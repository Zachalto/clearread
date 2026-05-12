/**
 * TextSource — abstract base + four concrete subclasses.
 *
 * Design pattern: Polymorphism. Every subclass implements `async getText()`
 * and returns a plain string. The caller (App.loadFromSource) does not
 * care whether the bytes came from a paste, a .txt, a .docx, or a .pdf —
 * it just awaits the same method on the same shape of object.
 *
 *     const source = pickSource(input);   // returns one of the subclasses
 *     const text   = await source.getText();
 *
 * Adding a new source (URL fetch, EPUB, etc.) is a matter of writing one
 * more subclass — every consumer downstream stays untouched.
 *
 * Note: the .docx and .pdf libraries are loaded with dynamic `import()` so
 * the initial JS payload stays small for users who never upload a file.
 */
export class TextSource {
  // eslint-disable-next-line class-methods-use-this
  async getText() {
    throw new Error('TextSource is abstract — subclasses must implement getText().');
  }
}

export class PastedTextSource extends TextSource {
  constructor(rawText) {
    super();
    this.rawText = rawText ?? '';
  }

  async getText() {
    const trimmed = this.rawText.trim();
    if (!trimmed) throw new Error('No text provided — paste something into the box first.');
    return trimmed;
  }
}

export class TxtFileSource extends TextSource {
  constructor(file) {
    super();
    this.file = file;
  }

  async getText() {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const value = String(reader.result || '').trim();
        if (!value) reject(new Error('Text file is empty.'));
        else resolve(value);
      };
      reader.onerror = () => reject(new Error('Could not read the text file.'));
      reader.readAsText(this.file);
    });
  }
}

export class DocxFileSource extends TextSource {
  constructor(file) {
    super();
    this.file = file;
  }

  async getText() {
    // Mammoth is large; only load it when a .docx is actually opened.
    const mammothMod = await import('mammoth/mammoth.browser.js');
    const mammoth = mammothMod.default || mammothMod;
    const arrayBuffer = await this.file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    const value = String(result.value || '').trim();
    if (!value) throw new Error('No readable text in this .docx file.');
    return value;
  }
}

export class PdfFileSource extends TextSource {
  constructor(file) {
    super();
    this.file = file;
  }

  async getText() {
    // PDF.js is even larger than mammoth; same dynamic-import trick.
    const pdfjsLib = await import('pdfjs-dist');
    const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

    const arrayBuffer = await this.file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map((it) => it.str).join(' ').trim();
      if (text) pages.push(text);
    }
    const value = pages.join('\n\n').trim();
    if (!value) throw new Error('No readable text in this PDF (it may be a scanned image).');
    return value;
  }
}

/**
 * Pick the right subclass for an uploaded file based on its extension.
 * Throws if the extension is not one we support.
 */
export function pickFileSource(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.txt')) return new TxtFileSource(file);
  if (name.endsWith('.docx')) return new DocxFileSource(file);
  if (name.endsWith('.pdf')) return new PdfFileSource(file);
  throw new Error(`Unsupported file type: ${file.name}`);
}
