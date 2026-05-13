// Entry point. Bundled font CSS imports happen first so @font-face rules are
// in the stylesheet before the reader is painted.
//
// Why bundle the fonts: OpenDyslexic and Lexend are dyslexia-targeted typefaces
// that aren't on every machine — relying on the system would mean the most
// important fonts in the picker silently fall back to a generic sans-serif
// for many users. Bundling guarantees the experience matches across devices.

import '@fontsource/opendyslexic/400.css';
import '@fontsource/opendyslexic/700.css';
import '@fontsource/lexend/400.css';
import '@fontsource/lexend/700.css';
import '@fontsource/open-sans/400.css';
import '@fontsource/open-sans/700.css';

import { App } from './classes/App.js';

const app = new App();
app.init();
