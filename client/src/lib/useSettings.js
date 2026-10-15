import { useCallback, useState } from 'react';
import { local } from './storage.js';

const KEY = 'noone.settings';
const DEFAULTS = {
  notifications: true, // browser мэдэгдэл (зөвшөөрөл өгсөн үед)
  sound: true,
  icebreakers: true,
  pushOptIn: false,
};

export function useSettings() {
  const [settings, setSettings] = useState(() => ({ ...DEFAULTS, ...local.get(KEY, {}) }));
  const update = useCallback((patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      local.set(KEY, next);
      return next;
    });
  }, []);
  return [settings, update];
}
