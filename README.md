# ClearRead

An evidence-based reading companion for people with dyslexia. Load any text — pasted, .txt, .docx, or .pdf — and customise the way it's displayed: typography, colour, reading ruler, text-to-speech with synchronised word highlighting, click-to-split-syllables, and an optional AI "Simplify this" rewriter.

This is a solo high-school computer-science project. Every feature is backed by published dyslexia research or established accessibility guidelines, and every adjustable control has an ⓘ icon that shows the evidence.

## Features

| # | Feature | What it does | Evidence |
|---|---|---|---|
| 1 | Multi-format text ingestion | Paste, or upload `.txt` / `.docx` / `.pdf`. Built with a polymorphic `TextSource` hierarchy. | — |
| 2 | Typography engine | Six controls — font, size, letter spacing, word spacing, line height, max line width — driven by CSS custom properties. | BDA Style Guide; Zorzi et al. 2012 (PNAS) |
| 3 | Text-to-speech | Play / pause / stop, adjustable speed, voice selection. Words highlight in sync via `SpeechSynthesisUtterance.onboundary`. | Wood et al. 2017 meta-analysis (d ≈ 0.35) |
| 4 | Reading ruler | Three modes: highlight bar, dimmed surroundings, single-line spotlight. Mouse or arrow-key controlled. | Bhattacharya et al. 2023 (ACM CHI); Bucci et al. 2011 |
| 5 | Themes + custom colour | BDA Cream, Soft Pastel, Dark, High Contrast, Custom (colour + opacity). No pure-white default. | BDA Style Guide |
| 6 | Click-to-split syllables | Click any word to split it via Liang's hyphenation algorithm (Hypher + en-US patterns); click again to restore. | IDA Structured Literacy; Snowling 2000; Goswami 2015 |
| 7 | "Why this helps" research layer | Every feature has an ⓘ icon → research citations, plain-language summary, evidence rating. Data lives in `src/data/research.json`. | — |
| 8 | AI Simplify (bonus) | Rewrites the current text or selection at a 6th-grade reading level via a small Express proxy → Anthropic API. Cached client-side; system prompt cached server-side. Optional — the app works fully without it. | WCAG 2.1 §3.1.5; W3C COGA |

## Architecture (OOP)

```
App                 — top-level Mediator. Wires everything.
├── TextSource          (abstract; polymorphism)
│   ├── PastedTextSource
│   ├── TxtFileSource
│   ├── DocxFileSource
│   └── PdfFileSource
├── ReaderView          — renders text, owns word-level <span>s
├── TypographyService   — drives --reader-* CSS variables
├── ThemeManager        — drives palette CSS variables
├── SpeechService       — Observer: emits 'boundary' events
├── RulerController     — line-focus overlay
├── SyllableProcessor   — pure: word -> syllables
├── ResearchPanel       — data-driven dialog from JSON
├── AISimplifier        — calls /api/simplify with caching
└── SettingsStore       — localStorage wrapper used by all of the above
```

**Design patterns used (labelled in code comments):**
- Polymorphism — `TextSource` and its subclasses.
- Observer — `SpeechService.on('boundary', …)` → `ReaderView.highlightAtChar(…)`.
- Mediator — `App` is the single place where services wire to each other.
- Proxy — the Express backend in `/server` proxies the Anthropic API so the key never reaches the browser.
- Single Responsibility — every service owns one concern.

## Running it

### Frontend

```bash
cd clearread
npm install
npm run dev
```

Opens at <http://localhost:5173>. The app is fully functional from here — Features 1–7 need nothing else.

### Backend (only for the AI "Simplify" feature)

```bash
cd clearread/server
npm install
cp .env.example .env       # then add your ANTHROPIC_API_KEY
npm start
```

The backend listens on <http://localhost:3000>. Vite's dev server proxies `/api/*` to it, so the frontend just calls `/api/simplify` directly. Without a key, the backend still starts and `/api/health` reports `aiEnabled: false`; the frontend hides the Simplify button (everything else still works).

**Get an API key at <https://console.anthropic.com/>.** The proxy uses `claude-haiku-4-5-20251001` (fast, cheap) with prompt caching on the system message — subsequent simplifications within ~5 minutes cost ~80% less.

## Keyboard shortcuts

| Key | Action |
|---|---|
| Space (reader focused) | Play / pause speech |
| Escape | Stop speech |
| ↑ / ↓ | Step the reading ruler one line at a time (when ruler is active) |
| Ctrl/Cmd + Enter (in paste box) | Load pasted text |

## File layout

```
clearread/
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.js
│   ├── classes/
│   │   ├── App.js
│   │   ├── TextSource.js
│   │   ├── ReaderView.js
│   │   ├── TypographyService.js
│   │   ├── ThemeManager.js
│   │   ├── SpeechService.js
│   │   ├── RulerController.js
│   │   ├── SyllableProcessor.js
│   │   ├── ResearchPanel.js
│   │   ├── AISimplifier.js
│   │   └── SettingsStore.js
│   ├── data/
│   │   ├── research.json
│   │   └── samples.json
│   └── styles/
│       ├── main.css
│       ├── themes.css
│       └── ruler.css
└── server/
    ├── index.js
    ├── package.json
    └── .env.example
```

## Notes for the presenter

- **The AI feature is supporting, not core.** Features 1–7 are real CS — algorithms, DOM manipulation, OOP, the Web Speech API. Feature 8 is one well-chosen API call to demonstrate that you can use external services responsibly (server-side key, error handling, caching).
- **Hypher implements *hyphenation*, not strict linguistic syllabification.** They overlap ~90% in English. The class comment in `SyllableProcessor.js` explains the trade-off if a teacher asks.
- **Word-boundary highlighting depends on `SpeechSynthesisUtterance.onboundary`,** which is reliable in Chromium/Edge and patchy in Firefox/Safari. The app degrades gracefully — speech still works, the highlight just doesn't fire.
- **All settings persist** to `localStorage` under the prefix `clearread:`. The Reset button in the header clears them.
