# WeTravel — Sprint 3 Midterm QA Readiness Report

**QA by:** Randoll Im  
**Course:** CPSC 491-03  
**Sprint:** 3 — QA / Midterm Readiness  
**Report date:** October 12, 2026  
**Jira objective:** SCRUM-29 — Midterm QA and CI Readiness Review  
**Standards:** `QA standard.md` (WT-3.1–WT-3.5), WeTravel Individual Test Plan (Sprint 3)  
**Report scope:** Evidence gathered during this QA review; no unreported test passes are assumed.

## 1. Purpose and User Story

As the WeTravel QA owner, I need to evaluate demo-critical features against established MVP acceptance criteria, document manual and automated results, identify defects and presentation blockers, and review CI coverage so the team can make an informed midterm readiness decision and use the findings as an actionable next-sprint handoff.

This report follows the Sprint 3 QA role rather than implementing the Sprint 4 automated regression suite (assigned to Randoll's next rotation). Chris owns Sprint 3 automated testing; the purpose here is acceptance review, exploratory/manual QA, CI evidence review, defect identification, and retest recommendations without duplicating his work.

## 2. Executive Summary and Readiness Decision

**Recommendation: NOT READY for the full agreed MVP midterm demonstration as of the reviewed state.** A limited prototype demonstration may be possible if the team explicitly narrows the scope to working UI previews, browser-local itinerary functionality, backend API/test evidence, and the Feed empty state. The full demo path remains at risk because frontend account creation/login is unavailable in the tested build; Create Post cannot publish; the Map is a placeholder; and Safety Reporting cannot persist reports from its frontend form.

**Verified positives:**
- **25/25 backend tests passed** in two local pytest runs using Python 3.14 (11 Authentication; 8 Posts; 6 Safety).
- **GitHub Actions PR #60:** Frontend CI, Backend CI, and QA documentation/traceability jobs were all green in the supplied screenshots. Backend job showed Black, Ruff, pytest, and PostgreSQL integration steps succeeding for that PR commit.
- **Manual passes:** ITIN-01, ITIN-02, ITIN-04, FEED-03; empty-field scenarios for POST-03 and SAFE-02.
- Local backend health endpoint returned `{"status":"healthy"}` after Python/environment setup; Alembic migrations created missing tables; `GET /api/posts` subsequently returned `[]`.

**Important limits:** Green CI for PR #60 does not prove the current working tree or full user journey is green. Backend pytest tests do not establish frontend acceptance. No actual populated Feed, production deployment, multi-browser audit, or full authenticated end-to-end demo was verified.

## 3. Existing QA Standards and Result Definitions

The prior `QA standard.md` remains the authority for requirements and severity. **WT-3.1 Definition of Done:** acceptance criteria met, app builds/starts, relevant local and CI tests pass, no open P0/P1 defects, no console/server errors, reviewed PR and green CI, documentation updated, and code merged. **WT-3.2:** P0 Blocker (crash, data loss, or completely broken core flow); P1 Critical (major feature unusable); P2 Major (significant flaw); P3 Minor (workaround); P4 Cosmetic. **WT-3.3/WT-3.4:** functional and negative testing, validation, error handling, responsive/cross-browser/accessibility checks, authentication, code review and PR quality checks.

**Execution status** in this report: **PASS** = observed test scenario met expectation; **PARTIAL** = some behaviors verified but criterion incomplete; **FAIL** = observed behavior contradicts criterion; **BLOCKED** = prerequisite prevents test execution; **NOT TESTED** = no executed evidence. **Code-review finding** is explicitly separate from a manual FAIL. The original traceability matrix's `Covered` status means a test/procedure exists, not that it passed.

## 4. Manual Requirements Traceability and Execution Matrix

| Requirement ID | Acceptance criterion (QA standard) | Sprint 3 manual result | Evidence / limitation |
|---|---|---|---|
| AUTH-01 | Register with email/password; reject duplicate email | **FAIL** (frontend) | `/register` showed no registration form. Backend registration tests passed separately. |
| AUTH-02 | Valid login succeeds; invalid login gives clear error | **BLOCKED** | User reported no available login form in tested UI; supplied `Login.tsx` has form code, so branch/build discrepancy should be checked. Backend login tests passed. |
| AUTH-03 | Session survives refresh and navigation | **BLOCKED** (dependency assessment) | Cannot establish frontend authenticated session. Not independently executed. |
| AUTH-04 | Logout clears session | **BLOCKED** (dependency assessment) | No usable logout/account-switch workflow shown. Not independently executed. |
| AUTH-05 | Protected routes redirect unauthenticated users | **NOT TESTED** (frontend) | Backend bearer-token enforcement tests passed; `App.tsx` has no route guard. Frontend redirect not manually executed. |
| FEED-01 | Feed displays newest posts first | **NOT TESTED** (ordering) | Initial API 500 from missing `posts` table; after migrations API returned empty array, so no two posts to compare. |
| FEED-02 | Author, caption, media, location shown | **NOT TESTED** | No populated posts. `PostCard.tsx` renders `Traveler #user_id` rather than username. |
| FEED-03 | Empty state handled | **PASS** | User confirmed `No travel posts yet` and Create Post link after API returned `[]`. |
| FEED-04 | Loading and failed-fetch states handled | **PARTIAL** | Failed-fetch message and retry control visibly appeared; throttled loading and successful retry recovery not executed (skipped). |
| POST-01 | Submit post with caption and at least one image | **BLOCKED** | No authenticated session; code review additionally shows no publishing path or image storage integration. |
| POST-02 | New post appears immediately in Feed | **BLOCKED** | Cannot publish from frontend; no end-to-end post creation. |
| POST-03 | Required fields validated before submit | **PASS — empty-field scenario only** | User confirmed caption and location required-field messages. Image requirement/boundary cases not fully verified. |
| POST-04 | Failed submission shows error | **BLOCKED** | Publish control disabled while unauthenticated; actual failed submission not executed. |
| MAP-01 | Map loads and centers correctly | **FAIL** | User observed placeholder only; no interactive map. |
| MAP-02 | Markers render and are clickable | **BLOCKED** | No interactive map to click. |
| MAP-03 | Marker shows relevant post/report info | **BLOCKED** | No interactive map; marker code references sample markers. |
| MAP-04 | Invalid location does not crash map | **BLOCKED** | No functioning map/data flow to exercise invalid location. |
| ITIN-01 | Create itinerary, add/remove destinations | **PASS** | User completed trip creation and destination add/remove. |
| ITIN-02 | Saved itinerary persists after reload | **PASS** | User confirmed draft and destination survived refresh in same browser. Browser-local only. |
| ITIN-03 | User can see/edit only own itineraries | **BLOCKED** | User reported account-switching/login not available. Shared `localStorage` key is a separate code-review risk. |
| ITIN-04 | Empty itinerary state handled | **PASS** | User confirmed empty state and creation entry point. |
| SAFE-01 | Submit report with type, location, description | **PARTIAL** | User reported fields usable but could not submit/persist; handler only logs to console. |
| SAFE-02 | Required fields and valid location checked | **PASS — empty-field scenario only** | User confirmed required-field errors. Coordinate validation and whitespace/boundary cases not executed. |
| SAFE-03 | Reports persist and can be retrieved for location | **BLOCKED** (frontend workflow) | No frontend submission; backend general create/list tests passed, location-specific filtering not established. |
| SAFE-04 | Reports appear at correct map location | **BLOCKED** | Submission not connected and map unavailable. |

**Count note:** Of 25 MVP feature requirements, 6 have a reported PASS for a specific manual scenario (ITIN-01/02/04, FEED-03, POST-03, SAFE-02); 2 are PARTIAL (FEED-04, SAFE-01); 2 are FAIL (AUTH-01, MAP-01); 12 are BLOCKED (AUTH-02/03/04, POST-01/02/04, MAP-02/03/04, ITIN-03, SAFE-03/04); and 3 are NOT TESTED (AUTH-05, FEED-01/02). The statuses above, not an aggregate pass rate, govern acceptance; limited-scenario passes do not imply full requirement closure.

**Process/documentation (PROC-01–PROC-06):** Prior `QA standard.md` documents Definition of Done, severity, QA checklist, PR checklist, MVP acceptance criteria, and repository accessibility as baseline `Covered`. This report does not claim an independent new repository-access check or CI traceability script inspection beyond the supplied PR evidence.

## 5. Automated Tests and CI Evidence

| Evidence ID | Scope | Result | Interpretation |
|---|---|---|---|
| AUTO-01 | `uv run --python 3.14 pytest tests/test_auth.py -v` | **11/11 PASSED** | Registration, login, input validation, bearer-protected API routes, invalid JWT. Python 3.14.8 / pytest 9.1.1. |
| AUTO-02 | `uv run --python 3.14 pytest tests/test_posts_safety.py -v` | **14/14 PASSED** | 8 Post/API and 6 Safety/API tests, including auth, validation, creation and retrieval. |
| CI-01 | GitHub Actions PR #60 overview screenshot | **3/3 jobs green** | Frontend, Backend, QA documentation/traceability passed for that PR commit. |
| CI-02 | PR #60 Backend CI steps screenshot | **Green** | Python setup, uv dependencies, Black, Ruff, pytest, PostgreSQL integration step passed. Exact test counts not independently captured. |
| ENV-01 | Local `/health` | **PASS** | FastAPI running after Python 3.14 and environment setup. |
| ENV-02 | Local `GET /api/posts` after migrations | **200 with `[]`** | Feed retrieval route reachable; not a populated-feed test. |

**Warnings:** Local Authentication run emitted two non-failing Starlette/TestClient/AnyIO deprecation warnings. No evidence of a current functional failure from those warnings.

**CI configuration reviewed:** PR/push on `develop` and `main`; Node 22 frontend lint/test/build; Python 3.14 backend Black/Ruff/pytest and PostgreSQL integration; `qa-check` documentation and traceability verification. The screenshot verifies execution on PR #60, not branch protection settings, exact frontend test coverage, a deployment smoke test, or the current `develop` commit. Review integration fixture configuration because `backend/tests/conftest.py` unconditionally sets `DATABASE_URL` to SQLite; the integration suite may use a separate fixture/configuration, which was not inspected. Do not conclude that PostgreSQL was bypassed without examining those files.

## 6. Defects, Implementation Gaps, and Severity Recommendations

These are **report IDs, not created Jira issue keys**. Severity is proposed using WT-3.2 and should be confirmed against the agreed demonstration scope.

| Finding ID | Area | Evidence and impact | Proposed priority | Verification |
|---|---|---|---|---|
| QA-F01 | Frontend registration | `/register` has no form; cannot register via browser. | **P1** if demo-critical | Manual FAIL + code review |
| QA-F02 | Frontend login/session/logout | User could not access login form; code shows a login component, but actual deployed route/version unclear. Session/logout not demonstrated. | **P1 candidate** | Manual BLOCKED + discrepancy |
| QA-F03 | Create Post | `onSubmit()` never invokes `createPost()`, image upload is preview-only, location lookup absent; authenticated publishing path unavailable. | **P1** | Code review; manual BLOCKED |
| QA-F04 | Interactive Map | `Map.tsx` placeholder; `MarkerLayer` sample-data only; `MapPage` named import vs default export mismatch in supplied files. | **P1** | Manual FAIL + code review |
| QA-F05 | Safety Reporting | Valid form only `console.log()`s; no API persistence or marker update. | **P1** | Manual PARTIAL + code review |
| QA-F06 | Itinerary account isolation | Browser drafts use one shared localStorage key; not user-scoped or server-synced. | **P2 candidate** | Code-review risk; manual BLOCKED |
| QA-F07 | Protected frontend routes | No route-level guard in supplied `App.tsx`; no observed unauthenticated redirect. | **P2/P1 candidate** | Code review; manual NOT TESTED |
| QA-F08 | Profile/navigation | Profile placeholder; navbar lacks Login/Register/Logout links; no fallback route. | **P2 candidate** | Code review only |
| QA-F09 | Requirement mismatches | Post image optional in UI/backend vs QA requirement; Safety description optional backend vs required frontend; location name vs coordinate object; incident datetime UI vs backend generated timestamp. | **P2 candidate** | Schema/code review |
| QA-F10 | Feed author | `PostCard` displays `Traveler #ID`; requirement says author is shown but display-name expectation needs clarification. | **P3/P2 candidate** | Code review; no populated-feed manual check |

**No unresolved application P0 is confirmed from the final local environment state.** The original `routes.py` syntax failure was caused by executing Python 3.14 syntax with Python 3.13 and was resolved for testing by using Python 3.14. The incomplete demo-critical features above still prevent declaring full readiness.

### Reproduction and verification instructions for major findings

- **QA-F01:** Open `/register` in the tested frontend; expected registration fields and API submission; observed no form. Retest registration, duplicate email, invalid input.
- **QA-F02:** Open `/login` on the exact demo branch/build; compare with supplied `Login.tsx`, verify frontend API URL and network calls; then test valid/invalid login, refresh persistence, logout, protected-route redirect.
- **QA-F03:** Open `/create-post`; form fields validate, but unauthenticated publish is disabled. Once login exists, submit valid caption + image + resolved location; verify `POST /api/posts` 201 and immediate Feed visibility, and test error feedback.
- **QA-F04:** Open `/map`; expected geographic tiles and clickable post/safety markers; observed placeholder. Verify component exports/imports, initialization, marker data, popup correctness and invalid coordinates.
- **QA-F05:** Fill Safety form with valid type, location, datetime, description; expect backend request, saved report and marker; supplied handler only logs data. Verify actual POST, database persistence and location-specific retrieval after integration.
- **QA-F06:** Create itinerary as test User A; switch to test User B in same browser profile; verify User B cannot view or edit A's drafts. Retest after login/account isolation implemented.

## 7. Local Environment Troubleshooting Log (Resolved Setup Issues)

| Sequence | Observed symptom | Root cause / resolution | Final state |
|---|---|---|---|
| ENV-01 | Pytest collection and Uvicorn import raised `SyntaxError` at `except jwt.InvalidTokenError, ValueError, TypeError:` | Local `python3` was 3.13; project CI uses 3.14, where syntax is accepted. Installed `uv`/Python 3.14 and ran tests with `uv run --python 3.14`. | **Resolved for test execution; 11/11 Auth passed** |
| ENV-02 | `KeyError: 'DATABASE_URL'`, then SQLAlchemy URL parse error | Missing/placeholder environment configuration. Loaded project-root `.env` from `backend` using `--env-file ../.env` and configured local database. | **Resolved for startup** |
| ENV-03 | `ERR_CONNECTION_REFUSED` for `/health` | Backend not running/ready; restarted from correct directory with proper Python and env. | **Resolved; `/health` passed** |
| ENV-04 | `GET /api/posts` returned HTTP 500, `relation "posts" does not exist` | Local PostgreSQL schema not migrated. Ran `uv run --python 3.14 alembic upgrade head`; migrations `a6fe3f474c47` and `ff6b866c8309` applied. | **Resolved; API returned `[]`** |

Environment/setup failures are documented for onboarding and repeatability; they are **not** counted as outstanding product bugs after successful remediation. The database migration command was applied to the user's local database; do not apply blindly to shared/production environments.

## 8. Recommended Next-Sprint Jira Backlog / Handoff

Proposed **ticket titles and scopes only**; none are represented as already created. Feature owners should confirm scope, assign responsibility and avoid duplicate existing tickets.

### Frontend

| ID | Suggested ticket | Priority | Acceptance / completion check |
|---|---|---|---|
| FE-01 | Complete registration, login, logout, session restore and protected redirects | P1 | AUTH-01–05 pass browser QA; appropriate errors and redirects. |
| FE-02 | Connect Create Post to location lookup, image storage and post API | P1 | POST-01–04 pass; newly created post appears in Feed. |
| FE-03 | Implement interactive Map and real markers | P1 | MAP-01–04 pass; correct post/report details, safe invalid coordinates. |
| FE-04 | Connect Safety Report form to backend and map | P1 | SAFE-01–04 pass with saved report and correct marker. |
| FE-05 | Implement Profile and account-aware Navbar | P2 | Profile displays current user; account controls and navigation usable. |

### Backend

| ID | Suggested ticket | Priority | Acceptance / completion check |
|---|---|---|---|
| BE-01 | Align post image requirement and media storage contract | P2 | Frontend/backend agree whether image is mandatory; validation and tests match. |
| BE-02 | Align Safety report description and incident time contract | P2 | Required/optional rules and datetime semantics agreed, implemented, tested. |
| BE-03 | Support/verify safety report retrieval by location | P2 | SAFE-03 demonstrated for specific location, not only global list. |
| BE-04 | Complete/verify database-backed Itinerary contract and authorization | P2 | ITIN-01–03 pass across sessions and distinct users. |

### Integration

| ID | Suggested ticket | Priority | Acceptance / completion check |
|---|---|---|---|
| INT-01 | Verify frontend auth → JWT → protected API | P1 | Valid/invalid login, token expiration, 401 and redirect handled. |
| INT-02 | Verify Create Post → PostgreSQL → Feed | P1 | End-to-end created post visible and correctly attributed. |
| INT-03 | Verify Safety Report → PostgreSQL → Map | P1 | Report persists and appears at correct coordinates. |
| INT-04 | Connect Itinerary UI to per-user backend persistence | P2 | Drafts separated by account and reload across sessions. |
| INT-05 | Feed → Map location navigation (Sprint 5 scope) | P2 | Correct location/marker context; invalid data/back navigation tested. |

### QA / Testing

| ID | Suggested ticket | Priority | Acceptance / completion check |
|---|---|---|---|
| QA-01 | Retest Authentication and route protection | P1 | AUTH-01–05 manual results with evidence. |
| QA-02 | Seed two or more posts and verify Feed ordering/content | P2 | FEED-01/02 pass with authors, captions, images, locations. |
| QA-03 | Retest Create Post submission and failure handling | P1 | POST-01/02/04 verified. |
| QA-04 | Retest Map functionality and invalid coordinates | P1 | MAP-01–04 verified. |
| QA-05 | Retest Safety persistence and map display | P1 | SAFE-01/03/04 verified. |
| QA-06 | Verify Itinerary account isolation | P2 | ITIN-03 verified with two accounts. |
| QA-07 | Expand repeatable MVP regression suite in Sprint 4 | P2 | High-risk cases automated and run in CI without duplicating Chris's suite. |
| QA-08 | Complete Feed loading/error/retry and browser QA | P2 | FEED-04 all scenarios tested and recorded. |

### CI/CD and Developer Environment

| ID | Suggested ticket | Priority | Acceptance / completion check |
|---|---|---|---|
| CI-01 | Document required Python 3.14, uv, env-file usage | P3 | Fresh Mac setup reproduces passing backend test run. |
| CI-02 | Document local PostgreSQL and Alembic setup | P3 | Fresh database migrated and `/api/posts` returns 200. |
| CI-03 | Audit PostgreSQL integration fixture isolation | P2 | CI integration tests demonstrably connect to intended PostgreSQL service. |
| CI-04 | Review frontend test coverage for demo-critical paths | P2 | Coverage gaps and owners documented; current CI run verified. |

## 9. Remaining QA Work and Exit Criteria

Before declaring full midterm readiness, the team should: (1) confirm the exact demo branch/build and agreed feature scope; (2) resolve demo-critical P1 items; (3) demonstrate registration/login/logout/session/redirects; (4) demonstrate post creation with required image and Feed visibility; (5) demonstrate interactive map and safety report persistence/markers; (6) seed test data for Feed ordering/content; (7) finish skipped Feed loading/retry testing; (8) verify account isolation; (9) rerun relevant backend/frontend/CI checks on the actual demo commit; (10) retest corrected defects and record PASS/FAIL evidence.

The original SCRUM-29 objective called for reproducible Jira defects and no unresolved P0 blockers. This report supplies reproducible findings and proposed Jira ticket descriptions but **does not assert that Jira issues were created**. The team should either create/link the necessary tickets or explicitly approve a report-based handoff as a scope adjustment.

## 10. Evidence Index and Next-Sprint AI Handoff Instructions

**Evidence sources supplied during QA:** `QA standard.md`; Randoll's Individual Test Plan PDF; frontend `Login.tsx`, `Register.tsx`, `Feed.tsx`, `PostCard.tsx`, `CreatePost.tsx`, `createPostSchema.ts`, `MapPage.tsx`, `Map.tsx`, `MarkerLayer.tsx`, `SafetyReportForm.tsx`, `safetyReportSchema.ts`, `App.tsx`, `Profile.tsx`, `Navbar.tsx`, `Itinerary.tsx`, `api_configs.ts`; backend `models.py`, `pydantic_models.py`, `server.py`, `routes.py`, `test_auth.py`, `conftest.py`, `test_posts_safety.py`, `ci.yml`; terminal outputs and browser screenshots; PR #60 CI screenshots. Full logs/screenshots were reviewed in conversation but are **not embedded** in this standalone Markdown file; attach them or add repository paths when publishing.

**Instructions to a future teammate or AI assistant:** Read this report alongside the current code, `QA standard.md`, and Jira backlog. Treat FAIL, PARTIAL, BLOCKED and NOT TESTED distinctly. First check whether each finding still reproduces on the current branch; do not assume the October 12 snapshot is current. Use the relevant finding's reproduction instructions and original requirement ID to implement and retest. Prioritize FE-01–04 and their integration dependencies; coordinate ownership before editing; do not duplicate existing tickets. Update the manual matrix with dated evidence and record the exact commit/CI run used for final acceptance.

---

**Final Sprint 3 assessment:** **Not Ready for full MVP midterm demo** on the observed implementation. **Backend/API test baseline: passing (25/25).** **Limited browser-local and empty-state functionality: verified.** **Core frontend integration: incomplete or blocked.** The report is a handoff artifact, not proof that every feature was exhaustively tested or that fixes have been merged.
