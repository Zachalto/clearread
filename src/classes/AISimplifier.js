/**
 * AISimplifier — the one AI-powered feature in the app.
 *
 * Sends text to the Express backend at /api/simplify, which proxies the
 * request to the Anthropic API (the key never leaves the server). Caches
 * results in a Map so toggling between original and simplified — or
 * re-simplifying the same passage — does not re-hit the API.
 *
 * Design pattern: Proxy (on the server side) + memoised client.
 *
 * Graceful no-key state: on startup, App calls checkAvailability(). If
 * the backend reports AI is disabled (or the backend isn't running), the
 * Simplify button stays disabled with a clear message — the rest of the
 * app works unchanged.
 *
 * Evidence basis: W3C Cognitive Accessibility Guidelines list plain-
 * language alternatives as a primary accommodation for complex text.
 * The AI here is a tool that applies plain-language principles — it is
 * not, on its own, a dyslexia treatment.
 */
export class AISimplifier {
  constructor({ endpoint = '/api/simplify', healthEndpoint = '/api/health' } = {}) {
    this.endpoint = endpoint;
    this.healthEndpoint = healthEndpoint;
    this.cache = new Map();
    this.available = false;
    this.lastHealthMessage = '';
  }

  async checkAvailability() {
    try {
      const res = await fetch(this.healthEndpoint);
      if (!res.ok) {
        this.available = false;
        this.lastHealthMessage = `Backend responded with HTTP ${res.status}.`;
        return false;
      }
      const data = await res.json();
      this.available = Boolean(data.aiEnabled);
      this.lastHealthMessage = data.aiEnabled
        ? `AI ready (${data.model || 'model unknown'}).`
        : 'Backend is up, but no API key configured. Add ANTHROPIC_API_KEY to server/.env to enable.';
      return this.available;
    } catch (err) {
      this.available = false;
      this.lastHealthMessage =
        'Backend not running. Start it with `npm start` in /server (Simplify is optional — the app works without it).';
      return false;
    }
  }

  async simplify(text, { level = 'easier' } = {}) {
    if (!text || !text.trim()) throw new Error('No text to simplify.');
    const cacheKey = `${level}::${text}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, level }),
    });
    if (!res.ok) {
      let msg = `Simplify failed (HTTP ${res.status}).`;
      try {
        const data = await res.json();
        if (data?.error) msg = data.error;
      } catch {
        // body wasn't JSON — keep the generic message
      }
      throw new Error(msg);
    }
    const data = await res.json();
    if (!data?.simplified) throw new Error('Simplify response was empty.');
    this.cache.set(cacheKey, data.simplified);
    return data.simplified;
  }
}
