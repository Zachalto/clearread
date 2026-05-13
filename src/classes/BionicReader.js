/**
 * BionicReader — bolds the first portion of each word to give the eye
 * "fixation anchors" along the line. Toggling the mode rewrites the
 * children of every word span; toggling it off restores the original
 * text from the span's `data-original` attribute.
 *
 * Algorithm (pure function `boldLengthFor`):
 *   - count only letters (ignore punctuation)
 *   - bold half of them, rounded up, minimum 1
 *   - "every" → bold "ev", "ery" stays normal
 *   - "photosynthesis" → bold "photosyn", "thesis" stays normal
 *
 * Design principle: Single Responsibility — knows about bionic transforms
 * and nothing else. It receives a single word span and emits the new
 * children for it; it does not know about TTS highlighting, syllable
 * splits, or the rest of the reader. The App composes it with the other
 * services.
 *
 * Evidence basis: mixed. Origin in Casutt (2017); the approach is widely
 * used by dyslexic readers anecdotally but controlled studies have not
 * produced consistent comprehension gains. We surface it as a personal
 * preference mode rather than a clinical recommendation — see research.json.
 */
export class BionicReader {
  constructor(settingsStore) {
    this.store = settingsStore;
    this.enabled = Boolean(this.store?.get('bionic.enabled', false));
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    this.store?.set('bionic.enabled', this.enabled);
  }

  /** Pure helper: how many letters to bold in a word of N letters. */
  boldLengthFor(letterCount) {
    if (letterCount <= 0) return 0;
    return Math.max(1, Math.ceil(letterCount * 0.5));
  }

  /**
   * Replace the contents of a word span with a <strong> for the bolded
   * head plus a text node for the tail. Punctuation stays attached to
   * whichever side it was originally on.
   */
  apply(span) {
    const original = span.dataset.original || span.textContent;
    span.replaceChildren();

    // Index every position that holds a letter (ignoring punctuation,
    // digits, apostrophes). The split position is "just after the Nth
    // letter," which we pick from this index.
    const letterPositions = [];
    for (let i = 0; i < original.length; i += 1) {
      if (/\p{L}/u.test(original[i])) letterPositions.push(i);
    }
    if (letterPositions.length === 0) {
      span.textContent = original;
      return;
    }
    const boldLen = this.boldLengthFor(letterPositions.length);
    const splitAt = letterPositions[boldLen - 1] + 1;

    const head = original.slice(0, splitAt);
    const tail = original.slice(splitAt);
    const strong = document.createElement('strong');
    strong.className = 'bionic-bold';
    strong.textContent = head;
    span.appendChild(strong);
    if (tail) span.appendChild(document.createTextNode(tail));
  }

  /** Restore a word span to its plain original text. */
  reset(span) {
    span.textContent = span.dataset.original || span.textContent;
  }

  /**
   * Apply or remove bionic across every .word in a container. Skips
   * spans currently in syllable-split mode so we do not clobber them —
   * the click handler in App takes care of re-applying bionic when the
   * user restores a split word.
   */
  applyToAll(container) {
    const spans = container.querySelectorAll('.word');
    for (const span of spans) {
      if (span.classList.contains('split')) continue;
      if (this.enabled) this.apply(span);
      else this.reset(span);
    }
  }
}
