/**
 * App — top-level controller.
 *
 * Owns the lifecycle of the page and wires services to DOM controls.
 * Services do NOT know about each other directly; they coordinate through
 * App. This is the Mediator pattern, and it keeps each service focused on
 * a single concern (Single Responsibility Principle).
 *
 * Phase 1 wires: text input -> ReaderView, and typography sliders -> TypographyService.
 * Later phases will plug in SpeechService, RulerController, etc. through
 * this same init() method without touching the services themselves.
 */
import { PastedTextSource } from './TextSource.js';
import { ReaderView } from './ReaderView.js';
import { TypographyService } from './TypographyService.js';

export class App {
  constructor() {
    this.readerView = new ReaderView(document.getElementById('reader-view'));
    // Bind typography variables to :root so they cascade to every descendant.
    this.typography = new TypographyService(document.documentElement);
  }

  init() {
    this.bindInputControls();
    this.typography.bindControls({
      fontFamily: document.getElementById('font-family'),
      fontSize: document.getElementById('font-size'),
      letterSpacing: document.getElementById('letter-spacing'),
      wordSpacing: document.getElementById('word-spacing'),
      lineHeight: document.getElementById('line-height'),
      maxWidth: document.getElementById('max-width'),
    });
  }

  bindInputControls() {
    const textarea = document.getElementById('paste-input');
    const loadBtn = document.getElementById('load-pasted-btn');

    loadBtn.addEventListener('click', () => this.loadFromPaste(textarea.value));

    // Ctrl/Cmd+Enter is a friendly shortcut while the textarea has focus.
    textarea.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        this.loadFromPaste(textarea.value);
      }
    });
  }

  async loadFromPaste(rawText) {
    const status = document.getElementById('input-status');
    const source = new PastedTextSource(rawText);
    try {
      const text = await source.getText();
      this.readerView.render(text);
      status.textContent = `Loaded ${this.readerView.wordCount} words.`;
    } catch (err) {
      this.readerView.renderError(err.message);
      status.textContent = '';
    }
  }
}
