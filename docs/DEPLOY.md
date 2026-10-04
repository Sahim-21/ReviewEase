# Deploy ReviewEase

Web on **Vercel**, API on **Render** or **Fly.io**, Postgres on **Neon** or **Supabase**. Diners stay anonymous. Do not commit `.env` files or password hashes.

Driver in this repo is **psycopg2** (`postgresql+psycopg2://…`). Alembic revision **`0001`**. No asyncpg.

## Environment variables

| Variable | Where | Required | Purpose |
|---|---|---|---|
| `DATABASE_URL` | API | Yes in prod | SQLAlchemy URL. Use `postgresql+psycopg2://USER:PASS@HOST/DB?sslmode=require` for Neon/Supabase. Direct (not pooled) host for `alembic upgrade`. |
| `JWT_SECRET` | API | Yes | HMAC secret for diner session JWTs and staff JWTs. 32+ random bytes. |
| `DEVICE_HASH_SALT` | API | Yes in prod | Salt for HMAC-SHA256 of diner `device_id`. Never stored raw. If empty, the API falls back to `JWT_SECRET` and logs a warning. |
| `ALLOWED_ORIGIN` | API | Yes | CORS allow-list. Comma-separated exact origins, e.g. `https://your-app.vercel.app`. No `*`. |
| `APP_PUBLIC_URL` | API | Yes in prod | Origin baked into QR URLs: `{APP_PUBLIC_URL}/r/{slug}`. Use the Vercel URL. |
| `SESSION_TOKEN_MINUTES` | API | No | Diner JWT lifetime. Default `120`. |
| `AUTH_TOKEN_MINUTES` | API | No | Staff JWT lifetime. Default `1440`. |
| `LLM_CHAIN` | API | No | Provider order. Default `groq,gemini`. |
| `GROQ_API_KEY` | API | For Groq drafts | [https://console.groq.com/keys](https://console.groq.com/keys) |
| `GROQ_MODEL` | API | No | Default `llama-3.1-8b-instant`. |
| `GEMINI_API_KEY` | API | For Gemini drafts | [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `GEMINI_MODEL` | API | No | Default `gemini-2.0-flash-lite`. |
| `ADMIN_EMAIL` | API | Bootstrap only | First admin email for `python -m app.bootstrap_admin`. |
| `ADMIN_PASSWORD` | API | Bootstrap only | First admin password (min 8). Stored as pbkdf2. |
| `NEXT_PUBLIC_API_URL` | Web | Yes in prod | Public API origin, e.g. `https://reviewease-api.onrender.com`. Inlined at **Next build** time. |

Not used: Ollama, Redis, Google Maps API keys, Supabase Auth.

---

## 1. Database (Neon or Supabase)

### Neon

1. Create a project at [https://console.neon.tech](https://console.neon.tech) (Postgres 16 is fine).
2. **Connect** → **direct** connection string (not the `-pooler` host).
3. Rewrite `postgresql://` to `postgresql+psycopg2://` and keep `sslmode=require`.

### Supabase

1. Create a project at [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. **Project Settings → Database → Connection string → URI**.
3. Use the **direct** host (db.*), not transaction pooling, for migrations.
4. Same rewrite: `postgresql+psycopg2://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres?sslmode=require`.

Run migrations from `apps/api` against that URL (not localhost):

```bash
cd apps/api
source .venv/bin/activate   # Windows: .venv\Scripts\activate
export DATABASE_URL='postgresql+psycopg2://…?sslmode=require'
alembic upgrade head
alembic current             # expect 0001
python -m app.bootstrap_admin   # if ADMIN_EMAIL / ADMIN_PASSWORD are set
```

---

## 2. API (Render)

1. New **Web Service**, repo connected to GitHub. Root directory: `apps/api`.
2. Runtime: Python 3.12. Build: `pip install -r requirements.txt`. Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
3. Add the API env vars above (`DATABASE_URL`, `JWT_SECRET`, `DEVICE_HASH_SALT`, `ALLOWED_ORIGIN` = Vercel origin, `APP_PUBLIC_URL`, LLM keys).
4. Optional release command: `alembic upgrade head`.
5. Health check path: `/health` (JSON `"database": "ok"`).

### API (Fly.io)

From `apps/api`:

```bash
fly launch --no-deploy
fly secrets set DATABASE_URL='postgresql+psycopg2://…?sslmode=require' JWT_SECRET='…' DEVICE_HASH_SALT='…' ALLOWED_ORIGIN='https://YOUR.vercel.app' APP_PUBLIC_URL='https://YOUR.vercel.app'
fly secrets set GROQ_API_KEY='…' GEMINI_API_KEY='…'
fly deploy
```

Process: `uvicorn app.main:app --host 0.0.0.0 --port 8080` (or `$PORT`). After first deploy, run `fly ssh console -C "alembic upgrade head"` if you did not bake migrate into the release.

---

## 3. Web (Vercel)

1. [https://vercel.com/new](https://vercel.com/new) → this GitHub repo.
2. Framework: Next.js. **Root Directory:** `apps/web`.
3. Environment: `NEXT_PUBLIC_API_URL=https://YOUR-API.onrender.com` (no trailing slash).
4. Deploy. Copy the `*.vercel.app` origin into API `ALLOWED_ORIGIN` and `APP_PUBLIC_URL`, then redeploy the API if those changed.
5. Rebuild the web app after any `NEXT_PUBLIC_*` change.

QR codes encode `APP_PUBLIC_URL/r/{slug}` (optional `?t=`). Google still uses each restaurant’s Place ID only.

---

## 4. Security notes (TRD §7)

- Diner `/draft` and `/complete` require a short-lived session JWT (`typ=session`).
- Staff routes use `typ=user` JWTs; owners are scoped to `restaurant_id`.
- Text fields are HTML-stripped; diner notes are JSON data in the LLM user message, not executable instructions.
- CORS allow-list is `ALLOWED_ORIGIN` only.
- Device identifiers are stored as HMAC-SHA256 (`device_hash`), never the raw `device_id`.
- Request logs are JSON (`method`, `path`, `status`, `ms`, `request_id`). They must not include tokens, passwords, or review text.

CI on GitHub Actions: ruff + pytest in `apps/api`, `alembic upgrade head` and `alembic check` against Postgres 16, ESLint + `tsc --noEmit` in `apps/web`.
