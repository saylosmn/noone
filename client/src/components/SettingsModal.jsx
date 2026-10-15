import { Modal } from './Modal.jsx';
import { Icon } from './Icon.jsx';

function Toggle({ label, description, checked, onChange, disabled }) {
  return (
    <label className={`toggle-row ${disabled ? 'is-disabled' : ''}`}>
      <span className="toggle-text">
        <span className="toggle-label">{label}</span>
        {description && <span className="toggle-desc">{description}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch" aria-hidden="true" />
    </label>
  );
}

const PERMISSION_TEXT = {
  granted: { label: 'Зөвшөөрсөн', tone: 'ok' },
  default: { label: 'Асуугаагүй', tone: 'muted' },
  denied: { label: 'Хориглосон', tone: 'bad' },
  unsupported: { label: 'Дэмжихгүй', tone: 'bad' },
};

export function SettingsModal({
  open,
  onClose,
  settings,
  update,
  permission,
  onEnableNotifications,
  onTestNotification,
  swStatus,
  pushConfig,
  pushState,
  onTogglePush,
  nickname,
  onReroll,
  canReroll,
}) {
  const perm = PERMISSION_TEXT[permission] || PERMISSION_TEXT.default;
  const pushAvailable = pushConfig?.enabled && swStatus === 'ready' && pushState !== 'unsupported';

  return (
    <Modal open={open} onClose={onClose} title="Тохиргоо" size="lg">
      <section className="settings-section">
        <h3>Мэдэгдэл</h3>
        <div className="perm-row">
          <div>
            <div className="toggle-label">Хөтчийн мэдэгдлийн зөвшөөрөл</div>
            <span className={`status-badge ${perm.tone}`}>{perm.label}</span>
          </div>
          {permission === 'default' && (
            <button type="button" className="btn sm primary" onClick={onEnableNotifications}>
              <Icon name="bell" size={16} /> Мэдэгдэл асаах
            </button>
          )}
          {permission === 'granted' && (
            <button type="button" className="btn sm ghost" onClick={onTestNotification}>
              Туршиж үзэх
            </button>
          )}
        </div>
        {permission === 'denied' && (
          <p className="callout warn">
            Та энэ сайтын мэдэгдлийг хөтөч дээрээ хориглосон байна. Хаягийн мөрний 🔒 дүрс → “Notifications/Мэдэгдэл” →
            “Allow/Зөвшөөрөх” болгоод хуудсаа дахин ачаална уу.
          </p>
        )}
        {permission === 'unsupported' && (
          <p className="callout warn">
            Таны хөтөч мэдэгдэл дэмжихгүй байна. iPhone дээр бол Safari → Share → “Add to Home Screen” хийж нүүр
            дэлгэцээс нээнэ үү. Дуу болон уншаагүй тоо ажилласаар байна.
          </p>
        )}
        <Toggle
          label="Чатны мэдэгдэл"
          description="Өөр tab дээр байхад “Шинэ мессеж ирлээ” гэж мэдэгдэнэ. Мессежийн агуулгыг хэзээ ч харуулахгүй."
          checked={settings.notifications}
          onChange={(v) => update({ notifications: v })}
        />
        {settings.notifications && permission === 'default' && (
          <p className="hint">Мэдэгдэл ажиллахын тулд дээрх “Мэдэгдэл асаах” товчоор зөвшөөрөл өгнө үү.</p>
        )}
        <Toggle
          label="Дуу"
          description="Шинэ мессеж ирэхэд богино дуу гаргана."
          checked={settings.sound}
          onChange={(v) => update({ sound: v })}
        />
        <Toggle
          label="Яриа эхлүүлэх санаа"
          description="Чимээгүй болоход богино асуулт санал болгоно."
          checked={settings.icebreakers}
          onChange={(v) => update({ icebreakers: v })}
        />
      </section>

      <section className="settings-section">
        <h3>Web Push (tab хаалттай үед)</h3>
        <div className="kv">
          <span>Service worker</span>
          <span className={`status-badge ${swStatus === 'ready' ? 'ok' : swStatus === 'pending' ? 'muted' : 'bad'}`}>
            {{ ready: 'Бүртгэгдсэн', pending: 'Ачаалж байна', unsupported: 'Дэмжихгүй', error: 'Алдаа' }[swStatus]}
          </span>
        </div>
        <div className="kv">
          <span>Серверийн Push түлхүүр (VAPID)</span>
          <span className={`status-badge ${pushConfig?.enabled ? 'ok' : 'bad'}`}>
            {pushConfig ? (pushConfig.enabled ? 'Тохируулсан' : 'Байхгүй') : 'Шалгаж байна'}
          </span>
        </div>
        {pushConfig && !pushConfig.enabled && (
          <p className="callout warn">
            <strong>Web Push одоогоор ажиллахгүй.</strong> Серверт VAPID түлхүүр (<code>VAPID_PUBLIC_KEY</code>,{' '}
            <code>VAPID_PRIVATE_KEY</code>) тохируулаагүй тул tab хаалттай үед мэдэгдэл ирэхгүй. Tab нээлттэй үеийн
            мэдэгдэл, дуу хэвийн ажиллана. Админ <code>npm run vapid</code> командаар түлхүүр үүсгэж серверийн орчны
            хувьсагчид нэмнэ.
          </p>
        )}
        {pushAvailable && (
          <Toggle
            label="Web Push идэвхжүүлэх"
            description={
              pushState === 'error'
                ? 'Бүртгэл амжилтгүй боллоо. Дахин оролдоно уу.'
                : 'Tab-аа нуусан ч “Шинэ мессеж ирлээ” мэдэгдэл ирнэ. Бүртгэл зөвхөн энэ сессийн хугацаанд санах ойд байна.'
            }
            checked={settings.pushOptIn && pushState === 'on'}
            disabled={pushState === 'working' || permission === 'denied'}
            onChange={onTogglePush}
          />
        )}
      </section>

      <section className="settings-section">
        <h3>Нууцлал</h3>
        <div className="kv">
          <span>
            Таны түр нэр: <strong>{nickname || '…'}</strong>
          </span>
          <button type="button" className="btn sm ghost" onClick={onReroll} disabled={!canReroll}>
            <Icon name="dice" size={16} /> Солих
          </button>
        </div>
        {!canReroll && <p className="hint">Чатлаж байх үед нэр солих боломжгүй.</p>}
        <ul className="privacy-list">
          <li>Бүртгэл, нэр, утас, байршил шаардахгүй. Tab бүрт санамсаргүй түр ID өгнө.</li>
          <li>Мессежийг серверт хадгалдаггүй — зөвхөн нөгөө хүн рүү дамжуулна. Чат дуусахад танай төхөөрөмж дээрээс ч арилна.</li>
          <li>Мэдээлэх үед зөвхөн шалтгаан, цаг, нууцалсан түр ID бүртгэгдэнэ. Чатын бичвэр хадгалагдахгүй.</li>
          <li>Хүйс нь таны өөрийн мэдүүлэг бөгөөд баталгаажуулдаггүй.</li>
          <li>Энэ үйлчилгээ зөвхөн 18 ба түүнээс дээш насныханд зориулагдсан.</li>
        </ul>
      </section>
    </Modal>
  );
}
