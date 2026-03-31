# CIH Web Project Overview

UC San Diego Centers for Integrative Health (CIH) website rebuild.

**Why:** Phased migration from Drupal 8 (old centers) to Drupal 10 (new centers). Design system exists in Figma.

## Stack

- CMS: Drupal 10 (new), Drupal 8 (legacy centers still migrating)
- Theme: DXPR (transitioning away toward paragraph types)
- Hosting: SD Supercomputer Center, dedicated sysadmin available
- Customization: Custom CSS and JS injected via DXPR theme settings (no Twig access yet, coming soon)

## Content Types

Custom content types built: program, profile, study, press/media, resource

**Key paragraph types:**
- `program-session`: per-session dates, registration window, registration link, location, format (taxonomy), instructors, session note

**Program format term IDs:** 113=Online, 114=In Person, 115=Hybrid, 116=Audio

## Current Constraints

- No Twig template access yet (sysadmin will enable)
- Extending functionality via custom JS — causes loading flashes, but necessary short-term
- Paragraph types are the preferred forward-looking display mechanism

## Design Decisions

- Program feed: 3-up grid on desktop regardless of count; lone last card sits left (no centering)
- Multi-session sidebar: text link list per session (date + "Location: X" + "Register →"); no gold button
- Single-session sidebar: gold button kept; session's registration link replaces node-level href
- Pricing field moves to top of sidebar when multiple sessions exist
- Format shown as "Location: Online/In Person" text in sidebar (not pill badges)
- Program feed shows max 6 cards (CFM typically has 7–12 programs); listing page shows all

## Drupal Config (not visible in code)

- **Program card compact display mode** includes `field_program_session` as Rendered entity (Default paragraph view mode) — required so compact card JS can extract session start dates and day/time when no node-level start date exists; the session wrapper is then hidden via JS
- **CFM Program Feed view** uses "Use aggregation: Yes" with "Group results together" on paragraph-level registration date filters — prevents duplicate cards when a program has multiple sessions; the paragraph relationship drives session-level date filtering
- **MBSR session paragraph registration dates** may need re-entry by content editor (form display field order was corrected but existing content was not re-saved)
