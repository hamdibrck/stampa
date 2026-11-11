/** In-memory stand-in for MMKV in Jest (the real module needs native code). */
export function createMMKV() {
  const map = new Map<string, string | number | boolean>();
  return {
    set: (key: string, value: string | number | boolean) => void map.set(key, value),
    getString: (key: string) => {
      const v = map.get(key);
      return typeof v === 'string' ? v : undefined;
    },
    contains: (key: string) => map.has(key),
    remove: (key: string) => map.delete(key),
    getAllKeys: () => [...map.keys()],
    clearAll: () => map.clear(),
  };
}
