# ReviewEase

QR review assistant: diners phrase their own experience, then post on Google themselves. Owners get private feedback.

## Stack

- `apps/web` — Next.js (App Router), TypeScript, Tailwind, Framer Motion
- `apps/api` — FastAPI, Pydantic, SQLAlchemy, Alembic
- Postgres via Docker for local development

## Prerequisites

- Node.js 20+
- Python 3.12+
- Docker Desktop

Copy env, then start Postgres:

```bash
copy .env.example .env
copy apps\web\.env.example apps\web\.env.local
docker compose up -d
```

Install Docker Desktop if `docker` is not on your PATH. The API still boots without Postgres; `/health` then reports `"database": "unavailable"`. Migrations need Postgres.

## API

```bash
cd apps/api
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload --port 8000
```

Health: http://localhost:8000/health

Create the first admin from env (`ADMIN_EMAIL`, `ADMIN_PASSWORD` in `.env` — never commit hashes):

```bash
python -m app.bootstrap_admin
```

Staff JWT login: `POST /api/auth/login`. Admin: `POST /api/admin/restaurants`, `GET /api/admin/restaurants/{id}/qr?format=svg|png&t=`. Owner: `GET /api/owner/metrics` (always scoped by the token’s `restaurant_id`; admins pass `?restaurant_id=`). QR payloads are `APP_PUBLIC_URL/r/{slug}` with optional `?t=`.

## Web

```bash
cd apps/web
npm install
npm run dev
```

App: http://localhost:3000  
Staff: http://localhost:3000/login · `/admin` · `/dashboard`  
Health: http://localhost:3000/health

On macOS/Linux, activate the API venv with `source .venv/bin/activate`.

Production: see [docs/DEPLOY.md](docs/DEPLOY.md) (Vercel + Render/Fly + Neon/Supabase, env vars, Alembic).

