/**
 * ResearchPanel — surfaces the evidence behind every adjustable feature.
 *
 * Each ⓘ button in the UI carries a `data-feature` attribute. Clicking it
 * opens a native <dialog> populated from research.json. The mapping is
 * data-driven: to add or change a citation, edit the JSON file — no
 * code changes required.
 *
 * Design pattern: Data-driven UI. The content lives in JSON; the class
 * just renders. Adding a new feature is one JSON entry away.
 */
export class ResearchPanel {
  constructor({ dialogEl, contentEl, dataset }) {
    this.dialog = dialogEl;
    this.content = contentEl;
    this.data = dataset || {};
  }

  static async load(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load research data (${res.status})`);
    return res.json();
  }

  bindTriggers(root = document) {
    root.querySelectorAll('[data-feature]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const id = el.getAttribute('data-feature');
        this.show(id);
      });
    });
  }

  show(featureId) {
    const entry = this.data[featureId];
    if (!entry) {
      this.content.innerHTML = `<p class="placeholder">No research notes for this feature yet.</p>`;
    } else {
      this.content.innerHTML = this._renderEntry(entry);
    }
    if (typeof this.dialog.showModal === 'function') this.dialog.showModal();
    else this.dialog.setAttribute('open', 'open');
  }

  _renderEntry(entry) {
    const evidence = entry.evidence || 'preference';
    const badge = BADGES[evidence] || BADGES.preference;

    const citations = Array.isArray(entry.citations) ? entry.citations : [];
    const citationHtml = citations
      .map((c) => `<li>${escapeHtml(c)}</li>`)
      .join('');

    return `
      <span class="evidence-badge evidence-${evidence}">${badge.icon} ${badge.label}</span>
      <h3>${escapeHtml(entry.title || 'About this feature')}</h3>
      <p>${escapeHtml(entry.summary || '')}</p>
      ${citations.length ? `<h4>Sources</h4><ul class="citation-list">${citationHtml}</ul>` : ''}
      ${entry.note ? `<p class="note"><strong>Note:</strong> ${escapeHtml(entry.note)}</p>` : ''}
    `;
  }
}

const BADGES = {
  strong: { icon: '✅', label: 'Strong evidence' },
  mixed: { icon: '⚠️', label: 'Mixed evidence' },
  preference: { icon: '🔵', label: 'User preference' },
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
