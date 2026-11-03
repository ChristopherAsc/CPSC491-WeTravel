"""SOC 2 C08: travel-data privacy and minimization for public API responses.

Targeted Risk: RISK-03 — Sensitive Travel and Location Data Exposure.

These tests call public endpoints anonymously, the way any visitor could, and
check that each response contains only the fields documented as public in
docs/security/C08-travel-data-privacy-assessment.md. Synthetic "canary" values
are seeded into private fields so a leak anywhere in a response is detectable.

Open findings are recorded as xfail(strict=True) tests naming the finding ID.
Findings C08-F1 and C08-F2 from the Sprint 4 baseline are fixed, so their
markers have been removed and these tests now guard against regressions.
"""

import json
import os
from datetime import date
from pathlib import Path

import pytest
from fastapi.routing import APIRoute
from models import Itinerary, Location, Post, SafetyReport, User
from pydantic import BaseModel
from pydantic_models import (
    PUBLIC_COORDINATE_DECIMALS,
    LocationResponse,
    PostResponse,
    PublicSafetyReportResponse,
    PublicUserResponse,
)
from routes import get_current_user, hash_password, router

# =========================================================
# 1. Documented Public Field Allowlists
# =========================================================
# Field paths use dots for nested objects ("location.name").
# Each set must match the classification table in the C08
# assessment document.
# =========================================================

POST_FIELDS = {
    "post_id",
    "user_id",
    "caption",
    "media_url",
    "created_at",
    "location",
    "location.name",
    "location.latitude",
    "location.longitude",
}
PROFILE_FIELDS = {"user_id", "username"}
LOCATION_FIELDS = {"location_id", "name", "latitude", "longitude"}
SAFETY_REPORT_FIELDS = {
    "report_id",
    "report_type",
    "description",
    "created_at",
    "location",
    "location.location_id",
    "location.name",
    "location.latitude",
    "location.longitude",
}

PROHIBITED_KEYS = {
    "email",
    "hashed_password",
    "password",
    "itineraries",
    "itinerary_id",
    "start_date",
    "end_date",
    "safety_reports",
    "post_likes",
}

PUBLIC_ENDPOINTS = {
    "feed": ("/api/posts", POST_FIELDS),
    "post_detail": ("/api/posts/{post_id}", POST_FIELDS),
    "public_profile": ("/api/users/{user_id}", PROFILE_FIELDS),
    "user_posts": ("/api/users/{user_id}/posts", POST_FIELDS),
    "location_list": ("/api/locations", LOCATION_FIELDS),
    "location_detail": ("/api/locations/{location_id}", LOCATION_FIELDS),
    "location_posts": ("/api/locations/{location_id}/posts", POST_FIELDS),
    "safety_reports": ("/api/safety-reports", SAFETY_REPORT_FIELDS),
}

# Live Mapbox autocomplete results; they contain no WeTravel user data
# and are not persisted (reviewed manually, see assessment document).
# Paths are relative to the "/api" prefix.
REVIEWED_PASS_THROUGH_ROUTES = {
    "/locations/search/suggest",
    "/locations/search/retrieve/{mapbox_id:path}",
}

# =========================================================
# 2. Synthetic Test Data With Private Canary Values
# =========================================================
# One traveler with a public post, a public safety report,
# and a private itinerary. Canary values are stored only in
# private fields; none may appear in a public response.
# =========================================================

CANARY_EMAIL = "c08.canary.traveler@example.test"
CANARY_ITINERARY_NAME = "C08 canary private trip"
CANARY_ITINERARY_NOTE = "C08 canary: staying at hotel room 1208"
CANARY_TRIP_DATES = (date(2031, 7, 14), date(2031, 7, 21))

# Seven decimal places, about 1 cm: deliberately more precise than allowed
POST_COORDINATES = (34.0522351, -118.2436849)
REPORT_COORDINATES = (33.8703596, -117.9242966)


@pytest.fixture
def c08_data(db):
    traveler = User(
        username="c08_traveler",
        email=CANARY_EMAIL,
        hashed_password=hash_password("ExamplePassword123!"),
    )
    viewpoint = Location(
        name="C08 synthetic viewpoint",
        latitude=POST_COORDINATES[0],
        longitude=POST_COORDINATES[1],
    )
    crossing = Location(
        name="C08 synthetic crossing",
        latitude=REPORT_COORDINATES[0],
        longitude=REPORT_COORDINATES[1],
    )
    post = Post(
        user=traveler,
        location=viewpoint,
        caption="C08 public travel post",
        media_url="https://example.com/c08-synthetic.jpg",
    )
    report = SafetyReport(
        user=traveler,
        location=crossing,
        report_type="C08 synthetic hazard",
        description="Synthetic safety report",
    )
    itinerary = Itinerary(
        user=traveler,
        name=CANARY_ITINERARY_NAME,
        description=CANARY_ITINERARY_NOTE,
        start_date=CANARY_TRIP_DATES[0],
        end_date=CANARY_TRIP_DATES[1],
        destinations=[viewpoint],
    )
    db.add_all([traveler, post, report, itinerary])
    db.commit()

    return {
        "user_id": traveler.user_id,
        "post_id": post.post_id,
        "location_id": viewpoint.location_id,
        "hashed_password": traveler.hashed_password,
    }


def get_public(client, c08_data, endpoint):
    """Request a public endpoint without an Authorization header."""
    path = PUBLIC_ENDPOINTS[endpoint][0].format(**c08_data)
    response = client.get(path)
    assert response.status_code == 200, f"[C08] GET {path} failed: {response.text}"
    return response


def field_paths(value, prefix=""):
    """Every field path in a JSON value; list items are merged."""
    if isinstance(value, list):
        return set().union(*(field_paths(item, prefix) for item in value))
    if isinstance(value, dict):
        paths = set()
        for key, child in value.items():
            paths.add(f"{prefix}{key}")
            paths |= field_paths(child, f"{prefix}{key}.")
        return paths
    return set()


def coordinate_values(value):
    if isinstance(value, list):
        return [number for item in value for number in coordinate_values(item)]
    if isinstance(value, dict):
        numbers = [value[key] for key in ("latitude", "longitude") if key in value]
        for child in value.values():
            numbers += coordinate_values(child)
        return numbers
    return []


def schema_paths(model, prefix=""):
    paths = set()
    for name, field in model.model_fields.items():
        paths.add(f"{prefix}{name}")
        if isinstance(field.annotation, type) and issubclass(
            field.annotation, BaseModel
        ):
            paths |= schema_paths(field.annotation, f"{prefix}{name}.")
    return paths


def requires_login(route):
    pending = list(route.dependant.dependencies)
    while pending:
        dependency = pending.pop()
        if dependency.call is get_current_user:
            return True
        pending.extend(dependency.dependencies)
    return False


# =========================================================
# 3. C08-T1 — Public Responses Match the Allowlist
# =========================================================


@pytest.mark.requirement("C08", "RISK-03")
@pytest.mark.parametrize("endpoint", PUBLIC_ENDPOINTS)
def test_c08_t1_public_response_matches_allowlist(client, c08_data, endpoint):
    """An anonymous response returns exactly the documented public fields."""
    body = get_public(client, c08_data, endpoint).json()
    allowed = PUBLIC_ENDPOINTS[endpoint][1]
    returned = field_paths(body)

    assert returned - allowed == set(), (
        f"[C08] {endpoint} returns fields outside the public allowlist: "
        f"{sorted(returned - allowed)}"
    )
    assert allowed - returned == set(), (
        f"[C08] {endpoint} is missing documented display fields: "
        f"{sorted(allowed - returned)}"
    )


# =========================================================
# 4. C08-T2 — No Private Data in Public Responses
# =========================================================


@pytest.mark.requirement("C08", "RISK-03")
@pytest.mark.parametrize("endpoint", PUBLIC_ENDPOINTS)
def test_c08_t2_public_response_reveals_no_private_data(client, c08_data, endpoint):
    """Private keys and canary values never appear, at any nesting depth."""
    response = get_public(client, c08_data, endpoint)
    returned_keys = {path.rsplit(".", 1)[-1] for path in field_paths(response.json())}

    assert returned_keys & PROHIBITED_KEYS == set(), (
        f"[C08] {endpoint} returns prohibited keys: "
        f"{sorted(returned_keys & PROHIBITED_KEYS)}"
    )

    private_values = [
        CANARY_EMAIL,
        CANARY_ITINERARY_NAME,
        CANARY_ITINERARY_NOTE,
        c08_data["hashed_password"],
        *(trip_date.isoformat() for trip_date in CANARY_TRIP_DATES),
    ]
    for private_value in private_values:
        assert (
            private_value not in response.text
        ), f"[C08] {endpoint} leaks a private value: {private_value!r}"


# =========================================================
# 5. C08-T3 — Public Coordinate Precision
# =========================================================


@pytest.mark.requirement("C08", "RISK-03")
@pytest.mark.parametrize(
    "endpoint", [name for name in PUBLIC_ENDPOINTS if name != "public_profile"]
)
def test_c08_t3_public_coordinates_are_coarsened(client, c08_data, endpoint):
    """Public coordinates are the stored values rounded to ~110 m."""
    coordinates = coordinate_values(get_public(client, c08_data, endpoint).json())
    too_precise = [
        value
        for value in coordinates
        if round(value, PUBLIC_COORDINATE_DECIMALS) != value
    ]
    correctly_rounded = {
        round(value, PUBLIC_COORDINATE_DECIMALS)
        for value in POST_COORDINATES + REPORT_COORDINATES
    }

    assert coordinates, f"[C08] {endpoint} returned no coordinates to check"
    assert (
        too_precise == []
    ), f"[C08] {endpoint} returns coordinates finer than ~110 m: {too_precise}"
    assert set(coordinates) <= correctly_rounded, (
        f"[C08] {endpoint} coordinates are not the stored location rounded "
        f"to {PUBLIC_COORDINATE_DECIMALS} decimals: {coordinates}"
    )


# =========================================================
# 6. C08-T4 — Response Schema and ORM Serialization Review
# =========================================================


@pytest.mark.requirement("C08", "RISK-03")
def test_c08_t4_every_public_route_declares_a_response_model():
    """Public routes filter ORM objects through a declared response schema."""
    public_routes = [
        route
        for route in router.routes
        if isinstance(route, APIRoute)
        and "GET" in route.methods
        and not requires_login(route)
    ]
    unfiltered = [
        route.path
        for route in public_routes
        if route.response_model is None
        and route.path not in REVIEWED_PASS_THROUGH_ROUTES
    ]

    assert len(public_routes) >= len(PUBLIC_ENDPOINTS)
    assert unfiltered == [], (
        "[C08] public routes return unfiltered data; add a response_model "
        f"or review them for the C08 assessment: {unfiltered}"
    )


@pytest.mark.requirement("C08", "RISK-03")
@pytest.mark.parametrize(
    ("model", "allowed"),
    [
        (PostResponse, POST_FIELDS),
        (PublicUserResponse, PROFILE_FIELDS),
        (LocationResponse, LOCATION_FIELDS),
        (PublicSafetyReportResponse, SAFETY_REPORT_FIELDS),
    ],
    ids=[
        "PostResponse",
        "PublicUserResponse",
        "LocationResponse",
        "PublicSafetyReportResponse",
    ],
)
def test_c08_t4_public_schema_matches_allowlist(model, allowed):
    """Schema snapshot: public response models declare only allowlisted fields."""
    assert schema_paths(model) == allowed


# =========================================================
# 7. Evidence Capture (run on demand, not in CI)
# =========================================================
# Writes the anonymous JSON response of every public endpoint
# plus a field inventory. All data is synthetic.
#
#   C08_EVIDENCE_DIR=../docs/security/evidence/C08/baseline \
#       pytest tests/test_soc_c08_travel_data_privacy.py -k capture
# =========================================================


@pytest.mark.skipif(
    not os.environ.get("C08_EVIDENCE_DIR"),
    reason="Set C08_EVIDENCE_DIR to write sanitized C08 response samples",
)
def test_c08_capture_public_response_evidence(client, c08_data):
    evidence_dir = Path(os.environ["C08_EVIDENCE_DIR"])
    evidence_dir.mkdir(parents=True, exist_ok=True)
    inventory = {}

    for endpoint, (path_template, _) in PUBLIC_ENDPOINTS.items():
        response = get_public(client, c08_data, endpoint)
        sample = {
            "request": f"GET {path_template}",
            "authenticated": False,
            "status": response.status_code,
            "body": response.json(),
        }
        (evidence_dir / f"{endpoint}.json").write_text(
            json.dumps(sample, indent=2) + "\n", encoding="utf-8"
        )
        inventory[endpoint] = sorted(field_paths(response.json()))

    (evidence_dir / "field-inventory.json").write_text(
        json.dumps(inventory, indent=2) + "\n", encoding="utf-8"
    )
