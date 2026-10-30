import { useState } from 'react';
import './BlindDateLayout.css';
const stages = ['questions', 'facts', 'flags', 'free'];
const titles = ['Асуулт', '5 факт', 'Green / red flag', 'Чөлөөт чат'];
const factLabels = [1,2,3,4,5].map(n => `Миний тухай факт ${n}`);
const flagLabels = ['Миний green flag', 'Миний red flag', 'Ямар хүн сонирхдог вэ?', 'Ямар хүн сонирхдоггүй вэ?'];
const who = g => g === 'male' ? 'Эрэгтэй' : 'Эмэгтэй';
function Fields({ labels, onSubmit, disabled }) {
  const [values, setValues] = useState(labels.map(() => ''));
  const [busy, setBusy] = useState(false);
  return <form className="guided-answer-form" onSubmit={async e => { e.preventDefault(); if (busy) return; setBusy(true); try { await onSubmit(values); } finally { setBusy(false); } }}>
    <div className={`guided-fields ${labels.length > 1 ? 'is-multiple' : ''}`}>
      {labels.map((label, i) => <label className="guided-field" key={label}><span>{label}</span><textarea required maxLength={500} rows={3} disabled={disabled || busy} placeholder={labels.length === 1 ? 'Бодлоо энд бичээрэй…' : 'Өөрийнхөөрөө хариулаарай…'} value={values[i]} onChange={e => setValues(v => v.map((x,j) => j === i ? e.target.value : x))} /><small>{values[i].length}/500</small></label>)}
    </div>
    <div className="guided-submit"><p>Илгээсэн хариулт нөгөө хүнд шууд харагдана.</p><button className="btn primary" disabled={disabled || busy || values.some(v => !v.trim())}>{busy ? 'Илгээж байна…' : 'Хариултаа илгээх'}</button></div>
  </form>;
}
function AnswerPair({ values, labels, me }) {
  const other = me === 'male' ? 'female' : 'male';
  const [selected, setSelected] = useState(null);
  const active = selected || (values[other] ? other : me);
  if (!Object.keys(values).length) return null;
  return <div className="guided-responses">
    <div className="guided-response-switch" role="group" aria-label="Хэний хариултыг харах вэ?">
      {[me, other].map(g => <button type="button" key={g} aria-pressed={active === g} onClick={() => setSelected(g)}>
        <span>{g === me ? 'Миний хариулт' : 'Нууц нэгэн'}</span><small>{values[g] ? '✓ Илгээсэн' : 'Хүлээж байна'}</small>
      </button>)}
    </div>
    <div className="guided-answer-pair">{[me, other].map(g => <article className={`guided-person ${g === me ? 'is-mine' : ''} ${active === g ? 'is-selected' : ''}`} key={g}>
      <header><span className="guided-person-dot" />{g === me ? 'Таны хариулт' : 'Нууц нэгний хариулт'}<small>{values[g] ? 'Илгээсэн' : 'Хүлээж байна'}</small></header>
      {values[g] ? <dl>{values[g].map((value,i) => <div key={i}>{labels.length > 1 && <dt>{labels[i]}</dt>}<dd>{value}</dd></div>)}</dl> : <p className="guided-wait">Хариулт хараахан илгээгээгүй байна.</p>}
    </article>)}</div>
  </div>;
}
const roundValues = q => Object.fromEntries(Object.entries(q.answers).map(([g,v]) => [g,[v]]));
export function BlindDatePanel({ blind: d, actions, online }) {
  const index = stages.indexOf(d.stage), turn = d.round % 2 === 0 ? 'male' : 'female', q = d.rounds[d.round];
  const [busy, setBusy] = useState(false);
  const act = async (event, payload) => { setBusy(true); try { return await actions.dateAction(event, payload); } finally { setBusy(false); } };
  const previous = d.rounds.filter((r,i) => (d.stage !== 'questions' || i < d.round) && Object.keys(r.answers).length);
  const previousFacts = d.stage !== 'facts' && Object.keys(d.facts).length > 0;
  const previousFlags = d.stage === 'free' && Object.keys(d.flags).length > 0;
  const hasHistory = previous.length > 0 || previousFacts || previousFlags;
  return <section className={`date-panel guided-date date-layout ${d.stage === 'free' ? 'is-free' : ''}`} aria-label="Blind date-ийн үе шат">
    <ol className="date-steps">{titles.map((title,i) => <li className={i <= index ? 'is-active' : ''} aria-current={i === index ? 'step' : undefined} key={title}><span>{i < index ? '✓' : i+1}</span>{title}</li>)}</ol>
    <div className="guided-body">
      <div className="guided-section-heading"><div><p className="guided-kicker">ТАНИЛЦАХ АЛХАМ {index+1} / 4</p><h2>{titles[index]}</h2></div>{d.stage === 'questions' && <span className="guided-count">{d.round+1} / 4 асуулт</span>}</div>
      <div className="guided-current">
        {d.stage === 'questions' && <>
          <p className="guided-turn">{turn === d.me ? 'Таны' : `${who(turn)}н`} {Math.floor(d.round/2)+1}-р асуулт</p>
          {!q ? turn === d.me ? <div className="question-choices"><p>Хоёулаа хариулах асуултаа сонгоорой.</p>{d.choices.map((text,i) => !d.rounds.some(r => r.question === text) && <button className="btn ghost" key={text} disabled={!online || busy} onClick={() => act('question', { question: i })}>{text}<span aria-hidden="true">↗</span></button>)}</div> : <p className="guided-status" role="status">Нууц нэгэн асуултаа сонгож байна…</p> : <>
            <h3 className="guided-question">{q.question}</h3>
            {!q.answers[d.me] ? <Fields key={`round-${d.round}`} labels={['Таны хариулт']} disabled={!online} onSubmit={v => act('answer', { answer: v[0] })} /> : <p className="guided-status" role="status">✓ Хариултаа илгээлээ. Хоёулаа хариулсны дараа үргэлжилнэ.</p>}
            <AnswerPair values={roundValues(q)} labels={['Хариулт']} me={d.me} />
          </>}
        </>}
        {['facts','flags'].includes(d.stage) && <>
          <p className="guided-turn">{d.stage === 'facts' ? 'Таныг илэрхийлэх таван жижиг зүйл' : 'Харилцаанд чухал гэж үздэг зүйлсээ хуваалцаарай'}</p>
          {!d[d.stage][d.me] ? <Fields key={d.stage} labels={d.stage === 'facts' ? factLabels : flagLabels} disabled={!online} onSubmit={values => act(d.stage, { values })} /> : <p className="guided-status" role="status">✓ Илгээлээ. Нөгөө хүний хариултыг хүлээж байна…</p>}
          <AnswerPair values={d[d.stage]} labels={d.stage === 'facts' ? factLabels : flagLabels} me={d.me} />
        </>}
        {d.stage === 'free' && <div><p>Одоо хүссэнээрээ ярилцаарай.</p><button className="btn primary sm" disabled={!online || busy} onClick={() => act('finish', { ready: !d.finish[d.me] })}>{d.finish[d.me] ? 'Дуусгах хүсэлтээ буцаах' : 'Болзоог дуусгах'}</button><p className="guided-turn" role="status">{d.finish.male || d.finish.female ? 'Дуусгах хүсэлт ирсэн. Хоёулаа дарвал болзоо дуусна.' : 'Хоёулаа зөвшөөрөх хүртэл чат үргэлжилнэ.'}</p></div>}
      </div>
      {hasHistory && <details className="guided-history"><summary>Өмнөх хариултууд <span>{previous.length + Number(previousFacts) + Number(previousFlags)} хэсэг</span></summary>
        {previous.map((r,i) => <details className="guided-history-item" key={i}><summary><span className="guided-history-number">{i+1}</span>{r.question}</summary><AnswerPair values={roundValues(r)} labels={['Хариулт']} me={d.me} /></details>)}
        {previousFacts && <details className="guided-history-item"><summary>Өөрийн тухай 5 факт</summary><AnswerPair values={d.facts} labels={factLabels} me={d.me} /></details>}
        {previousFlags && <details className="guided-history-item"><summary>Green / red flag</summary><AnswerPair values={d.flags} labels={flagLabels} me={d.me} /></details>}
      </details>}
    </div>
  </section>;
}
