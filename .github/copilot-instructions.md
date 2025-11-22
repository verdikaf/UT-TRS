# Copilot Instructions for UT-TRS

## Project Overview
UT-TRS is a reminder task application built with Express (backend), Vue 3 (frontend), MongoDB (database), Agenda.js (job scheduling), and Fonnte API (WhatsApp delivery). Users can register/login, create tasks with deadlines, and receive automated WhatsApp reminders.

## Architecture

### Backend (`server/`)
- **Framework**: Express.js (Node 18+, ESM)
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT with server-side revocation
- **Job Scheduling**: Agenda.js backed by MongoDB
- **WhatsApp API**: Fonnte for message delivery
- **Testing**: Jest with `mongodb-memory-server`

**Key directories:**
- `src/models/` - Mongoose schemas (User, Task, Session)
- `src/routes/` - Express routes (auth, tasks)
- `src/middleware/` - Auth middleware (JWT validation, idle timeout)
- `src/services/` - External integrations (Fonnte)
- `src/jobs/` - Agenda job definitions (reminder scheduling)
- `src/utils/` - Helper functions (validators, scheduler logic, logger)
- `src/config/` - Configuration (database, agenda)
- `tests/` - Unit and integration tests

### Frontend (`client/`)
- **Framework**: Vue 3 with Composition API
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Routing**: Vue Router
- **HTTP Client**: Axios

**Key directories:**
- `src/pages/` - Vue page components
- `src/App.vue` - Root component
- `src/main.js` - Application entry point

## Tech Stack & Dependencies

### Backend
- `express` - Web framework
- `mongoose` - MongoDB ODM
- `agenda` - Job scheduling
- `jsonwebtoken` - JWT authentication
- `bcryptjs` - Password hashing
- `axios` - HTTP client for Fonnte API
- `cors` - CORS middleware
- `dotenv` - Environment variables

### Frontend
- `vue` - UI framework
- `vue-router` - Routing
- `axios` - API client
- `tailwindcss` - Utility-first CSS

## Coding Standards

### General
- **Language**: JavaScript ES Modules (ESM)
- **Node Version**: 18+
- **Module System**: Use `import/export`, not `require()`
- **Commit Messages**: Follow conventional commits (e.g., `feat(auth):`, `fix(tasks):`)
- **Branch Naming**: `feat/<short-name>` or `fix/<short-name>`

### Code Style
- Keep functions small and focused
- Avoid inline comments unless clarifying non-obvious logic
- Use descriptive variable names
- Prefer async/await over promises
- Use arrow functions for callbacks

### Error Handling
- Always handle errors in async functions
- Return appropriate HTTP status codes (400 for validation, 401 for auth, 404 for not found, 500 for server errors)
- Log errors using the logger utility

### Security
- Never commit `.env` files (they are gitignored)
- Validate all user inputs using validators
- Use JWT for authentication with proper expiration
- Hash passwords with bcrypt before storage
- Sanitize phone numbers to international format (E.164)

## Key Features & Business Logic

### Authentication
- Registration: phone + password (phone must be unique)
- Login: returns JWT token (7-day expiration by default)
- Logout: server-side token revocation via Session model
- Auto-logout: configurable idle timeout (`MAX_IDLE_MINUTES`)

### Task Management
- Create, edit, delete tasks with deadlines
- Reminder offsets: 3 days, 1 day, or 3 hours before deadline
- **One-time reminders**: Send once, then mark task completed
- **Weekly recurring reminders**: 
  - Require `endDate` (ISO date)
  - Shift deadline by 7 days after each reminder
  - Stop when next schedule exceeds `endDate`

### Reminder Scheduling (Agenda.js)
- Initial send time = deadline - offset
- If initial time is past:
  - One-time: schedule for 1 minute from now
  - Weekly: roll forward by weeks until future, normalize deadline
- After sending:
  - One-time: mark task completed
  - Weekly: shift deadline +7 days, schedule next reminder

### WORKER Gating
- Only instances with `WORKER=1` env var run Agenda scheduler
- Prevents duplicate job execution in multi-instance deployments
- See `server/src/config/agenda.js`

## Environment Configuration

### Backend (`server/.env`)
Required variables:
- `MONGODB_URI` - MongoDB connection string
- `MONGODB_DB` - Database name (default: `ut_trs`)
- `JWT_SECRET` - Secret for JWT signing
- `FONNTE_TOKEN` - Fonnte API token for WhatsApp
- `CLIENT_URL` - Frontend origin for CORS
- `TIMEZONE` - Timezone for scheduling (default: `Asia/Jakarta`)
- `WORKER` - Set to `1` to enable Agenda scheduler
- `JWT_EXPIRES_IN` - Token lifetime (default: `7d`)
- `MAX_IDLE_MINUTES` - Inactivity timeout (default: `5`)

### Frontend (`client/.env`)
- `VITE_API_URL` - Backend API base URL (default: `http://localhost:4000`)

## Development Workflow

### Setup
```bash
# Backend
cd server
npm install
npm run dev  # Runs on http://localhost:4000

# Frontend
cd client
npm install
npm run dev  # Runs on http://localhost:5173
```

### Testing
```bash
# Backend only (uses Jest)
cd server
npm test              # Run all tests
npm run test:watch    # Watch mode
```

**Testing conventions:**
- Tests in `tests/` with `unit/` and `integration/` subfolders
- Use `mongodb-memory-server` for integration tests
- Mock external services (Fonnte) using `jest.unstable_mockModule()`
- Use fake timers for time-sensitive tests
- Run via `npm test` (includes `--experimental-vm-modules` flag)

### Building
```bash
# Frontend
cd client
npm run build  # Outputs to dist/
npm run preview  # Preview production build
```

## API Structure

### Authentication Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT
- `POST /api/auth/logout` - Logout (requires Authorization header)

### Task Endpoints (require `Authorization: Bearer <token>`)
- `GET /api/tasks` - List user's tasks
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Health Check
- `GET /api/health` - Server health status

## Common Patterns

### Request Validation
- Use validators from `src/utils/validators.js`
- Validate early, return 400 with clear error messages

### Database Queries
- Use Mongoose models from `src/models/`
- Always handle potential null results
- Use transactions for multi-document operations if needed

### Job Scheduling
- Define jobs in `src/jobs/`
- Use Agenda instance from config
- Handle both success and failure cases
- Log job execution for debugging

### Phone Number Format
- Use utility from `src/utils/phone.js`
- Convert to E.164 format (e.g., `628xxxxxxxxxx`)
- Validate before saving to database

## Deployment (Render)

- Backend: Web Service (Node)
- Frontend: Static Site
- Database: MongoDB Atlas
- Configuration: See `render.yaml` in root
- Only one backend instance should have `WORKER=1`

## Documentation Files
- `README.md` - Project overview, setup, features
- `CONTRIBUTING.md` - Contribution guidelines, workflow
- `server/TESTING.md` - Testing guide and conventions
- `docs/DEPLOYMENT.md` - Deployment guide for Render
- `.github/pull_request_template.md` - PR template

## When Making Changes

1. **Keep PRs small and focused** - One feature or fix per PR
2. **Reference issues** - Link to related issue numbers
3. **Test locally** - Verify both backend and frontend work
4. **No secrets** - Never commit `.env` files
5. **Screenshots** - Include for UI changes
6. **Descriptive commits** - Use conventional commit format
7. **Update docs** - If changing behavior or adding features

## Troubleshooting Tips

- **Port conflicts**: Ensure 4000 (backend) and 5173 (frontend) are available
- **CORS errors**: Check `CLIENT_URL` matches frontend origin
- **Auth failures**: Verify JWT_SECRET is set and consistent
- **Reminders not firing**: Check WORKER env var and Agenda logs
- **WhatsApp not sending**: Verify FONNTE_TOKEN and phone format
- **Test failures**: Run via `npm test` to ensure ESM support

## Quick Reference

### File Locations
- Models: `server/src/models/`
- Routes: `server/src/routes/`
- Middleware: `server/src/middleware/`
- Jobs: `server/src/jobs/`
- Utils: `server/src/utils/`
- Tests: `server/tests/`
- Vue Pages: `client/src/pages/`

### Key Files
- Backend entry: `server/src/index.js`
- Frontend entry: `client/src/main.js`
- Agenda config: `server/src/config/agenda.js`
- DB config: `server/src/config/db.js`
- Auth middleware: `server/src/middleware/auth.js`
- Scheduler logic: `server/src/utils/scheduler.js`

### Commands Cheatsheet
```bash
# Development
cd server && npm run dev
cd client && npm run dev

# Testing
cd server && npm test

# Building
cd client && npm run build

# Git workflow
git checkout -b feat/my-feature
git commit -m "feat(scope): description"
git push origin feat/my-feature
```
