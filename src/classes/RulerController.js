/**
 * RulerController — three line-focus overlays for the reader pane.
 *
 * Modes:
 *   - 'bar'       : translucent highlight band follows the cursor / arrow keys
 *   - 'dimmed'    : darken everything except the current line
 *   - 'spotlight' : same as dimmed but near-opaque — only one line shows
 *   - 'off'       : overlay hidden
 *
 * Inputs:
 *   - mousemove inside the reader (debounced via requestAnimationFrame)
 *   - ArrowUp / ArrowDown to step line-by-line
 *
 * Implementation: a fixed-position overlay with three children (top mask,
 * highlight bar, bottom mask). We compute the line height from the reader's
 * computed style and snap the cursor's Y to that grid, then set two CSS
 * variables (--ruler-y, --ruler-h) that drive the layout. Everything else
 * is CSS — no per-frame DOM mutation.
 *
 * Evidence basis: Bhattacharya et al. 2023 (ACM CHI) — digital reading
 * rulers reduce regressions and improve comprehension for struggling
 * readers. Bucci et al. 2011 — dyslexic readers show less stable binocular
 * fixation, which line-focus tools help compensate for.
 */
export class RulerController {
  constructor({ readerEl, overlayEl, settingsStore }) {
    this.reader = readerEl;
    this.overlay = overlayEl;
    this.store = settingsStore;
    this.mode = this.store?.get('ruler.mode', 'off') || 'off';
    this.lineHeightPx = 24;
    this.lineIndex = 0;
    this._frameQueued = false;
    this._lastClientY = null;

    this._onMouseMove = this._onMouseMove.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onResize = this._onResize.bind(this);
  }

  bindControls(controls) {
    const { modeSelect } = controls;
    modeSelect.value = this.mode;
    this.setMode(this.mode);

    modeSelect.addEventListener('change', (e) => this.setMode(e.target.value));
  }

  setMode(mode) {
    this.mode = mode;
    this.store?.set('ruler.mode', mode);
    this.overlay.dataset.mode = mode;
    this.overlay.setAttribute('aria-hidden', mode === 'off' ? 'true' : 'false');

    if (mode === 'off') {
      this._teardown();
      return;
    }
    this._setup();
    // Position once immediately so the user sees the ruler even before they move.
    this._updateLineHeight();
    if (this._lastClientY != null) this._snapTo(this._lastClientY);
    else this._snapToLineIndex(this.lineIndex);
  }

  _setup() {
    this.reader.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('resize', this._onResize);
  }

  _teardown() {
    this.reader.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('resize', this._onResize);
  }

  _updateLineHeight() {
    const cs = window.getComputedStyle(this.reader);
    const parsed = parseFloat(cs.lineHeight);
    // If `line-height: normal`, parseFloat returns NaN. Fall back to ~font-size * 1.2.
    if (Number.isFinite(parsed)) {
      this.lineHeightPx = parsed;
    } else {
      const fontSize = parseFloat(cs.fontSize) || 18;
      this.lineHeightPx = fontSize * 1.2;
    }
    this.overlay.style.setProperty('--ruler-h', `${this.lineHeightPx}px`);
    const rect = this.reader.getBoundingClientRect();
    this.overlay.style.setProperty('--ruler-x', `${rect.left}px`);
    this.overlay.style.setProperty('--ruler-w', `${rect.width}px`);
  }

  _onMouseMove(e) {
    this._lastClientY = e.clientY;
    if (this._frameQueued) return;
    this._frameQueued = true;
    requestAnimationFrame(() => {
      this._frameQueued = false;
      this._snapTo(this._lastClientY);
    });
  }

  _onResize() {
    this._updateLineHeight();
    this._snapToLineIndex(this.lineIndex);
  }

  _onKeyDown(e) {
    if (this.mode === 'off') return;
    if (isTypingTarget(e.target)) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.lineIndex += 1;
      this._snapToLineIndex(this.lineIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.lineIndex = Math.max(0, this.lineIndex - 1);
      this._snapToLineIndex(this.lineIndex);
    }
  }

  /** Snap an absolute viewport-Y to the nearest line within the reader. */
  _snapTo(clientY) {
    this._updateLineHeight();
    const rect = this.reader.getBoundingClientRect();
    // Top of the first text line — account for the reader's top padding.
    const padTop = parseFloat(window.getComputedStyle(this.reader).paddingTop) || 0;
    const firstLineTop = rect.top + padTop;
    const offset = clientY - firstLineTop;
    const idx = Math.max(0, Math.floor(offset / this.lineHeightPx));
    this.lineIndex = idx;
    const y = firstLineTop + idx * this.lineHeightPx;
    this.overlay.style.setProperty('--ruler-y', `${y}px`);
  }

  _snapToLineIndex(idx) {
    this._updateLineHeight();
    const rect = this.reader.getBoundingClientRect();
    const padTop = parseFloat(window.getComputedStyle(this.reader).paddingTop) || 0;
    const firstLineTop = rect.top + padTop;
    const y = firstLineTop + idx * this.lineHeightPx;
    this.overlay.style.setProperty('--ruler-y', `${y}px`);
  }
}

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}
