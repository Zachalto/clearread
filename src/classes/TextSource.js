/**
 * TextSource — abstract base class for any source of reading text.
 *
 * Design pattern: Polymorphism. Each subclass overrides getText() with its
 * own retrieval logic (paste / .txt / .docx / .pdf), but the caller does
 * not need to know which subclass it holds — it just does:
 *
 *     const text = await source.getText();
 *
 * Phase 2 will add TxtFileSource, DocxFileSource, and PdfFileSource by
 * extending this same base. The ReaderView, App, and everything else
 * downstream stays unchanged — that is the payoff of polymorphism.
 */
export class TextSource {
  // eslint-disable-next-line class-methods-use-this
  async getText() {
    throw new Error('TextSource is abstract — subclasses must implement getText().');
  }
}

/**
 * PastedTextSource — text the user typed or pasted into the textarea.
 *
 * The simplest subclass: it just trims and returns what it was given.
 * Used as the reference implementation that file-based sources mirror.
 */
export class PastedTextSource extends TextSource {
  constructor(rawText) {
    super();
    this.rawText = rawText ?? '';
  }

  async getText() {
    const trimmed = this.rawText.trim();
    if (!trimmed) {
      throw new Error('No text provided — paste something into the box first.');
    }
    return trimmed;
  }
}
