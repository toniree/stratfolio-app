import '@testing-library/jest-dom/vitest'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  clear() {
    this.values.clear()
  }

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, String(value))
  }
}

// Node exposes an unavailable `localStorage` global in some versions. Use a
// standards-shaped in-memory implementation so persistence code behaves like
// it does in a browser and remains isolated inside each Vitest worker.
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: new MemoryStorage(),
})

/**
 * jsdom implements no layout, so it ships no ResizeObserver. Components that
 * measure themselves need the constructor to exist; the callback never has
 * anything real to report under jsdom, so a no-op observer is the honest stub.
 */
class NoopResizeObserver implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!('ResizeObserver' in globalThis)) {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: NoopResizeObserver,
  })
}
