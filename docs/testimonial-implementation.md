# Testimonial Implementation

Frontend hooks in `main.css` and `custom.js` drive the testimonial section. This document covers the Drupal structures required and how the JS behavior depends on them.

---

## 1) Paragraph Types

### Testimonial (`testimonial`)

An individual testimonial consisting of a quote and optional attribution.

| Field | Machine name | Type | Required | Cardinality | Notes |
|---|---|---|---|---|---|
| Quote | `field_quote` | Text (plain) | Yes | 1 | The testimonial quote; do not include quotation marks — added by CSS |
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
| Section heading | `field_section_heading` | Text (plain) | No | 1 | Promoted to `h2.heading--h2-alt` by JS |
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

| Field | Label | Format |
|---|---|---|
| `field_section_heading` | Hidden | Plain text |
| `field_testimonials` | Hidden | Rendered entity — Default |

---

## 3) JS Behavior

### `testimonialSectionEnhancements`

Runs on `.paragraph--type--testimonial-section`. Responsibilities:

- Promotes `field_section_heading` to `h2.heading--h2-alt`
- Reads all `.paragraph--type--testimonial` elements, extracts quote and attribution
- Hides raw paragraph output after extraction
- **Single testimonial:** renders statically — quote and attribution, no cycling, no indicator
- **Multiple testimonials:** builds cycling display:
  - Crossfade transition between quotes (fade out current, fade in next)
  - 5 second interval per quote
  - Infinite loop
  - Pauses on hover (`mouseenter` / `mouseleave`)
  - Respects `prefers-reduced-motion` — if set, disables auto-cycling and renders all quotes statically or shows only the first with no transition
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
    <button class="testimonial-indicator__dot testimonial-indicator__dot--active" aria-label="Testimonial 1"></button>
    <button class="testimonial-indicator__dot" aria-label="Testimonial 2"></button>
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

```css
.testimonial-section {
  text-align: center;
  padding: var(--space-4);
}

.testimonial-stage {
  position: relative;
  min-height: 8rem; /* prevent layout shift during crossfade */
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
  font-size: var(--font-size-lg);
  font-style: italic;
  margin: 0 0 var(--space-2);
}

.testimonial-item__quote::before { content: "\201C"; }
.testimonial-item__quote::after  { content: "\201D"; }

.testimonial-item__attribution {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin: 0;
}

.testimonial-indicator {
  display: flex;
  justify-content: center;
  gap: var(--space-1);
  margin-top: var(--space-3);
}

.testimonial-indicator__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: none;
  background: var(--color-border);
  cursor: pointer;
  padding: 0;
  transition: background 0.3s ease;
}

.testimonial-indicator__dot--active {
  background: var(--color-primary);
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .testimonial-item {
    transition: none;
  }
}
```

---

## 5) Known Limitations

- **No manual prev/next controls** — cycling is automatic only. Indicator dots allow jumping to a specific quote.
- **Static fallback for reduced motion** — users with `prefers-reduced-motion` set will see only the first testimonial or all testimonials stacked, depending on implementation choice.
- **Quote length** — very long quotes will cause layout shift during crossfade. Content entry rule: keep quotes to 1–3 sentences.
