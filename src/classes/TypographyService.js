/**
 * TypographyService — updates CSS custom properties to restyle the reader.
 *
 * Why CSS variables instead of writing styles directly on the reader element:
 *   - One write to :root cascades to every descendant that consumes the var.
 *   - The browser handles invalidation; no JS layout thrash, no per-element
 *     style writes when the document is long.
 *   - It cleanly separates concerns: this service knows about typography
 *     variables, the stylesheet knows how to use them.
 *
 * Design principle: Single Responsibility. This service does not touch
 * speech, themes, or text content. It only translates control values
 * into the corresponding --reader-* CSS variable.
 *
 * Evidence basis: British Dyslexia Association Style Guide; Zorzi et al. 2012
 * (PNAS) showed that increased letter spacing reduced visual crowding and
 * improved reading accuracy in dyslexic children.
 */
export class TypographyService {
  constructor(targetEl) {
    // Default target is :root (the <html> element). CSS vars defined there
    // are visible to every selector that descends from it.
    this.target = targetEl;
  }

  setVar(name, value) {
    this.target.style.setProperty(name, value);
  }

  bindControls(controls) {
    const {
      fontFamily,
      fontSize,
      letterSpacing,
      wordSpacing,
      lineHeight,
      maxWidth,
    } = controls;

    fontFamily.addEventListener('change', (e) => {
      this.setVar('--reader-font-family', e.target.value);
    });

    fontSize.addEventListener('input', (e) => {
      const pt = e.target.value;
      this.setVar('--reader-font-size', `${pt}pt`);
      document.getElementById('font-size-value').textContent = pt;
    });

    letterSpacing.addEventListener('input', (e) => {
      const v = e.target.value;
      this.setVar('--reader-letter-spacing', `${v}em`);
      document.getElementById('letter-spacing-value').textContent = v;
    });

    wordSpacing.addEventListener('input', (e) => {
      const v = e.target.value;
      this.setVar('--reader-word-spacing', `${v}em`);
      document.getElementById('word-spacing-value').textContent = v;
    });

    lineHeight.addEventListener('input', (e) => {
      const v = e.target.value;
      this.setVar('--reader-line-height', v);
      document.getElementById('line-height-value').textContent = v;
    });

    maxWidth.addEventListener('input', (e) => {
      const v = e.target.value;
      this.setVar('--reader-max-width', `${v}ch`);
      document.getElementById('max-width-value').textContent = v;
    });
  }
}
