import express from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { maskProfanity } from './profanity.js';
const hash = s => createHash('sha256').update(s).digest('hex');
export const friendIdentity = token => typeof token === 'string' && /^[a-f0-9]{64}$/.test(token) ? hash(token) : null;
export function createFriends(kv) {
  const key = 'noone:friends:v1';
  let tail = Promise.resolve();
  const enabled = kv.kind !== 'memory';
  // One backend instance, serialized read/modify/write; never acknowledge failed writes.
  const transact = fn => {
    const job = tail.then(async () => {
      if (!enabled) throw new Error('friends_unavailable');
      const db = await kv.get(key) || { pairs: {} };
      const result = await fn(db);
      if (result.write) await kv.set(key, db);
      return result.value;
    });
    tail = job.catch(() => {}); return job;
  };
  const pairId = (a,b) => hash([a,b].sort().join(':'));
  async function save(a,b,contactA,contactB) {
    if (!a || !b || a === b) throw new Error('friends_identity');
    return transact(db => {
      const id = pairId(a,b), existing = db.pairs[id];
      if (existing?.blocked) throw new Error('friend_blocked');
      if (!existing) {
        if (Object.values(db.pairs).filter(p => p.members.includes(a)).length >= 100 || Object.values(db.pairs).filter(p => p.members.includes(b)).length >= 100) throw new Error('friends_limit');
        db.pairs[id] = { id, members:[a,b], contacts:{[a]:contactA,[b]:contactB}, messages:[], seen:{[a]:0,[b]:0}, at:Date.now() };
      }
      return { write:!existing, value:id };
    });
  }
  const router = express.Router();
  router.use(express.json({limit:'8kb'}));
  router.use((req,res,next) => {
    req.identity = friendIdentity(req.get('authorization')?.replace(/^Bearer /,''));
    if (!req.identity) return res.status(401).json({error:'unauthorized'});
    if (!enabled) return res.status(503).json({error:'friends_unavailable'});
    next();
  });
  const route = fn => async (req,res) => { try { res.json(await transact(db => fn(req,db))); } catch(e) { res.status(e.message === 'not_found' ? 404 : e.message === 'rate_limited' ? 429 : e.message === 'invalid' ? 400 : 503).json({error:e.message === 'not_found' || e.message === 'rate_limited' || e.message === 'invalid' ? e.message : 'storage'}); } };
  const member = (req,db) => { const p=db.pairs[req.params.id]; if (!p || p.blocked || !p.members.includes(req.identity)) throw new Error('not_found'); return p; };
  router.get('/', route((req,db) => ({value:{items:Object.values(db.pairs).filter(p=>!p.blocked && p.members.includes(req.identity)).map(p=>({id:p.id,contact:p.contacts[p.members.find(x=>x!==req.identity)],unread:p.messages.filter(m=>m.from!==req.identity && m.seq>(p.seen[req.identity]||0)).length,at:p.messages.at(-1)?.ts||p.at})).sort((a,b)=>b.at-a.at)}})));
  router.get('/:id', route((req,db) => { const p=member(req,db); return {value:{messages:p.messages.map(m=>({id:m.id,seq:m.seq,text:m.text,ts:m.ts,mine:m.from===req.identity}))}}; }));
  router.post('/:id/seen', route((req,db) => { const p=member(req,db); const seq=Number(req.body.seq); if(!Number.isInteger(seq)||seq<0||seq>(p.sequence||0)) throw new Error('invalid'); p.seen[req.identity]=Math.max(p.seen[req.identity]||0,seq); return {write:true,value:{ok:true}}; }));
  router.post('/:id/messages', route((req,db) => {
    const p=member(req,db); const text=typeof req.body.text==='string'?req.body.text.trim():'';
    if(!text||[...text].length>1000||!/^u_[a-f0-9]{32}$/.test(req.body.id||'')) throw new Error('invalid');
    const existing=p.messages.find(m=>m.id===req.body.id && m.from===req.identity); if(existing) return {value:{ok:true}};
    if(p.messages.filter(m=>m.from===req.identity && Date.now()-m.ts<10000).length>=10) throw new Error('rate_limited');
    p.sequence=(p.sequence||0)+1;
    p.messages.push({id:req.body.id,seq:p.sequence,from:req.identity,text:maskProfanity(text).text,ts:Date.now()});
    p.messages=p.messages.slice(-200);
    return {write:true,value:{ok:true}};
  }));
  router.delete('/:id', route((req,db) => { const p=member(req,db); if(req.query.block==='true') db.pairs[p.id]={id:p.id,members:p.members,blocked:true}; else delete db.pairs[p.id]; return {write:true,value:{ok:true}}; }));
  return {router,save,enabled};
}
