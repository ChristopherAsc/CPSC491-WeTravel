"""Sprint 4 Location MVP API tests; Mapbox HTTP requests are mocked."""

import httpx
from models import Location


def test_list_locations(client, db):
    db.add(Location(name="Anaheim", latitude=33.84, longitude=-117.91))
    db.flush()
    response = client.get("/api/locations")
    assert response.status_code == 200
    assert any(loc["name"] == "Anaheim" for loc in response.json())


def test_list_locations_validates_limit(client):
    assert client.get("/api/locations?limit=0").status_code == 422


def test_nearby_requires_postgresql(client):
    response = client.get("/api/locations/nearby?latitude=33.8&longitude=-117.9")
    assert response.status_code == 503


def test_nearby_validates_coordinates(client):
    response = client.get("/api/locations/nearby?latitude=93&longitude=-117.9")
    assert response.status_code == 422


def test_suggest_uses_mapbox_without_storing(monkeypatch, client, db):
    monkeypatch.setenv("MAPBOX_TOKEN", "pk.test-for-mocking")
    observed = {}

    original_get = httpx.Client.get

    def fake_get(self, url, *args, **kwargs):
        # Only mock outgoing Mapbox API requests
        if str(url).startswith("https://api.mapbox.com/search/searchbox/v1/"):
            observed.update(
                {
                    "url": url,
                    "params": kwargs.get("params"),
                }
            )

            return httpx.Response(
                200,
                json={
                    "suggestions": [
                        {
                            "name": "Anaheim",
                            "mapbox_id": "test-id",
                        }
                    ]
                },
                request=httpx.Request("GET", str(url)),
            )

        # Allow FastAPI TestClient to work normally
        return original_get(self, url, *args, **kwargs)

    monkeypatch.setattr(httpx.Client, "get", fake_get)

    response = client.get(
        "/api/locations/search/suggest",
        params={
            "q": "Anaheim",
            "session_token": "unit-test-session",
        },
    )

    assert response.status_code == 200
    assert response.json()["suggestions"][0]["name"] == "Anaheim"
    assert observed["params"]["access_token"] == "pk.test-for-mocking"
    assert db.query(Location).count() == 0


def test_retrieve_mapbox(monkeypatch, client):
    monkeypatch.setenv("MAPBOX_TOKEN", "pk.test-for-mocking")

    original_get = httpx.Client.get

    def fake_get(self, url, *args, **kwargs):
        if str(url).startswith("https://api.mapbox.com/search/searchbox/v1/"):
            assert str(url).endswith("/retrieve/mapbox-test-id")

            return httpx.Response(
                200,
                json={
                    "type": "FeatureCollection",
                    "features": [],
                },
                request=httpx.Request("GET", str(url)),
            )

        return original_get(self, url, *args, **kwargs)

    monkeypatch.setattr(httpx.Client, "get", fake_get)

    response = client.get(
        "/api/locations/search/retrieve/mapbox-test-id",
        params={
            "session_token": "unit-test-session",
        },
    )

    assert response.status_code == 200
    assert response.json()["type"] == "FeatureCollection"


def test_search_rejects_unconfigured_token(monkeypatch, client):
    monkeypatch.delenv("MAPBOX_TOKEN", raising=False)
    response = client.get(
        "/api/locations/search/suggest?q=Anaheim&session_token=unit-test-session"
    )
    assert response.status_code == 503
