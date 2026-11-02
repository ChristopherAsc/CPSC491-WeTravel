# WeTravel

A collaborative travel planning and safety-sharing web application.

WeTravel is a travel-focused social platform that combines travel discovery, social content, interactive maps, safety reporting, and trip planning.

**Repository:** https://github.com/ChristopherAsc/CPSC491-WeTravel

---

## Project Overview

WeTravel allows users to:

- Register, log in, and log out securely.
- Explore travel posts shared by other users.
- Create travel posts with location and media information.
- View travel destinations on an interactive map.
- Create and organize travel itineraries.
- Submit and view safety reports.
- Access personal profile information.

Some MVP features are still undergoing integration and manual acceptance testing.

---

## Technology Stack

### Frontend
- React + TypeScript + Vite
- Tailwind CSS
- React Router
- Mapbox GL JS
- Lucide React Icons
- Vitest + React Testing Library

### Backend
- FastAPI (Python)
- SQLAlchemy
- PostgreSQL
- JWT Authentication
- Pydantic
- pytest

### Development Tools
- Git and GitHub
- GitHub Actions CI/CD
- Ruff and Black for backend code quality
- ESLint and Prettier for frontend code quality

---

## Current Development

The WeTravel MVP includes the following application features.

| Feature | Current Status |
|---|---|
| Registration and Login | Implemented and tested |
| Logout | Added to desktop and mobile navigation |
| Protected Routes | Implemented |
| Travel Feed | Automated tests passing |
| Create Post | Backend tests passing; frontend publishing requires verification |
| Post Detail | Backend retrieval tested |
| Interactive Map | Smoke tests passing |
| Itinerary | Frontend automated tests passing |
| Safety Reporting | Backend automated tests passing |
| User Profile | Frontend automated tests passing |

---

## Application Routes

| Route | Page |
|---|---|
| `/` | Home |
| `/login` | Login |
| `/register` | Register |
| `/feed` | Travel Feed |
| `/map` | Interactive Map and Safety |
| `/create-post` | Create Post |
| `/itinerary` | Itinerary |
| `/profile` | User Profile |

Feed, Map, Create Post, Itinerary, and Profile are protected routes that require authentication.

---

## Prerequisites

Before running WeTravel locally, install:

- Node.js and npm
- Python 3.11+
- uv (Python package manager)
- PostgreSQL
- Git

Verify the installations:

```bash
node --version
npm --version
python --version
uv --version
git --version
```

---

## Frontend Setup

From the project root, install dependencies:

```bash
npm ci
```

Start the frontend development server:

```bash
npm run dev
```

Open the local URL displayed in the terminal, typically:

http://localhost:5173

---

## Backend Setup

Install Python dependencies from the project root:

```bash
uv sync --dev
```

Create a `.env.local` file in the project root containing the required backend environment variables.

Example configuration:

```dotenv
DATABASE_URL=postgresql://USERNAME:PASSWORD@localhost:5432/DATABASE_NAME
SECRET_KEY=REPLACE_WITH_A_SECURE_RANDOM_VALUE
```

The exact authentication secret variable name should match the backend configuration.

Do not commit `.env.local` or actual credentials to GitHub.

Start the backend from the project root:

```bash
uv run --env-file .env.local uvicorn server:app --app-dir backend --reload
```

The backend runs at:

http://127.0.0.1:8000

API documentation is available at:

http://127.0.0.1:8000/docs

---

## Database Setup

WeTravel uses PostgreSQL for application data.

Before starting the backend:

1. Install and start PostgreSQL.
2. Create a local development database.
3. Configure `DATABASE_URL` in `.env.local`.
4. Confirm the database connection is available.

The database initialization procedure depends on the current backend configuration.

---

## Running Automated Tests

### Frontend Tests

Run all frontend tests:

```bash
npm run test
```

Run a specific test file:

```bash
npm run test -- src/pages/Login.test.tsx --run
```

Run frontend smoke tests:

```bash
npm run test -- src/test/smoke.test.tsx --run
```

### Backend Tests

From the project root:

```bash
cd backend
uv run pytest tests/ -v
```

Run specific backend tests:

```bash
uv run pytest tests/test_auth.py -v
uv run pytest tests/test_posts_safety.py -v
uv run pytest tests/test_auth_jwt.py -v
uv run pytest tests/test_smoke.py -v
uv run pytest tests/integration/test_integration.py -v
```

Backend automated tests use an isolated test database and test credentials.

---

## Code Quality Checks

### Frontend

Run ESLint:

```bash
npm run lint
```

Check formatting:

```bash
npx prettier --check src/
```

Build the frontend:

```bash
npm run build
```

### Backend

From the project root, run:

```bash
uv run ruff check .
uv run black --check .
```

These checks help maintain consistent code quality before merging changes.

---

## Sprint 4 – MVP QA Review

**Jira Ticket:** WT-22 – Feature MVP Acceptance Review

Sprint 4 focuses on reviewing the completed MVP features, executing automated and manual tests, identifying defects, and preparing the application for Sprint 5 integration.

### Automated Testing Results

During the initial Sprint 4 QA review, 110 automated tests were executed across the frontend and backend.

**Results:**
- 110 tests passed in their latest executions.
- 0 remaining automated test failures in the reviewed test files.
- Frontend smoke test Mapbox mock issue identified and fixed.
- Additional manual acceptance testing required.

### Identified Improvements

- Fixed the Mapbox mock used by frontend smoke tests.
- Added a Logout button to desktop and mobile navigation.
- Updated authentication and protected-route functionality through ongoing team development.

### Remaining QA Work

- Complete manual testing of all MVP features.
- Verify Create Post publishing and persistence.
- Review remaining functional acceptance criteria.
- Document unresolved defects.
- Prepare the final Sprint 4 MVP QA report.

---

## Git Workflow

Development work should be completed on feature branches.

Example:

```bash
git switch develop
git pull origin develop
git switch -c feature/my-feature
```

After implementing and testing changes:

```bash
git add .
git commit -m "Description of changes"
git push -u origin feature/my-feature
```

Create a pull request targeting `develop`.

All changes should be reviewed and pass the required CI checks before merging.

---

## Project Status

WeTravel is currently under active development.

The MVP includes authentication, travel posts, interactive maps, itinerary planning, safety reporting, and user profiles.

Automated testing and CI/CD are in place. Additional manual testing, integration improvements, and security assessments are ongoing as the project progresses toward Sprint 5.
