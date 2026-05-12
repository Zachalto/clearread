/**
 * ThemeManager — owns the colour palette CSS variables on :root.
 *
 * Five presets, plus a Custom mode driven by a color input and an
 * opacity slider. Custom blends the picked colour toward white at the
 * given strength, then auto-picks a contrasting text colour based on
 * the resulting luminance.
 *
 * Design principle: Single Responsibility. Knows about palette variables
 * only. Typography is somebody else's job.
 *
 * Evidence basis: British Dyslexia Association Style Guide explicitly
 * advises against pure white backgrounds (cream / off-white reduces
 * glare). Coloured-overlay research for dyslexia is mixed, so we frame
 * the Custom mode as user preference rather than clinical treatment.
 */
const PRESETS = {
  'bda-cream': {
    '--bg-page': '#fdf6e3',
    '--bg-panel': '#fffbf0',
    '--fg-text': '#2d2d2d',
    '--fg-muted': '#6b6b6b',
    '--border': '#d8d0b8',
    '--accent': '#4a6fa5',
    '--accent-fg': '#ffffff',
  },
  'soft-pastel': {
    '--bg-page': '#eef4fb',
    '--bg-panel': '#f7fbff',
    '--fg-text': '#222831',
    '--fg-muted': '#6a7280',
    '--border': '#cfd9e6',
    '--accent': '#6b7fc5',
    '--accent-fg': '#ffffff',
  },
  dark: {
    '--bg-page': '#1d1f24',
    '--bg-panel': '#262933',
    '--fg-text': '#e7e9ed',
    '--fg-muted': '#a3a9b5',
    '--border': '#393d49',
    '--accent': '#7ea0ff',
    '--accent-fg': '#1d1f24',
  },
  'high-contrast': {
    '--bg-page': '#000000',
    '--bg-panel': '#0a0a0a',
    '--fg-text': '#ffffff',
    '--fg-muted': '#cccccc',
    '--border': '#ffffff',
    '--accent': '#ffd400',
    '--accent-fg': '#000000',
  },
};

export class ThemeManager {
  constructor(rootEl, settingsStore) {
    this.root = rootEl; // <html>
    this.body = document.body;
    this.store = settingsStore;
    this.themeName = this.store?.get('theme.name', 'bda-cream') || 'bda-cream';
    this.customColor = this.store?.get('theme.customColor', '#ffeebb') || '#ffeebb';
    this.customOpacity = this.store?.get('theme.customOpacity', 0.7) ?? 0.7;
  }

  apply(name) {
    this.themeName = name;
    this.store?.set('theme.name', name);
    this.body.dataset.theme = name;

    if (name === 'custom') {
      this._applyCustom();
      return;
    }
    const preset = PRESETS[name];
    if (!preset) return;
    for (const [key, value] of Object.entries(preset)) {
      this.root.style.setProperty(key, value);
    }
  }

  setCustomColor(hex) {
    this.customColor = hex;
    this.store?.set('theme.customColor', hex);
    if (this.themeName === 'custom') this._applyCustom();
  }

  setCustomOpacity(opacity) {
    this.customOpacity = Number(opacity);
    this.store?.set('theme.customOpacity', this.customOpacity);
    if (this.themeName === 'custom') this._applyCustom();
  }

  _applyCustom() {
    const rgb = hexToRgb(this.customColor);
    if (!rgb) return;
    // Blend the picked colour toward white. Higher opacity = more saturated.
    const mixed = blend(rgb, [255, 255, 255], 1 - this.customOpacity);
    const lum = luminance(mixed);
    const fgText = lum > 0.55 ? '#1a1a1a' : '#f5f5f5';
    const fgMuted = lum > 0.55 ? '#555555' : '#bcbcbc';
    const border = lum > 0.55 ? '#cfc6a8' : '#5a5a5a';

    this.root.style.setProperty('--bg-page', rgbToCss(mixed));
    // Panel is slightly lighter than page so panels stand out:
    const panel = blend(mixed, [255, 255, 255], 0.4);
    this.root.style.setProperty('--bg-panel', rgbToCss(panel));
    this.root.style.setProperty('--fg-text', fgText);
    this.root.style.setProperty('--fg-muted', fgMuted);
    this.root.style.setProperty('--border', border);
    this.root.style.setProperty('--accent', '#4a6fa5');
    this.root.style.setProperty('--accent-fg', '#ffffff');
  }

  bindControls(controls) {
    const { select, customBg, customOpacityRange, customWrap } = controls;

    select.value = this.themeName;
    customBg.value = this.customColor;
    customOpacityRange.value = this.customOpacity;
    document.getElementById('custom-opacity-value').textContent = this.customOpacity.toFixed(2);
    customWrap.hidden = this.themeName !== 'custom';

    // Apply current theme on init so reload matches stored preference.
    this.apply(this.themeName);

    select.addEventListener('change', (e) => {
      const name = e.target.value;
      customWrap.hidden = name !== 'custom';
      this.apply(name);
    });

    customBg.addEventListener('input', (e) => this.setCustomColor(e.target.value));
    customOpacityRange.addEventListener('input', (e) => {
      this.setCustomOpacity(e.target.value);
      document.getElementById('custom-opacity-value').textContent = Number(e.target.value).toFixed(2);
    });
  }
}

// --- colour helpers ---------------------------------------------------------

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || ''));
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
}

function blend(a, b, t) {
  // t = 0 -> all a, t = 1 -> all b
  return [
    Math.round(a[0] * (1 - t) + b[0] * t),
    Math.round(a[1] * (1 - t) + b[1] * t),
    Math.round(a[2] * (1 - t) + b[2] * t),
  ];
}

function rgbToCss([r, g, b]) {
  return `rgb(${r}, ${g}, ${b})`;
}

function luminance([r, g, b]) {
  // Rec. 709 relative luminance, 0..1.
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
