# Reminder Task App (Express, Vue, MongoDB, Agenda, Fonnte, JWT)

A simple reminder system where users register/login and create tasks with deadlines and WhatsApp reminders. Supports one-time and weekly recurring reminders, sent via Fonnte API and scheduled by Agenda.js.

## Features
- Register and login with phone + password (JWT)
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
2. Frontend env (optional):
   - Copy `client/.env.example` to `client/.env` if you need to change API URL.

## Install
Open two terminals.

Terminal A (backend):
```powershell
cd "d:\UT\CAPSTONE PROJECT\UT-TRS\server"
npm install
npm run dev
```
The API runs at `http://localhost:4000`.

Terminal B (frontend):
```powershell
cd "d:\UT\CAPSTONE PROJECT\UT-TRS\client"
npm install
npm run dev
```
The web app runs at `http://localhost:5173`.

## API Notes
- Registration: `POST /api/auth/register` { name, phone, password }
- Login: `POST /api/auth/login` { phone, password } → returns JWT
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
