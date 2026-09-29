|<br />WeTravel MVP acceptance criteria and QA standards <br /><br />User Story <br />As a development team, we need common quality standards so everyone agrees on when a ticket or feature is actually complete. <br /><br />Tasks WT-3.1 — Create Definition of Done <br />A ticket is complete only when: <br />- Acceptance criteria are met <br />- Code is implemented and builds without errors <br />- App/server starts locally without import or runtime errors <br />- Relevant tests pass, locally and in CI <br />- No open P0 or P1 defects <br />- No console or server errors <br />- PR is opened, reviewed by a teammate, and CI is green <br />- Docs are updated if the change touches setup, an API, or a workflow <br />- Code is merged into the shared branch <br /><br />WT-3.2 — Establish bug severity levels <br />Define: <br />P0 — Blocker. App crashes, data is lost, or a core flow is completely broken. Blocks release. Example: the map view crashes the app when it tries to load, or no user can log in at all.<br />P1 — Critical. A major feature is broken or unusable for most users, though the app itself doesn't crash. Fix before merge or release. Example: safety reports never appear on the map after being submitted, or the feed shows no posts for anyone.<br />P2 — Major. The feature works but has a significant flaw — wrong data shown, an edge case that breaks — that hurts usability. Example: tapping a map marker opens the info for the wrong post, or a post's image fails to load in the feed but the caption still shows.<br />P3 — Minor. A small functional issue with a workaround. Doesn't block normal use. Example: itineraries aren't sorted by date, so a user has to scroll to find the right one.<br />P4 — Cosmetic. Visual only — spacing, alignment, color — no functional impact. Example: a map marker icon is a few pixels off-center, or a post's timestamp text is misaligned on mobile. <br /><br />WT-3.3 — Create QA checklist <br />Check each of these before marking a feature done: <br />- Functional behavior matches the acceptance criteria <br />- Request/response models actually validate data (type-annotated fields, not default-value assignments) <br />- Error handling covers bad input and failed requests, not just the happy path <br />- Input validation on both frontend and backend <br />- Responsive on mobile, tablet, and desktop widths <br />- Works on Chrome plus at least one other browser <br />- API errors reach the user instead of failing silently <br />- Authenticated/protected behavior is correct where it applies <br />- Basic accessibility: labeled inputs, keyboard navigation, readable contrast <br /><br />WT-3.4 — PR QA checklist <br />- Acceptance criteria satisfied <br />- Tests added or updated for the change <br />- Tests pass locally and in CI <br />- No secrets or API keys committed <br />- No leftover console logs or debug code <br />- Error states handled, not just the success path <br />- Reviewed by at least one teammate <br /><br />WT-3.5 — Define initial P0 feature acceptance criteria Authentication  ✓ User can register with email and password; duplicate emails are rejected<br />✓ Login succeeds with correct credentials and fails with a clear error otherwise<br />✓ Session survives page refresh and normal navigation<br />✓ Logout clears the session<br />✓ Protected routes redirect unauthenticated users instead of showing content Feed  ✓ Feed loads and shows posts in a consistent order (newest first)<br />✓ Each post shows author, caption, media, and location when available<br />✓ Empty state (no posts yet) is handled<br />✓ Loading state and failed-fetch state are both handled Create Post  ✓ User can submit a post with a caption and at least one image<br />✓ Post shows up in the feed right after creation<br />✓ Required fields are validated before submit<br />✓ A failed submission shows an error instead of silently dropping the post Map  ✓ Map loads and centers on a default or the user's location<br />✓ Markers/hotspots render and are clickable<br />✓ Selecting a marker shows the relevant info (post or safety report)<br />✓ Missing or invalid location data doesn't crash the map Itinerary  ✓ User can create an itinerary and add/remove destinations<br />✓ Saved itineraries persist and reload correctly<br />✓ A user can only see and edit their own itineraries<br />✓ Empty itinerary state is handled Safety  ✓ User can submit a safety report with type, location, and description<br />✓ Submitted reports are validated (required fields, valid location)<br />✓ Reports persist and can be retrieved for their location<br />✓ Reports show up on the map in the right spot Acceptance Criteria  ✓ Definition of Done documented <br />✓ Bug severity system documented <br />✓ QA checklist documented <br />✓ PR checklist established <br />✓ Every P0 feature has initial measurable acceptance criteria <br />✓ Documentation accessible to all team members|
|-|



## Requirements Traceability Matrix

The following matrix maps the MVP acceptance criteria defined above to
the tests used to verify them.

- **Requirement ID** — stable ID for a single acceptance criterion (also used as a pytest marker on the automated tests that verify it, e.g. `@pytest.mark.requirement("AUTH-01")`).
- **Test Type** — `Automated` (runs in CI on every push/PR) or `Manual` (performed against the QA checklist in WT-3.3 before a PR is marked done).
- **Test ID** — the automated test function name(s), or a `MANUAL-<REQ-ID>` case ID with its procedure, for manual rows.
- **Test Location** — file path for automated tests, or where the manual procedure is documented/performed.
- **Status** — `Covered` once a real test/procedure exists, `Not Covered` while it's still outstanding.

CI's `qa-check` job (`scripts/verify_traceability.py`) parses this table on every run and fails the build if a row is missing a Test ID/Test Type/Test Location, still says `TBD`, or if an `Automated` row points at a test function or file that no longer exists — so this table cannot silently drift out of sync with the test suite. When an automated test fails, pytest prints the linked Requirement ID(s) (see the `pytest_runtest_makereport` hook in `backend/tests/conftest.py`), tracing the failure straight back to a row below.

### Authentication

| Requirement ID | Acceptance Criterion | Test Type | Test ID | Test Location | Status |
|---|---|---|---|---|---|
| AUTH-01 | User can register with email and password; duplicate emails are rejected | Automated | test_register_success, test_register_duplicate_email, test_register_duplicate_username | backend/tests/test_auth.py | Covered |
| AUTH-02 | Login succeeds with correct credentials and fails with a clear error otherwise | Automated | test_login_success, test_login_invalid_username, test_login_invalid_password | backend/tests/test_auth.py | Covered |
| AUTH-03 | Session survives page refresh and normal navigation | Manual | MANUAL-AUTH-03 — reload the app while logged in; confirm the stored token persists and the current page still renders as authenticated | QA checklist (WT-3.3), exercised against src/pages/Login.tsx | Not Covered |
| AUTH-04 | Logout clears the session | Manual | MANUAL-AUTH-04 — log out, then confirm the stored token is cleared and protected routes redirect to login | QA checklist (WT-3.3) | Not Covered (logout not yet implemented in frontend) |
| AUTH-05 | Protected routes redirect unauthenticated users instead of showing content | Automated + Manual | test_protected_route_requires_token, test_protected_route_with_valid_token, test_invalid_jwt_is_rejected; MANUAL-AUTH-05 — confirm the frontend redirects to /login on a 401 | backend/tests/test_auth.py (API enforcement); QA checklist (WT-3.3) for the frontend redirect | Covered (backend); Not Covered (frontend redirect) |

### Feed

| Requirement ID | Acceptance Criterion | Test Type | Test ID | Test Location | Status |
|---|---|---|---|---|---|
| FEED-01 | Feed loads and shows posts in a consistent order (newest first) | Manual | MANUAL-FEED-01 — load the feed and confirm posts are ordered newest first | QA checklist (WT-3.3), exercised against src/pages/Feed.tsx | Not Covered |
| FEED-02 | Each post shows author, caption, media, and location when available | Manual | MANUAL-FEED-02 — confirm each rendered post displays author, caption, media, and location | QA checklist (WT-3.3), exercised against src/pages/Feed.tsx | Not Covered |
| FEED-03 | Empty state (no posts yet) is handled | Manual | MANUAL-FEED-03 — load the feed with zero posts and confirm the empty state renders instead of a blank/broken page | QA checklist (WT-3.3), exercised against src/pages/Feed.tsx | Not Covered |
| FEED-04 | Loading state and failed-fetch state are both handled | Manual | MANUAL-FEED-04 — throttle/fail the feed request and confirm loading and error states both render | QA checklist (WT-3.3), exercised against src/pages/Feed.tsx | Not Covered |

### Map

| Requirement ID | Acceptance Criterion | Test Type | Test ID | Test Location | Status |
|---|---|---|---|---|---|
| MAP-01 | Map loads and centers on a default or the user's location | Manual | MANUAL-MAP-01 — open the map and confirm it loads and centers correctly | QA checklist (WT-3.3), exercised against src/pages/MapPage.tsx, src/components/map/Map.tsx | Not Covered |
| MAP-02 | Markers/hotspots render and are clickable | Manual | MANUAL-MAP-02 — confirm markers render and respond to clicks | QA checklist (WT-3.3), exercised against src/components/map/MarkerLayer.tsx | Not Covered |
| MAP-03 | Selecting a marker shows the relevant info | Manual | MANUAL-MAP-03 — click a marker and confirm the correct post/report info is shown | QA checklist (WT-3.3), exercised against src/components/map/MarkerLayer.tsx | Not Covered |
| MAP-04 | Missing or invalid location data doesn't crash the map | Manual | MANUAL-MAP-04 — load the map with a post/report missing or with invalid coordinates and confirm the map still renders | QA checklist (WT-3.3), exercised against src/components/map/Map.tsx | Not Covered |

### Create Post

| Requirement ID | Acceptance Criterion | Test Type | Test ID | Test Location | Status |
|---|---|---|---|---|---|
| POST-01 | User can submit a post with a caption and at least one image | Manual | MANUAL-POST-01 — submit a post with a caption and image and confirm it succeeds | QA checklist (WT-3.3), exercised against src/pages/CreatePost.tsx, backend/routes.py create_post | Not Covered |
| POST-02 | Post shows up in the feed right after creation | Manual | MANUAL-POST-02 — create a post and confirm it appears in the feed without a manual refresh | QA checklist (WT-3.3), exercised against src/pages/CreatePost.tsx, src/pages/Feed.tsx | Not Covered |
| POST-03 | Required fields are validated before submit | Manual | MANUAL-POST-03 — attempt to submit with required fields missing and confirm validation blocks it | QA checklist (WT-3.3), exercised against src/pages/CreatePost.tsx | Not Covered |
| POST-04 | A failed submission shows an error instead of silently dropping the post | Manual | MANUAL-POST-04 — force a failed submission (e.g. offline) and confirm an error is shown | QA checklist (WT-3.3), exercised against src/pages/CreatePost.tsx | Not Covered |

### Itinerary

| Requirement ID | Acceptance Criterion | Test Type | Test ID | Test Location | Status |
|---|---|---|---|---|---|
| ITIN-01 | User can create an itinerary and add/remove destinations | Manual | MANUAL-ITIN-01 — create an itinerary, add a destination, then remove it | QA checklist (WT-3.3), exercised against src/pages/Itinerary.tsx, backend/routes.py create_itinerary | Not Covered |
| ITIN-02 | Saved itineraries persist and reload correctly | Manual | MANUAL-ITIN-02 — create an itinerary, reload the app, and confirm it's still there with the same data | QA checklist (WT-3.3), exercised against src/pages/Itinerary.tsx | Not Covered |
| ITIN-03 | A user can only see and edit their own itineraries | Manual | MANUAL-ITIN-03 — log in as a second user and confirm the first user's itineraries aren't visible/editable | QA checklist (WT-3.3), exercised against backend/routes.py get_itineraries | Not Covered |
| ITIN-04 | Empty itinerary state is handled | Manual | MANUAL-ITIN-04 — view itineraries with none created and confirm the empty state renders | QA checklist (WT-3.3), exercised against src/pages/Itinerary.tsx | Not Covered |

### Safety

| Requirement ID | Acceptance Criterion | Test Type | Test ID | Test Location | Status |
|---|---|---|---|---|---|
| SAFE-01 | User can submit a safety report with type, location, and description | Manual | MANUAL-SAFE-01 — submit a safety report with all required fields and confirm it succeeds | QA checklist (WT-3.3), exercised against src/components/map/SafetyReportForm.tsx, backend/routes.py create_safety_report | Not Covered |
| SAFE-02 | Submitted reports are validated (required fields, valid location) | Manual | MANUAL-SAFE-02 — attempt to submit a report with a missing field or invalid location and confirm it's rejected | QA checklist (WT-3.3), exercised against src/components/map/SafetyReportForm.tsx | Not Covered |
| SAFE-03 | Reports persist and can be retrieved for their location | Manual | MANUAL-SAFE-03 — submit a report, then confirm it can be retrieved for that location | QA checklist (WT-3.3), exercised against backend/routes.py get_safety_reports | Not Covered |
| SAFE-04 | Reports show up on the map in the right spot | Manual | MANUAL-SAFE-04 — submit a report and confirm a marker appears at the correct map location | QA checklist (WT-3.3), exercised against src/components/map/MarkerLayer.tsx | Not Covered |

### Process / Documentation

These acceptance criteria verify the QA process itself rather than app behavior, so they're validated by document review instead of a test run.

| Requirement ID | Acceptance Criterion | Test Type | Test ID | Test Location | Status |
|---|---|---|---|---|---|
| PROC-01 | Definition of Done documented | Manual | MANUAL-PROC-01 — review document | QA standard.md (WT-3.1) | Covered |
| PROC-02 | Bug severity system documented | Manual | MANUAL-PROC-02 — review document | QA standard.md (WT-3.2) | Covered |
| PROC-03 | QA checklist documented | Manual | MANUAL-PROC-03 — review document | QA standard.md (WT-3.3) | Covered |
| PROC-04 | PR checklist established | Manual | MANUAL-PROC-04 — review document | QA standard.md (WT-3.4) | Covered |
| PROC-05 | Every P0 feature has initial measurable acceptance criteria | Manual | MANUAL-PROC-05 — review document | QA standard.md (WT-3.5) and the requirement sections above | Covered |
| PROC-06 | Documentation accessible to all team members | Manual | MANUAL-PROC-06 — confirm the document is committed to the shared repository | QA standard.md (repository root) | Covered |