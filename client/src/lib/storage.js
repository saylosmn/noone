// Хувийн цонх, хаалттай storage-д ч алдаа өгөхгүй байх wrapper.
function make(getStore) {
  return {
    get(key, fallback) {
      try {
        const raw = getStore()?.getItem(key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        getStore()?.setItem(key, JSON.stringify(value));
      } catch {
        /* ignore */
      }
    },
    remove(key) {
      try {
        getStore()?.removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };
}

export const session = make(() => window.sessionStorage);
export const local = make(() => window.localStorage);
