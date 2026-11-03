"""SOC 2 C01: ownership enforcement for private itineraries and destructive actions.

Targeted Risk: RISK-01 — Unauthorized Access to User Resources.

These tests verify that the FastAPI backend enforces resource ownership using
the authenticated user's identity rather than client-provided ownership data.
"""

from datetime import date

import pytest
from models import Itinerary, Location, Post, SafetyReport, User
from routes import create_access_token, hash_password

# =========================================================
# 1. Test Fixtures — Users, Authentication, and Resources
# =========================================================
# Creates two separate users (owner and stranger), generates
# authentication headers for both, and creates resources
# belonging exclusively to the owner.
#
# These fixtures establish the conditions needed to test
# authorized and unauthorized access across all resources.
# =========================================================


@pytest.fixture
def c01_users(db):
    users = []
    for suffix in ("owner", "stranger"):
        user = User(
            username=f"c01_{suffix}",
            email=f"c01_{suffix}@example.com",
            hashed_password=hash_password("ExamplePassword123!"),
        )
        db.add(user)
        users.append(user)
    db.commit()
    for user in users:
        db.refresh(user)
    return users


@pytest.fixture
def c01_headers(c01_users):
    return [
        {"Authorization": f"Bearer {create_access_token(user.user_id, user.username)}"}
        for user in c01_users
    ]


@pytest.fixture
def c01_resources(db, c01_users):
    owner = c01_users[0]
    place = Location(name="Private test location", latitude=33.9, longitude=-117.9)
    itinerary = Itinerary(
        user_id=owner.user_id,
        name="C01 private travel schedule",
        start_date=date(2026, 11, 10),
        end_date=date(2026, 11, 12),
    )
    post = Post(user_id=owner.user_id, location=place, caption="C01 post")
    report = SafetyReport(
        user_id=owner.user_id,
        location=place,
        report_type="C01 hazard",
        description="Report owned by A",
    )
    db.add_all([itinerary, post, report])
    db.commit()
    for resource in (itinerary, post, report):
        db.refresh(resource)
    return {
        "itinerary": itinerary.itinerary_id,
        "post": post.post_id,
        "report": report.report_id,
    }


# =========================================================
# 2. Itinerary Authorization Tests — Confidentiality
# =========================================================
# Endpoint: GET /api/itineraries/{itinerary_id}
#
# Purpose:
# Verify that private itineraries are accessible only to
# their owners and that unauthorized users cannot retrieve
# another user's travel information.
#
# Tests:
# - Owner receives HTTP 200 and correct itinerary data.
# - Non-owner receives HTTP 403 or 404 without private data.
# - Unauthenticated requests receive HTTP 401.
# - Nonexistent itineraries receive HTTP 404.
# =========================================================


@pytest.mark.requirement("C01", "RISK-01")
def test_itinerary_owner_can_read(client, c01_resources, c01_headers):
    """Verify the itinerary owner can retrieve their private itinerary."""
    response = client.get(
        f"/api/itineraries/{c01_resources['itinerary']}", headers=c01_headers[0]
    )
    assert response.status_code == 200
    assert response.json()["name"] == "C01 private travel schedule"


@pytest.mark.requirement("C01", "RISK-01")
def test_itinerary_nonowner_cannot_read(client, c01_resources, c01_headers):
    """Verify a different user cannot access another user's itinerary."""
    response = client.get(
        f"/api/itineraries/{c01_resources['itinerary']}", headers=c01_headers[1]
    )
    assert response.status_code in (403, 404)
    assert "C01 private travel schedule" not in response.text


@pytest.mark.requirement("C01", "RISK-01")
def test_itinerary_requires_auth(client, c01_resources):
    """Verify unauthenticated requests cannot retrieve private itineraries."""
    response = client.get(f"/api/itineraries/{c01_resources['itinerary']}")
    assert response.status_code == 401


@pytest.mark.requirement("C01", "RISK-01")
def test_itinerary_nonexistent(client, c01_headers):
    """Verify requests for nonexistent itineraries return HTTP 404."""
    assert (
        client.get("/api/itineraries/999999999", headers=c01_headers[0]).status_code
        == 404
    )


# =========================================================
# 3. Post Ownership Tests — Data Integrity
# =========================================================
# Endpoint: DELETE /api/posts/{post_id}
#
# Purpose:
# Verify that only the user who created a post can delete it.
# This prevents users from manipulating a post ID to delete
# another user's content.
#
# Tests:
# - Non-owner receives HTTP 403; post remains in database.
# - Unauthenticated requests receive HTTP 401.
# - Owner receives HTTP 204; post is removed from database.
# - Nonexistent posts receive HTTP 404.
# =========================================================


@pytest.mark.requirement("C01", "RISK-01")
def test_post_nonowner_cannot_delete(client, db, c01_resources, c01_headers):
    """Verify a non-owner cannot delete another user's post."""
    post_id = c01_resources["post"]
    response = client.delete(f"/api/posts/{post_id}", headers=c01_headers[1])
    assert response.status_code == 403
    assert db.get(Post, post_id) is not None


@pytest.mark.requirement("C01", "RISK-01")
def test_post_requires_auth(client, db, c01_resources):
    """Verify unauthenticated users cannot delete posts."""
    post_id = c01_resources["post"]
    assert client.delete(f"/api/posts/{post_id}").status_code == 401
    assert db.get(Post, post_id) is not None


@pytest.mark.requirement("C01", "RISK-01")
def test_post_owner_can_delete(client, db, c01_resources, c01_headers):
    """Verify the owner can delete their post and persist the deletion."""
    post_id = c01_resources["post"]
    assert (
        client.delete(f"/api/posts/{post_id}", headers=c01_headers[0]).status_code
        == 204
    )
    db.expire_all()
    assert db.get(Post, post_id) is None


@pytest.mark.requirement("C01", "RISK-01")
def test_post_nonexistent(client, c01_headers):
    """Verify deleting a nonexistent post returns HTTP 404."""
    assert (
        client.delete("/api/posts/999999999", headers=c01_headers[0]).status_code == 404
    )


# =========================================================
# 4. Safety Report Ownership Tests — Data Integrity
# =========================================================
# Endpoint: DELETE /api/safety-reports/{report_id}
#
# Purpose:
# Verify that only the user who submitted a safety report
# can delete it. This prevents malicious or unauthorized
# deletion of safety information submitted by other users.
#
# Tests:
# - Non-owner receives HTTP 403; report remains in database.
# - Unauthenticated requests receive HTTP 401.
# - Owner receives HTTP 204; report is removed from database.
# - Nonexistent safety reports receive HTTP 404.
# =========================================================


@pytest.mark.requirement("C01", "RISK-01")
def test_safety_nonowner_cannot_delete(client, db, c01_resources, c01_headers):
    """Verify a non-owner cannot delete another user's safety report."""
    report_id = c01_resources["report"]
    response = client.delete(f"/api/safety-reports/{report_id}", headers=c01_headers[1])
    assert response.status_code == 403
    assert db.get(SafetyReport, report_id) is not None


@pytest.mark.requirement("C01", "RISK-01")
def test_safety_requires_auth(client, db, c01_resources):
    """Verify unauthenticated users cannot delete safety reports."""
    report_id = c01_resources["report"]
    assert client.delete(f"/api/safety-reports/{report_id}").status_code == 401
    assert db.get(SafetyReport, report_id) is not None


@pytest.mark.requirement("C01", "RISK-01")
def test_safety_owner_can_delete(client, db, c01_resources, c01_headers):
    """Verify the owner can delete their safety report."""
    report_id = c01_resources["report"]
    assert (
        client.delete(
            f"/api/safety-reports/{report_id}", headers=c01_headers[0]
        ).status_code
        == 204
    )
    db.expire_all()
    assert db.get(SafetyReport, report_id) is None


@pytest.mark.requirement("C01", "RISK-01")
def test_safety_nonexistent(client, c01_headers):
    """Verify deleting a nonexistent safety report returns HTTP 404."""
    response = client.delete("/api/safety-reports/999999999", headers=c01_headers[0])
    assert response.status_code == 404
