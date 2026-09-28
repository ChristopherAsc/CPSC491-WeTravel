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
6. Invalid password rejection
7. Protected routes reject unauthenticated requests
8. Valid JWT tokens allow access to protected routes
9. Invalid JWT tokens are rejected

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

## Directory Structure

```
backend/
└── tests/
    ├── README.md
    ├── __init__.py
    ├── conftest.py
    ├── test_health.py
    └── test_auth.py
```