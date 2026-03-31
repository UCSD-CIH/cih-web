# Profile Content Type (Drupal 10)

People/faculty/researcher directory profiles. Used across all 6 centers. REACH-specific fields are relevant only to REACH center profiles.

---

## 1) Content Type

Create content type:
- Label: `Profile`
- Machine name: `profile`

---

## 2) Taxonomies

| Vocabulary | Machine name | Notes |
|------------|-------------|-------|
| Center Affiliation | `center_affiliation` | Used by both `field_primary_center` and `field_center_name` |
| Institution | `institution` | e.g. UC San Diego |
| Organizational Roles | `organizational_roles` | Admin, Author, Director, Faculty, Guest, Instructor, Program Lead, Researcher, Trainee, Staff |
| Focus Areas | `focus_areas` | Addiction/Substance Use, Compassion, Integrative Medicine, Lifestyle Medicine, Mental Health, Mind-Body, Movement/Qigong, Nutrition, Stress, Integrative Treatment, Trauma-Informed Care, Yoga & Health *(list may grow)* |
| REACH Partner Role | `reach_partner_role` | Program Director, Dean/Program Director, PBRC Chair, Partner to Collaborate, Research Director, Scholar, Scholar Applicant |

---

## 3) Fields on `profile`

| Label | Machine name | Field type | Notes |
|-------|-------------|------------|-------|
| First Name | `field_first_name` | Text (plain) | |
| Last Name | `field_last_name` | Text (plain) | |
| Titles | `field_titles` | Text (plain, long) | Honorifics/credentials line — e.g. "Professor, MD, PhD" |
| Headshot Image | `field_profile_headshot` | Entity ref → Media (Image) | 2:3 aspect ratio required — note for editors |
| Research Profile URL | `field_profile_link` | Link | Single link to internal or external research profile |
| Short Bio | `field_short_bio` | Text (formatted, long) | Condensed — used in cards and listings |
| Bio | `field_bio` | Text (formatted, long) | Full biography — rendered on full profile page |
| Primary Center | `field_primary_center` | Entity ref → Taxonomy term (Center Affiliation) | The profile's main center assignment |
| Additional Affiliations | `field_center_name` | Entity ref → Taxonomy term (Center Affiliation) | Secondary center affiliations |
| Institution Affiliation | `field_institution_affiliation` | Entity ref → Taxonomy term (Institution) | e.g. UC San Diego |
| Organizational Roles | `field_profile_roles` | Entity ref → Taxonomy term (Organizational Roles) | Multiple |
| REACH Roles | `field_reach_roles` | List (text) | REACH center profiles only |
| REACH Partner Role | `field_reach_partner_role` | Entity ref → Taxonomy term (REACH Partner Role) | REACH center profiles only |
| Committee Memberships | `field_committee_memberships` | Entity ref revisions → Paragraph (REACH Committee Membership) | REACH center profiles only |
| Credentials (Display) | `field_credentials_display` | Text (plain) | Free-text display string — e.g. "PhD, MD, MPH" |
| Credentials (Search) | `field_credentials_search` | List (text) | Used for directory filtering |
| Focus Areas | `field_program_focus_areas` | Entity ref → Taxonomy term (Focus Areas) | Multiple |
| Research Areas | `field_research_areas` | Text (plain, long) | Freeform research focus description |
| Weight/Sort Order | `field_sort_weight` | Number (integer) | Controls display order in listings |

---

## 4) Editorial Notes

- **Headshot:** 2:3 ratio required. Communicate clearly to content editors — wrong ratio will break card layout.
- **Titles vs Credentials (Display):** `field_titles` is the honorific/title line (e.g. "Professor of Medicine"). `field_credentials_display` is the credential string (e.g. "PhD, MPH"). Both may appear on the profile; keep them editorially distinct.
- **Credentials (Display) vs Credentials (Search):** Display (`field_credentials_display`) is free-text for rendering. Search (`field_credentials_search`) is the list field used for filtering the directory. Both should be filled.
- **Primary Center vs Additional Affiliations:** Both use the Center Affiliation vocabulary. `field_primary_center` = single primary assignment. `field_center_name` = additional affiliations. A profile can belong to multiple centers.
- **REACH fields:** `field_reach_roles`, `field_reach_partner_role`, and `field_committee_memberships` are only relevant for REACH center profiles. Consider using Conditional Fields or field group visibility to hide these on non-REACH profiles.
- **Committee Memberships:** Implemented as a Paragraph (entity reference revisions) with paragraph type REACH Committee Membership — not a flat taxonomy reference. Allows structured membership data per committee.

---

## 5) View Mode

Create view mode:
- Name: `Profile Card`
- Machine name: `profile_card`

Manage display for `profile_card`:
- Show: `field_profile_headshot`, `field_first_name`, `field_last_name`, `field_titles`, `field_credentials_display`, `field_primary_center`, `field_program_focus_areas`
- Hide: `field_bio`, `field_research_areas`, `field_profile_link`, REACH fields (render on full profile only)

---

## 6) Views

Create view:
- Name: `People`
- Machine name: `people`
- Show: Content of type `profile`
- Format: Grid

Display A: Full directory
- Path: `/people`
- Exposed filters: `field_profile_roles`, `field_credentials_search`, `field_program_focus_areas`, `field_primary_center`
- Sort: `field_sort_weight` ASC, `field_last_name` ASC

Display B: Per-center filtered listing *(as needed)*
- Use contextual or fixed filter to scope by `field_primary_center` or `field_center_name`

---

## 7) Permissions

- Editors: create/edit/publish `profile`
- Taxonomy managers: administer Focus Areas, Organizational Roles, REACH Partner Role vocabularies

---

## 8) QA Checklist

- [ ] Profile card displays correctly at 2:3 headshot ratio
- [ ] Missing headshot falls back gracefully (placeholder or initials)
- [ ] `field_credentials_display` and `field_credentials_search` both render and filter correctly
- [ ] `field_titles` and `field_credentials_display` display as distinct fields on full profile
- [ ] Primary Center and Additional Affiliations both appear where expected
- [ ] REACH fields hidden or not displayed on non-REACH center profiles
- [ ] Committee Memberships paragraph renders correctly on REACH profiles
- [ ] Directory filters work: roles, credentials, focus areas, center
- [ ] `field_sort_weight` controls ordering in listings
- [ ] Full profile page shows bio, research areas, research profile URL
- [ ] Cards collapse to 2-up tablet and 1-up mobile
