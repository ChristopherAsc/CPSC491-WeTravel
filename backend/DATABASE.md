# Database Schema

PostgreSQL database, managed via SQLAlchemy models (`models.py`) and Alembic migrations (`alembic/versions/`).

Only `users` is implemented in `models.py` / migrated so far. The other tables below are inferred from the response schemas in `pydantic_models.py` (which read `from_attributes=True`, i.e. from ORM objects) and describe the data model the API is being built toward, but do not yet exist as SQLAlchemy models or migrations.

## Tables

### `users` (implemented)

| Column            | Type         | Constraints                |
|-------------------|--------------|-----------------------------|
| `user_id`         | Integer      | Primary key                 |
| `username`        | String(50)   | Unique, not null            |
| `email`           | String(255)  | Unique, not null            |
| `hashed_password` | String(255)  | Not null                    |

### `locations` (planned)

| Column       | Type    | Constraints |
|--------------|---------|--------------|
| `location_id`| Integer | Primary key  |
| `name`       | String  | Not null     |
| `latitude`   | Float   | Not null     |
| `longitude`  | Float   | Not null     |

### `posts` (planned)

| Column       | Type          | Constraints                          |
|--------------|---------------|----------------------------------------|
| `post_id`    | Integer       | Primary key                            |
| `user_id`    | Integer       | Foreign key → `users.user_id`          |
| `caption`    | String(2200)  | Not null                               |
| `media_url`  | String        | Nullable                               |
| `location_id`| Integer       | Foreign key → `locations.location_id`  |
| `created_at` | DateTime      | Not null                               |

### `itineraries` (planned)

| Column        | Type         | Constraints                     |
|---------------|--------------|-----------------------------------|
| `itinerary_id`| Integer      | Primary key                       |
| `user_id`     | Integer      | Foreign key → `users.user_id`     |
| `name`        | String(100)  | Not null                          |
| `description` | String       | Nullable                          |
| `start_date`  | Date         | Not null                          |
| `end_date`    | Date         | Not null                          |

### `itinerary_destinations` (planned, join table)

Many-to-many link between an itinerary and the locations on it (`ItineraryCreate.destinations` / `ItineraryResponse.destinations`).

| Column         | Type    | Constraints                            |
|----------------|---------|-------------------------------------------|
| `itinerary_id` | Integer | Foreign key → `itineraries.itinerary_id`  |
| `location_id`  | Integer | Foreign key → `locations.location_id`     |

### `safety_reports` (planned)

| Column        | Type    | Constraints                           |
|---------------|---------|------------------------------------------|
| `report_id`   | Integer | Primary key                              |
| `user_id`     | Integer | Foreign key → `users.user_id`            |
| `report_type` | String  | Not null                                 |
| `location_id` | Integer | Foreign key → `locations.location_id`    |
| `description` | String  | Nullable                                 |
| `created_at`  | DateTime| Not null                                 |

## Relationships

- `users` 1—* `posts` (`posts.user_id`)
- `users` 1—* `itineraries` (`itineraries.user_id`)
- `users` 1—* `safety_reports` (`safety_reports.user_id`)
- `locations` 1—* `posts` (`posts.location_id`)
- `locations` 1—* `safety_reports` (`safety_reports.location_id`)
- `itineraries` *—* `locations` through `itinerary_destinations`

Currently, `users` is the only table actually created in the database (see `alembic/versions/a6fe3f474c47_create_users_table.py`); it has no foreign keys yet since no other tables exist.
