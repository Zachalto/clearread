/**
 * TypographyService — drives the --reader-* CSS custom properties.
 *
 * Why CSS variables: writing one variable on :root cascades instantly to
 * every element that uses it. No per-element style writes, no JS layout
 * thrashing on long documents.
 *
 * Design principle: Single Responsibility. Knows about typography
 * variables and nothing else (no themes, no speech, no text content).
 *
 * Persistence: every change writes to SettingsStore. On startup the App
 * calls restoreFromStore() before bindControls(), so the UI reflects the
 * user's last session.
 *
 * Evidence basis: British Dyslexia Association Style Guide; Zorzi et al.
 * 2012 (PNAS) — wider letter spacing reduces visual crowding and improves
 * reading accuracy in dyslexic children.
 */
export class TypographyService {
  constructor(targetEl, settingsStore) {
    this.target = targetEl;
    this.store = settingsStore;
    this.controls = null;
  }

  setVar(name, value) {
    this.target.style.setProperty(name, value);
  }

  restoreFromStore() {
    const saved = this.store.get('typography', null);
    if (!saved) return;
    if (saved.fontFamily) this.setVar('--reader-font-family', saved.fontFamily);
    if (saved.fontSize) this.setVar('--reader-font-size', `${saved.fontSize}pt`);
    if (saved.letterSpacing != null) this.setVar('--reader-letter-spacing', `${saved.letterSpacing}em`);
    if (saved.wordSpacing != null) this.setVar('--reader-word-spacing', `${saved.wordSpacing}em`);
    if (saved.lineHeight != null) this.setVar('--reader-line-height', String(saved.lineHeight));
    if (saved.maxWidth != null) this.setVar('--reader-max-width', `${saved.maxWidth}ch`);
    this._saved = { ...saved };
  }

  _persist(patch) {
    const merged = { ...(this._saved || {}), ...patch };
    this._saved = merged;
    this.store.set('typography', merged);
  }

  bindControls(controls) {
    this.controls = controls;
    const { fontFamily, fontSize, letterSpacing, wordSpacing, lineHeight, maxWidth } = controls;

    // Mirror saved values into the form widgets so the UI matches the cascade.
    const saved = this._saved || {};
    if (saved.fontFamily) fontFamily.value = saved.fontFamily;
    if (saved.fontSize) { fontSize.value = saved.fontSize; document.getElementById('font-size-value').textContent = saved.fontSize; }
    if (saved.letterSpacing != null) { letterSpacing.value = saved.letterSpacing; document.getElementById('letter-spacing-value').textContent = saved.letterSpacing; }
    if (saved.wordSpacing != null) { wordSpacing.value = saved.wordSpacing; document.getElementById('word-spacing-value').textContent = saved.wordSpacing; }
    if (saved.lineHeight != null) { lineHeight.value = saved.lineHeight; document.getElementById('line-height-value').textContent = saved.lineHeight; }
    if (saved.maxWidth != null) { maxWidth.value = saved.maxWidth; document.getElementById('max-width-value').textContent = saved.maxWidth; }

    fontFamily.addEventListener('change', (e) => {
      this.setVar('--reader-font-family', e.target.value);
      this._persist({ fontFamily: e.target.value });
    });

    fontSize.addEventListener('input', (e) => {
      const pt = e.target.value;
      this.setVar('--reader-font-size', `${pt}pt`);
      document.getElementById('font-size-value').textContent = pt;
      this._persist({ fontSize: Number(pt) });
    });

    letterSpacing.addEventListener('input', (e) => {
      const v = e.target.value;
      this.setVar('--reader-letter-spacing', `${v}em`);
      document.getElementById('letter-spacing-value').textContent = v;
      this._persist({ letterSpacing: Number(v) });
    });

    wordSpacing.addEventListener('input', (e) => {
      const v = e.target.value;
      this.setVar('--reader-word-spacing', `${v}em`);
      document.getElementById('word-spacing-value').textContent = v;
      this._persist({ wordSpacing: Number(v) });
    });

    lineHeight.addEventListener('input', (e) => {
      const v = e.target.value;
      this.setVar('--reader-line-height', v);
      document.getElementById('line-height-value').textContent = v;
      this._persist({ lineHeight: Number(v) });
    });

    maxWidth.addEventListener('input', (e) => {
      const v = e.target.value;
      this.setVar('--reader-max-width', `${v}ch`);
      document.getElementById('max-width-value').textContent = v;
      this._persist({ maxWidth: Number(v) });
    });
  }
}
