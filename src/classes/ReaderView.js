/**
 * ReaderView — renders text into the reader pane.
 *
 * Wraps every word in a <span class="word"> with a unique id. We do this
 * from Phase 1 even though nothing reads the spans yet, because:
 *   - Phase 2's TTS needs per-word elements to highlight during playback.
 *   - Phase 3's syllable-splitter listens for clicks on individual words.
 * Wrapping once up front beats retro-fitting later.
 *
 * Tokenization rule: split on whitespace, keep the whitespace as plain text
 * nodes (so spacing is preserved naturally), and keep punctuation attached
 * to its word ("hello," is one span). Paragraphs are detected by blank lines.
 */
export class ReaderView {
  constructor(rootEl) {
    this.root = rootEl;
    this.wordCount = 0;
  }

  render(text) {
    this.root.replaceChildren();
    this.wordCount = 0;

    const paragraphs = text.split(/\n\s*\n/);
    for (const para of paragraphs) {
      if (!para.trim()) continue;
      const p = document.createElement('p');
      this.appendWords(p, para);
      this.root.appendChild(p);
    }
  }

  renderError(message) {
    this.root.replaceChildren();
    const p = document.createElement('p');
    p.className = 'placeholder error';
    p.textContent = message;
    this.root.appendChild(p);
  }

  /**
   * Split a paragraph into word and whitespace tokens, then append each one.
   * Whitespace becomes a plain text node so the browser handles line wrapping
   * normally; words become <span class="word"> with a sequential id.
   */
  appendWords(parentEl, paragraph) {
    const tokens = paragraph.split(/(\s+)/);
    for (const tok of tokens) {
      if (!tok) continue;
      if (/^\s+$/.test(tok)) {
        parentEl.appendChild(document.createTextNode(tok));
      } else {
        const span = document.createElement('span');
        span.className = 'word';
        span.id = `w-${this.wordCount++}`;
        span.textContent = tok;
        parentEl.appendChild(span);
      }
    }
  }
}
