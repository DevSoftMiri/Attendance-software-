# Attendance Software Monorepo

This workspace is separated into three deployable parts:

- `frontend/` - React + Vite staff, manager, admin, and super-admin UI
- `backend/` - Node.js + Express REST API
- `face-service/` - Python FastAPI face verification service

## What is included

- Authentication scaffolding with role-based routing
- Employee, attendance, leave, payroll, report, and settings API surfaces
- PostgreSQL + Sequelize schema registry for the core tables
- Face-service proxy flow so the React app never talks to DeepFace directly
- Webcam and geolocation-ready attendance UI shell

## Development

1. Install dependencies in each folder.
2. Configure environment variables.
3. Start the backend and face service first.
4. Start the frontend last.

### PostgreSQL

If you already have PostgreSQL installed locally, use the Windows service on `localhost:5432`.

If you want a Docker-based Postgres instance instead, start the compose service first:

```bash
docker compose up -d postgres
```

This exposes Postgres on `localhost:5433` with:

- database: `attendance_db`
- user: `postgres`
- password: `postgres`

### Backend

```bash
cd backend
npm install
npm run dev
```

To create or repair the first production-style super admin user in the connected database:

```bash
cd backend
npm run seed:super-admin
```

This seeds:

- email: `jatin@gmail.com`
- password: `Bigubuisness`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Face service

```bash
cd face-service
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

## Environment variables

### Backend

```bash
PORT=5000
DATABASE_URL=postgres://user:password@localhost:5432/attendance
JWT_SECRET=replace-me
JWT_EXPIRES_IN=1d
FACE_SERVICE_URL=http://localhost:8001
FRONTEND_URL=http://localhost:5173
```

### Frontend

```bash
VITE_API_URL=http://localhost:5000/api
```

### Face service

```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_BUCKET=face-profiles
```

## Notes

- This scaffold keeps roles and job titles separate.
- Attendance validation happens in the backend, not in the browser.
- Sensitive employee files should be stored privately in object storage.
- Free deployment and PWA steps are documented in [DEPLOYMENT.md](./DEPLOYMENT.md).
