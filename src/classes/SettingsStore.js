/**
 * SettingsStore — JSON wrapper around localStorage.
 *
 * Every service that needs to persist user preferences (typography sliders,
 * theme choice, speech rate, ruler mode, etc.) receives one of these and
 * calls .get / .set. Centralising the prefix and serialisation means no
 * other class has to know that localStorage is the backing store — we
 * could swap it for IndexedDB later without touching anything else.
 *
 * Design principle: Single Responsibility (this is the only class that
 * touches localStorage).
 */
export class SettingsStore {
  constructor(prefix = 'clearread:') {
    this.prefix = prefix;
  }

  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(this.prefix + key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  set(key, value) {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
    } catch {
      // Storage quota or private-mode: just skip. Settings remain in memory.
    }
  }

  remove(key) {
    localStorage.removeItem(this.prefix + key);
  }

  clearAll() {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(this.prefix)) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  }
}
