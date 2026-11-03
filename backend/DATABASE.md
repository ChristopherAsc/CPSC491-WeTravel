# Database Schema

PostgreSQL database, managed via SQLAlchemy models (`models.py`) and Alembic migrations (`alembic/versions/`).

All tables below are implemented in `models.py` and created by the migrations:

| Revision       | File                                                  | Creates                                                                 |
|----------------|-------------------------------------------------------|-------------------------------------------------------------------------|
| `a6fe3f474c47` | `a6fe3f474c47_create_users_table.py`                  | `users`                                                                 |
| `ff6b866c8309` | `ff6b866c8309_add_post_safety_and_location_tables.py` | `locations`, `itineraries`, `posts`, `safety_reports`, `itinerary_destinations` |

## Tables

### `users`

| Column            | Type         | Constraints                |
|-------------------|--------------|-----------------------------|
| `user_id`         | Integer      | Primary key                 |
| `username`        | String(50)   | Unique, not null            |
| `email`           | String(255)  | Unique, not null            |
| `hashed_password` | String(255)  | Not null                    |

### `locations`

| Column        | Type        | Constraints |
|---------------|-------------|--------------|
| `location_id` | Integer     | Primary key  |
| `name`        | String(255) | Not null     |
| `latitude`    | Float       | Not null     |
| `longitude`   | Float       | Not null     |

### `posts`

| Column        | Type                      | Constraints                                                   |
|---------------|---------------------------|----------------------------------------------------------------|
| `post_id`     | Integer                   | Primary key                                                    |
| `user_id`     | Integer                   | Foreign key → `users.user_id` (on delete cascade), not null, indexed |
| `location_id` | Integer                   | Foreign key → `locations.location_id`, not null, indexed       |
| `caption`     | String(2200)              | Not null                                                       |
| `media_url`   | String(2048)              | Nullable                                                       |
| `created_at`  | DateTime (with time zone) | Not null, server default `now()`                               |

### `itineraries`

| Column         | Type         | Constraints                                                   |
|----------------|--------------|----------------------------------------------------------------|
| `itinerary_id` | Integer      | Primary key                                                    |
| `user_id`      | Integer      | Foreign key → `users.user_id` (on delete cascade), not null, indexed |
| `name`         | String(100)  | Not null                                                       |
| `description`  | String(2000) | Nullable                                                       |
| `start_date`   | Date         | Not null                                                       |
| `end_date`     | Date         | Not null                                                       |

### `itinerary_destinations` (join table)

Many-to-many link between an itinerary and the locations on it (`Itinerary.destinations` / `Location.itineraries`). Composite primary key on (`itinerary_id`, `location_id`).

| Column         | Type    | Constraints                                                          |
|----------------|---------|-----------------------------------------------------------------------|
| `itinerary_id` | Integer | Primary key, foreign key → `itineraries.itinerary_id` (on delete cascade) |
| `location_id`  | Integer | Primary key, foreign key → `locations.location_id` (on delete cascade)    |

### `safety_reports`

| Column        | Type                      | Constraints                                                   |
|---------------|---------------------------|----------------------------------------------------------------|
| `report_id`   | Integer                   | Primary key                                                    |
| `user_id`     | Integer                   | Foreign key → `users.user_id` (on delete cascade), not null, indexed |
| `location_id` | Integer                   | Foreign key → `locations.location_id`, not null, indexed       |
| `report_type` | String(100)               | Not null                                                       |
| `description` | String(2000)              | Nullable                                                       |
| `created_at`  | DateTime (with time zone) | Not null, server default `now()`                               |

## Relationships

- `users` 1—* `posts` (`posts.user_id`)
- `users` 1—* `itineraries` (`itineraries.user_id`)
- `users` 1—* `safety_reports` (`safety_reports.user_id`)
- `locations` 1—* `posts` (`posts.location_id`)
- `locations` 1—* `safety_reports` (`safety_reports.location_id`)
- `itineraries` *—* `locations` through `itinerary_destinations`

### Delete behavior

- Deleting a user deletes their posts, itineraries, and safety reports (database `ON DELETE CASCADE`, plus `cascade="all, delete-orphan"` on the ORM relationships).
- Deleting an itinerary or a location removes its rows from `itinerary_destinations`.
- Deleting a location that is still referenced by a post or safety report fails (no cascade on those foreign keys).

## Indexes

| Index                           | Table            | Column        |
|---------------------------------|------------------|---------------|
| `ix_posts_user_id`              | `posts`          | `user_id`     |
| `ix_posts_location_id`          | `posts`          | `location_id` |
| `ix_itineraries_user_id`        | `itineraries`    | `user_id`     |
| `ix_safety_reports_user_id`     | `safety_reports` | `user_id`     |
| `ix_safety_reports_location_id` | `safety_reports` | `location_id` |

`users.username` and `users.email` are covered by their unique constraints. Note that `models.py` also marks them `index=True`, but the `create_users_table` migration doesn't create separate `ix_users_*` indexes, so Alembic autogenerate may try to add them.
