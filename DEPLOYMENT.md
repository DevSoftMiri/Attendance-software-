# Deployment Guide

This repository has three separate deployable services:

- `frontend/`: Vite + React web app
- `backend/`: Node.js + Express API
- `face-service/`: Python FastAPI face matching service

## Recommended free stack

For a free demo deployment, use:

- Frontend: Vercel
- Backend API: Render free web service
- Face service: Render free web service
- PostgreSQL: Neon free database
- Face image storage: Supabase Storage

This is the simplest setup that matches the current codebase without changing the architecture.

## Face storage status

The face service now supports persistent face storage in Supabase Storage when these environment variables are set:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_BUCKET`

With Supabase enabled:

- enrolled reference face images are stored in Supabase Storage
- generated `embeddings.json` cache files are stored in Supabase Storage
- temporary identify, verify, and quality-check images stay local and are not persisted

If those variables are not set, the service falls back to local `face-service/registered_faces/` storage for development.

## PWA status

The frontend now includes:

- a web app manifest
- a service worker
- install prompt support on `/public-attendance`
- offline shell caching

Attendance still requires internet because face verification, IP checks, and geofence validation happen on the backend.

## 1. Prepare your repository

Push this project to GitHub first. All the free hosts below deploy directly from GitHub.

## 2. Create a free Neon database

1. Sign in to Neon.
2. Create a new project.
3. Copy the Postgres connection string.
4. Save it for the backend `DATABASE_URL` variable.

Example:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require
```

## 3. Create a Supabase Storage bucket

1. Sign in to Supabase.
2. Open your project.
3. Go to `Storage`.
4. Create a bucket named `face-profiles`.
5. Keep the bucket private.
6. Copy your project URL.
7. Copy your `service_role` key from project API settings.

Use the `service_role` key only on the server side inside the face service. Do not expose it in the frontend.

## 4. Deploy the backend on Render

Create a new `Web Service` in Render and point it to this repo.

Use these settings:

- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm start`

Set these environment variables:

```env
PORT=10000
DATABASE_URL=your_neon_connection_string
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=1d
FACE_SERVICE_URL=https://your-face-service.onrender.com
FRONTEND_URL=https://your-frontend.vercel.app
NODE_ENV=production
```

Notes:

- If you later attach a custom domain to the frontend, add that URL to `FRONTEND_URL` too.
- Your backend supports comma-separated origins, so you can set both domains if needed.

Example:

```env
FRONTEND_URL=https://your-frontend.vercel.app,https://attendance.yourdomain.com
```

## 5. Deploy the face service on Render

Create another `Web Service` in Render and point it to the same repo.

Use these settings:

- Root directory: `face-service`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

Set these environment variables:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_BUCKET=face-profiles
```

After deployment, open:

```txt
https://your-face-service.onrender.com/health
```

You should get a JSON health response.

## 6. Deploy the frontend on Vercel

Create a new project in Vercel connected to the same GitHub repo.

Use these settings:

- Framework preset: `Vite`
- Root directory: `frontend`
- Build command: `npm run build`
- Build output directory: `dist`

Set this environment variable:

```env
VITE_API_URL=https://your-backend.onrender.com/api
```

Because this frontend uses React Router, add SPA rewrites so direct visits to routes like `/public-attendance` do not return `404`.

Create [frontend/vercel.json](/C:/Users/jainh/Desktop/Template/Attendace/frontend/vercel.json) with:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/"
    }
  ]
}
```

After deploy, open:

```txt
https://your-project.vercel.app/public-attendance
```

That route is the kiosk/PWA entry point.

## 7. First production checks

After all three services are live:

1. Open the frontend URL.
2. Go to `/public-attendance`.
3. Allow camera and location permissions.
4. Confirm the webcam opens.
5. Confirm the app can reach the backend.
6. Confirm the backend can reach the face service.
7. Register one employee face and test check-in.
8. Confirm the enrolled face images appear in your private `face-profiles` bucket.

## 8. Install the PWA

From a supported browser:

1. Open `/public-attendance`.
2. Wait for the page to fully load.
3. Tap the new `Install App` button when available.
4. If the button says `How to Install`, use the browser menu and choose `Install app` or `Add to Home Screen`.

Best kiosk devices:

- Android tablet
- Android phone
- Windows desktop with Chrome or Edge
- iPad in Safari, using `Add to Home Screen`

## 9. What is free and what is not reliable

This setup is free for demo use, but keep these tradeoffs in mind:

- Render free web services can sleep when idle.
- Cold starts will slow the first attendance request.
- Neon free databases can autosuspend after inactivity.
- Supabase free projects can pause after inactivity.

## 10. What to upgrade next

If you want this to be stable for real office use, do these next:

1. Add a background keep-alive or move to paid hosting to avoid cold starts.
2. Add a real migration strategy instead of relying only on `sequelize.sync`.
3. Put the frontend and backend on custom domains.
4. Store face metadata and audit records in Postgres if you want richer administration and reporting.

## Optional future improvement

If you want, the next good change is to persist face metadata in Postgres as well, so you can track enrollment history, image versions, and storage references directly from the admin app.
