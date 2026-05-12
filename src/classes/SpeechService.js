/**
 * SpeechService — wraps the Web Speech API for play/pause/stop + speed +
 * voice selection, and emits per-word boundary events.
 *
 * Design pattern: Observer. The service emits four events — 'state',
 * 'boundary', 'end', 'error' — and any consumer can subscribe with .on().
 * In this app, App subscribes to 'boundary' and forwards the char offset
 * to ReaderView, which finds the matching word span and adds .current-word.
 *
 * Browser caveat: SpeechSynthesisUtterance.onboundary fires reliably in
 * Chromium/Edge with `event.name === 'word'`. Firefox and Safari are
 * patchier. We degrade gracefully — if no boundary events fire, the read-
 * aloud still works, you just don't get the highlight. We also re-emit
 * 'state' on every transition so the UI can enable/disable buttons.
 *
 * Evidence basis: Wood et al. 2017 meta-analysis (text-to-speech improves
 * reading comprehension for struggling readers, d ≈ 0.35).
 */
export class SpeechService {
  constructor(settingsStore) {
    this.supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
    this.synth = this.supported ? window.speechSynthesis : null;
    this.store = settingsStore;
    this.utterance = null;
    this.state = 'idle'; // 'idle' | 'playing' | 'paused'
    this.rate = this.store?.get('speech.rate', 1.0) ?? 1.0;
    this.voiceURI = this.store?.get('speech.voiceURI', '') || '';
    this.listeners = {};
  }

  on(event, fn) {
    (this.listeners[event] ||= []).push(fn);
  }

  emit(event, data) {
    (this.listeners[event] || []).forEach((fn) => fn(data));
  }

  getVoices() {
    if (!this.supported) return [];
    return this.synth.getVoices();
  }

  setRate(rate) {
    this.rate = Number(rate) || 1.0;
    if (this.utterance) this.utterance.rate = this.rate;
    this.store?.set('speech.rate', this.rate);
  }

  setVoiceURI(uri) {
    this.voiceURI = uri || '';
    this.store?.set('speech.voiceURI', this.voiceURI);
  }

  _pickVoice() {
    if (!this.voiceURI) return null;
    return this.getVoices().find((v) => v.voiceURI === this.voiceURI) || null;
  }

  play(text) {
    if (!this.supported) {
      this.emit('error', new Error('Speech synthesis is not supported in this browser.'));
      return;
    }

    if (this.state === 'paused') {
      this.synth.resume();
      this._setState('playing');
      return;
    }
    if (this.state === 'playing') return;

    this.synth.cancel(); // belt-and-braces — clears any stuck state

    const u = new SpeechSynthesisUtterance(text);
    u.rate = this.rate;
    const voice = this._pickVoice();
    if (voice) u.voice = voice;

    u.onboundary = (e) => {
      // We don't filter on e.name — Chrome reports 'word' but other engines
      // can emit on sentences or be inconsistent. The downstream char-offset
      // lookup handles any granularity gracefully.
      this.emit('boundary', { charIndex: e.charIndex, name: e.name });
    };
    u.onend = () => {
      this.utterance = null;
      this._setState('idle');
      this.emit('end');
    };
    u.onerror = (e) => {
      this.utterance = null;
      this._setState('idle');
      this.emit('error', e);
    };

    this.utterance = u;
    this.synth.speak(u);
    this._setState('playing');
  }

  pause() {
    if (this.state === 'playing') {
      this.synth.pause();
      this._setState('paused');
    }
  }

  stop() {
    if (!this.supported) return;
    this.synth.cancel();
    this.utterance = null;
    this._setState('idle');
  }

  _setState(next) {
    if (this.state === next) return;
    this.state = next;
    this.emit('state', next);
  }
}
