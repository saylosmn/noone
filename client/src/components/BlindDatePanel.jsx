import { useState } from 'react';
const stages = ['questions', 'facts', 'flags', 'free'];
const titles = ['Асуулт', '5 факт', 'Green / red flag', 'Чөлөөт чат'];
const flagLabels = ['Миний green flag', 'Миний red flag', 'Ямар хүн сонирхдог вэ?', 'Ямар хүн сонирхдоггүй вэ?'];
const who = g => g === 'male' ? 'Эрэгтэй' : 'Эмэгтэй';
function Fields({ labels, onSubmit, disabled }) {
  const [values, setValues] = useState(labels.map(() => ''));
  const [busy, setBusy] = useState(false);
  return <form className="date-profile-form" onSubmit={async e => { e.preventDefault(); setBusy(true); try { await onSubmit(values); } finally { setBusy(false); } }}>
    {labels.map((label, i) => <label key={label}>{label}<textarea className="input" required maxLength={500} value={values[i]} onChange={e => setValues(v => v.map((x,j) => j === i ? e.target.value : x))} /></label>)}
    <button className="btn primary sm" disabled={disabled || busy || values.some(v => !v.trim())}>Хариултаа илгээх</button>
    <small>Илгээмэгц нөгөө хүнд харагдана. Хоёулаа илгээсний дараа автоматаар үргэлжилнэ.</small>
  </form>;
}
export function BlindDatePanel({ blind: d, actions, online }) {
  const index = stages.indexOf(d.stage);
  const turn = d.round % 2 === 0 ? 'male' : 'female';
  const q = d.rounds[d.round];
  const [busy, setBusy] = useState(false);
  const act = async (event, payload) => { setBusy(true); try { return await actions.dateAction(event, payload); } finally { setBusy(false); } };
  const answers = (values, labels) => ['male','female'].map(g => values[g] && <div className="date-answer" key={g}><strong>{who(g)}{g === d.me ? ' · Та' : ''}</strong>{values[g].map((v,i) => <p key={i}><b>{labels[i]}:</b> {v}</p>)}</div>);
  return <section className={`date-panel guided-date ${d.stage === 'free' ? 'is-free' : ''}`} aria-label="Blind date-ийн үе шат">
    <ol className="date-steps">{titles.map((title,i) => <li className={i <= index ? 'is-active' : ''} aria-current={i === index ? 'step' : undefined} key={title}><span>{i+1}</span>{title}</li>)}</ol>
    <div className="guided-body">
      <h2>{titles[index]}</h2>
      {d.stage === 'questions' && <>
        <p>{d.round+1}/4 · {who(turn)}н {Math.floor(d.round/2)+1}-р асуулт</p>
        {!q ? turn === d.me ? <div className="question-choices"><p>Хоёулаа хариулах асуултаа сонго:</p>{d.choices.map((text,i) => !d.rounds.some(r => r.question === text) && <button className="btn ghost" key={text} disabled={!online || busy} onClick={() => act('question', { question: i })}>{text}</button>)}</div> : <p role="status">Нөгөө хүн асуултаа сонгож байна…</p> : <>
          <blockquote>{q.question}</blockquote>
          {!q.answers[d.me] ? <Fields key={`round-${d.round}`} labels={['Таны хариулт']} disabled={!online} onSubmit={v => act('answer', { answer: v[0] })} /> : <p role="status">Хариултаа илгээлээ. Нөгөө хүнийг хүлээж байна…</p>}
        </>}
      </>}
      {['facts','flags'].includes(d.stage) && (!d[d.stage][d.me] ? <Fields key={d.stage} labels={d.stage === 'facts' ? [1,2,3,4,5].map(n => `Миний тухай факт ${n}`) : flagLabels} disabled={!online} onSubmit={values => act(d.stage, { values })} /> : <p role="status">Таны хариулт харагдаж байна. Нөгөө хүний хариултыг хүлээж байна…</p>)}
      {d.stage === 'free' && <div><p>Одоо хүссэнээрээ ярилцаарай. Доорх чатын талбарыг ашиглана.</p><button className="btn primary sm" disabled={!online || busy} onClick={() => act('finish', { ready: !d.finish[d.me] })}>{d.finish[d.me] ? 'Дуусгах хүсэлтээ буцаах' : 'Болзоог дуусгах'}</button><p role="status">{d.finish.male || d.finish.female ? 'Дуусгах хүсэлт ирсэн. Хоёулаа дарвал болзоо дуусна.' : 'Хоёулаа дуусгахыг зөвшөөрөх хүртэл чат үргэлжилнэ.'}</p></div>}
      <details className="date-history" open={d.stage !== 'free'}><summary>Хоёулангийн хариултууд</summary>
        {d.rounds.map((r,i) => <article key={i}><h3>{i+1}. {r.question}</h3>{answers(Object.fromEntries(Object.entries(r.answers).map(([g,v]) => [g,[v]])), ['Хариулт'])}</article>)}
        {answers(d.facts, [1,2,3,4,5].map(n => `Факт ${n}`))}
        {answers(d.flags, flagLabels)}
      </details>
    </div>
  </section>;
}
