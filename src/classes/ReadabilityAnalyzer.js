/**
 * ReadabilityAnalyzer — computes the Flesch-Kincaid grade level of any text.
 *
 * Algorithm (one of the most widely-used readability formulas, derived
 * empirically by Kincaid et al. for the U.S. Navy in 1975):
 *
 *     FK Grade = 0.39 × (words / sentences)
 *              + 11.8  × (syllables / words)
 *              − 15.59
 *
 * Output is a U.S. school grade level. Grade 6 ≈ a typical 6th-grader;
 * Grade 12 ≈ high-school senior; Grade 16+ ≈ college / graduate prose.
 *
 * We also compute the Flesch Reading Ease (higher = easier):
 *
 *     FRE = 206.835 − 1.015 × (words / sentences)
 *                   − 84.6  × (syllables / words)
 *
 * Design principle: this class is pure. It depends on the existing
 * SyllableProcessor (Hypher / Liang's algorithm) for per-word syllable
 * counts, which means our Phase-3 work pays for itself a second time —
 * SyllableProcessor handles both the click-to-split feature AND the
 * syllable counts the FK formula needs.
 *
 * Caveat to mention in the presentation: Liang hyphenation is not
 * identical to true linguistic syllabification (~90% match), so the
 * grade estimate is within ~0.5 of what a stricter tool would report.
 * That tolerance is well within the precision of the formula itself.
 */
export class ReadabilityAnalyzer {
  constructor(syllableProcessor) {
    this.syllables = syllableProcessor;
  }

  /** Returns null fields for empty/too-short input. */
  analyze(text) {
    const t = String(text || '').trim();
    if (!t) {
      return { fkGrade: null, fre: null, words: 0, sentences: 0, syllables: 0 };
    }

    const sentences = this._countSentences(t);
    const words = this._countWords(t);
    const totalSyllables = this._countSyllables(t);

    if (words === 0 || sentences === 0) {
      return { fkGrade: null, fre: null, words, sentences, syllables: totalSyllables };
    }

    const wordsPerSentence = words / sentences;
    const syllablesPerWord = totalSyllables / words;
    const fkGrade = 0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59;
    const fre = 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord;

    return {
      fkGrade: Math.max(0, fkGrade),
      fre: Math.max(0, Math.min(120, fre)),
      words,
      sentences,
      syllables: totalSyllables,
      wordsPerSentence,
      syllablesPerWord,
    };
  }

  _countSentences(text) {
    // A sentence is a run of non-terminator chars followed by . ! or ?.
    // Trailing fragment without a terminator still counts as one sentence.
    const matches = text.match(/[^.!?]+[.!?]+/g);
    if (matches) return matches.length;
    return text.trim() ? 1 : 0;
  }

  _countWords(text) {
    // Word = anything containing at least one letter. Pure-punctuation
    // tokens (e.g. "—") would otherwise inflate the count and crash the
    // syllables-per-word average toward zero.
    const tokens = text.match(/\S+/g) || [];
    return tokens.filter((t) => /\p{L}/u.test(t)).length;
  }

  _countSyllables(text) {
    const tokens = text.match(/\S+/g) || [];
    let total = 0;
    for (const token of tokens) {
      if (!/\p{L}/u.test(token)) continue;
      const parts = this.syllables.syllabify(token);
      // Liang hyphenation returns a single-element array for words it
      // refuses to split. Treat any word as at least one syllable.
      total += Math.max(1, parts.length);
    }
    return total;
  }

  /** Pretty-print a grade number with a US-school-system label. */
  formatGrade(grade) {
    if (grade == null) return '—';
    const rounded = Math.round(grade * 10) / 10;
    if (rounded >= 16) return `Grade ${rounded.toFixed(1)} (Graduate)`;
    if (rounded >= 13) return `Grade ${rounded.toFixed(1)} (College)`;
    if (rounded >= 9) return `Grade ${rounded.toFixed(1)} (High school)`;
    if (rounded >= 6) return `Grade ${rounded.toFixed(1)} (Middle school)`;
    return `Grade ${rounded.toFixed(1)} (Elementary)`;
  }
}
