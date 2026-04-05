# Program Content Type Implementation

Frontend hooks in `main.css` and `custom.js` drive the program card, program feed, and program detail page sidebar. This document covers the Drupal structures required and how the JS behaviors depend on them.

---

## 1) Content Type

- Label: `Program`
- Machine name: `program`

---

## 2) Paragraph Types

### Program Session (`program_session`)

Each program has one or more session paragraphs representing individual offerings.

| Field | Machine name | Type | Notes |
|---|---|---|---|
| Session start date | `field_session_start_date` | Datetime | Required |
| Session end date | `field_session_end_date` | Datetime | Required |
| Registration start date | `field_registration_start_date` | Datetime | |
| Registration end date | `field_registration_end_date` | Datetime | Used by JS to gate card visibility and sidebar state |
| Registration link | `field_registration_link` | Link | Presence indicates session has a registration path |
| Day and time | `field_day_and_time` | Text (plain) | e.g. "Tuesdays, 9:30–11 AM PT" |
| Program format | `field_program_format` | Entity reference (taxonomy) | Term IDs: 113=Online, 114=In Person, 115=Hybrid, 116=Audio |
| Location | `field_location` | Text (plain) | Physical address; shown only for In Person sessions (term 114) |
| Instructor(s) | `field_instructors` | Entity reference (Profile nodes) | |
| Session note | `field_session_note` | Text (plain) | |

**Content entry rule:** Registration start date must be earlier than registration end date. If entered in reverse order, JS visibility filtering will treat the session as expired regardless of actual dates.

---

## 3) Fields on `program`

| Field | Machine name | Type | Notes |
|---|---|---|---|
| Program session | `field_program_session` | Entity reference revisions (paragraph) | Unlimited; references `program_session` |
| Program summary | `field_program_summary` | Text (long) | Shown on cards |
| Program format | `field_program_format` | Entity reference (taxonomy) | Node-level; used for filtering |
| Audience type | `field_audience_type` | Entity reference (taxonomy) | "Public" is hidden on cards; "Professional" renders as "Training" |
| Price | `field_price` | Text (plain) | Shown at top of sidebar |
| Pricing details | `field_pricing_details` | Text (long) | Shown below price in sidebar |
| Registration link | `field_registration_link` | Link | Node-level fallback; session-level links take precedence |
| Subscribe link | `field_subscribe_link` | Link | Shown when registration is closed |
| Contact email | `field_contact_email` | Email | Rendered as a mailto link with surrounding copy |
| Instructors | `field_instructors` | Entity reference (Profile nodes) | Node-level; shown in program body |
| Body | `body` | Text (long, formatted) | Program overview |
| Continuing education | `field_continuing_education` | Text (long, formatted) | |
| Cancellation policy | `field_cancellation_policy` | Text (long, formatted) | |
| Featured image | `field_post_featured_image` | Entity reference (Media) | Used on compact cards |
| Schedule | `field_schedule` | Text (plain) | Node-level day/time; overridden by session-level `field_day_and_time` when sessions are present |

---

## 4) Taxonomies

- **Program Format** (`program_format`): Online (113), In Person (114), Hybrid (115), Audio (116)
- **Audience Type** (`audience_type`): Public, Professional

---

## 5) Display Modes

### Node: Program Card Compact

Used in the Program Feed paragraph embed. Must include:

- `field_program_session` — formatter: **Rendered entity**, view mode: **Default**
- `field_program_summary`
- `field_post_featured_image`
- `field_program_format`
- `field_audience_type`
- `field_schedule` (if used at node level)

### Paragraph: Program Session — Default

Used when `field_program_session` renders as "Rendered entity" on the compact card. Must include all fields the JS reads:

| Field | Label | Format |
|---|---|---|
| `field_session_start_date` | Hidden | Default (outputs `<time datetime="...">`) |
| `field_session_end_date` | Hidden | Default |
| `field_registration_start_date` | Hidden | Default |
| `field_registration_end_date` | Hidden | Default |
| `field_registration_link` | Hidden | Link |
| `field_day_and_time` | Hidden | Plain text |
| `field_program_format` | Hidden | Default |
| `field_instructors` | Hidden | Rendered entity (instructor-compact view mode) |
| `field_location` | Hidden | Default |

**Important:** Date fields must use the Default formatter (not Plain text) so that Drupal renders a `<time datetime="...">` element. The JS reads the `datetime` attribute directly.

---

## 6) Program Feed Paragraph (`program_feed`)

A paragraph type that embeds a Drupal view of published programs.

- View: Programs CFM (`view_id: programs_cfm`)
- Display: Page or embed returning `article.program-card-compact` cards
- **No date filters in the View** — visibility filtering is handled entirely by JS to support programs with a mix of expired and active sessions

Fields on the paragraph:
- `field_section_heading` — promoted to `h2.heading--h2-alt` by JS

---

## 7) JS Behaviors

All behaviors live in `custom.js` (injected via DXPR theme settings).

### `programCompactCardsEnhancements`

Runs on every `article.program-card-compact`. Responsibilities:

- Promotes `h2` title to `h5`
- Moves featured image outside `.content` to the card root
- Injects "Starts [date]" from the earliest session with open registration (falls back to earliest overall if none are open)
- Injects day/time from the same session
- Shows "Multiple sessions available" when more than one session paragraph exists
- Hides the raw session paragraph field after extracting data
- Makes the card body clickable (delegates to title link)

**Session selection logic:** Reads `field_registration_end_date` from each `.paragraph--type--program-session`. Prefers the earliest session whose registration end date is in the future. Falls back to the earliest session overall.

### `programFeedViewEmbedEnhancements`

Runs on `.paragraph--type--program-feed`. Responsibilities:

- Promotes section heading to `h2.heading--h2-alt`
- Hides rows where all sessions have expired registration end dates
- Sets `data-registration-open` attribute on each card
- Applies `program-feed-grid--one/two/three` class to the view content based on visible card count

**Visibility logic:** Iterates `.paragraph--type--program-session` elements within each card (not `.field__items > .field__item`, which would match nested instructor items). A card is visible if any session has no registration end date, or has one that has not yet passed. Falls back to session end date if registration end date is absent.

### `programSidebarSessionEnhancements`

Runs on `.page-node-type-program .group-program-sidebar`. Responsibilities:

- Reads all session paragraphs from the sidebar's `field_program_session`
- Determines which sessions are currently open (registration start ≤ now ≤ registration end, and a registration link exists)
- Renders a "Current Sessions" heading and list: date range, day/time, location, instructor, register link
- For In Person sessions (format term 114), shows `field_location` text instead of the format label
- First open session gets `.program-sidebar__session-register--primary` (gold button); additional sessions render as text links
- Hides the raw session paragraph field after extracting data
- Sets `data-current-session-count` on the sidebar for use by `programRegistrationToggle`

### `programRegistrationToggle`

Runs on `.page-node-type-program .group-program-sidebar` after `programSidebarSessionEnhancements`. Uses `data-current-session-count` to set `is-registration-open` or `is-registration-closed` on the sidebar. When closed, injects a fallback "Registration is currently closed" message and subscribe link.

---

## 8) Sidebar Field Order

The sidebar JS enforces this display order regardless of Drupal field weight:

1. Price (`field_price`)
2. Pricing details (`field_pricing_details`)
3. Current Sessions heading
4. Per-session items: date range → day/time → location → instructor → register link
5. Registration closed message + subscribe link (when no open sessions)

---

## 9) Known Content Entry Rules

- **Registration dates must be entered in chronological order** (start before end). Reversed dates cause the JS visibility filter to treat the session as expired.
- **Registration link is required** for a session to be treated as "open" in the sidebar. Sessions without a link are excluded from the current sessions list regardless of dates.
- **In Person format** must use taxonomy term 114 for the location-vs-label logic to trigger correctly.
