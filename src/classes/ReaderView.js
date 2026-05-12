/**
 * ReaderView — renders text into the reader pane.
 *
 * Owns the per-word <span> elements that everything else hooks into:
 *   - SpeechService asks for the plain text and emits boundary events;
 *     ReaderView translates each character offset into a span and toggles
 *     `.current-word` (this is the read side of the Observer pattern).
 *   - SyllableProcessor responds to clicks on individual words; ReaderView
 *     surfaces those via an onWordClick callback so it does not have to
 *     know what `click on a word` means semantically.
 *
 * Render strategy: build a parallel `wordOffsets` array of {start, end, span}
 * during render(). Speech and click handlers both consult that array, so
 * we tokenise the text exactly once.
 *
 * Tokenisation rule: split on whitespace; punctuation stays attached to its
 * word ("hello," is one span). Blank lines split paragraphs.
 */
export class ReaderView {
  constructor(rootEl) {
    this.root = rootEl;
    this.plainText = '';
    this.wordOffsets = []; // [{ start, end, span }]
    this.wordCount = 0;
    this._highlighted = null;
    this._wordClickHandler = null;

    // Event delegation: a single listener on the root span-walks up to the
    // nearest .word and forwards to the registered handler. Cheaper than
    // attaching one listener per word, and survives re-renders for free.
    this.root.addEventListener('click', (e) => {
      if (!this._wordClickHandler) return;
      const wordEl = e.target.closest('.word');
      if (!wordEl || !this.root.contains(wordEl)) return;
      this._wordClickHandler(wordEl);
    });
  }

  /**
   * Render text into the reader. Builds the wordOffsets index too.
   */
  render(text) {
    const normalized = String(text || '').trim();
    this.root.replaceChildren();
    this.plainText = normalized;
    this.wordOffsets = [];
    this.wordCount = 0;
    this._highlighted = null;

    if (!normalized) {
      this.renderPlaceholder('Nothing to display yet.');
      return;
    }

    // Pre-compute word offsets in the full plain text. SpeechSynthesis emits
    // boundary events with char offsets into this same string, so we can
    // look up the right span without re-tokenising at speak time.
    const wordRegex = /\S+/g;
    const wordTokens = [];
    let m;
    while ((m = wordRegex.exec(normalized)) !== null) {
      wordTokens.push({ start: m.index, end: m.index + m[0].length });
    }

    const paragraphs = normalized.split(/\n\s*\n/);
    let wordIdx = 0;
    for (const para of paragraphs) {
      if (!para.trim()) continue;
      const p = document.createElement('p');
      const tokens = para.split(/(\s+)/);
      for (const tok of tokens) {
        if (!tok) continue;
        if (/^\s+$/.test(tok)) {
          p.appendChild(document.createTextNode(tok));
        } else {
          const span = document.createElement('span');
          span.className = 'word';
          span.id = `w-${wordIdx}`;
          span.dataset.original = tok;
          span.textContent = tok;
          const offset = wordTokens[wordIdx];
          if (offset) this.wordOffsets.push({ start: offset.start, end: offset.end, span });
          wordIdx += 1;
          p.appendChild(span);
        }
      }
      this.root.appendChild(p);
    }
    this.wordCount = wordIdx;
  }

  renderPlaceholder(message) {
    this.root.replaceChildren();
    const p = document.createElement('p');
    p.className = 'placeholder';
    p.textContent = message;
    this.root.appendChild(p);
  }

  renderError(message) {
    this.root.replaceChildren();
    const p = document.createElement('p');
    p.className = 'placeholder error';
    p.textContent = message;
    this.root.appendChild(p);
  }

  getPlainText() {
    return this.plainText;
  }

  /**
   * Highlight the word containing the given character offset in the plain text.
   * Called by App in response to SpeechService 'boundary' events.
   */
  highlightAtChar(charIndex) {
    this.clearHighlight();
    // Linear scan — fine for typical document sizes. With ~10k words you'd
    // switch to binary search; we never hit that.
    for (const w of this.wordOffsets) {
      if (charIndex >= w.start && charIndex < w.end) {
        w.span.classList.add('current-word');
        w.span.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        this._highlighted = w.span;
        return;
      }
    }
  }

  clearHighlight() {
    if (this._highlighted) {
      this._highlighted.classList.remove('current-word');
      this._highlighted = null;
    }
  }

  /**
   * Register a click handler that fires when the user clicks any word span.
   * Wiring this up here keeps SyllableProcessor pure — it doesn't need to
   * know anything about the DOM.
   */
  onWordClick(handler) {
    this._wordClickHandler = handler;
  }
}
