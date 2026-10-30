// The SSR/unit tests run outside a browser. Keep storage in memory rather than
// changing production authentication to accommodate the test runner.
if (typeof globalThis.localStorage === 'undefined') {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      get length() { return values.size; },
      key(index: number) { return [...values.keys()][index] ?? null; },
      getItem(key: string) { return values.get(key) ?? null; },
      setItem(key: string, value: string) { values.set(key, String(value)); },
      removeItem(key: string) { values.delete(key); },
      clear() { values.clear(); },
    },
  });
}
