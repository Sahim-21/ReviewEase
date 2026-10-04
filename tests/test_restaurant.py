from fastapi.testclient import TestClient

from tests.conftest import TEST_SLUG


def test_get_restaurant_returns_public_config(client: TestClient) -> None:
    response = client.get(
        f"/api/r/{TEST_SLUG}",
        headers={"Origin": "http://localhost:3000"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["slug"] == TEST_SLUG
    assert body["name"] == "Demo Cafe"
    assert body["google_place_id"]
    assert body["brand_color"] == "#C45C26"
    assert [item["name"] for item in body["menu"]] == ["Butter chicken"]
    assert {tag["aspect"] for tag in body["tags"]} == {"food", "service"}
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_cors_rejects_unknown_origin(client: TestClient) -> None:
    response = client.get(
        f"/api/r/{TEST_SLUG}",
        headers={"Origin": "https://evil.example"},
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") != "https://evil.example"


def test_get_restaurant_unknown_slug(client: TestClient) -> None:
    response = client.get("/api/r/missing-place")
    assert response.status_code == 404
