# C08 — Travel-Data Privacy and Minimization: Sprint 4 Interim Assessment

| | |
|---|---|
| **Control** | C08 — Travel-Data Privacy and Minimization |
| **SOC 2 alignment** | CC6.3 (access restrictions), CC6.7 (information protection); Confidentiality and Privacy |
| **Targeted risk** | Risk 3 — Sensitive Travel and Location Data Exposure (High) |
| **Control owner / assessor** | Christopher Ascencio |
| **Jira work item** | SCRUM-54 |
| **Sprint** | Sprint 4 (Oct 26 – Nov 2, 2026) |
| **Baseline assessed** | 2026-11-02, against `develop` at commit `5edbb37` ([PR #82](https://github.com/ChristopherAsc/CPSC491-WeTravel/pull/82)) |
| **Remediated** | 2026-11-02, branch `feature/c08-privacy-remediation`, from `develop` at commit `a25ef25` |
| **Interim status** | **Verified for the agreed Sprint 4 scope.** All six acceptance criteria are met; both baseline findings that failed the criteria (C08-F1, C08-F2) are fixed and covered by regression tests. The remediation PR's CI run and review complete C08-T5. Follow-up items outside the Sprint 4 scope remain open (section 7). |

This is a SOC 2-aligned project control assessment, not a SOC 2 certification or auditor opinion.

## 1. Control objective

Public WeTravel API responses must return only the fields a public feature needs. Private data (email, password hash, itineraries) must never appear, internal identifiers must be justified by a feature, and location coordinates must not be more precise than the feature requires.

## 2. Scope and independence boundary

| In scope for C08 | Out of scope (owner) |
|---|---|
| Inventory of every unauthenticated (public) `GET` endpoint and its response fields | Resource ownership and cross-user access checks (C01) |
| Classification of public and prohibited fields | JWT validation, expiry and sessions (C03) |
| Pydantic response schemas and ORM serialization for public endpoints | Repository secret scanning (C02) |
| Coordinate precision in public responses | Security event logging (C07) |
| Anonymous response-shape tests and sanitized evidence | Product decisions on which posts are public |

Findings outside this boundary are recorded in section 7 and referred to the owning control.

## 3. Method

All tests call public endpoints **without an `Authorization` header**, as any visitor could. The test data is synthetic. A traveler account is seeded with a public post, a public safety report and a private itinerary. **Canary values** (a unique email, itinerary name, itinerary note and trip dates) are stored only in private fields, so their appearance anywhere in a public response proves a leak.

| Test ID | Procedure | Type | Automated test |
|---|---|---|---|
| C08-T1 | Anonymous `GET` of each public endpoint; returned field paths (including nested) must equal the documented allowlist | Automated | `test_c08_t1_public_response_matches_allowlist` |
| C08-T2 | Prohibited keys and canary values must be absent from every public response, at any depth | Automated | `test_c08_t2_public_response_reveals_no_private_data` |
| C08-T3 | Every public latitude/longitude must be the stored value rounded to 3 decimal places (about 110 m) | Automated | `test_c08_t3_public_coordinates_are_coarsened` |
| C08-T4 | Every public route must filter its output through a declared response schema; schema snapshot of each public model must equal its allowlist | Automated + code review | `test_c08_t4_every_public_route_declares_a_response_model`, `test_c08_t4_public_schema_matches_allowlist` |
| C08-T5 | Focused tests pass in GitHub Actions; PR reviewed by a teammate | CI + manual | Linked in section 9 |

All automated tests are in [`backend/tests/test_soc_c08_travel_data_privacy.py`](../../backend/tests/test_soc_c08_travel_data_privacy.py) and run in CI with the backend suite.

At baseline, tests for open findings were marked `xfail(strict=True)` with the finding ID, so CI stayed green while recording each gap. Strict mode turns an unexpected pass into a CI failure, so a fixed finding cannot keep its marker. This was confirmed during remediation: after the fix and before the markers were removed, the 8 marked tests reported `XPASS(strict)` and failed the run. The markers were then removed, and the tests now guard against regressions.

**Reproduce** (from `backend/`):

```
pytest tests/test_soc_c08_travel_data_privacy.py -v -rxX
C08_EVIDENCE_DIR=../docs/security/evidence/C08/remediated pytest tests/test_soc_c08_travel_data_privacy.py -k capture
```

The second command regenerates the sanitized JSON samples. Running it with `C08_EVIDENCE_DIR` set to `baseline` on commit `a25ef25` (before the fix) reproduces the "before" samples.

## 4. Public endpoint inventory

All paths are under `/api`. "Public" means the route has no `get_current_user` dependency.

| Endpoint | Response schema | What it returns | Feature using it |
|---|---|---|---|
| `GET /posts` | `list[PostResponse]` | Latest 20 posts | Travel Feed |
| `GET /posts/{post_id}` | `PostResponse` | One post | Post detail |
| `GET /users/{user_id}` | `PublicUserResponse` | Public profile | Profile pages |
| `GET /users/{user_id}/posts` | `list[PostResponse]` | A user's posts | Profile pages |
| `GET /locations` | `list[LocationResponse]` | Stored locations | Map |
| `GET /locations/nearby` | `list[LocationResponse]` | Locations within a radius (PostGIS) | Map |
| `GET /locations/{location_id}` | `LocationResponse` | One location | Map |
| `GET /locations/{location_id}/posts` | `list[PostResponse]` | Posts at a location | Map → Feed (Sprint 5) |
| `GET /safety-reports` | `list[PublicSafetyReportResponse]` *(was `list[SafetyReportResponse]`)* | Latest 100 safety reports | Map safety layer |
| `GET /locations/search/suggest` | none (pass-through) | Live Mapbox suggestions | Location search |
| `GET /locations/search/retrieve/{id}` | none (pass-through) | Live Mapbox place detail | Location search |

Login-only routes (`/auth/me`, `/users/me`, `/users/me/posts`, `/itineraries`, `/itineraries/{id}`) were confirmed to require a token and are excluded. Their access control belongs to C01 and C03.

## 5. Field classification and public allowlist

| Data | Field | Classification | Rationale |
|---|---|---|---|
| User | `username` | **Public** | Display name for profiles and posts |
| User | `user_id` | **Public, justified identifier** | Key for `/users/{user_id}` and `/users/{user_id}/posts`; posts need it to link to their author. IDs are sequential (see C08-F3). |
| User | `email` | **Prohibited** | Returned only to the account owner via `/users/me` |
| User | `hashed_password` | **Prohibited (secret)** | Never returned by any endpoint |
| Post | `post_id`, `caption`, `media_url`, `created_at` | **Public** | Content the author chose to publish; `created_at` is the posting time, not a visit time |
| Post | `user_id` | **Public, justified identifier** | Author link (see `User.user_id`) |
| Post | `location.name` | **Public** | Shown on every feed card |
| Post / Location / Safety report | `latitude`, `longitude` | **Public at reduced precision (3 decimals, about 110 m)** | Map pins need an approximate position; no public feature needs building-level precision. Enforced by the `PublicCoordinate` type in `pydantic_models.py`. |
| Location | `location_id` | **Public, justified identifier** | Key for `/locations/{location_id}/posts` (map to feed) |
| Safety report | `report_id`, `report_type`, `description`, `created_at`, `location` | **Public** | Shown on the map safety layer |
| Safety report | `user_id` (reporter) | **Prohibited in public responses** | No public feature needs the reporter's identity; combined with a location and timestamp it places a named user at a spot at a time. Returned only to the reporter in the response to their own `POST /safety-reports`. Owner-only deletion is checked server-side from the token. |
| Itinerary | all fields (name, description, dates, destinations) | **Prohibited (private)** | Available only through login-only, owner-checked routes |
| Post like | who liked a post | **Prohibited** | Not exposed; only the liker receives the toggle result |

The allowlists in the test module (`POST_FIELDS`, `PROFILE_FIELDS`, `LOCATION_FIELDS`, `SAFETY_REPORT_FIELDS`, `PROHIBITED_KEYS`) encode this table exactly.

## 6. Results

### 6.1 Baseline (2026-11-02, commit `5edbb37`)

Result: **19 passed, 9 expected failures** (all from C08-F1 or C08-F2). Full backend suite: 156 passed.

| Test | Result | Detail |
|---|---|---|
| C08-T1 field allowlist | 7 of 8 endpoints pass | `GET /safety-reports` also returned the reporter's `user_id` (C08-F1). |
| C08-T2 private data | 8 of 8 pass | No email, password hash, itinerary name/note/dates, or prohibited key in any public response. |
| C08-T3 coordinate precision | 0 of 7 pass | Every endpoint returned coordinates exactly as stored, e.g. `34.0522351, -118.2436849` (C08-F2). |
| C08-T4 response schemas | Pass with one finding | 10 of 12 public routes used a response schema; the other 2 are the reviewed Mapbox pass-throughs. `SafetyReportResponse` declared `user_id` (C08-F1). |

Sanitized "before" responses: [`evidence/C08/baseline/`](evidence/C08/baseline/).

### 6.2 After remediation (2026-11-02, branch `feature/c08-privacy-remediation`)

Result: **28 passed, 0 expected failures.** Full backend suite: 165 passed; integration suite: 8 passed.

| Test | Result | Detail |
|---|---|---|
| C08-T1 field allowlist | **8 of 8 pass** | Public safety reports no longer include `user_id`. |
| C08-T2 private data | **8 of 8 pass** | Unchanged. |
| C08-T3 coordinate precision | **7 of 7 pass** | Every public coordinate is the stored value rounded to 3 decimals, e.g. `33.8703596, -117.9242966` → `33.87, -117.924`. |
| C08-T4 response schemas | **Pass** | 10 of 12 public routes use a response schema and the other 2 are the reviewed pass-throughs; all 4 public models match their allowlists. |
| C08-T5 CI and review | **Baseline: pass. Remediation: on its PR.** | See section 9. |

Sanitized "after" responses: [`evidence/C08/remediated/`](evidence/C08/remediated/). Comparing each file with its baseline counterpart shows only two kinds of change: `user_id` removed from safety reports, and coordinates rounded. Timestamps differ because the samples were generated at different times.

The fix was also confirmed against a locally running backend: an anonymous `GET /api/safety-reports` returned rounded coordinates and no `user_id` for reports created through the API.

### 6.3 What changed

- **`backend/pydantic_models.py`:**
  - A `PublicCoordinate` type rounds latitude and longitude to 3 decimals when a response is serialized. Stored values and request validation are unchanged.
  - It is used by `LocationResponse` and by a new `PostLocationResponse`, which replaces the request model previously reused in `PostResponse`.
  - A new `PublicSafetyReportResponse` omits `user_id`. `SafetyReportResponse` extends it with `user_id` for the reporter's own create response.
- **`backend/routes.py`:** `GET /api/safety-reports` uses `PublicSafetyReportResponse`.
- **Tests:**
  - The C08 expected-failure markers were removed.
  - C08-T3 now also checks that each coordinate is the correctly rounded stored value.
  - Two integration tests that asserted exact coordinates now expect the rounded public values.

Frontend impact: none. The Feed reads `location.name` and `user_id`, which are unchanged, and the map currently uses sample data.

### Existing safeguards verified

- **S1.** Every public route filters ORM objects through a declared Pydantic response schema, so undeclared attributes and relationships (`Post.user`, `User.itineraries`, `User.email`) cannot be serialized. The two exceptions are the Mapbox pass-throughs, reviewed manually: they return live third-party place data, contain no WeTravel user data, and are documented in code as not persisted. *(C08-T4)*
- **S2.** The public profile returns only `user_id` and `username`, with no email and no nested post list. *(C08-T1, C08-T2; also covered by the WT-21 test `test_public_profile_returns_public_fields_only`)*
- **S3.** Itinerary names, notes, dates and destinations never appear in any public response. *(C08-T2 canary values)* Owner-only access to itineraries is verified separately by C01.
- **S4.** Email addresses and password hashes never appear in any public response. *(C08-T2)*

## 7. Findings

| ID | Severity | Finding | Status | Owner | Resolution / next action |
|---|---|---|---|---|---|
| C08-F1 | Medium | `GET /api/safety-reports` publicly returned the reporter's `user_id`, linking a named user to a place and time. | **Fixed** | Christopher Ascencio (C08) | Public list now uses `PublicSafetyReportResponse`. Evidence: `safety_reports.json` before/after; C08-T1 and C08-T4 pass. |
| C08-F2 | High | All public responses returned coordinates at full stored precision (7 decimals, about 1 cm), enough to pinpoint a home or hotel. | **Fixed** | Christopher Ascencio (C08) | Public coordinates are rounded to 3 decimals at the schema level. Evidence: all before/after samples with coordinates; 7 C08-T3 cases pass. |
| C08-F3 | Low | User IDs are sequential, so anyone can list every public profile by counting. | **Accepted for Sprint 4** | Christopher Ascencio (C08) | Profiles expose only a username. Revisit if profiles gain more fields. |
| C08-F4 | Low | `POST /api/auth/register` answers "Email is already registered", revealing whether an email has an account. | **Referred** | C03 owner (authentication); C04 is not assigned this sprint | Out of C08's response-field scope; referred for an account-enumeration review. |
| C08-F5 | Info | Once photo upload (Cloudinary) is connected, uploaded images could carry EXIF GPS metadata more precise than the post's location. | **Follow-up** | Christopher Ascencio (Create Post owner) | Strip image metadata when Cloudinary upload is added. |
| C08-F6 | Info | `GET /api/locations/nearby` requires PostgreSQL/PostGIS and cannot run against the SQLite test database. | **Covered by design; not executed** | Christopher Ascencio (C08) | Returns `list[LocationResponse]`, so the C08-F2 rounding applies. Execute against PostgreSQL when the integration environment supports PostGIS. |
| C08-F7 | Low | Coordinates are still **stored** at the precision the client submits; only public output is reduced. A database compromise (Risk 8) would expose the stored precision. | **Follow-up** | Christopher Ascencio (C08) | Decide in Sprint 6 backend hardening whether to round on write, which would also coarsen PostGIS radius searches. Relates to Risk 8; the database control (C10) is not assigned this sprint. |

## 8. Acceptance criteria status

| Acceptance criterion (from the C08 control plan) | Baseline | After remediation |
|---|---|---|
| A field-classification table lists allowed and excluded fields for each selected endpoint | Met | **Met** (section 5) |
| Returned JSON field set matches the public allowlist, including nested fields | Partially met (7 of 8) | **Met** (8 of 8) |
| Private email, nonpublic itinerary details and unnecessary internal identifiers are absent | Partially met | **Met** |
| Precise coordinates are omitted or reduced when the feature does not justify exact precision | Not met | **Met** (3 decimals, about 110 m) |
| Public schemas avoid serializing private ORM relationships or extra nested fields | Met | **Met** |
| Focused tests pass locally and in CI; unresolved findings recorded with an owner and next action | Met locally; CI pending | **Met**: baseline CI passed (section 9); remediation CI on its PR; open items recorded in section 7 |

## 9. Evidence index

| Evidence | Location |
|---|---|
| Automated C08 tests | `backend/tests/test_soc_c08_travel_data_privacy.py` |
| Sanitized baseline responses and field inventory | `docs/security/evidence/C08/baseline/` |
| Sanitized remediated responses and field inventory | `docs/security/evidence/C08/remediated/` |
| Baseline PR | [PR #82](https://github.com/ChristopherAsc/CPSC491-WeTravel/pull/82), merged 2026-11-03 04:47 UTC by ChristopherAsc |
| Baseline CI run (C08-T5) | [GitHub Actions run 41577478288](https://github.com/ChristopherAsc/CPSC491-WeTravel/actions/runs/41577478288): success, 2026-11-03 04:19 UTC |
| Baseline PR review (C08-T5) | Approved by Khraen, 2026-11-03 04:22 UTC |
| Remediation PR, CI run and review (C08-T5) | Linked from the remediation PR page |
| Jira work item | SCRUM-54 |

Times are UTC; 2026-11-03 04:00 UTC is the evening of 2026-11-02 in Pacific time.

## 10. Remaining work

1. Complete C08-T5 for the remediation PR: CI run and teammate review.
2. C08-F4: hand to the C03 owner for an account-enumeration review.
3. C08-F5: strip image metadata when Cloudinary photo upload is implemented.
4. C08-F6: run the C08 checks against PostgreSQL with PostGIS once the integration environment supports it.
5. C08-F7: decide on write-time coordinate rounding during Sprint 6 backend hardening.
