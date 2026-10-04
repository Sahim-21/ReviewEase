# TRD: Review Assistant

## 1. Architecture
```
QR -> https://app.com/r/{slug}?t={table}
        |
  Next.js PWA (Vercel)  --->  FastAPI backend (Render/Fly/Railway)  --->  Postgres (Supabase/Neon)
                                   |
                            LLM Gateway (provider chain)
                      Groq (primary) -> Gemini Flash-Lite -> template fallback
```

## 2. Stack (all free-tier friendly)
- **Frontend:** Next.js (App Router) + TypeScript + Tailwind + Framer Motion, PWA manifest
- **Backend:** FastAPI + Pydantic + SQLAlchemy + Alembic
- **DB:** Postgres (Supabase or Neon free tier)
- **QR:** `qrcode` (Python) generating SVG/PNG; QR encodes the short URL only
- **Hosting:** Vercel (frontend), Render/Fly/Railway (API). Verify current free-tier limits.
- **Auth:** owner/admin login only (Supabase Auth or simple JWT). Diners are anonymous.

## 3. Data model
```
restaurants(id, slug UNIQUE, name, google_place_id, brand_color, logo_url, default_lang, created_at)
menu_items(id, restaurant_id FK, name, category, active)
tag_bank(id, restaurant_id FK, label, aspect)        -- aspect: food|service|ambience|value
tables(id, restaurant_id FK, label)
sessions(id, restaurant_id FK, table_id NULL, device_hash, started_at,
         items JSONB, ratings JSONB, tags JSONB, raw_text, tone, out_lang,
         draft_text, final_text, llm_provider, grounding_ok BOOL,
         clicked_google BOOL, completed_at)
private_feedback(id, restaurant_id FK, session_id FK NULL, message, rating, contact NULL, created_at)
events(id, restaurant_id, session_id, type, ts)       -- scan, step_n, generate, copy, open_google
users(id, email, password_hash, role, restaurant_id NULL)
```

## 4. API (FastAPI)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/r/{slug}` | Restaurant public config: menu, tags, branding |
| POST | `/api/sessions` | Start session, returns session id + token |
| POST | `/api/sessions/{id}/draft` | Body: items, ratings, tags, raw_text, tone, lang. Returns draft |
| POST | `/api/sessions/{id}/complete` | Save final_text, mark copy/click events |
| POST | `/api/feedback` | Private feedback |
| POST | `/api/admin/restaurants` | Create restaurant |
| GET | `/api/admin/restaurants/{id}/qr` | QR SVG/PNG |
| GET | `/api/owner/metrics` | Funnel and feedback (auth) |

Rate limit: `/draft` 5 per session, 20 per device per day (slowapi or Redis-less in-memory for MVP).

## 5. LLM integration

### 5.1 Model choice (free, lightweight)
Sentence framing from structured facts is easy; a small model is enough.

| Role | Model | Why |
|---|---|---|
| Primary | **Llama 3.1 8B Instant on Groq** (free API tier) | Very fast (sub-second), good English/Hinglish framing |
| Fallback 1 | **Gemini Flash-Lite via Google AI Studio free tier** | Better Kannada/Hindi, generous free limits |
| Fallback 2 | Template draft built from selections (no LLM) | Never blocks the diner |
| Local dev | **Ollama + Qwen2.5 3B (or Llama 3.2 3B)** | Offline, zero cost for testing |

Notes:
- Model names and free-tier limits change often. Check Groq and AI Studio docs before building; keep model names in env vars.
- Free tiers may log or train on prompts (Google's free tier especially). Send only the review inputs, never names, phone numbers or other identifiers.
- Self-hosting is not worth it at pilot scale.

### 5.2 LLM Gateway design
```python
class LLMProvider(Protocol):
    async def generate(self, system: str, user: str, *, max_tokens: int, temperature: float) -> str: ...

PROVIDERS = [GroqProvider(), GeminiProvider()]   # order from env LLM_CHAIN
async def draft_review(inp) -> Draft:
    for p in PROVIDERS:
        try:
            text = await asyncio.wait_for(p.generate(...), timeout=6)
            if grounding_check(text, inp): return Draft(text, p.name, True)
        except Exception: continue
    return Draft(template_draft(inp), "template", True)
```
Use OpenAI-compatible endpoints where available (Groq supports it) to keep adapters thin.

### 5.3 Prompt (system)
```
You help a restaurant customer phrase their own review.
RULES:
- Use ONLY the facts in INPUT. Never add dishes, prices, staff names, events or praise not present.
- Keep the customer's sentiment. If a rating is low or a complaint is given, include it honestly and politely.
- Write in first person, {tone} tone, {lang}, 40-120 words (short: 20-40).
- Fix spelling/grammar of broken words; translate meaning faithfully.
- No hashtags, no emojis unless tone=casual (max 1), no marketing language.
- Vary sentence structure; do not start with "I recently visited".
- Output only the review text.
```
User message: JSON of `{items, ratings, tags, raw_text}`.

### 5.4 Grounding check (post-processing)
1. Every menu item name mentioned in the output must be in `items` (fuzzy match against the full menu to catch extras).
2. Rating-sentiment consistency: if avg rating <= 2, reject outputs with strong praise words; if >= 4, reject outputs with strong negatives not in input.
3. Word-count bounds; strip quotes/markdown.
4. Optional v2: second cheap LLM call as verifier ("list any claims not in INPUT").
On failure: retry once with temperature lowered, then next provider, then template.

### 5.5 Variation control
Temperature 0.7-0.9, random style hint per request (e.g. "start with the dish" / "start with the vibe"), cap on repeated opening n-grams per restaurant (check last 20 drafts).

### 5.6 Caching and cost
No caching of drafts (variation desired). Cache restaurant config only. Track tokens per call in `events`.

## 6. Frontend structure
```
app/r/[slug]/page.tsx        -- flow shell
components/steps/{Dishes,Ratings,Tags,FreeText,Tone,Draft,Done}.tsx
components/ui/{ProgressBar,EmojiRating,TagChip,DishCard}.tsx
lib/api.ts, lib/clipboard.ts
app/dashboard/*              -- owner views
```
Open Google: `https://search.google.com/local/writereview?placeid=${placeId}` after `navigator.clipboard.writeText(text)`. Show a "pasted? tap here" fallback because clipboard and deep links vary on iOS in-app browsers.

## 7. Security and privacy
- Session token (signed, short-lived) required for `/draft`, `/complete`.
- Input length limits; strip HTML; prompt-injection resistant (user text only inside JSON, system rules fixed).
- API keys in env only; CORS restricted to the frontend origin.
- No PII stored by default; `device_hash` is a salted hash.
- Owner endpoints scoped by `restaurant_id`.

## 8. Testing
- Unit: grounding check, template fallback, provider failover (mock).
- Contract: API schemas via Pydantic and OpenAPI.
- Prompt eval set: ~30 input cases (broken Hinglish, low ratings, empty text) scored for hallucination, tone, length.
- E2E: Playwright on mobile viewport for the full flow.

## 9. Deployment and env
```
DATABASE_URL, JWT_SECRET, ALLOWED_ORIGIN
LLM_CHAIN=groq,gemini
GROQ_API_KEY, GROQ_MODEL
GEMINI_API_KEY, GEMINI_MODEL
```
CI: GitHub Actions running lint, tests, and Alembic migration check.

## 10. Open questions
- Per-table QR needed in MVP?
- Billing model for restaurants (affects dashboard scope)
- Languages to support at launch (English + Hinglish + Kannada?)
