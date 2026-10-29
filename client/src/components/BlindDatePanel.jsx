import { useState } from 'react';

const STAGES = [
  { id: 'icebreaker', label: 'Асуулт', next: 'Текст чат руу', hint: 'Доорх асуултаар яриагаа эхлүүлээрэй. Бэлэн болох үедээ дараагийн шатыг сонго.' },
  { id: 'text', label: 'Текст', next: 'Дуут ярианы шат руу', hint: 'Нэр, зураггүйгээр танилцаарай. Дуугаар ярилцах боломжийг хоёулаа зөвшөөрч нээнэ.' },
  { id: 'voice', label: 'Дуу', next: 'Нэр/зургийн шат руу', hint: 'Хүсвэл дуугаар ярь. Заавал залгахгүйгээр хоёулаа дараагийн шат руу шилжиж болно.' },
  { id: 'reveal', label: 'Нэр/зураг', next: 'Сошиалын шат руу', hint: 'Нэр/зураг илгээх нь заавал биш. Хоёулаа тус тус илгээсэн үед л харилцан харагдана.' },
  { id: 'connect', label: 'Сошиал', hint: 'Та хоёр бүх шатыг зөвшөөрлөө. Найз болох хүсэлтээр сошиал хаягаа тусдаа зөвшөөрч солилцоорой.' },
];

// Re-encode pixels to JPEG: bounded dimensions/size, no original EXIF metadata.
async function preparePhoto(file) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
    throw new Error('10 MB-аас жижиг JPG, PNG эсвэл WebP зураг сонгоно уу.');
  }
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 480 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.8, 0.6, 0.4, 0.2]) {
      const data = canvas.toDataURL('image/jpeg', quality);
      if (data.length <= 120000) return data;
    }
    throw new Error('Зураг хэт том байна. Өөр зураг сонгоно уу.');
  } finally { bitmap.close(); }
}

export function BlindDatePanel({ blind, actions, online, onCall, callBusy, onFriend }) {
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [name, setName] = useState(blind.mine?.name || '');
  const [photo, setPhoto] = useState(blind.mine?.photo || null);
  const [error, setError] = useState('');
  const index = STAGES.findIndex(s => s.id === blind.stage);
  const step = STAGES[index] || STAGES[0];
  const run = async (fn) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); } finally { setBusy(false); }
  };
  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(''); setPhotoBusy(true);
    try { setPhoto(await preparePhoto(file)); }
    catch (err) { setError(err.message || 'Зургийг уншиж чадсангүй.'); }
    finally { setPhotoBusy(false); e.target.value = ''; }
  };
  return (
    <section className="date-panel" aria-label="Blind date-ийн үе шат">
      <ol className="date-steps">
        {STAGES.map((s, i) => <li key={s.id} className={i <= index ? 'is-active' : ''} aria-current={i === index ? 'step' : undefined}><span>{i < index ? '✓' : i + 1}</span>{s.label}</li>)}
      </ol>
      <details className="date-content" key={blind.stage} open>
        <summary>💘 {index + 1}/5 · {step.label}<small>Хугацааны хязгааргүй</small></summary>
        <div className="date-body">
          <p>{step.hint}</p>
          {blind.stage === 'icebreaker' && <blockquote>{blind.question}</blockquote>}
          {blind.stage === 'voice' && (onCall
            ? <button type="button" className="btn sm ghost" disabled={!online || callBusy} onClick={onCall}>Дуугаар ярих</button>
            : <p className="hint">Энэ хөтөч дуудлага дэмжихгүй байна. Текстээр үргэлжлүүлж болно.</p>)}
          {blind.stage === 'reveal' && !blind.partnerProfile && (
            blind.profileOffered ? <div className="date-profile-wait" role="status">
              Нэр/зургаа илгээсэн. Нөгөө хүн бас илгээх хүртэл нууц байна.
              <button type="button" className="link-btn" disabled={!online || busy} onClick={() => run(() => actions.shareDateProfile({ cancel: true }))}>Илгээснээ цуцлах</button>
            </div> : <form className="date-profile-form" onSubmit={e => { e.preventDefault(); run(() => actions.shareDateProfile({ name, photo })); }}>
              <label>Харуулах нэр<input className="input" value={name} maxLength={40} onChange={e => setName(e.target.value)} placeholder="Нэр эсвэл хоч" required /></label>
              <label className="date-photo-pick">Зураг · заавал биш<input type="file" accept="image/jpeg,image/png,image/webp" disabled={photoBusy} onChange={pickPhoto} /></label>
              {photoBusy && <small role="status">Зургийг бэлдэж байна…</small>}
              {photo && <div className="date-photo-preview"><img src={photo} alt="Илгээх зургийн урьдчилсан харагдац" /><button type="button" className="link-btn" onClick={() => setPhoto(null)}>Зургийг хасах</button></div>}
              {error && <p className="form-error" role="alert">{error}</p>}
              <small>Зөвхөн хоёулаа илгээвэл харилцан харагдана. Нөгөө хүн зураг хуулж авч болно.</small>
              <button type="submit" className="btn sm primary" disabled={!online || busy || photoBusy || !name.trim()}>Нэр/зургаа зөвшөөрч илгээх</button>
            </form>
          )}
          {blind.partnerProfile && <div className="date-revealed">
            {blind.partnerProfile.photo && <img src={blind.partnerProfile.photo} alt={`${blind.partnerProfile.name}-ийн зөвшөөрч хуваалцсан зураг`} />}
            <span>Танилцсандаа таатай байна, <strong>{blind.partnerProfile.name}</strong>!</span>
          </div>}
          {index < STAGES.length - 1 ? <div className="date-next">
            <button type="button" className={`btn sm ${blind.ready ? 'ghost' : 'primary'}`} disabled={!online || busy} onClick={() => run(() => actions.advanceDate(!blind.ready))}>
              {blind.ready ? 'Зөвшөөрлөө буцаах' : step.next}
            </button>
            <small role="status">{blind.ready ? 'Таны сонголт нууц. Хоёулаа зөвшөөрвөл шилжинэ.' : 'Хоёулаа зөвшөөрвөл дараагийн шат нээгдэнэ.'}</small>
          </div> : <button type="button" className="btn sm primary" disabled={!online} onClick={onFriend}>Найз болох</button>}
        </div>
      </details>
    </section>
  );
}
