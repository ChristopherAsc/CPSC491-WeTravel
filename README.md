# WeTravel

WeTravel is a travel-focused social platform designed to combine travel discovery, social content, maps, and trip planning into one application.

The goal of WeTravel is to make it easier for users to discover destinations, view travel experiences shared by other users, explore locations on an interactive map, and organize destinations into itineraries.

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

## Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- React Router
- Lucide React Icons

## Current Routes

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

## Project Structure

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