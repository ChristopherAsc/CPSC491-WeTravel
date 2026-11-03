"""Itinerary creation and destination-management API tests."""

from datetime import date

import pytest
from models import Itinerary, Location, User
from routes import create_access_token, hash_password

# =========================================================
# 1. Test Fixtures
# =========================================================
# Creates two users and several locations so the tests can
# verify itinerary ownership and destination management.
# =========================================================


@pytest.fixture
def itinerary_users(db):
    users = []

    for suffix in ("owner", "stranger"):
        user = User(
            username=f"itinerary_{suffix}",
            email=f"itinerary_{suffix}@example.com",
            hashed_password=hash_password("ExamplePassword123!"),
        )
        db.add(user)
        users.append(user)

    db.commit()

    for user in users:
        db.refresh(user)

    return users


@pytest.fixture
def itinerary_headers(itinerary_users):
    return [
        {"Authorization": f"Bearer {create_access_token(user.user_id, user.username)}"}
        for user in itinerary_users
    ]


@pytest.fixture
def itinerary_locations(db):
    locations = [
        Location(
            name="Destination One",
            latitude=33.9,
            longitude=-117.9,
        ),
        Location(
            name="Destination Two",
            latitude=34.0,
            longitude=-118.0,
        ),
        Location(
            name="Destination Three",
            latitude=34.1,
            longitude=-118.1,
        ),
    ]

    db.add_all(locations)
    db.commit()

    for location in locations:
        db.refresh(location)

    return locations


@pytest.fixture
def owned_itinerary(db, itinerary_users):
    itinerary = Itinerary(
        user_id=itinerary_users[0].user_id,
        name="Destination Management Test",
        description="Itinerary used for destination testing",
        start_date=date(2026, 11, 10),
        end_date=date(2026, 11, 12),
    )

    db.add(itinerary)
    db.commit()
    db.refresh(itinerary)

    return itinerary


# =========================================================
# 2. Itinerary Creation With Destinations
# =========================================================
# Verifies that destination IDs supplied during itinerary
# creation are resolved to Location records and persisted
# through the itinerary_destinations association table.
# =========================================================


@pytest.mark.requirement("ITINERARY-DESTINATIONS")
def test_create_itinerary_with_destinations(
    client,
    itinerary_headers,
    itinerary_locations,
):
    """Verify an itinerary can be created with destinations."""
    location_ids = [location.location_id for location in itinerary_locations[:2]]

    response = client.post(
        "/api/itineraries",
        headers=itinerary_headers[0],
        json={
            "name": "Trip With Destinations",
            "description": "Testing destination persistence",
            "start_date": "2026-11-10",
            "end_date": "2026-11-12",
            "destinations": location_ids,
        },
    )

    assert response.status_code == 201

    data = response.json()

    assert data["name"] == "Trip With Destinations"
    assert data["destinations"] is not None
    assert {destination["location_id"] for destination in data["destinations"]} == set(
        location_ids
    )


@pytest.mark.requirement("ITINERARY-DESTINATIONS")
def test_create_itinerary_rejects_unknown_destination(
    client,
    itinerary_headers,
):
    """Verify an invalid destination ID returns HTTP 404."""
    response = client.post(
        "/api/itineraries",
        headers=itinerary_headers[0],
        json={
            "name": "Invalid Destination Test",
            "description": "Testing invalid destination handling",
            "start_date": "2026-11-10",
            "end_date": "2026-11-12",
            "destinations": [999999999],
        },
    )

    assert response.status_code == 404


# =========================================================
# 3. Destination Addition
# =========================================================
# Verifies that an itinerary owner can add an existing
# Location to their itinerary.
# =========================================================


@pytest.mark.requirement("ITINERARY-DESTINATIONS")
def test_owner_can_add_destination(
    client,
    owned_itinerary,
    itinerary_locations,
    itinerary_headers,
):
    """Verify the itinerary owner can add a destination."""
    location = itinerary_locations[0]

    response = client.post(
        f"/api/itineraries/{owned_itinerary.itinerary_id}/destinations/"
        f"{location.location_id}",
        headers=itinerary_headers[0],
    )

    assert response.status_code == 200

    data = response.json()

    assert location.location_id in {
        destination["location_id"] for destination in data["destinations"]
    }


@pytest.mark.requirement("ITINERARY-DESTINATIONS")
def test_owner_cannot_add_duplicate_destination(
    client,
    db,
    owned_itinerary,
    itinerary_locations,
    itinerary_headers,
):
    """Verify adding an existing destination returns HTTP 409."""
    location = itinerary_locations[0]

    owned_itinerary.destinations.append(location)
    db.commit()

    response = client.post(
        f"/api/itineraries/{owned_itinerary.itinerary_id}/destinations/"
        f"{location.location_id}",
        headers=itinerary_headers[0],
    )

    assert response.status_code == 409


# =========================================================
# 4. Destination Removal
# =========================================================
# Verifies that the owner can remove a destination without
# deleting the underlying Location record.
# =========================================================


@pytest.mark.requirement("ITINERARY-DESTINATIONS")
def test_owner_can_remove_destination(
    client,
    db,
    owned_itinerary,
    itinerary_locations,
    itinerary_headers,
):
    """Verify the itinerary owner can remove a destination."""
    location = itinerary_locations[0]

    owned_itinerary.destinations.append(location)
    db.commit()

    response = client.delete(
        f"/api/itineraries/{owned_itinerary.itinerary_id}/destinations/"
        f"{location.location_id}",
        headers=itinerary_headers[0],
    )

    assert response.status_code == 204

    db.expire_all()

    itinerary = db.get(Itinerary, owned_itinerary.itinerary_id)
    assert location.location_id not in {
        destination.location_id for destination in itinerary.destinations
    }

    assert db.get(Location, location.location_id) is not None


@pytest.mark.requirement("ITINERARY-DESTINATIONS")
def test_remove_nonexistent_destination_association(
    client,
    owned_itinerary,
    itinerary_locations,
    itinerary_headers,
):
    """Verify removing an unassociated destination returns HTTP 404."""
    location = itinerary_locations[0]

    response = client.delete(
        f"/api/itineraries/{owned_itinerary.itinerary_id}/destinations/"
        f"{location.location_id}",
        headers=itinerary_headers[0],
    )

    assert response.status_code == 404


# =========================================================
# 5. Ownership and Authentication
# =========================================================
# Verifies that only the itinerary owner can modify its
# destinations and that authentication is required.
# =========================================================


@pytest.mark.requirement("ITINERARY-DESTINATIONS")
def test_nonowner_cannot_add_destination(
    client,
    owned_itinerary,
    itinerary_locations,
    itinerary_headers,
):
    """Verify a non-owner cannot add destinations."""
    response = client.post(
        f"/api/itineraries/{owned_itinerary.itinerary_id}/destinations/"
        f"{itinerary_locations[0].location_id}",
        headers=itinerary_headers[1],
    )

    assert response.status_code == 403


@pytest.mark.requirement("ITINERARY-DESTINATIONS")
def test_nonowner_cannot_remove_destination(
    client,
    db,
    owned_itinerary,
    itinerary_locations,
    itinerary_headers,
):
    """Verify a non-owner cannot remove destinations."""
    location = itinerary_locations[0]

    owned_itinerary.destinations.append(location)
    db.commit()

    response = client.delete(
        f"/api/itineraries/{owned_itinerary.itinerary_id}/destinations/"
        f"{location.location_id}",
        headers=itinerary_headers[1],
    )

    assert response.status_code == 403


@pytest.mark.requirement("ITINERARY-DESTINATIONS")
def test_destination_management_requires_auth(
    client,
    owned_itinerary,
    itinerary_locations,
):
    """Verify unauthenticated users cannot modify destinations."""
    response = client.post(
        f"/api/itineraries/{owned_itinerary.itinerary_id}/destinations/"
        f"{itinerary_locations[0].location_id}",
    )

    assert response.status_code == 401


# =========================================================
# 6. Resource Error Handling
# =========================================================
# Verifies that unknown itineraries and locations return
# appropriate HTTP 404 responses.
# =========================================================


@pytest.mark.requirement("ITINERARY-DESTINATIONS")
def test_add_destination_unknown_itinerary(
    client,
    itinerary_locations,
    itinerary_headers,
):
    """Verify adding to a nonexistent itinerary returns HTTP 404."""
    response = client.post(
        f"/api/itineraries/999999999/destinations/"
        f"{itinerary_locations[0].location_id}",
        headers=itinerary_headers[0],
    )

    assert response.status_code == 404


@pytest.mark.requirement("ITINERARY-DESTINATIONS")
def test_add_destination_unknown_location(
    client,
    owned_itinerary,
    itinerary_headers,
):
    """Verify adding a nonexistent location returns HTTP 404."""
    response = client.post(
        f"/api/itineraries/{owned_itinerary.itinerary_id}/destinations/999999999",
        headers=itinerary_headers[0],
    )

    assert response.status_code == 404
