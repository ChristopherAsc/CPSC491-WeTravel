# WeTravel Backend Tests

This directory contains automated tests for the WeTravel backend.

## Test Structure

### `conftest.py`

Contains shared pytest fixtures used by all backend tests.

The test configuration:

- Creates an isolated test database
- Overrides the FastAPI database dependency
- Provides a FastAPI `TestClient`
- Creates seeded test users when required
- Uses a test-only JWT secret

Tests use an isolated SQLite test database and test-only credentials —
they don't require production database access or real JWT secrets.

### `test_health.py`

Contains an automated test for the `/health` endpoint, verifying the
API is reachable and returns the expected status response. This test
doesn't touch the database and serves as a basic smoke test that the
application starts and imports cleanly.

### `test_auth.py`

Contains automated tests for the authentication API.

The current test suite verifies:

1. Successful user registration
2. Duplicate email rejection
3. Duplicate username rejection
4. Successful login
5. Invalid username rejection
6. Invalid Email Register
7. Invalid password rejection
8. Protected routes reject unauthenticated requests
9. Valid JWT tokens allow access to protected routes
10. Invalid JWT tokens are rejected
11. Testing for password length


### `test_smoke.py`

The Sprint 3 Midterm Smoke Test Suite. A shallow, repeatable pass across
the app's most critical workflows — Authentication, Feed, Create Post,
Map, Safety, and representative API endpoints — meant to catch a
critical failure before/during the midterm demo, not to exercise every
edge case (that's what `test_auth.py` and `test_posts_safety.py` are
for). Every test is tagged with `@pytest.mark.smoke` and its assertion
messages are prefixed with the affected feature (e.g. `[Map] ...`) so a
failure is immediately traceable. See `QA standard.md`'s
"Midterm Smoke Test Suite (Sprint 3)" section for the requirement
mapping.

## Running the Tests

From the `backend` directory, run all tests:

```bash
uv run pytest -v
```

Or run a specific test file:

```bash
uv run pytest tests/test_health.py -v
uv run pytest tests/test_auth.py -v
```

Run only the midterm smoke suite:

```bash
uv run pytest -m smoke -v
```

## Directory Structure

```
backend/
└── tests/
    ├── README.md
    ├── __init__.py
    ├── conftest.py
    ├── test_health.py
    ├── test_auth.py
    ├── test_posts_safety.py
    └── test_smoke.py
```