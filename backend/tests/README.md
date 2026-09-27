# WeTravel Backend Authentication Tests

This directory contains automated tests for the WeTravel backend authentication system.

These tests are part of the Backend CI authentication testing objective and verify user registration, login, credential validation, JWT authentication, and access to protected routes.

## Test Structure

### `conftest.py`

Contains shared pytest fixtures used by the authentication tests.

The test configuration:

- Creates an isolated test database
- Overrides the FastAPI database dependency
- Provides a FastAPI `TestClient`
- Creates seeded test users when required
- Uses a test-only JWT secret

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

From the `backend` directory, run:

```bash
python3 -m pytest tests/test_auth.py -v


backend/
└── tests/
    ├── README.md
    ├── __init__.py
    ├── conftest.py
    └── test_auth.py