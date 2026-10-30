import { useEffect, useRef, useState } from 'react';
import { apiUrl, friendToken } from '../lib/socket.js';
import './FriendsInbox.css';
function ChatIcon({kind='chat'}) {
  const paths={chat:'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9H13a8.5 8.5 0 0 1 8 8v.5Z',search:'m21 21-4.4-4.4M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0',send:'m5 12 7-7 7 7M12 5v14',back:'m15 18-6-6 6-6',close:'m6 6 12 12M6 18 18 6'};
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]}/></svg>;
}
async function request(path='', method='GET', body) {
  const res=await fetch(apiUrl('/api/friends'+path),{method,headers:{Authorization:`Bearer ${friendToken()}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)});
  if(!res.ok) throw new Error(res.status===503?'Найз хадгалах үйлчилгээ бэлэн биш байна.':'Хүсэлт амжилтгүй. Дахин оролдоно уу.');
  return res.json();
}
export function FriendsInbox() {
  const [open,setOpen]=useState(false),[items,setItems]=useState([]),[selected,setSelected]=useState(null),[messages,setMessages]=useState([]),[draft,setDraft]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState(null);
  const generation=useRef(0),pending=useRef(null),dialog=useRef(null),trigger=useRef(null),messageList=useRef(null),followBottom=useRef(true);
  const [menu,setMenu]=useState(false),[loading,setLoading]=useState(false);
  const [search,setSearch]=useState(''),[away,setAway]=useState(false);
  const name=selected?.contact?.handle||'Нууц нэгэн';
  const time=ts=>new Date(ts).toLocaleTimeString('mn-MN',{hour:'2-digit',minute:'2-digit'});
  const day=ts=>new Date(ts).toLocaleDateString('mn-MN',{month:'short',day:'numeric'});
  const unread=items.reduce((n,f)=>n+f.unread,0);
  useEffect(()=>{
    let live=true;
    const load=async()=>{if(document.hidden)return;try{const data=await request();if(live)setItems(data.items);}catch(e){if(live&&open)setError(e.message);}};
    load();const timer=setInterval(load,open?5000:20000);return()=>{live=false;clearInterval(timer);};
  },[open]);
  useEffect(()=>{
    const current=++generation.current;setMessages([]);setDraft('');pending.current=null;setConfirm(null);setError('');setMenu(false);setAway(false);followBottom.current=true;setLoading(Boolean(open&&selected));
    if(!open||!selected)return;
    const load=async()=>{if(document.hidden)return;try{const data=await request('/'+selected.id);if(generation.current!==current)return;setMessages(data.messages);setError('');const seq=data.messages.at(-1)?.seq||0;await request('/'+selected.id+'/seen','POST',{seq});if(generation.current===current)setItems(v=>v.map(f=>f.id===selected.id?{...f,unread:0}:f));}catch(e){if(generation.current===current)setError(e.message);}finally{if(generation.current===current)setLoading(false);}};
    load();const timer=setInterval(load,3000);return()=>{generation.current++;clearInterval(timer);};
  },[selected?.id,open]);
  useEffect(()=>{if(open)dialog.current?.showModal();else dialog.current?.close();},[open]);
  useEffect(()=>{const el=messageList.current;if(el&&followBottom.current)el.scrollTop=el.scrollHeight;},[messages]);
  const close=()=>{setOpen(false);trigger.current?.focus();};
  const send=async e=>{e.preventDefault();if(busy||!draft.trim())return;const id=selected.id;setBusy(true);setError('');
    if(!pending.current||pending.current.text!==draft.trim())pending.current={id:'u_'+[...crypto.getRandomValues(new Uint8Array(16))].map(b=>b.toString(16).padStart(2,'0')).join(''),text:draft.trim()};
    const current=generation.current;
    try{await request('/'+id+'/messages','POST',pending.current);if(current!==generation.current)return;setDraft('');pending.current=null;const data=await request('/'+id);if(current===generation.current){followBottom.current=true;setMessages(data.messages);}}catch(e){if(current===generation.current)setError(e.message);}finally{setBusy(false);}
  };
  const remove=async()=>{setBusy(true);try{await request('/'+selected.id+(confirm==='block'?'?block=true':''),'DELETE');setItems(v=>v.filter(f=>f.id!==selected.id));setSelected(null);setConfirm(null);}catch(e){setError(e.message);}finally{setBusy(false);}};
  return <>
    <button ref={trigger} className="friends-launch" onClick={()=>setOpen(true)}><ChatIcon/> Найзууд {unread>0&&<b>{unread}</b>}</button>
    <dialog ref={dialog} className="friends-dialog" onCancel={e=>{e.preventDefault();close();}} aria-label="Найзуудын чат">
      <header className="friends-header">
        {selected&&<button className="friends-icon" aria-label="Найзууд руу буцах" disabled={busy} onClick={()=>setSelected(null)}><ChatIcon kind="back"/></button>}
        <span className="friends-avatar" aria-hidden="true">{selected?Array.from(name)[0].toUpperCase():'♡'}</span>
        <div className="friends-heading"><strong>{selected?name:'Миний найзууд'}</strong><small>{selected?'Та хоёрын яриа':`${items.length} найз · Дахин холбогдоорой`}</small></div>
        {selected&&<button className="friends-icon" aria-label="Чатны сонголтууд" aria-expanded={menu} onClick={()=>setMenu(v=>!v)}>•••</button>}
        <button className="friends-icon" aria-label="Хаах" onClick={close}><ChatIcon kind="close"/></button>
      </header>
      {!selected&&<details className="friends-note"><summary>Хадгалалтын тухай</summary>Энэ хөтөч дээр хадгалагдана. Хөтчийн өгөгдлөө цэвэрлэвэл хандах эрх алдагдана. Найзын чатны сүүлийн 200 мессеж хадгалагдана.</details>}
      {error&&<p role="alert" className="friends-error">{error}</p>}
      {!selected&&<div className="friends-search"><ChatIcon kind="search"/><input aria-label="Найзаа хайх" placeholder="Найзаа хайх…" value={search} onChange={e=>setSearch(e.target.value)}/></div>}
      {!selected?<div className="friends-list">{items.length>0&&!items.some(f=>(f.contact?.handle||'Нууц нэгэн').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))&&<div className="friends-empty"><strong>Найз олдсонгүй</strong><p>Өөр нэрээр хайгаад үзээрэй.</p></div>}{!items.length&&<div className="friends-empty"><span>♡</span><strong>Танилцаад, найз болоорой</strong><p>Чат дотор хоёулаа «Найз болох»-ыг зөвшөөрвөл энд хадгалагдана.</p></div>}{items.filter(f=>(f.contact?.handle||'Нууц нэгэн').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).map(f=><button key={f.id} onClick={()=>setSelected(f)}><span className="friends-avatar" aria-hidden="true">{Array.from(f.contact?.handle||'Н')[0].toUpperCase()}</span><span className="friends-person">{f.contact?.handle||'Нууц нэгэн'}<small>{f.unread?'Шинэ мессеж ирсэн':'Яриагаа үргэлжлүүлэх'}</small></span><span className="friends-list-meta"><small>{day(f.at)}</small>{f.unread>0&&<b>{f.unread}</b>}</span></button>)}</div>:<>
        {menu&&<div className="friends-tools"><button disabled={busy} onClick={()=>{setConfirm('remove');setMenu(false);}}>Найзаас хасах</button><button disabled={busy} onClick={()=>{setConfirm('block');setMenu(false);}}>Блоклох</button></div>}
        {confirm&&<div className="friends-confirm"><p>{confirm==='block'?'Блокловол дахин найз болж, мессеж илгээж чадахгүй.':'Найзыг хоёр талын жагсаалтаас хасаж, энэ чатны түүхийг устгана.'}</p><button disabled={busy} onClick={remove}>Баталгаажуулах</button><button disabled={busy} onClick={()=>setConfirm(null)}>Болих</button></div>}
        <div ref={messageList} className="friends-messages" role="log" aria-label="Найзын мессежүүд" aria-busy={loading} onScroll={e=>{const el=e.currentTarget;followBottom.current=el.scrollHeight-el.scrollTop-el.clientHeight<80;setAway(!followBottom.current);}}>
          {!messages.length&&<div className="friends-empty"><span>✦</span><strong>{loading?'Яриаг ачаалж байна…':'Яриа эндээс эхэлнэ'}</strong><p>{loading?'Түр хүлээгээрэй':`${name}-д мэнд мэдээд эхлээрэй.`}</p></div>}
          {messages.map((m,i)=><div key={m.id} className="friends-message-group">
            {(i===0||new Date(messages[i-1].ts).toDateString()!==new Date(m.ts).toDateString())&&<div className="friends-day">{day(m.ts)}</div>}
            <div className={`friends-bubble${m.mine?' mine':''}`}><p>{m.text}</p><time dateTime={new Date(m.ts).toISOString()}>{time(m.ts)}</time></div>
          </div>)}
        </div>
        {away&&messages.length>0&&<button className="friends-jump" onClick={()=>{followBottom.current=true;setAway(false);messageList.current?.scrollTo({top:messageList.current.scrollHeight,behavior:'smooth'});}}>Сүүлийн мессеж ↓</button>}
        <form className="friends-composer" onSubmit={send}><textarea onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing&&window.matchMedia('(pointer:fine)').matches){e.preventDefault();send(e);}}} rows={2} aria-label="Найздаа мессеж бичих" placeholder="Мессеж бичих…" maxLength={1000} value={draft} onChange={e=>setDraft(e.target.value)} disabled={busy}/><button aria-label={busy?'Илгээж байна':'Мессеж илгээх'} disabled={busy||!draft.trim()}>{busy?<span className="friends-sending"/>:<ChatIcon kind="send"/>}</button><small>Сүүлийн 200 мессеж хадгалагдана<span>{draft.length}/1000</span></small></form>
      </>}
    </dialog>
  </>;
}
