/**
 * SyllableProcessor — splits a word into syllables using Liang's
 * hyphenation algorithm (via the Hypher library + the en-US pattern set).
 *
 * Pedagogical note for the presentation slide:
 *
 *   Liang's algorithm walks every position between characters in a word
 *   and assigns it a numeric "priority" derived from a dictionary of
 *   small patterns (e.g. "1tio", "2io1"). Odd priorities mean "split is
 *   allowed here," even priorities mean "do not split." The highest-
 *   priority decision wins at each position. This is the same algorithm
 *   TeX uses to hyphenate paragraphs of text.
 *
 *   We are USING hyphenation as a proxy for syllabification — they overlap
 *   ~90% in English but are not the same thing (e.g. "every" hyphenates
 *   as "ev-ery" but syllabifies as "ev-e-ry"). For a reading-support
 *   tool that is the right trade-off: hyphenation gives speakable chunks
 *   that match how readers naturally break long words.
 *
 * Design principle: Single Responsibility + pure functions. This class
 * has no DOM dependency, no state beyond its Hypher instance, and is
 * trivially testable.
 *
 * Evidence basis: International Dyslexia Association's Structured
 * Literacy approach — phonological-based word decomposition is central
 * to reading instruction for dyslexia (Snowling 2000; Goswami 2015).
 */
import Hypher from 'hypher';
import english from 'hyphenation.en-us';

export class SyllableProcessor {
  constructor() {
    this.hypher = new Hypher(english);
  }

  /**
   * Split a token (possibly with surrounding punctuation) into hyphenation
   * parts. Punctuation stays attached to the outer parts so the display
   * reads naturally — "(photosynthesis)," becomes ["(pho", "to", "syn",
   * "the", "sis),"].
   *
   * If the token has no alphabetic content, returns it unchanged.
   */
  syllabify(token) {
    const m = /^([^\p{L}]*)([\p{L}]+(?:['’][\p{L}]+)*)([^\p{L}]*)$/u.exec(String(token));
    if (!m) return [token];
    const [, lead, core, trail] = m;
    const parts = this.hypher.hyphenate(core);
    if (!parts || parts.length <= 1) return [token];
    if (lead) parts[0] = lead + parts[0];
    if (trail) parts[parts.length - 1] = parts[parts.length - 1] + trail;
    return parts;
  }

  /** Convenience: build a display string with middle-dot separators. */
  formatWithDots(token) {
    const parts = this.syllabify(token);
    if (parts.length <= 1) return token;
    return parts.join('·');
  }
}
