# Reminder Task App (Express, Vue, MongoDB, Agenda, Fonnte, JWT)

A simple reminder system where users register/login and create tasks with deadlines and WhatsApp reminders. Supports one-time and weekly recurring reminders, sent via Fonnte API and scheduled by Agenda.js.

## Features
- Register and login with phone + password (JWT)
- Secure logout (server-side revocation)
- Auto-logout on inactivity (configurable idle timeout)
- Create, edit, delete tasks
- Reminder offsets: 3 days, 1 day, or 3 hours before deadline
- One-time or weekly recurring reminders
- WhatsApp delivery via Fonnte API
- Scheduling with Agenda.js backed by MongoDB

## Prerequisites
- Node.js 18+
- MongoDB running locally or a connection string
- Fonnte API token (https://fonnte.com)

## Setup
1. Backend env:
   - Copy `server/.env.example` to `server/.env` and fill values.
  - Key vars:
    - `JWT_EXPIRES_IN=7d` (token lifetime)
    - `MAX_IDLE_MINUTES=5` (server-enforced inactivity timeout)
2. Frontend env (optional):
   - Copy `client/.env.example` to `client/.env` if you need to change API URL.

## Run Locally

1. Clone the repo and enter the project folder:
```bash
git clone https://github.com/verdikaf/UT-TRS.git
cd UT-TRS
```

2. Start the backend (Terminal A):
```bash
cd server
npm install
npm run dev
```
The API runs at `http://localhost:4000`.

3. Start the frontend (Terminal B):
```bash
cd client
npm install
npm run dev
```
The web app runs at `http://localhost:5173`.

Notes:
- Commands are the same for PowerShell, Command Prompt, or bash/zsh.
- Ensure env files are configured as described below.

## API Notes
- Registration: `POST /api/auth/register` { name, phone, password }
- Login: `POST /api/auth/login` { phone, password } → returns JWT
- Logout: `POST /api/auth/logout` (requires Authorization header)
- Tasks CRUD under `/api/tasks` (Authorization: `Bearer <token>`)

## Fonnte
- Ensure `FONNTE_TOKEN` is set in `server/.env`.
- Phone numbers should be in international format (e.g., 628xxxxxxxxxx).

## Agenda Behavior
- On task creation, the system computes the initial send time (deadline minus offset).
- If that time is in the past:
  - one-time: schedules for 1 minute from now
  - weekly: rolls forward by weeks until in the future, and normalizes the deadline
- After sending:
  - one-time: marks task completed
  - weekly: shifts deadline by 7 days and schedules the next reminder

## Dev Tips
- Update `CLIENT_URL` in `server/.env` if the frontend origin differs.
- To change polling, adjust `processEvery` in `server/src/config/agenda.js`.
- Idle timeout: server rejects requests when session is idle beyond `MAX_IDLE_MINUTES`. Client should handle 401 by redirecting to login.
