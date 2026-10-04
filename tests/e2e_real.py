"""Real local-stack walkthrough: admin restaurant, diner draft via live LLM, Google complete.

Run from apps/api with FastAPI on :8000, Next.js on :3000, and Docker Postgres up:

    python tests/e2e_real.py
"""

from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

import httpx
from dotenv import load_dotenv

API_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = API_ROOT.parent.parent
sys.path.insert(0, str(API_ROOT))

load_dotenv(API_ROOT / ".env")
load_dotenv(REPO_ROOT / ".env")

from app.bootstrap_admin import bootstrap_admin  # noqa: E402
from app.config import settings  # noqa: E402
from app.llm.grounding import extra_menu_mentions  # noqa: E402
from app.llm.schemas import DraftInput  # noqa: E402

API = os.environ.get("E2E_API_URL", "http://localhost:8000").rstrip("/")
WEB = os.environ.get("E2E_WEB_URL", "http://localhost:3000").rstrip("/")
SLUG = "demo-cafe"
TABLE = "1"
SELECTED_DISHES = ["Butter chicken", "Garlic naan"]
ABSENT_DISH = "Mango lassi"
SELECTED_TAGS = ["Flavourful", "Friendly"]
FAILED = 0


def _ok(name: str, detail: str) -> None:
    print(f"[PASS] {name}: {detail}")


def _fail(name: str, detail: str) -> None:
    global FAILED
    FAILED += 1
    print(f"[FAIL] {name}: {detail}")


def _ensure_restaurant(client: httpx.Client) -> dict[str, object]:
    response = client.get(f"/api/r/{SLUG}")
    if response.status_code == 200:
        body = response.json()
        _ok("restaurant exists", f"GET /api/r/{SLUG} -> {body.get('name')} place_id={body.get('google_place_id')}")
        return body

    _ok("restaurant missing", f"GET /api/r/{SLUG} -> HTTP {response.status_code}; creating via admin")
    email = settings.admin_email.strip()
    password = settings.admin_password
    if not email or not password:
        _fail(
            "admin env",
            "ADMIN_EMAIL and ADMIN_PASSWORD are empty; cannot POST /api/admin/restaurants",
        )
        raise SystemExit(1)

    bootstrap_admin()
    login = client.post("/api/auth/login", json={"email": email, "password": password})
    if login.status_code != 200:
        _fail("admin login", f"HTTP {login.status_code} {login.text}")
        raise SystemExit(1)
    token = login.json()["token"]
    _ok("admin login", f"role={login.json().get('role')} email={login.json().get('email')}")

    created = client.post(
        "/api/admin/restaurants",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "Demo Cafe",
            "slug": SLUG,
            "google_place_id": "ChIJDemoCafePlaceId000000000",
            "brand_color": "#C45C26",
            "default_lang": "en",
            "menu": [
                {"name": "Butter chicken", "category": "mains"},
                {"name": "Garlic naan", "category": "breads"},
                {"name": "Mango lassi", "category": "drinks"},
                {"name": "Palak paneer", "category": "mains"},
            ],
            "tags": [
                {"label": "Flavourful", "aspect": "food"},
                {"label": "Friendly", "aspect": "service"},
                {"label": "Cozy", "aspect": "ambience"},
            ],
            "tables": [{"label": TABLE}],
        },
    )
    if created.status_code != 200:
        _fail("admin create restaurant", f"HTTP {created.status_code} {created.text}")
        raise SystemExit(1)
    _ok("admin create restaurant", f"{created.json()}")

    again = client.get(f"/api/r/{SLUG}")
    if again.status_code != 200:
        _fail("reload restaurant", f"HTTP {again.status_code} {again.text}")
        raise SystemExit(1)
    return again.json()


def main() -> int:
    print(f"API={API}")
    print(f"WEB={WEB}")
    print(f"GROQ_API_KEY set={bool(settings.groq_api_key)} GEMINI_API_KEY set={bool(settings.gemini_api_key)}")

    with httpx.Client(base_url=API, timeout=60.0) as client:
        health = client.get("/health")
        if health.status_code != 200:
            _fail("api health", f"HTTP {health.status_code} {health.text}")
            return 1
        payload = health.json()
        if payload.get("database") != "ok":
            _fail("api health", f"{payload}")
            return 1
        _ok("api health", str(payload))

        restaurant = _ensure_restaurant(client)
        menu_names = [item["name"] for item in restaurant.get("menu", [])]
        tag_labels = [tag["label"] for tag in restaurant.get("tags", [])]
        for dish in SELECTED_DISHES:
            if dish not in menu_names:
                _fail("menu selection", f"{dish!r} not on public menu {menu_names}")
                return 1
        if ABSENT_DISH not in menu_names:
            _fail("grounding foil", f"{ABSENT_DISH!r} must be on the menu but unselected; menu={menu_names}")
            return 1
        for tag in SELECTED_TAGS:
            if tag not in tag_labels:
                _fail("tag selection", f"{tag!r} not in tag bank {tag_labels}")
                return 1
        _ok("menu/tags", f"select {SELECTED_DISHES} + {SELECTED_TAGS}; foil {ABSENT_DISH}")

        qr_path = f"/r/{SLUG}?t={TABLE}"
        try:
            page = httpx.get(f"{WEB}{qr_path}", timeout=30.0, follow_redirects=True)
        except httpx.RequestError as exc:
            _fail("qr / diner page", f"Next.js not reachable at {WEB}{qr_path}: {exc}")
            return 1
        html = page.text
        if page.status_code != 200:
            _fail("qr / diner page", f"HTTP {page.status_code}")
            return 1
        if restaurant["name"] not in html and "What did you have" not in html:
            _fail("qr / diner page", f"HTTP {page.status_code} but page did not include restaurant UI")
            return 1
        _ok("qr / diner page", f"GET {WEB}{qr_path} HTTP {page.status_code} (scan URL)")

        started = client.post(
            "/api/sessions",
            json={"slug": SLUG, "device_id": f"e2e-real-{uuid.uuid4().hex[:12]}", "table": TABLE},
        )
        if started.status_code != 200:
            _fail("start session", f"HTTP {started.status_code} {started.text}")
            return 1
        session = started.json()
        session_id = session["id"]
        token = session["token"]
        _ok("start session (scan)", f"id={session_id} expires_in={session.get('expires_in')}")

        draft_body = {
            "items": SELECTED_DISHES,
            "ratings": {"food": 5, "service": 4, "ambience": 4, "value": 5},
            "tags": SELECTED_TAGS,
            "raw_text": "gravy was rich, naan was hot, cozy tables",
            "tone": "casual",
            "lang": "English",
        }
        draft = client.post(
            f"/api/sessions/{session_id}/draft",
            headers={"Authorization": f"Bearer {token}"},
            json=draft_body,
        )
        if draft.status_code != 200:
            _fail("draft (live LLM)", f"HTTP {draft.status_code} {draft.text}")
            return 1
        draft_json = draft.json()
        text = str(draft_json.get("text") or "")
        provider = str(draft_json.get("provider") or "")
        grounded_flag = draft_json.get("grounding_ok")
        _ok("draft response", f"provider={provider} grounding_ok={grounded_flag} text={text!r}")

        if provider == "template":
            _fail(
                "live LLM",
                "gateway returned template fallback; set GROQ_API_KEY (and/or GEMINI_API_KEY) so a model runs",
            )
        elif provider not in {"groq", "gemini"}:
            _fail("live LLM", f"unexpected provider {provider!r}")
        else:
            _ok("live LLM", f"used {provider}")

        inp = DraftInput(
            items=SELECTED_DISHES,
            ratings=draft_body["ratings"],
            tags=SELECTED_TAGS,
            raw_text=draft_body["raw_text"],
            tone="casual",
            lang="English",
            menu=menu_names,
        )
        extras = extra_menu_mentions(text, inp)
        lower = text.casefold()
        if extras:
            _fail("grounding extras", f"unselected menu names in draft: {extras}")
        else:
            _ok("grounding extras", "no unselected menu items detected")
        if ABSENT_DISH.casefold() in lower:
            _fail("grounding foil text", f"draft mentioned unselected {ABSENT_DISH!r}")
        else:
            _ok("grounding foil text", f"{ABSENT_DISH!r} not in draft")
        if grounded_flag is not True:
            _fail("grounding_ok flag", f"API returned grounding_ok={grounded_flag}")
        else:
            _ok("grounding_ok flag", "true")

        google_url = (
            "https://search.google.com/local/writereview?placeid="
            f"{restaurant['google_place_id']}"
        )
        complete = client.post(
            f"/api/sessions/{session_id}/complete",
            headers={"Authorization": f"Bearer {token}"},
            json={"final_text": text, "copied": True, "clicked_google": True},
        )
        if complete.status_code != 200:
            _fail("copy and open Google", f"HTTP {complete.status_code} {complete.text}")
            return 1
        done = complete.json()
        if done.get("clicked_google") is not True:
            _fail("copy and open Google", f"clicked_google={done.get('clicked_google')} body={done}")
        else:
            _ok(
                "copy and open Google",
                f"session {done.get('id')} clicked_google={done.get('clicked_google')} "
                f"handoff={google_url}",
            )

    print()
    if FAILED:
        print(f"RESULT: FAIL ({FAILED} check(s) failed)")
        return 1
    print("RESULT: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
