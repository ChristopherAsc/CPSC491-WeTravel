# WeTravel

A collaborative travel planning and safety-sharing web application. WeTravel is a travel-focused social platform designed to combine travel discovery, social content, maps, and trip planning into one application.

The goal of WeTravel is to make it easier for users to discover destinations, view travel experiences shared by other users, explore locations on an interactive map, and organize destinations into itineraries.

**Repository**: https://github.com/ChristopherAsc/CPSC491-WeTravel

---

## Project Overview

**WeTravel** empowers travelers to:
- **Create and share itineraries** with destinations, activities, and timing
- **Explore a feed** of posts from other travelers (destinations, photos, tips)
- **Interact with maps** to visualize travel locations and discover nearby places
- **Report and view safety information** for travel regions
- **Save and organize** favorite posts and itineraries

---

## Technology Stack

### Frontend
- React 18 + TypeScript + Vite
- Tailwind CSS
- shadcn/ui components
- TanStack Query for data fetching
- React Router for routing
- React Hook Form + Zod for forms
- Mapbox GL JS for maps
- Lucide React Icons
- Vitest + React Testing Library for testing

### Backend
- FastAPI (Python)
- SQLAlchemy 2.0 ORM
- PostgreSQL database
- PostGIS for geospatial queries
- JWT authentication
- Pydantic for validation
- pytest for testing

### Infrastructure
- GitHub for version control
- GitHub Actions for CI/CD
- Vercel for frontend hosting
- Render for backend hosting
- Supabase / Neon for managed PostgreSQL
- Cloudinary for image hosting
- Mapbox for map APIs

---

## Current Development

This branch contains the initial frontend shell for the WeTravel application.

### Completed

- React + TypeScript + Vite project setup
- Tailwind CSS configuration
- shadcn/ui configuration
- React Router setup
- Global application layout
- Responsive navigation
- Initial application routes
- Reusable layout components

### Current Routes

| Route | Page |
| --- | --- |
| `/` | Home |
| `/login` | Login |
| `/register` | Register |
| `/feed` | Travel Feed |
| `/map` | Map |
| `/create-post` | Create Post |
| `/itinerary` | Itinerary |
| `/profile` | Profile |

### Frontend Project Structure

```text
src/
├── assets/
├── components/
│   ├── layout/
│   │   ├── MainContent.tsx
│   │   ├── Navbar.tsx
│   │   └── PageContainer.tsx
│   └── ui/
├── lib/
├── pages/
│   ├── CreatePost.tsx
│   ├── Feed.tsx
│   ├── Home.tsx
│   ├── Itinerary.tsx
│   ├── Login.tsx
│   ├── Map.tsx
│   ├── Profile.tsx
│   └── Register.tsx
├── App.tsx
├── index.css
└── main.tsx
```

---

## Prerequisites

### Required
- **Node.js** v18+ ([nodejs.org](https://nodejs.org))
- **Python** 3.11+ ([python.org](https://www.python.org))
- **PostgreSQL** 15+ (or Docker Desktop for Postgres container)
- **Git** ([git-scm.com](https://git-scm.com))

### Verify Installation
```bash
node --version
python --version
git --version
```

---

## Frontend Setup

TBD

---

## Backend Setup

TBD

---

## Database Setup

TBD