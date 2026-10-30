import { useEffect, useRef, useState } from 'react';
import { apiUrl, friendToken } from '../lib/socket.js';
import './FriendsInbox.css';
async function request(path='', method='GET', body) {
  const res=await fetch(apiUrl('/api/friends'+path),{method,headers:{Authorization:`Bearer ${friendToken()}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)});
  if(!res.ok) throw new Error(res.status===503?'Найз хадгалах үйлчилгээ бэлэн биш байна.':'Хүсэлт амжилтгүй. Дахин оролдоно уу.');
  return res.json();
}
export function FriendsInbox() {
  const [open,setOpen]=useState(false),[items,setItems]=useState([]),[selected,setSelected]=useState(null),[messages,setMessages]=useState([]),[draft,setDraft]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState(null);
  const generation=useRef(0),pending=useRef(null),dialog=useRef(null),trigger=useRef(null);
  const unread=items.reduce((n,f)=>n+f.unread,0);
  useEffect(()=>{
    let live=true;
    const load=async()=>{if(document.hidden)return;try{const data=await request();if(live)setItems(data.items);}catch(e){if(live&&open)setError(e.message);}};
    load();const timer=setInterval(load,open?5000:20000);return()=>{live=false;clearInterval(timer);};
  },[open]);
  useEffect(()=>{
    const current=++generation.current;setMessages([]);setDraft('');pending.current=null;setConfirm(null);setError('');
    if(!open||!selected)return;
    const load=async()=>{if(document.hidden)return;try{const data=await request('/'+selected.id);if(generation.current!==current)return;setMessages(data.messages);setError('');const seq=data.messages.at(-1)?.seq||0;await request('/'+selected.id+'/seen','POST',{seq});if(generation.current===current)setItems(v=>v.map(f=>f.id===selected.id?{...f,unread:0}:f));}catch(e){if(generation.current===current)setError(e.message);}};
    load();const timer=setInterval(load,3000);return()=>{generation.current++;clearInterval(timer);};
  },[selected?.id,open]);
  useEffect(()=>{if(open)dialog.current?.showModal();else dialog.current?.close();},[open]);
  const close=()=>{setOpen(false);trigger.current?.focus();};
  const send=async e=>{e.preventDefault();if(busy||!draft.trim())return;const id=selected.id;setBusy(true);setError('');
    if(!pending.current||pending.current.text!==draft.trim())pending.current={id:'u_'+[...crypto.getRandomValues(new Uint8Array(16))].map(b=>b.toString(16).padStart(2,'0')).join(''),text:draft.trim()};
    try{await request('/'+id+'/messages','POST',pending.current);setDraft('');pending.current=null;const data=await request('/'+id);setMessages(data.messages);}catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const remove=async()=>{setBusy(true);try{await request('/'+selected.id+(confirm==='block'?'?block=true':''),'DELETE');setItems(v=>v.filter(f=>f.id!==selected.id));setSelected(null);setConfirm(null);}catch(e){setError(e.message);}finally{setBusy(false);}};
  return <>
    <button ref={trigger} className="friends-launch" onClick={()=>setOpen(true)}>Найзууд {unread>0&&<b>{unread}</b>}</button>
    <dialog ref={dialog} className="friends-dialog" onCancel={e=>{e.preventDefault();close();}} aria-label="Найзуудын чат">
      <header><button disabled={busy} onClick={()=>setSelected(null)}>Найзууд</button><strong>{selected?.contact?.handle||'Миний найзууд'}</strong><button aria-label="Хаах" onClick={close}>✕</button></header>
      <p className="friends-note">Энэ хөтөч дээр хадгалагдана. Хөтчийн өгөгдлөө цэвэрлэвэл хандах эрх алдагдана. Найзын чатны сүүлийн 200 мессеж хадгалагдана.</p>
      {error&&<p role="alert" className="friends-error">{error}</p>}
      {!selected?<div className="friends-list">{!items.length&&<p>Найз хараахан алга. Чат дотор хоёулаа «Найз болох»-ыг зөвшөөрвөл энд хадгалагдана.</p>}{items.map(f=><button key={f.id} onClick={()=>setSelected(f)}><span>{f.contact?.handle||'Нууц нэгэн'}<small>{f.contact?.platform}</small></span>{f.unread>0&&<b>{f.unread} шинэ</b>}</button>)}</div>:<>
        <div className="friends-tools"><button disabled={busy} onClick={()=>setConfirm('remove')}>Найзаас хасах</button><button disabled={busy} onClick={()=>setConfirm('block')}>Блоклох</button></div>
        {confirm&&<div className="friends-confirm"><p>{confirm==='block'?'Блокловол дахин найз болж, мессеж илгээж чадахгүй.':'Найзыг хоёр талын жагсаалтаас хасаж, энэ чатны түүхийг устгана.'}</p><button disabled={busy} onClick={remove}>Баталгаажуулах</button><button disabled={busy} onClick={()=>setConfirm(null)}>Болих</button></div>}
        <div className="friends-messages" role="log" aria-label="Найзын мессежүүд">{!messages.length&&<p>Мэнд мэдээд эхлээрэй!</p>}{messages.map(m=><div key={m.id} className={m.mine?'mine':''}><p>{m.text}</p><small>{new Date(m.ts).toLocaleTimeString('mn-MN',{hour:'2-digit',minute:'2-digit'})}</small></div>)}</div>
        <form onSubmit={send}><textarea aria-label="Найздаа мессеж бичих" placeholder="Мессеж бичих…" maxLength={1000} value={draft} onChange={e=>setDraft(e.target.value)} disabled={busy}/><button disabled={busy||!draft.trim()}>{busy?'Илгээж байна…':'Илгээх'}</button></form>
      </>}
    </dialog>
  </>;
}
