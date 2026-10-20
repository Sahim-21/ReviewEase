# Deploy ReviewEase

Web on **Vercel**, API on **Render** or **Fly.io**, Postgres on **Neon** or **Supabase**. Diners stay anonymous. Do not commit `.env` files or password hashes.

Driver in this repo is **psycopg2** (`postgresql+psycopg2://…`). Latest Alembic revision: **`0005`**. No asyncpg.

## Environment variables

| Variable | Where | Required | Purpose |
|---|---|---|---|
| `DATABASE_URL` | API | Yes in prod | SQLAlchemy URL. Use `postgresql+psycopg2://USER:PASS@HOST/DB?sslmode=require` for Neon/Supabase. Direct (not pooled) host for `alembic upgrade`. |
| `JWT_SECRET` | API | Yes | HMAC secret for diner session JWTs and staff JWTs. **32+ random characters.** Against a non-local database the API refuses to start with a missing, default (`change-me`, the `.env.example` value) or shorter secret. Generate: `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Changing it signs everyone out. |
| `DEVICE_HASH_SALT` | API | Yes in prod | Salt for HMAC-SHA256 of diner `device_id`. Never stored raw. If empty, the API falls back to `JWT_SECRET` and logs a warning. |
| `ALLOWED_ORIGIN` | API | Yes | CORS allow-list. Comma-separated exact origins, e.g. `https://your-app.vercel.app`. No `*`. |
| `APP_PUBLIC_URL` | API | Yes in prod | Origin baked into QR URLs: `{APP_PUBLIC_URL}/r/{slug}`. Use the Vercel URL. |
| `SESSION_TOKEN_MINUTES` | API | No | Diner JWT lifetime. Default `120`. |
| `AUTH_TOKEN_MINUTES` | API | No | Staff JWT lifetime. Default `1440`. |
| `LLM_CHAIN` | API | No | Provider order. Default `groq,gemini`. Add more models with `provider:model`, e.g. `groq,groq:openai/gpt-oss-20b,gemini` (Groq rate-limits each model separately, so a second model doubles the free-tier budget). |
| `GROQ_API_KEY` | API | For Groq drafts | [https://console.groq.com/keys](https://console.groq.com/keys) |
| `GROQ_MODEL` | API | No | Default `qwen/qwen3.8-27b`. |
| `GEMINI_API_KEY` | API | For Gemini drafts | [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `GEMINI_MODEL` | API | No | Default `gemini-2.0-flash-lite`. |
| `ADMIN_EMAIL` | API | Bootstrap only | First admin email for `python -m app.bootstrap_admin`. |
| `ADMIN_PASSWORD` | API | Bootstrap only | First admin password (min 8). Stored as pbkdf2. |
| `NEXT_PUBLIC_API_URL` | Web | Yes in prod | Public API origin, e.g. `https://reviewease-api.onrender.com`. Inlined at **Next build** time. Diner calls go here directly; staff calls go through the same-origin `/backend/*` proxy to this origin (see below). |
| `API_ORIGIN` | Web | No | Overrides the proxy target for `/backend/*` and the revalidate route. Defaults to `NEXT_PUBLIC_API_URL`. |

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
alembic current             # expect 0005
python -m app.bootstrap_admin   # if ADMIN_EMAIL / ADMIN_PASSWORD are set
```

---

## 2. API (Render)

1. New **Web Service**, repo connected to GitHub. Root directory: `apps/api`.
2. Runtime: Python 3.12. Build: `pip install -r requirements.txt`. Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
3. Add the API env vars above (`DATABASE_URL`, `JWT_SECRET`, `DEVICE_HASH_SALT`, `ALLOWED_ORIGIN` = Vercel origin, `APP_PUBLIC_URL`, LLM keys).
4. Migrations: run `alembic upgrade head` before (or as) each deploy that adds one. Free Render plans have no release command, so use the Shell tab or run it locally against the direct Neon URL.
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

### Staff session (HttpOnly cookie)

Staff pages call the API through `https://YOUR.vercel.app/backend/*`, a Next.js rewrite to `NEXT_PUBLIC_API_URL`. Because the request is same-origin, the API's `re_staff` session cookie (HttpOnly, Secure, SameSite=Lax) is first-party and JavaScript never sees the token. Cookie-authenticated writes must send `X-Requested-With: ReviewEase` (CSRF guard); API clients can still use `Authorization: Bearer …` by logging in with the `X-Auth-Mode: bearer` header.

### Keep the free Render instance awake

The free plan sleeps after ~15 minutes, and the first diner then waits ~50 s. `.github/workflows/keep-warm.yml` pings `/health` every 10 minutes between 09:00 and 23:59 IST. Enable it by adding a repository **variable** `API_HEALTH_URL = https://YOUR-API.onrender.com/health` (GitHub → Settings → Secrets and variables → Actions → Variables). The QR page also shows a "Setting the table…" screen while the API wakes up.

---

## 4. Staff passwords

- Signed-in staff change their password from the **Password** button on the dashboard (min 10 characters).
- Forgotten password: open the API's shell (Render → Shell) and run

  ```bash
  python -m app.reset_password admin@example.com
  ```

  It prompts for the new password (or reads `NEW_PASSWORD`). Passwords are stored only as pbkdf2 hashes, so they cannot be looked up.
- Sign-in is throttled: 8 failed attempts per email or 20 per IP within 15 minutes returns HTTP 429.

## 5. Security notes (TRD §7)

- Diner `/draft` and `/complete` require a short-lived session JWT (`typ=session`).
- Staff routes use `typ=user` JWTs; owners are scoped to `restaurant_id`.
- Text fields are HTML-stripped; diner notes are JSON data in the LLM user message, not executable instructions.
- CORS allow-list is `ALLOWED_ORIGIN` only (diner calls). Staff calls are same-origin through `/backend`.
- Rate limits are stored in Postgres (`rate_limits` table), so restarts do not reset them: session starts (60/h per IP, 30/h per device), private feedback (20/h per IP, 8/h per device), drafts (5 per session, 20/day per device) and failed sign-ins.
- Paused restaurants reject new diner sessions immediately; pausing also revalidates the cached public page.
- Device identifiers are stored as HMAC-SHA256 (`device_hash`), never the raw `device_id`.
- Request logs are JSON (`method`, `path`, `status`, `ms`, `request_id`). They must not include tokens, passwords, or review text.

CI on GitHub Actions: ruff + pytest in `apps/api`, `alembic upgrade head` and `alembic check` against Postgres 16, ESLint + `tsc --noEmit` in `apps/web`.
