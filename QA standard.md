# WeTravel MVP Acceptance Criteria and QA Standards

## Definition of Done

A ticket is done only when:

* Acceptance criteria are met
* Code is implemented and builds without errors
* App/server starts locally without import or runtime errors
* Relevant tests pass, locally and in CI
* No open P0 or P1 defects
* No console or server errors
* PR is opened, reviewed by a teammate, and CI is green
* Docs are updated if the change touches setup, an API, or a workflow
* Code is merged into the shared branch

## Bug Severity Levels

* **P0 — Blocker.** App crashes, data is lost, or a core flow is completely broken. Blocks release.

  * Example: the map view crashes the app when it tries to load, or no user can log in at all.
* **P1 — Critical.** A major feature is broken or unusable for most users, though the app itself doesn't crash. Fix before merge or release.

  * Example: safety reports never appear on the map after being submitted, or the feed shows no posts for anyone.
* **P2 — Major.** The feature works but has a significant flaw — wrong data shown, an edge case that breaks — that hurts usability.

  * Example: tapping a map marker opens the info for the wrong post, or a post's image fails to load in the feed but the caption still shows.
* **P3 — Minor.** A small functional issue with a workaround. Doesn't block normal use.

  * Example: itineraries aren't sorted by date, so a user has to scroll to find the right one.
* **P4 — Cosmetic.** Visual only — spacing, alignment, color — no functional impact.

  * Example: a map marker icon is a few pixels off-center, or a post's timestamp text is misaligned on mobile.

## QA Checklist

Check each of these before marking a feature done:

* \[ ] Functional behavior matches the acceptance criteria
* \[ ] Request/response models actually validate data (type-annotated fields, not default-value assignments)
* \[ ] Error handling covers bad input and failed requests, not just the happy path
* \[ ] Input validation on both frontend and backend
* \[ ] Responsive on mobile, tablet, and desktop widths
* \[ ] Works consistently across major browsers (not tied to one specific browser)
* \[ ] API errors reach the user instead of failing silently
* \[ ] Authenticated/protected behavior is correct where it applies
* \[ ] Basic accessibility: labeled inputs, keyboard navigation, readable contrast

## PR QA Checklist

* \[ ] Acceptance criteria satisfied
* \[ ] Tests added or updated for the change
* \[ ] Tests pass locally and in CI
* \[ ] No secrets or API keys committed
* \[ ] No leftover console logs or debug code
* \[ ] Error states handled, not just the success path
* \[ ] Reviewed by at least one teammate

## P0 Feature Acceptance Criteria

### Authentication

* User can register with email and password; duplicate emails are rejected
* Login succeeds with correct credentials and fails with a clear error otherwise
* Session survives page refresh and normal navigation
* Logout clears the session
* Protected routes redirect unauthenticated users instead of showing content

### Feed

* Feed loads and shows posts in a consistent order (newest first)
* Each post shows author, caption, media, and location when available
* Empty state (no posts yet) is handled
* Loading state and failed-fetch state are both handled

### Create Post

* User can submit a post with a caption and at least one image
* Post shows up in the feed right after creation
* Required fields are validated before submit
* A failed submission shows an error instead of silently dropping the post

### Map

* Map loads and centers on a default or the user's location
* Markers/hotspots render and are clickable
* Selecting a marker shows the relevant info (post or safety report)
* Missing or invalid location data doesn't crash the map

### Itinerary

* User can create an itinerary and add/remove destinations
* Saved itineraries persist and reload correctly
* A user can only see and edit their own itineraries
* Empty itinerary state is handled

### Safety

* User can submit a safety report with type, location, and description
* Submitted reports are validated (required fields, valid location)
* Reports persist and can be retrieved for their location
* Reports show up on the map in the right spot
* A safety report's location uses the same location data model as posts and the map (no duplicate or inconsistent location representation across features)

### Acceptance Criteria

* Definition of Done documented
* Bug severity system documented
* QA checklist documented
* PR checklist established
* Every P0 feature has initial measurable acceptance criteria
* Documentation accessible to all team members



