# Kinetiq Academy - Changelog

All notable changes and technical fixes made during takeover and system alignment.

---

## [Phase 1 & 2: Audit & Infrastructure] - 2026-10-10
### Added
- **`AUDIT.md`**: Complete system mapping of frontend modules, API endpoints, request contracts, security findings, and compile diagnostics.
- **`docker-compose.yml`**: Upgraded container orchestration containing PostgreSQL 15, Redis 7, MinIO S3 object storage, and an automated MinIO provisioning container (`minio/mc`) to auto-create and set public access policies for required buckets (`kinetiq-media`, `kinetiq-avatars`, `kinetiq-docs`).
- **`.env.example`**: Complete template covering DB, Redis, JWT, CORS, MinIO, LiveKit, Stripe, OpenAI, and SMTP configurations.
- **`src/config/envValidator.ts`**: Fail-fast environment variable validator using Zod schema to prevent unexpected runtime crashes.
- **`shared/config.js`**: Unified frontend endpoint configuration dynamically resolving API and WebSocket endpoints for local and deployed environments.

### Updated
- **`backend/package.json`**: Added scripts for `worker`, `lint`, `migrate`, and `test`.

---

## [Phase 3: Backend Alignment & Fixes] - 2026-10-10
### Fixed
- **`src/models/Transaction.ts`**:
  - Added missing `livekitRoomName` property to the `LiveSession` model.
- **`src/services/payment.service.ts`**:
  - Fixed property name desynchronization: updated invalid `order.stripePaymentIntentId` reference to `order.paymentIntentId`.
- **`src/app.ts`**:
  - Added request body `verify` callback in `express.json` to capture and preserve `req.rawBody` buffer needed for Stripe webhook signature verification.
  - Enhanced `/health` check route to actively test database and Redis connectivity, returning HTTP 200 for healthy states and 503 for degraded states.
- **`src/config/redis.ts`**:
  - Exported `redisClient` instance for health check accessibility and external monitoring.
- **`src/routes/payment.routes.ts`**:
  - Secured webhook ingestion buffer extraction with `req.rawBody` fallback.
- **`src/worker.ts`**:
  - Created standalone BullMQ worker process entry point to run email and certificate queues independently.

---

## [Phase 4 & 5: Frontend Alignment & Verification] - 2026-10-10
### Updated
- **`shared/api.js`**:
  - Connected client requests to `window.KINETIQ_CONFIG.API_BASE_URL` and `window.KINETIQ_CONFIG.SOCKET_URL`.
  - Configured auto-reconnection and authentication headers for Socket.io.

### Verified
- **TypeScript Typecheck**: `npm run type-check` compiles with 0 errors.
- **Production Build**: `npm run build` compiles clean TypeScript distribution files with 0 errors.
- **API Health Check**: `http://localhost:4000/health` verified returning status `ok` and PostgreSQL `ok`.
- **Authentication**: Automated registration and login tested with status 201 and 200 respectively.
- **Courses API**: `GET /api/v1/courses` verified returning 5 seeded courses.
- **Frontend Server**: `http://localhost:5500` verified active.
