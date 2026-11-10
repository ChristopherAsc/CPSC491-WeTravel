# WeTravel

A collaborative travel planning and safety-sharing web application.

WeTravel is a travel-focused social platform that combines travel discovery, social content, interactive maps, safety reporting, and trip planning into one application.

The goal of WeTravel is to help users discover destinations, share travel experiences, explore locations, and organize trips.

**Repository:** https://github.com/ChristopherAsc/CPSC491-WeTravel

---

## Project Overview

WeTravel allows users to:

- Register, log in, and log out.
- Explore travel posts shared by other users.
- Create posts with captions, locations, and media.
- Explore destinations using an interactive map.
- Create and organize travel itineraries.
- Submit and view safety reports.
- View personal profile information.

Some features are still undergoing development and integration.

---

## Technology Stack

### Frontend

- React + TypeScript + Vite
- Tailwind CSS
- shadcn/ui
- React Router
- Mapbox GL JS
- Lucide React Icons
- Vitest + React Testing Library

### Backend

- FastAPI (Python)
- SQLAlchemy ORM
- PostgreSQL
- JWT Authentication
- Pydantic
- pytest

### Development Tools

- Git and GitHub
- GitHub Actions CI/CD
- Ruff and Black
- ESLint and Prettier

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

Feed, Map, Create Post, Itinerary, and Profile require authentication.

---

## Prerequisites

Install the following tools before running the project:

- Node.js and npm
- Python 3.11+
- uv (Python package manager)
- PostgreSQL
- Git

Verify installation:

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

Open the URL displayed in the terminal, usually:

http://localhost:5173

---

## Backend Setup

Install Python dependencies from the project root:

```bash
uv sync --dev
```

Create a `.env.local` file in the project root and configure the required environment variables.

Example:

```dotenv
DATABASE_URL=postgresql://USERNAME:PASSWORD@localhost:5432/DATABASE_NAME
```

Additional authentication-related environment variables may be required depending on the backend configuration.

Do not commit `.env.local` or real credentials to GitHub.

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

WeTravel uses PostgreSQL to store application data.

To configure the database:

1. Install and start PostgreSQL.
2. Create a local development database.
3. Configure the database connection in `.env.local`.
4. Start the FastAPI backend.
5. Verify the database connection.

Database initialization and migration procedures should follow the backend configuration.

---

## Running Automated Tests

### Frontend Tests

Install dependencies:

```bash
npm ci
```

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

Frontend testing uses Vitest and React Testing Library.

### Backend Tests

From the project root:

```bash
cd backend
uv run pytest tests/ -v
```

Run a specific backend test file:

```bash
uv run pytest tests/test_auth.py -v
```

Backend tests use pytest and FastAPI's TestClient with an isolated test database and test credentials.

See `backend/tests/README.md` for additional information.

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

From the project root:

```bash
uv run ruff check .
uv run black --check .
```

These tools help maintain code quality and consistency.

---

## CI/CD

WeTravel uses GitHub Actions to automatically run checks when changes are submitted.

The CI pipeline includes:

- Frontend linting and testing.
- Frontend build verification.
- Backend automated testing.
- Backend linting and formatting checks.
- Smoke testing for critical application workflows.

The workflow configuration is located at:

`.github/workflows/ci.yml`

---

## Git Workflow

Development work should be completed on feature branches.

Create a branch:

```bash
git switch develop
git pull origin develop
git switch -c feature/my-feature
```

After making changes:

```bash
git add .
git commit -m "Description of changes"
git push -u origin feature/my-feature
```

Create a pull request targeting `develop`.

Changes should pass CI checks and receive team review before merging.

---

## Project Status

WeTravel is under active development.

The application includes authentication, travel feeds, post creation, interactive maps, itinerary planning, safety reporting, and user profiles.

Additional integration, testing, and improvements are ongoing.
