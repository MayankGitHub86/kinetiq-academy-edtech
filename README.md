# Kinetiq Academy - Platform Engineering Guide

Production-grade EdTech LMS with Node.js/TypeScript backend, PostgreSQL, Redis, MinIO S3 object storage, LiveKit video classroom, and multi-module frontend.

---

## 🚀 Quickstart (One Command Setup)

### 1. Start Infrastructure Services
Start PostgreSQL, Redis, MinIO, and bucket auto-provisioning:
```bash
cd backend
docker compose up -d
```

### 2. Configure Environment
Copy the example environment file and adjust keys if necessary:
```bash
cp .env.example .env
```

### 3. Seed Database
Populate database with default admin, instructor, student, and 5 complete courses:
```bash
npm run seed
```

### 4. Start Application
In two terminal windows or background tasks:

**Backend (API & WebSockets):**
```bash
cd backend
npm run dev
# Starts on http://localhost:4000 (API at /api/v1)
```

**Frontend (Static Web Modules):**
```bash
# In project root
npx serve -l 5500
# Available on http://localhost:5500
```

---

## 🛠️ Environment Variables & Credentials

### Default Seeded Accounts
- **Admin**: `admin@kinetiqacademy.com` / `Admin@1234`
- **Instructor**: `instructor@kinetiqacademy.com` / `Instructor@1234`
- **Student**: `student@kinetiqacademy.com` / `Student@1234`

### Required External Service Keys (To Configure for Production)
| Service | Required Keys in `.env` | Purpose |
|---|---|---|
| **Stripe** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY` | Course checkout & webhook fulfillment |
| **OpenAI** | `OPENAI_API_KEY` | Vector embeddings, search, AI recommendations |
| **LiveKit** | `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Live video streaming rooms & participant tokens |
| **SMTP** | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Asynchronous system notification emails |

---

## 🧪 Testing & Verification

Run type checking and builds:
```bash
cd backend
npm run type-check   # Verifies TypeScript without emit (0 errors)
npm run build        # Compiles TypeScript into dist/
npm run test         # Executes test runners
```

Test API health endpoint:
```bash
curl http://localhost:4000/health
```

---

## 📂 Key Architecture Folders

- `/backend/src/models`: Sequelize-TypeScript database models (`User`, `Course`, `Transaction`, `Profile`, `Onboarding`).
- `/backend/src/routes`: Express route endpoints.
- `/backend/src/jobs`: BullMQ Redis queues for email and certificate background workers.
- `/backend/src/storage`: MinIO/S3 file storage client and presigned URL generator.
- `/shared`: Client-side SDK (`api.js`, `router.js`, `config.js`) shared across all frontend modules.
- `/student_portal_dashboard_kinetiq_academy`: Student portal interface.
- `/admin_instructor_dashboard`: Admin and instructor platform management.
- `/course_lms_player`: Video course player and progress tracking.
