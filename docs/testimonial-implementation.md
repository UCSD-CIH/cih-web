# Testimonial Implementation

Frontend hooks in `main.css` and `custom.js` drive the testimonial section. This document covers the Drupal structures required and how the JS behavior depends on them.

---

## For Editors

Add a **Testimonial Section** paragraph to a page. Inside it, add one or more **Testimonial** paragraphs — each is one quote.

**Each testimonial has:**
- A **Quote** — the quote text, no quotation marks (CSS adds them automatically)
- An optional **Attribution** — one line: name, title, or both (e.g. "Jane Smith, Program Participant")

**The section itself has:**
- An optional **Show top divider** toggle — turns on a horizontal rule above the section
- An optional **Section heading** — appears above the quotes (e.g. "Testimonials", "What Participants Say")

**Display behavior:**
- **One quote:** displays statically, no animation
- **Two or more quotes:** cycles automatically, one at a time, with a crossfade every 8 seconds. Dot indicators appear below — clicking a dot jumps to that quote. Hovering pauses the cycle.
- Users with reduced-motion system preferences see all quotes stacked, no animation.

---

## 1) Paragraph Types

### Testimonial (`testimonial`)

An individual testimonial consisting of a quote and optional attribution.

| Field | Machine name | Type | Required | Cardinality | Notes |
|---|---|---|---|---|---|
| Quote | `field_quote` | Text (plain, long) | Yes | 1 | The testimonial quote; do not include quotation marks — added by CSS |
| Attribution | `field_attribution` | Text (plain) | No | 1 | Name, title, or both in one line (e.g. "Jane Smith, Program Participant") |

**Content entry rules:**
- Do not wrap the quote in quotation marks — CSS handles that
- Attribution is a single plain text line; no formatting needed
- Keep quotes concise — 1–3 sentences optimal for cycling display

---

### Testimonial Section (`testimonial_section`)

A section containing one or more testimonials, rendered as a static quote or auto-cycling display.

| Field | Machine name | Type | Required | Cardinality | Notes |
|---|---|---|---|---|---|
| Show top divider | `field_show_top_divider` | Boolean | No | 1 | Renders an `<hr>`-style divider above the section; processed by `topDividerFieldAdapter` |
| Section heading | `field_section_heading` | Text (plain) | No | 1 | Promoted to a plain `h3` by JS, inserted after the divider field if present |
| Testimonials | `field_testimonials` | Entity reference revisions (paragraph) | Yes | Unlimited | References `testimonial` |

---

## 2) Display Modes

### Paragraph: Testimonial — Default

All fields visible, labels hidden.

| Field | Label | Format |
|---|---|---|
| `field_quote` | Hidden | Plain text |
| `field_attribution` | Hidden | Plain text |

### Paragraph: Testimonial Section — Default

| Field | Label | Format | Weight |
|---|---|---|---|
| `field_show_top_divider` | Hidden | Default | 0 (first) |
| `field_section_heading` | Hidden | Plain text | 1 |
| `field_testimonials` | Hidden | Rendered entity — Default | 2 |

**Important:** `field_show_top_divider` must appear first in Manage Display so the JS heading-insertion logic can find it as the reference node.

---

## 3) JS Behavior

### `testimonialSectionEnhancements`

Runs on `.paragraph--type--testimonial-section`. Responsibilities:

- Checks for `:scope > .field--name-field-show-top-divider`; if present, inserts the heading after it (not at `section.firstChild`) so the divider renders above the heading
- Promotes `field_section_heading` to a plain `h3` (no class), hides the raw field
- Reads all `.paragraph--type--testimonial` elements, extracts quote and attribution
- Hides raw paragraph output after extraction
- **Single testimonial:** renders statically — quote and attribution, no cycling, no indicator
- **Multiple testimonials:** builds cycling display:
  - Crossfade transition between quotes (fade out current, fade in next)
  - 8 second interval per quote
  - Infinite loop
  - Pauses on hover (`mouseenter` / `mouseleave`)
  - Respects `prefers-reduced-motion` — if set, disables auto-cycling and renders all quotes statically with margin between them; no indicator dots
  - Progress indicator: one dot per testimonial rendered beneath the quote; active dot gets `.testimonial-indicator__dot--active` class, updates on each cycle

**Rendered markup structure:**
```html
<div class="testimonial-section">
  <div class="testimonial-stage">
    <div class="testimonial-item testimonial-item--active">
      <blockquote class="testimonial-item__quote">Quote text</blockquote>
      <p class="testimonial-item__attribution">Attribution</p>
    </div>
    <div class="testimonial-item">...</div>
    <!-- additional items -->
  </div>
  <div class="testimonial-indicator">
    <button class="testimonial-indicator__dot testimonial-indicator__dot--active" aria-label="Testimonial 1" type="button"></button>
    <button class="testimonial-indicator__dot" aria-label="Testimonial 2" type="button"></button>
    <!-- one per testimonial -->
  </div>
</div>
```

**Accessibility:**
- Indicator dots are `<button>` elements — clicking a dot jumps to that testimonial and resets the timer
- `aria-label` on each dot identifies position
- Auto-cycling stops when `prefers-reduced-motion` is set
- Pauses on hover to allow reading

---

## 4) CSS

New classes added to `main.css` under `/* NATIVE PARAGRAPHS: TESTIMONIAL SECTION */`:

```css
.paragraph--type--testimonial-section {
  margin-top: var(--space-400);
}
.paragraph--type--testimonial-section .field__label {
  display: none;
}
.testimonial-section {
  text-align: center;
  padding: var(--space-200) 0;
  max-width: 758px;
  margin-inline: auto;
}
.testimonial-stage {
  position: relative;
  min-height: 8rem; /* prevents layout shift during crossfade */
}
.testimonial-item {
  opacity: 0;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  transition: opacity 0.6s ease;
  pointer-events: none;
}
.testimonial-item--active {
  opacity: 1;
  position: relative;
  pointer-events: auto;
}
.testimonial-item__quote {
  font-family: 'Inter', sans-serif;
  font-size: 20px;
  line-height: 32px;
  letter-spacing: -0.005em;
  font-style: italic;
  font-weight: 400;
  color: var(--color-text-paragraph);
  margin: 0 0 var(--space-200) 0;
  border: none;
  padding: 0;
}
.testimonial-item__quote::before { content: "\201C"; }
.testimonial-item__quote::after  { content: "\201D"; }
.testimonial-item__attribution {
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  line-height: 20px;
  letter-spacing: 0;
  color: var(--color-text-subdued-strong);
  margin: 0;
}
.testimonial-indicator {
  display: flex;
  justify-content: center;
  gap: var(--space-100);
  margin-top: var(--space-300);
}
.testimonial-indicator__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: none;
  background: var(--color-border-plain);
  cursor: pointer;
  padding: 0;
  transition: background 0.3s ease;
}
.testimonial-indicator__dot--active {
  background: var(--color-bg-blue-100);
}
@media (prefers-reduced-motion: reduce) {
  .testimonial-item { transition: none; }
}
```

---

## 5) Known Limitations

- **No manual prev/next controls** — cycling is automatic only. Indicator dots allow jumping to a specific quote.
- **Static fallback for reduced motion** — users with `prefers-reduced-motion` set see all testimonials stacked with `var(--space-400)` margin between them; no dots shown.
- **Quote length** — very long quotes will cause layout shift during crossfade. Content entry rule: keep quotes to 1–3 sentences.
- **Divider field ordering** — `field_show_top_divider` must be first in Manage Display. If it appears after `field_section_heading` in the rendered HTML, the heading will insert before the divider rather than after it.
