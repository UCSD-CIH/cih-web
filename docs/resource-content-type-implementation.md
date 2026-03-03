# Resource Content Type + Guided Meditations View (Drupal 10)

This project now includes frontend hooks in `main.css` and `custom.js` for a reusable `resource` card UX and guided meditation filtering. Use this checklist to implement the Drupal structures.

## 1) Content Type
Create content type:
- Label: `Resource`
- Machine name: `resource`

## 2) Taxonomies
Create vocabulary:
- Label: `Resource Type`
- Machine name: `resource_type`
- Terms: Audio, Video, Webpage, Download, SoundCloud

Create vocabulary:
- Label: `Resource Category`
- Machine name: `resource_category`
- Hierarchical: enabled
- Add meditation categories as parent/child terms (e.g., Seated, Body Scan, MPEAK, Spanish Adult, Spanish Teens/Kids, UCSD-TV)

## 3) Fields on `resource`
Required fields:
- `field_resource_destination_type` (List text)
  - Allowed values: `external_url|External URL`, `internal_url|Internal URL`, `file_download|File Download`, `soundcloud|SoundCloud`, `video_platform|Video Platform`
- `field_primary_url` (Link)
- `field_primary_file` (File or Media reference)
- `field_resource_type` (Entity reference -> taxonomy term, `resource_type`)
- `field_resource_categories` (Entity reference -> taxonomy term, `resource_category`, unlimited)
- `field_summary` (Text plain/long)

Optional fields:
- `field_thumbnail_image` (Image)
- `field_duration` (Text or integer)
- `field_language` (List text)
- `field_featured` (Boolean)
- `field_sort_weight` (Integer)
- `field_secondary_links` (Link, multiple)

## 4) Validation / Editorial Rules
Configure with Conditional Fields / ECA / custom validation:
- If `field_resource_destination_type = file_download`, require `field_primary_file` and hide/ignore `field_primary_url`.
- For all URL-based destination types, require `field_primary_url` and hide/ignore `field_primary_file`.
- Ensure only one primary destination is used.

## 5) View Mode
Create view mode:
- Name: `Resource Card`
- Machine name: `resource_card`

Manage display for `resource_card`:
- Show: thumbnail, resource type, title, summary, duration, language, categories, destination fields.
- Keep destination fields rendered (hidden by CSS) so JS can build CTA text/href.

## 6) Views
Create view:
- Name: `Resources`
- Machine name: `resources`
- Show: Content of type `resource`
- Format: Grid (3 columns desktop)

Display A: Generic resources listing
- Path: `/resources`
- Exposed filters:
  - `field_resource_type`
  - `field_resource_categories` (hierarchy)
  - Full-text `keys`
- Sort order:
  - `field_featured` DESC
  - `field_sort_weight` ASC
  - `created` DESC

Display B: Guided meditations listing
- Path: `/resources/guided-meditations`
- Add default contextual filter or fixed filter to only include items in meditation category root/descendants.
- Expose `field_resource_categories` and `keys`.

## 7) Permissions
- Editors: create/edit/publish `resource`
- Taxonomy managers: administer `resource_category` and `resource_type`

## 8) Frontend Hooks Already Implemented
The following are already implemented in this repository:
- `main.css`
  - Press & Media-like card grid + filters for:
    - `.view-resources`, `.view-id-resources`
    - `.view-guided-meditations`, `.view-id-guided_meditations`
  - Reusable `.resource-card` presentation
- `custom.js`
  - Auto-adds `.resource-card` class to resource view cards
  - Builds CTA label based on destination/resource type:
    - `file_download` -> `Download`
    - `soundcloud` / audio -> `Listen`
    - `video_platform` / video -> `Watch`
    - default -> `Open Resource`
  - Resource filter UX behavior (search placeholder, expand active filter groups)

## 9) QA Checklist
- Resource with SoundCloud URL shows `Listen` CTA and correct link.
- Resource with file shows `Download` CTA.
- Guided meditations display only meditation-category content.
- Category filter and search can be combined.
- Empty state displays for no results.
- Keyboard focus visible on title links and CTA links.
- Cards collapse to 2-up tablet and 1-up mobile.
