# Icon Feature Implementation

Frontend hooks in `main.css` and `custom.js` drive the icon feature grid. This document covers the Drupal structures required and how the JS behavior depends on them.

---

## For Editors

Add an **Icon Feature Section** paragraph to a page. Inside it, add one or more **Icon Feature** paragraphs — each becomes a card in the grid.

**Each card has:**
- An optional icon (enter a name from the approved list below, e.g. `brain`, `compass`)
- A short heading (2–6 words)
- A brief body (1–3 sentences)

**The section itself has:**
- An optional **Show top divider** toggle — turns on a horizontal rule above the section
- An optional **Section heading** — appears above the card grid as a section title

**Grid layout is automatic:** 1–4 cards use a 2-column layout; 5 or more switch to 3 columns. Single column on mobile.

**Icon names must match exactly** — a typo means no icon renders (the card still works, just without the icon). Use only names from the approved icon list in section 2.

---

## 1) Paragraph Types

### Icon Feature (`icon_feature`)

An individual card with an optional icon, short heading, and brief body text. Used inside an Icon Feature Section.

| Field | Machine name | Type | Required | Notes |
|---|---|---|---|---|
| Icon | `field_icon` | Text (plain) | No | Lucide icon name (e.g. "brain", "compass"). See approved icon list. |
| Heading | `field_heading` | Text (plain) | Yes | Short — 2–6 words, no period |
| Body | `field_body` | Text (formatted, long) | Yes | 1–3 sentences; restrict to Basic/Restricted text format (bold, italic, links only — no headings, no images) |

**Help text for Icon field:** Enter a Lucide icon name (e.g. "brain", "compass"). See the [approved icon list] for valid options.

**Content entry rules:**
- Heading should be a short phrase — not a full sentence
- Body should be 1–3 sentences maximum; this is a card, not a content area
- Icon name must exactly match a Lucide icon name — typos silently fail to render

---

### Icon Feature Section (`icon_feature_section`)

Section containing a grid of icon feature cards.

| Field | Machine name | Type | Required | Notes |
|---|---|---|---|---|
| Show top divider | `field_show_top_divider` | Boolean | No | Renders a divider above the section; must be first in Manage Display |
| Section heading | `field_section_heading` | Text (plain) | No | Promoted to a plain `h3` by JS, inserted after the divider if present |
| Icon features | `field_icon_features` | Entity reference revisions (paragraph) | Yes | References `icon_feature`; unlimited cardinality |

---

## 2) Approved Icon List

Icons are sourced from [Lucide](https://lucide.dev) and injected as inline SVG by JS. Only the following names are approved for use in `field_icon`:

| Icon name | Label |
|---|---|
| `brain` | Focus & Awareness |
| `heart` | Compassion |
| `target` | Goals & Intention |
| `eye` | Mindfulness |
| `zap` | Resilience |
| `message-circle` | Communication |
| `users` | Community |
| `shield` | Boundaries |
| `sun` | Wellbeing |
| `leaf` | Growth |
| `compass` | Values & Direction |
| `layers` | Integration |

Icons are fetched from jsDelivr CDN at render time:
`https://cdn.jsdelivr.net/npm/lucide-static/icons/{icon-name}.svg`

---

## 3) Display Modes

### Paragraph: Icon Feature — Default

All fields visible, labels hidden.

| Field | Label | Format |
|---|---|---|
| `field_icon` | Hidden | Plain text |
| `field_heading` | Hidden | Plain text |
| `field_body` | Hidden | Default |

### Paragraph: Icon Feature Section — Default

| Field | Label | Format | Weight |
|---|---|---|---|
| `field_show_top_divider` | Hidden | Default | 0 (first) |
| `field_section_heading` | Hidden | Plain text | 1 |
| `field_icon_features` | Hidden | Rendered entity — Default | 2 |

**Important:** `field_show_top_divider` must appear first in Manage Display so the JS heading-insertion logic can find it as the reference node.

---

## 4) JS Behavior

### `iconFeatureSectionEnhancements`

Runs on `.paragraph--type--icon-feature-section`. Responsibilities:

- Checks for `:scope > .field--name-field-show-top-divider`; if present, inserts the heading after it so the divider renders above the heading
- Promotes `field_section_heading` to a plain `h3` (no class), hides the raw field
- Iterates each `.paragraph--type--icon-feature`
- Reads `field_icon`, `field_heading`, and `field_body` from each card
- Fetches the Lucide SVG by icon name from jsDelivr CDN and injects inline
- If `field_icon` is empty or the fetch fails, renders the card without an icon — no broken UI
- Replaces raw paragraph output with composed card markup
- Applies `icon-feature-grid--two` or `icon-feature-grid--three` class to the grid based on card count:
  - 2 cards → 2-col
  - 3–4 cards → 2-col
  - 5+ cards → 3-col
- Hides raw paragraph field after extraction

**Icon fetch pattern:**
```js
var iconName = iconField ? iconField.textContent.trim() : '';
if (iconName) {
  fetch('https://cdn.jsdelivr.net/npm/lucide-static/icons/' + iconName + '.svg')
    .then(function (r) { if (!r.ok) throw new Error('fetch failed'); return r.text(); })
    .then(function (svg) { iconEl.innerHTML = svg; })
    .catch(function () { iconEl.remove(); }); // fail silently
}
```

---

## 5) CSS

```css
.icon-feature-grid {
  display: grid;
  gap: var(--space-4); /* 32px */
}
.icon-feature-grid--two   { grid-template-columns: repeat(2, 1fr); }
.icon-feature-grid--three { grid-template-columns: repeat(3, 1fr); }

/* Responsive */
@media (max-width: 768px) {
  .icon-feature-grid--two,
  .icon-feature-grid--three { grid-template-columns: 1fr; }
}
@media (min-width: 769px) and (max-width: 1024px) {
  .icon-feature-grid--three { grid-template-columns: repeat(2, 1fr); }
}

.icon-feature-card {
  padding: var(--space-3); /* 24px */
  background: var(--color-surface-2);
  border-radius: var(--radius-md);
}
.icon-feature-card__icon svg {
  width: 32px;
  height: 32px;
  color: var(--color-primary);
}
.icon-feature-card__heading { /* h4/h5 weight */ }
.icon-feature-card__body    { /* small body text */ }
```

---

## 6) Known Limitations

- **Icon name validation:** There is no Drupal-side validation on `field_icon`. An unrecognized icon name fails silently — the card renders without an icon. Restrict entry to the approved icon list and consider a select list field in a future iteration to eliminate the failure mode entirely.
- **CDN dependency:** Icon SVGs are fetched from jsDelivr at render time. If the CDN is unavailable, icons will not render. Cards remain functional without them.
- **All-or-nothing grid:** The column count applies to the entire section. There is no per-card layout override.
