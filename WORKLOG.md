# Attendance Software Worklog

## Date: 2026-07-14

## What has been completed so far

### Project scaffold
- Created a separated monorepo layout with `frontend/`, `backend/`, and `face-service/`.
- Added root documentation in `README.md`.
- Added root workspace metadata and ignore rules.

### Backend foundation
- Created Express API bootstrap and route wiring.
- Added Sequelize model registry for the core attendance, employee, leave, payroll, face, notification, and audit tables.
- Added auth, employee, attendance, leave, payroll, report, settings, and face controllers.
- Added middleware for authentication, validation, and error handling.
- Added business utilities for employee ID generation and attendance calculations.
- Added face-service proxy functions in the backend.
- Added `.env` configuration for local development.
- Added a demo-mode fallback path so the backend can start when PostgreSQL authentication is not available.
- Added CORS support for local frontend origins on both `5173` and `5174`.
- Added office-IP validation support in attendance check-in flow.
- Added a fallback in-memory/demo startup path for local development when PostgreSQL is unavailable.

### Frontend foundation
- Created a React + Vite app shell with Tailwind CSS.
- Added router setup with protected routes and role-based dashboards.
- Added auth context and API client wiring.
- Added dashboard, attendance, employee, leave, payroll, reports, settings, login, and not-found pages.
- Added webcam-based face-registration and attendance pages.
- Added a public no-login attendance kiosk that auto-scans faces and supports check-in/check-out.
- Added a dedicated employee-wise attendance summary page with filters for employee, department, branch, date range, and status.
- Added `.env` configuration for the frontend API URL.
- Fixed the blank-screen runtime issue by wrapping the app in `BrowserRouter`.
- Added a face-registration route and navigation entry for admin users.
- Added authenticated employee attendance submission and recent attendance history display.

### Face service
- Created a FastAPI service structure for face enrolment, verification, quality checks, and deletion.
- Added DeepFace-first verification logic with local fallback behavior.
- Added Docker and requirements files for the service.
- Added JSON-based face enrolment and verification endpoints for one-to-one employee verification.
- Added face-identification support so public attendance can match a face without a login session.

### Configuration files
- Added `backend/.env` with local PostgreSQL, JWT, frontend URL, and face-service URL settings.
- Added `frontend/.env` with the local API base URL.
- Added `docker-compose.yml` to run PostgreSQL locally on `localhost:5433`.

### Validation completed
- Frontend syntax checks passed.
- Frontend production build passed with Vite.
- Backend dependencies were installed successfully.
- Backend syntax checks passed on touched files.
- Frontend CORS mismatch was resolved for local Vite development ports.
- The attendance summary page and report endpoint were added and validated.
- The public attendance kiosk routes and face-identification service were added and validated.

## Current setup notes
- Local frontend API calls should target `http://localhost:5000/api`.
- Backend CORS allows both `http://localhost:5173` and `http://localhost:5174`.
- Backend `.env` is configured for the local Windows PostgreSQL service on `localhost:5432`, but the backend can also run in demo mode if the database is unavailable.
- The frontend app requires a browser router context, which is already configured in `App.jsx`.

## Current blocker observed during local run
- Port `5000` was already in use by another process named `httpd`.
- The backend crash was caused by `EADDRINUSE`, not by the application code itself.
- PostgreSQL authentication was also failing for the configured `postgres` user, which triggered demo mode.
- The backend may still need a free port or a different `PORT` value in `.env` before a successful local run.

## Suggested next steps
- Use the local PostgreSQL service on `localhost:5432` in pgAdmin and the backend `.env`.
- Free port `5000` or change the backend port in `.env`.
- Continue with leave balance, payroll, and report generation features.

Compreface is used for the face recogniztion 

