# Kinetiq Academy - Comprehensive System Audit (Phase 1)

Date: 2026-10-10  
Lead: Senior Full-Stack Engineer & DevOps Lead  
Project: Kinetiq Academy (Production-grade EdTech LMS)

---

## 1. Executive Summary

An exhaustive repository scan was conducted across the backend (`/backend/src`), infrastructure configuration, and frontend client modules (`/shared`, `/student_portal_dashboard_kinetiq_academy`, `/course_lms_player`, `/practice_quiz_center`, `/admin_instructor_dashboard`, `/explore_courses_kinetiq_academy_2`, `/sign_in_register_kinetiq_academy`, etc.).

The system features a solid architecture with Node.js/TypeScript, Express, Sequelize-Typescript, Redis BullMQ, LiveKit WebRTC, and OpenAI integrations. However, several critical architectural gaps, TypeScript compilation errors, unaligned frontend/backend contracts, unauthenticated endpoints, and missing container orchestrations prevent smooth end-to-end execution.

---

## 2. TypeScript Compilation & Runtime Audit

Running `npm run type-check` (`tsc --noEmit`) revealed **4 direct TypeScript compile failures**:

1. `src/routes/live.routes.ts(73,52)`: Property `livekitRoomName` does not exist on type `LiveSession`.
2. `src/routes/live.routes.ts(77,23)`: Property `livekitRoomName` does not exist on type `LiveSession`.
   - *Cause:* Model `LiveSession` in `src/models/Transaction.ts` defines `meetingUrl` and lacks `livekitRoomName` column declaration.
3. `src/services/payment.service.ts(236,16)`: Property `stripePaymentIntentId` does not exist on type `Order`.
4. `src/services/payment.service.ts(238,57)`: Property `stripePaymentIntentId` does not exist on type `Order`.
   - *Cause:* Model `Order` in `src/models/Transaction.ts` declares the property as `paymentIntentId`, but `payment.service.ts` references `stripePaymentIntentId`.

---

## 3. Route, Controller & Frontend Mapping

| Module / Domain | Frontend Action / Function | Frontend Path / Trigger | Backend Endpoint Target | HTTP Method | Expected Payload / Params | Backend Response Format | Status / Audit Finding |
|---|---|---|---|---|---|---|---|
| **Auth** | `Auth.register()` | `/sign_in_register_kinetiq_academy` | `/api/v1/auth/register` | POST | `{ firstName, lastName, email, password, role }` | `{ success: true, data: { user, accessToken, refreshToken } }` | Matches contract; inputs validated via express-validator. |
| **Auth** | `Auth.login()` | `/sign_in_register_kinetiq_academy` | `/api/v1/auth/login` | POST | `{ email, password }` | `{ success: true, data: { user, accessToken, refreshToken } }` | Aligned. |
| **Auth** | `Auth.logout()` | Topbar / Navigation | `/api/v1/auth/logout` | POST | Header Bearer Token | `{ success: true, message: "Logged out" }` | Aligned. |
| **Auth** | Refresh Token | Client interceptor on 401 | `/api/v1/auth/refresh` | POST | `{ refreshToken }` | `{ success: true, data: { accessToken, refreshToken } }` | Aligned. |
| **Courses** | `Courses.list()` | `/explore_courses_kinetiq_academy_2` | `/api/v1/courses` | GET | `?limit=12&category=&search=` | `{ success: true, data: Course[], meta: { total, page } }` | Aligned. |
| **Courses** | `Courses.get(slug)` | `/course_details_*` | `/api/v1/courses/:slug` | GET | URL param `slug` | `{ success: true, data: Course }` | Aligned. |
| **Courses** | `Courses.enroll(id)` | Course Details / LMS | `/api/v1/courses/:courseId/enroll` | POST | None (Auth token required) | `{ success: true, data: Enrollment }` | Aligned. Free course auto-enrollment. |
| **Courses** | `Courses.updateProgress()` | `/course_lms_player` | `/api/v1/courses/:courseId/lessons/:lessonId/progress` | PATCH | `{ progressPercent, isCompleted }` | `{ success: true, data: { progressPercent } }` | Aligned. |
| **User** | `User.getDashboard()` | `/student_portal_dashboard_kinetiq_academy` | `/api/v1/users/dashboard` | GET | Auth token | `{ success: true, data: { stats, enrollments, recentActivity } }` | Aligned. |
| **User** | `User.getEnrolledCourses()`| `/student_portal_dashboard_kinetiq_academy` | `/api/v1/users/courses` | GET | Auth token | `{ success: true, data: Enrollment[] }` | Aligned. |
| **User** | `User.completeOnboarding()`| `/student_onboarding_personalize_your_curriculum`| `/api/v1/users/onboarding` | POST | `{ goals, learningStyle, experienceLevel, ... }` | `{ success: true, data: Onboarding }` | Aligned. |
| **Payments** | `Payments.createCheckoutSession()`| Pricing / Course Details | `/api/v1/payments/checkout` | POST | `{ courseId, successUrl, cancelUrl }` | `{ success: true, data: { url, sessionId } }` | Aligned. Requires active Stripe secret key. |
| **Payments** | Stripe Webhook | Stripe CLI / Gateway callback | `/api/v1/payments/webhook` | POST | Raw Stripe payload buffer + `stripe-signature` header | `{ received: true }` | Express body parser must preserve raw buffer. |
| **Quiz** | `Quiz.startAttempt()` | `/practice_quiz_center` | `/api/v1/quiz/lessons/:lessonId/start` | POST | Param `lessonId` | `{ success: true, data: QuizAttempt }` | Aligned. |
| **Quiz** | `Quiz.submit()` | `/practice_quiz_center` | `/api/v1/quiz/attempts/:attemptId/submit` | POST | `{ answers, lessonId, timeTakenSeconds }` | `{ success: true, data: { score, passed, attempt } }` | Aligned. |
| **Admin** | `Admin.getStats()` | `/admin_instructor_dashboard` | `/api/v1/admin/stats` | GET | Auth token (Admin role required) | `{ success: true, data: { stats, recentUsers } }` | Role guard properly enforced. |
| **Admin** | `Admin.getUsers()` | `/admin_instructor_dashboard` | `/api/v1/admin/users` | GET | Query params: page, limit, search, role | `{ success: true, data: User[], meta: { total } }` | Aligned. |
| **Live** | LiveKit Session Join | `/course_lms_player` | `/api/v1/live/sessions/:id/join` | GET | Param `id` | `{ success: true, data: { token, roomName, livekitUrl } }` | Broken due to missing model property `livekitRoomName`. |
| **Upload** | Thumbnail / Video Upload | Instructor Dashboard | `/api/v1/upload/thumbnail` & `/api/v1/upload/presign` | POST | FormData / JSON | `{ success: true, data: { url, key } }` | Requires MinIO/S3 running with initialized buckets. |

---

## 4. Key Mismatches and Architectural Inconsistencies

1. **Frontend Host and Navigation Configuration**:
   - `shared/api.js` points to `http://localhost:4000/api/v1`.
   - `serve.json` routes static requests on port `5500`.
   - In multiple raw HTML templates (e.g., `ai_learning_kinetiq_academy/index.html`), UI elements have static mock text and lack integration with `window.KinetiqAPI`.
2. **Payment Service Model Desynchronization**:
   - `payment.service.ts` expects `order.stripePaymentIntentId`, while `Transaction.ts` model names the column `paymentIntentId`.
3. **LiveKit Room Name Desynchronization**:
   - `live.routes.ts` accesses `session.livekitRoomName`, which is omitted from `LiveSession` definition in `src/models/Transaction.ts`.
4. **CORS and Allowed Origins**:
   - Backend `.env` allows `http://localhost:5500,http://127.0.0.1:5500,http://localhost:3000`. If served via `127.0.0.1` or arbitrary IP, browser blocks API requests without strict fallback.
5. **Background Queue Execution in Dev**:
   - `server.ts` starts BullMQ workers in the same process via `startEmailWorker()` and `startCertificateWorker()`. For production reliability, workers must also have an isolated worker entrypoint script (`worker.ts`).

---

## 5. Security & Infra Audit Findings

1. **Stripe Webhook Body Parsing**:
   - Express applies global `express.json()` in `src/app.ts` prior to route matching. In `src/routes/payment.routes.ts`, `express.raw()` is attached at the router level, but global JSON parsing can interfere with verifying Stripe webhook signatures. Webhooks must receive unmodified raw buffers.
2. **Docker Compose Missing PostgreSQL**:
   - `backend/docker-compose.yml` only specifies `redis` and `minio`. PostgreSQL is assumed to be run locally or preinstalled. It must be consolidated into `docker-compose.yml` so a single `docker compose up -d` spins up PostgreSQL 15, Redis 7, and MinIO.
3. **MinIO Default Buckets Missing on Boot**:
   - Storage buckets (`kinetiq-media`, `kinetiq-avatars`, `kinetiq-docs`) fail if not auto-created on initial MinIO provisioning.
4. **Environment Variables**:
   - No `.env.example` in repo.
   - Secrets (`JWT_ACCESS_SECRET`, `SESSION_SECRET`) contain fallback values in `.env`.
   - Need fail-fast startup validator using Zod or custom validator.
