# CDC Career Dashboard

A full-stack web application for the University of St. Thomas Career Development Center. Staff get a cohort-wide dashboard with engagement tracking and analytics. Students get a personalized four-year career roadmap tied to real Handshake activity data.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Tailwind CSS |
| Backend | Node.js, Express 5 |
| Database | Supabase (PostgreSQL) |
| Auth | JWT (staff), student ID lookup (students) |
| File uploads | Multer (CSV ingestion) |
| Dev server | nodemon |

---

## Project Structure

```
cdc-career-dashboard/
├── backend/
│   ├── src/
│   │   ├── config/db.js          # Supabase client setup
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js  # JWT issue + verify
│   │   │   └── errorHandler.js
│   │   ├── routes/
│   │   │   ├── authRoutes.js      # POST /api/auth/staff
│   │   │   ├── studentRoutes.js   # GET /api/student/profile/:id, events, apps
│   │   │   ├── staffRoutes.js     # GET /api/staff/students (auth required)
│   │   │   ├── adminRoutes.js     # CSV upload + resync (auth required)
│   │   │   ├── roadmapRoutes.js   # GET/POST/PUT/DELETE /api/roadmap
│   │   │   └── taskRoutes.js      # Student task completion + file upload
│   │   ├── utils/
│   │   │   ├── triggers.js        # Auto-complete trigger logic
│   │   │   └── constants.js
│   │   └── server.js
│   ├── .env                       # NOT committed — see setup below
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── StaffDashboard.jsx
│   │   │   ├── StudentDashboard.jsx
│   │   │   ├── AdminDashboard.jsx
│   │   │   └── PlatformsHub.jsx
│   │   ├── services/api.js        # All axios calls to the backend
│   │   └── App.js
│   └── package.json
├── test-data/team-demo/           # Sample CSVs for local testing
├── .env.example                   # Template for backend/.env
└── package.json                   # Root scripts (runs both servers)
```

---

## Prerequisites

- Node.js 18+
- A Supabase project with the CDC schema already applied (ask the project owner for access)

---

## Local Setup

### 1. Clone the repo

```bash
git clone https://github.com/Essenam/-cdc-career-dashboard.git
cd cdc-career-dashboard
```

### 2. Install dependencies

```bash
npm run install:all
```

This installs packages for both `backend/` and `frontend/`.

### 3. Configure environment variables

```bash
cp .env.example backend/.env
```

Then open `backend/.env` and fill in the values. You'll need:

| Variable | Where to find it |
|---|---|
| `SUPABASE_URL` | Supabase project → Settings → API |
| `SUPABASE_KEY` | Supabase project → Settings → API → anon public key |
| `SUPABASE_SERVICE_KEY` | Supabase project → Settings → API → service_role secret |
| `DB_HOST` | Supabase project → Settings → Database → Host |
| `DB_PASSWORD` | Supabase project → Settings → Database → Password |
| `STAFF_PASSWORD` | Choose any strong password — this is the staff login password |
| `JWT_SECRET` | Choose any long random string — used to sign session tokens |

> **Never commit `backend/.env`** — it contains secrets. It is already in `.gitignore`.

### 4. Start the development servers

```bash
npm start
```

This runs both servers concurrently:
- Backend: `http://localhost:5000`
- Frontend: `http://localhost:3000`

Or run them separately:

```bash
npm run start:backend   # port 5000
npm run start:frontend  # port 3000
```

---

## How the App Works

### Authentication

- **Staff** — enter the `STAFF_PASSWORD`. On success the server issues a JWT stored in `sessionStorage`. All `/api/staff/*` and `/api/admin/*` routes require this token.
- **Students** — enter their student ID (e.g. `STU001`). The backend looks up the ID in Supabase; no password needed. Students can only see their own profile.

### Data ingestion (CSV upload)

All student activity data comes from Handshake CSV exports. Staff upload them via **Admin → Upload CSV**. The system detects the file type from the filename:

| Filename contains | Processed as |
|---|---|
| `student` | Student roster |
| `application` | Job applications |
| `event` or `attendee` | Career events attended |
| `appointment` | CDC advising appointments |
| `fair` | Career fair attendance |

After uploading, click **Resync** to recalculate all engagement scores and fire auto-complete triggers on roadmap tasks.

### Auto-complete triggers

Roadmap tasks can have a `trigger` field (e.g. `event:career_fair`, `appointment:resume`). When a matching CSV row is processed during resync, the task is automatically marked complete for that student. Trigger logic lives in `backend/src/utils/triggers.js`.

### Engagement scoring

Each student gets an engagement score (0–100) based on:
- Events attended
- Job applications submitted
- CDC advising appointments

Scores determine the cohort segment shown on the staff dashboard:
- **Need Outreach** — 0% (no recorded activity)
- **Developing** — 1–19%
- **Engaged** — 20%+

---

## Sample Data

`test-data/team-demo/` contains five pre-built CSVs with 15 synthetic students matching the real Handshake export format. Upload them in this order for a full demo environment:

1. `students_demo.csv`
2. `events_demo.csv`
3. `applications_demo.csv`
4. `appointments_demo.csv`
5. `fair_demo.csv`

Then click **Resync** in the Admin panel.

---

## API Reference

All staff/admin routes require `Authorization: Bearer <token>` header.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | None | Server health check |
| POST | `/api/auth/staff` | None | Staff login → returns JWT |
| GET | `/api/student/profile/:id` | None | Student profile |
| GET | `/api/student/events/:id` | None | Student events |
| GET | `/api/student/applications/:id` | None | Student applications |
| GET | `/api/student/search?q=` | None | Search students by name/ID |
| GET | `/api/roadmap/` | None | All active roadmap tasks |
| GET | `/api/roadmap/admin` | Staff | All tasks including inactive |
| POST | `/api/roadmap/` | Staff | Create roadmap task |
| PUT | `/api/roadmap/:id` | Staff | Update roadmap task |
| DELETE | `/api/roadmap/:id` | Staff | Delete roadmap task |
| GET | `/api/tasks/:studentId` | None | Student's completed tasks |
| POST | `/api/tasks/:studentId/:taskId` | None | Mark task complete |
| GET | `/api/staff/students` | Staff | Full cohort with scores |
| GET | `/api/staff/analytics` | Staff | Cohort analytics |
| POST | `/api/admin/upload` | Staff | Upload Handshake CSV |
| POST | `/api/admin/resync` | Staff | Recalculate all scores + triggers |

---

## Production Build

To build a single deployable artifact (Express serves the React build):

```bash
npm run build
npm run start:prod
```

Set `NODE_ENV=production` and `ALLOWED_ORIGINS=https://your-domain.com` in the environment. The app is ready to deploy on Render, Railway, or any Node-compatible host.

---

## Branches

| Branch | Purpose |
|---|---|
| `master` | Active development — this is the main branch |

---

## Contact

Project built by Essenam Komlanvi for the UST Career Development Center.  
For Supabase credentials and project context, reach out to the project owner directly.
