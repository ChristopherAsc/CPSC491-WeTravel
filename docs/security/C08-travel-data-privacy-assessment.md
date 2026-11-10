# C08 — Travel-Data Privacy and Minimization: Sprint 4 Interim Assessment

| | |
|---|---|
| **Control** | C08 — Travel-Data Privacy and Minimization |
| **SOC 2 alignment** | CC6.3 (access restrictions), CC6.7 (information protection); Confidentiality and Privacy |
| **Targeted risk** | Risk 3 — Sensitive Travel and Location Data Exposure (High) |
| **Control owner / assessor** | Christopher Ascencio |
| **Sprint** | Sprint 4 (Oct 26 – Nov 2, 2026) |
| **Baseline assessed** | 2026-11-02, against `develop` at commit `5edbb37` |
| **Interim status** | **Partially assessed.** Baseline complete; acceptance criteria not yet met because of findings C08-F1 and C08-F2 (remediation in progress). |

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
| C08-T3 | Every public latitude/longitude must have at most 3 decimal places (about 110 m) | Automated | `test_c08_t3_public_coordinates_are_coarsened` |
| C08-T4 | Every public route must filter its output through a declared response schema; schema snapshot of each public model must equal its allowlist | Automated + code review | `test_c08_t4_every_public_route_declares_a_response_model`, `test_c08_t4_public_schema_matches_allowlist` |
| C08-T5 | Focused tests pass in GitHub Actions; PR reviewed by a teammate | CI + manual | Linked in section 9 |

All automated tests are in [`backend/tests/test_soc_c08_travel_data_privacy.py`](../../backend/tests/test_soc_c08_travel_data_privacy.py) and run in CI with the backend suite. Tests for open findings are marked `xfail(strict=True)` with the finding ID. They are expected to fail until the finding is fixed, and strict mode turns an unexpected pass into a CI failure, so the marker cannot be forgotten after remediation.

**Reproduce** (from `backend/`):

```
pytest tests/test_soc_c08_travel_data_privacy.py -v -rxX
C08_EVIDENCE_DIR=../docs/security/evidence/C08/baseline pytest tests/test_soc_c08_travel_data_privacy.py -k capture
```

The second command regenerates the sanitized JSON samples in [`evidence/C08/baseline/`](evidence/C08/baseline/).

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
| `GET /safety-reports` | `list[SafetyReportResponse]` | Latest 100 safety reports | Map safety layer |
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
| Post / Location / Safety report | `latitude`, `longitude` | **Public at reduced precision (3 decimals, about 110 m)** | Map pins need an approximate position; no public feature needs building-level precision |
| Location | `location_id` | **Public, justified identifier** | Key for `/locations/{location_id}/posts` (map to feed) |
| Safety report | `report_id`, `report_type`, `description`, `created_at`, `location` | **Public** | Shown on the map safety layer |
| Safety report | `user_id` (reporter) | **Prohibited in public responses** | No public feature needs the reporter's identity; combined with exact coordinates and a timestamp it places a named user at a spot at a time. Owner-only deletion is checked server-side from the token, not from this field. |
| Itinerary | all fields (name, description, dates, destinations) | **Prohibited (private)** | Available only through login-only, owner-checked routes |
| Post like | who liked a post | **Prohibited** | Not exposed; only the liker receives the toggle result |

The allowlists in the test module (`POST_FIELDS`, `PROFILE_FIELDS`, `LOCATION_FIELDS`, `SAFETY_REPORT_FIELDS`, `PROHIBITED_KEYS`) encode this table exactly.

## 6. Baseline results (2026-11-02)

Result: **19 passed, 9 expected failures** (all expected failures belong to C08-F1 or C08-F2). Full backend suite: 156 passed.

| Test | Result | Detail |
|---|---|---|
| C08-T1 field allowlist | **7 of 8 endpoints pass** | `GET /safety-reports` also returns the reporter's `user_id` (C08-F1). |
| C08-T2 private data | **8 of 8 pass** | No email, password hash, itinerary name/note/dates, or prohibited key in any public response. |
| C08-T3 coordinate precision | **0 of 7 pass** | Every endpoint with coordinates returns them exactly as stored, e.g. `34.0522351, -118.2436849` (C08-F2). |
| C08-T4 response schemas | **Pass with one finding** | 10 of 12 public routes use a response schema; the other 2 are the reviewed Mapbox pass-throughs. Schema snapshot: 3 of 4 public models match; `SafetyReportResponse` declares `user_id` (C08-F1). |
| C08-T5 CI and review | **Pending** | Added when the PR's GitHub Actions run and review complete (section 9). |

Sanitized "before" responses: [`evidence/C08/baseline/`](evidence/C08/baseline/), with a field-by-field summary in [`field-inventory.json`](evidence/C08/baseline/field-inventory.json).

### Existing safeguards verified

- **S1.** Every public route filters ORM objects through a declared Pydantic response schema, so undeclared attributes and relationships (`Post.user`, `User.itineraries`, `User.email`) cannot be serialized. The two exceptions are the Mapbox pass-throughs, reviewed manually: they return live third-party place data, contain no WeTravel user data, and are documented in code as not persisted. *(C08-T4)*
- **S2.** The public profile returns only `user_id` and `username`, with no email and no nested post list. *(C08-T1, C08-T2; also covered by the WT-21 test `test_public_profile_returns_public_fields_only`)*
- **S3.** Itinerary names, notes, dates and destinations never appear in any public response. *(C08-T2 canary values)* Owner-only access to itineraries is verified separately by C01.
- **S4.** Email addresses and password hashes never appear in any public response. *(C08-T2)*

## 7. Findings

| ID | Severity | Finding | Evidence | Status | Owner | Next action |
|---|---|---|---|---|---|---|
| C08-F1 | Medium | `GET /api/safety-reports` publicly returns the reporter's `user_id`, linking a named user to an exact place and time. | `evidence/C08/baseline/safety_reports.json`; C08-T1 and C08-T4 expected failures | **Open, remediation in progress** | Christopher Ascencio (C08) | Remove `user_id` from the public safety report schema; keep owner checks server-side. |
| C08-F2 | High | All public responses return coordinates at full stored precision (7 decimals, about 1 cm), which can pinpoint a home or hotel. | All baseline samples with coordinates; 7 C08-T3 expected failures | **Open, remediation in progress** | Christopher Ascencio (C08) | Round public coordinates to 3 decimals at the response-schema level, so it also covers `/locations/nearby`. |
| C08-F3 | Low | User IDs are sequential, so anyone can list every public profile by counting. | `GET /api/users/{user_id}` | **Accepted for Sprint 4** | Christopher Ascencio (C08) | Profiles expose only a username. Revisit if profiles gain more fields. |
| C08-F4 | Low | `POST /api/auth/register` answers "Email is already registered", revealing whether an email has an account. | `routes.py` `register` | **Referred** | C03 owner (authentication); C04 is not assigned this sprint | Out of C08's response-field scope; referred for an account-enumeration review. |
| C08-F5 | Info | Once photo upload (Cloudinary) is connected, uploaded images could carry EXIF GPS metadata more precise than the post's location. | Upload not yet implemented | **Follow-up** | Christopher Ascencio (Create Post owner) | Strip image metadata when Cloudinary upload is added. |
| C08-F6 | Info | `GET /api/locations/nearby` requires PostgreSQL/PostGIS and cannot run against the SQLite test database. | `routes.py` `nearby_locations` | **Reviewed manually** | Christopher Ascencio (C08) | Uses `LocationResponse`, so the schema-level fix for C08-F2 covers it. |

## 8. Acceptance criteria status

| Acceptance criterion (from the C08 control plan) | Status |
|---|---|
| A field-classification table lists allowed and excluded fields for each selected endpoint | **Met** (section 5) |
| Returned JSON field set matches the public allowlist, including nested fields | **Partially met**: 7 of 8 endpoints (C08-F1) |
| Private email, nonpublic itinerary details and unnecessary internal identifiers are absent | **Partially met**: email and itinerary data absent; reporter `user_id` present (C08-F1) |
| Precise coordinates are omitted or reduced when the feature does not justify exact precision | **Not met** (C08-F2) |
| Public schemas avoid serializing private ORM relationships or extra nested fields | **Met** (S1) |
| Focused tests pass locally and in CI; unresolved findings recorded with an owner and next action | **Met locally; CI pending** (section 9); findings recorded (section 7) |

## 9. Evidence index

| Evidence | Location |
|---|---|
| Automated C08 tests | `backend/tests/test_soc_c08_travel_data_privacy.py` |
| Sanitized baseline responses and field inventory | `docs/security/evidence/C08/baseline/` |
| Baseline PR and GitHub Actions run | *(add link after the PR is opened)* |
| PR review | *(add reviewer and link)* |
| Jira work item | *(add C08 work item key)* |

## 10. Remaining work

1. Remediate C08-F1 and C08-F2 in the public response schemas, remove the matching `xfail` markers, and capture "after" evidence in `evidence/C08/remediated/`.
2. Confirm no frontend regression. The Feed uses `user_id` only to label the author, and the map currently uses sample data, so neither change should affect the UI.
3. Update this document's status, acceptance criteria and evidence links with the remediation PR and CI run.
4. Hand C08-F4 to the C03 owner, and schedule C08-F5 with the photo-upload work.
