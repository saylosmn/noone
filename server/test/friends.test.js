import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createFriends, friendIdentity } from '../src/friends.js';

test('saved friends survive service recreation; private inbox, idempotent messages, seen and block', async t => {
 const values=new Map();const kv={kind:'file',get:async k=>structuredClone(values.get(k)||null),set:async(k,v)=>values.set(k,structuredClone(v))};
 const a='a'.repeat(64),b='b'.repeat(64),stranger='c'.repeat(64);
 const service=createFriends(kv);
 const id=await service.save(friendIdentity(a),friendIdentity(b),{handle:'A',platform:'instagram'},{handle:'B',platform:'instagram'});
 const restarted=createFriends(kv),app=express();app.use('/friends',restarted.router);
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const req=async(token,path='',method='GET',body)=>{const res=await fetch(`http://127.0.0.1:${server.address().port}/friends${path}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:res.status,data:await res.json()};};
 assert.equal((await req(a)).data.items[0].contact.handle,'B');
 assert.equal((await req(stranger,'/'+id)).status,404);
 assert.equal((await req('bad')).status,401);
 const message={id:'u_'+'d'.repeat(32),text:'Hello friend'};
 assert.equal((await req(a,'/'+id+'/messages','POST',message)).status,200);
 await req(a,'/'+id+'/messages','POST',message);
 assert.equal((await req(b,'/'+id)).data.messages.length,1);
 assert.equal((await req(b)).data.items[0].unread,1);
 assert.equal((await req(stranger,'/'+id+'/messages','POST',message)).status,404);
 await req(b,'/'+id+'/seen','POST',{seq:1});assert.equal((await req(b)).data.items[0].unread,0);
 await req(b,'/'+id+'?block=true','DELETE');
 assert.equal((await req(a)).data.items.length,0);
 assert.equal((await req(a,'/'+id+'/messages','POST',message)).status,404);
 await assert.rejects(()=>restarted.save(friendIdentity(a),friendIdentity(b),{},{}),/friend_blocked/);
});
test('ephemeral storage cannot pretend to save a friend', async()=>{
 const service=createFriends({kind:'memory'});assert.equal(service.enabled,false);
 await assert.rejects(()=>service.save('a','b',{},{}),/friends_unavailable/);
});
