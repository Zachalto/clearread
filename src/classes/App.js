/**
 * App — top-level controller (Mediator).
 *
 * Constructs every service, restores saved state from SettingsStore,
 * wires DOM controls to service methods, and routes events between
 * services. Services never reference each other directly — they all
 * talk through App. This keeps every service Single-Responsibility and
 * means you can read any one of them without first understanding the
 * other ten.
 *
 * Wiring summary (read this for the presentation):
 *   1. ReaderView         ← renders text and owns word spans
 *   2. TypographyService  ← drives --reader-* CSS variables
 *   3. ThemeManager       ← drives palette CSS variables
 *   4. SpeechService      ← Observer: emits 'boundary' → ReaderView.highlightAtChar
 *   5. RulerController    ← line-focus overlay; reads getComputedStyle of reader
 *   6. SyllableProcessor  ← pure word → string[]; wired to ReaderView.onWordClick
 *   7. ResearchPanel      ← data-driven dialog from research.json
 *   8. AISimplifier       ← optional; calls Express backend with caching
 *   9. SettingsStore      ← localStorage wrapper used by everyone above
 */

import { SettingsStore } from './SettingsStore.js';
import { PastedTextSource, pickFileSource } from './TextSource.js';
import { ReaderView } from './ReaderView.js';
import { TypographyService } from './TypographyService.js';
import { ThemeManager } from './ThemeManager.js';
import { SpeechService } from './SpeechService.js';
import { RulerController } from './RulerController.js';
import { SyllableProcessor } from './SyllableProcessor.js';
import { BionicReader } from './BionicReader.js';
import { ReadabilityAnalyzer } from './ReadabilityAnalyzer.js';
import { ResearchPanel } from './ResearchPanel.js';
import { AISimplifier } from './AISimplifier.js';

export class App {
  constructor() {
    this.store = new SettingsStore();
    this.readerView = new ReaderView(document.getElementById('reader-view'));
    this.typography = new TypographyService(document.documentElement, this.store);
    this.theme = new ThemeManager(document.documentElement, this.store);
    this.speech = new SpeechService(this.store);
    this.ruler = new RulerController({
      readerEl: document.getElementById('reader-view'),
      overlayEl: document.getElementById('ruler-overlay'),
      settingsStore: this.store,
    });
    this.syllables = new SyllableProcessor();
    this.bionic = new BionicReader(this.store);
    this.readability = new ReadabilityAnalyzer(this.syllables);
    this.ai = new AISimplifier();

    this.currentOriginal = ''; // last loaded original text
    this.currentSimplified = null; // simplified version if any
    this.showingSimplified = false;
  }

  async init() {
    // 1. Restore stored prefs BEFORE binding controls so the UI mirrors them.
    this.typography.restoreFromStore();

    // 2. Bind every panel.
    this.typography.bindControls({
      fontFamily: document.getElementById('font-family'),
      fontSize: document.getElementById('font-size'),
      letterSpacing: document.getElementById('letter-spacing'),
      wordSpacing: document.getElementById('word-spacing'),
      lineHeight: document.getElementById('line-height'),
      maxWidth: document.getElementById('max-width'),
    });

    this.theme.bindControls({
      select: document.getElementById('theme-select'),
      customBg: document.getElementById('custom-bg'),
      customOpacityRange: document.getElementById('custom-opacity'),
      customWrap: document.getElementById('custom-theme-controls'),
    });

    this.ruler.bindControls({
      modeSelect: document.getElementById('ruler-mode'),
    });

    this.bindInputControls();
    this.bindSpeechControls();
    this.bindSyllableClicks();
    this.bindBionicToggle();
    this.bindResetButton();
    this.bindKeyboardShortcuts();

    // 3. Load data-driven panels.
    await Promise.all([
      this._loadResearch(),
      this._loadSamples(),
      this._initAI(),
    ]);
  }

  // ----- Input (paste / sample / file) --------------------------------------

  bindInputControls() {
    const textarea = document.getElementById('paste-input');
    const loadBtn = document.getElementById('load-pasted-btn');
    const fileInput = document.getElementById('file-input');
    const samplePicker = document.getElementById('sample-picker');

    loadBtn.addEventListener('click', () => this.loadFromPaste(textarea.value));
    textarea.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        this.loadFromPaste(textarea.value);
      }
    });

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      await this.loadFromFile(file);
      // Reset input so picking the same file twice still fires 'change'.
      e.target.value = '';
    });

    samplePicker.addEventListener('change', (e) => {
      const id = e.target.value;
      if (!id) return;
      const sample = this._samples?.find((s) => s.id === id);
      if (!sample) return;
      textarea.value = sample.text;
      this.loadFromText(sample.text);
    });
  }

  async loadFromPaste(rawText) {
    try {
      const source = new PastedTextSource(rawText);
      const text = await source.getText();
      this.loadFromText(text);
    } catch (err) {
      this._setStatus(err.message, true);
    }
  }

  async loadFromFile(file) {
    this._setStatus(`Reading ${file.name}…`);
    try {
      const source = pickFileSource(file);
      const text = await source.getText();
      this.loadFromText(text);
    } catch (err) {
      this._setStatus(err.message, true);
      this.readerView.renderError(err.message);
    }
  }

  loadFromText(text) {
    this.currentOriginal = text;
    this.currentSimplified = null;
    this.showingSimplified = false;
    this._updateSimplifyToggleUI();
    this.speech.stop();
    this.readerView.clearHighlight();
    this.readerView.render(text);
    // Re-apply bionic styling to the freshly-rendered word spans.
    this.bionic.applyToAll(this.readerView.root);
    this._updateReadability();
    this._setStatus(`Loaded ${this.readerView.wordCount} words.`);
  }

  _setStatus(message, isError = false) {
    const el = document.getElementById('input-status');
    el.textContent = message;
    el.classList.toggle('error', Boolean(isError));
  }

  // ----- Speech -------------------------------------------------------------

  bindSpeechControls() {
    const playBtn = document.getElementById('play-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const stopBtn = document.getElementById('stop-btn');
    const rateRange = document.getElementById('speech-rate');
    const rateLabel = document.getElementById('speech-rate-value');
    const voiceSel = document.getElementById('speech-voice');

    if (!this.speech.supported) {
      playBtn.disabled = true;
      pauseBtn.disabled = true;
      stopBtn.disabled = true;
      rateRange.disabled = true;
      voiceSel.disabled = true;
      playBtn.title = 'Speech synthesis not supported in this browser.';
      return;
    }

    // Restore saved rate.
    rateRange.value = this.speech.rate;
    rateLabel.textContent = Number(this.speech.rate).toFixed(1);

    playBtn.addEventListener('click', () => {
      const text = this.readerView.getPlainText();
      if (!text) {
        this._setStatus('Load some text first.', true);
        return;
      }
      this.speech.play(text);
    });
    pauseBtn.addEventListener('click', () => this.speech.pause());
    stopBtn.addEventListener('click', () => this.speech.stop());

    rateRange.addEventListener('input', (e) => {
      const v = Number(e.target.value);
      this.speech.setRate(v);
      rateLabel.textContent = v.toFixed(1);
    });

    voiceSel.addEventListener('change', (e) => this.speech.setVoiceURI(e.target.value));

    // Observer pattern: speech events drive the UI and the reader highlight.
    this.speech.on('boundary', (e) => this.readerView.highlightAtChar(e.charIndex));
    this.speech.on('end', () => this.readerView.clearHighlight());
    this.speech.on('error', () => this.readerView.clearHighlight());
    this.speech.on('state', (state) => {
      playBtn.disabled = state === 'playing';
      pauseBtn.disabled = state !== 'playing';
      stopBtn.disabled = state === 'idle';
      playBtn.textContent = state === 'paused' ? '▶ Resume' : '▶ Play';
    });

    const populateVoices = () => {
      const voices = this.speech.getVoices();
      const english = voices.filter((v) => v.lang?.startsWith('en'));
      const list = english.length ? english : voices;
      voiceSel.replaceChildren();
      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.textContent = 'Default';
      voiceSel.appendChild(defaultOpt);
      for (const v of list) {
        const opt = document.createElement('option');
        opt.value = v.voiceURI;
        opt.textContent = `${v.name} (${v.lang})`;
        voiceSel.appendChild(opt);
      }
      if (this.speech.voiceURI && list.some((v) => v.voiceURI === this.speech.voiceURI)) {
        voiceSel.value = this.speech.voiceURI;
      }
    };
    populateVoices();
    // Voices load async in some browsers.
    if (typeof speechSynthesis !== 'undefined') {
      speechSynthesis.addEventListener?.('voiceschanged', populateVoices);
    }
  }

  // ----- Syllable splitter --------------------------------------------------

  bindSyllableClicks() {
    this.readerView.onWordClick((wordEl) => {
      const original = wordEl.dataset.original || wordEl.textContent;
      if (wordEl.classList.contains('split')) {
        // Coming out of syllable-split. Restore either bionic styling
        // (if that mode is on) or plain text.
        wordEl.classList.remove('split');
        if (this.bionic.enabled) this.bionic.apply(wordEl);
        else wordEl.textContent = original;
        return;
      }
      const display = this.syllables.formatWithDots(original);
      if (display === original) return; // single-syllable — nothing to show
      // Entering syllable-split: drop any bionic <strong> children first,
      // then write the dot-joined form.
      wordEl.replaceChildren();
      wordEl.textContent = display;
      wordEl.classList.add('split');
    });
  }

  bindBionicToggle() {
    const toggle = document.getElementById('bionic-toggle');
    toggle.checked = this.bionic.enabled;
    toggle.addEventListener('change', (e) => {
      this.bionic.setEnabled(e.target.checked);
      this.bionic.applyToAll(this.readerView.root);
    });
  }

  // ----- AI Simplify --------------------------------------------------------

  async _initAI() {
    const statusEl = document.getElementById('ai-status');
    const simplifyBtn = document.getElementById('simplify-btn');
    const available = await this.ai.checkAvailability();
    statusEl.textContent = this.ai.lastHealthMessage;
    statusEl.classList.toggle('available', available);
    simplifyBtn.disabled = !available;

    simplifyBtn.addEventListener('click', () => this._runSimplify());

    const toggleBtn = document.getElementById('simplify-toggle-btn');
    toggleBtn.addEventListener('click', () => this._toggleSimplifiedView());
  }

  async _runSimplify() {
    if (!this.readerView.getPlainText()) {
      this._setStatus('Load some text first, then click Simplify.', true);
      return;
    }
    // Prefer the user's current selection; fall back to the whole document.
    const selection = window.getSelection();
    const selectedText = selection && !selection.isCollapsed ? selection.toString().trim() : '';
    const sourceText = selectedText || this.currentOriginal || this.readerView.getPlainText();

    const btn = document.getElementById('simplify-btn');
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = '… simplifying …';
    try {
      const simplified = await this.ai.simplify(sourceText);
      this.currentSimplified = simplified;
      this.showingSimplified = true;
      this.readerView.render(simplified);
      this.bionic.applyToAll(this.readerView.root);
      this._updateSimplifyToggleUI();
      this._updateReadability();
      this._setStatus('Simplified version loaded. Toggle to compare.');
    } catch (err) {
      this._setStatus(err.message, true);
    } finally {
      btn.textContent = originalLabel;
      btn.disabled = !this.ai.available;
    }
  }

  _toggleSimplifiedView() {
    if (!this.currentSimplified) return;
    this.showingSimplified = !this.showingSimplified;
    const text = this.showingSimplified ? this.currentSimplified : this.currentOriginal;
    this.speech.stop();
    this.readerView.render(text);
    this.bionic.applyToAll(this.readerView.root);
    this._updateSimplifyToggleUI();
    this._updateReadability();
  }

  _updateReadability() {
    const bar = document.getElementById('readability-bar');
    const text = document.getElementById('readability-text');
    if (!this.currentOriginal) {
      bar.hidden = true;
      return;
    }
    bar.hidden = false;
    const orig = this.readability.analyze(this.currentOriginal);
    if (this.currentSimplified) {
      const simp = this.readability.analyze(this.currentSimplified);
      const improvement = orig.fkGrade != null && simp.fkGrade != null
        ? Math.max(0, orig.fkGrade - simp.fkGrade)
        : 0;
      text.innerHTML = `
        <span class="rb-label">Reading level:</span>
        <span class="rb-orig"><strong>${escapeHtml(this.readability.formatGrade(orig.fkGrade))}</strong></span>
        <span class="rb-arrow">→</span>
        <span class="rb-simp"><strong class="improved">${escapeHtml(this.readability.formatGrade(simp.fkGrade))}</strong></span>
        ${improvement >= 0.5 ? `<span class="rb-delta">−${improvement.toFixed(1)} grades easier</span>` : ''}
      `;
    } else {
      text.innerHTML = `
        <span class="rb-label">Reading level:</span>
        <strong>${escapeHtml(this.readability.formatGrade(orig.fkGrade))}</strong>
        <span class="rb-muted">${orig.words} words · ${orig.sentences} sentences · ${orig.syllables} syllables</span>
      `;
    }
  }

  _updateSimplifyToggleUI() {
    const wrap = document.getElementById('simplify-toggle-wrap');
    const btn = document.getElementById('simplify-toggle-btn');
    if (!this.currentSimplified) {
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    btn.textContent = this.showingSimplified ? 'Show original' : 'Show simplified';
  }

  // ----- Research dialog + samples ------------------------------------------

  async _loadResearch() {
    try {
      const data = await ResearchPanel.load('/src/data/research.json');
      this.research = new ResearchPanel({
        dialogEl: document.getElementById('research-dialog'),
        contentEl: document.getElementById('research-content'),
        dataset: data,
      });
      this.research.bindTriggers(document);
    } catch (err) {
      console.warn('Research data failed to load:', err);
    }
  }

  async _loadSamples() {
    try {
      const res = await fetch('/src/data/samples.json');
      const data = await res.json();
      this._samples = data.samples || [];
      const picker = document.getElementById('sample-picker');
      for (const s of this._samples) {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.title;
        picker.appendChild(opt);
      }
    } catch (err) {
      console.warn('Samples failed to load:', err);
    }
  }

  // ----- Reset + keyboard ---------------------------------------------------

  bindResetButton() {
    const btn = document.getElementById('reset-settings-btn');
    btn.addEventListener('click', () => {
      const ok = confirm('Reset all settings to defaults? This clears your saved preferences.');
      if (!ok) return;
      this.store.clearAll();
      location.reload();
    });
  }

  bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      const typing = isTypingTarget(e.target);
      if (e.key === 'Escape') {
        this.speech.stop();
        return;
      }
      if (e.key === ' ' && !typing) {
        if (this.speech.state === 'playing') { e.preventDefault(); this.speech.pause(); }
        else { e.preventDefault(); const t = this.readerView.getPlainText(); if (t) this.speech.play(t); }
      }
      // Arrow keys are handled inside RulerController (only when ruler mode != 'off').
    });
  }
}

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
