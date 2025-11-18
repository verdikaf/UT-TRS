# Testing (Backend)

This project uses Jest for unit/integration tests and `mongodb-memory-server` for an ephemeral test MongoDB.

## Setup

```powershell
cd server
npm install
```

Jest runs in ESM mode via Node’s `--experimental-vm-modules` flag (already configured in `package.json`).

## Run

```powershell
npm test
```

## What’s Covered

- Unit: `src/utils/scheduler.js` (offset math, initial send time, weekly recurrence)
- Integration: `routes/tasks.js` (basic create/validation) using in-memory Mongo + real Agenda init
- Integration: Reminder job handler (weekly progression, once completion) with mocked Fonnte
- Integration: `middleware/auth.js` session enforcement (token, idle timeout, revoked)

## Conventions

- Tests live under `tests/` with `unit/` and `integration/` subfolders
- Shared env setup in `tests/setup/env.js`
- External services:
  - Fonnte API mocked via `jest.spyOn()` on `sendWhatsAppMessage`
  - Agenda used in tasks route test; job tests use a fake agenda object
- Time handling:
  - Use `jest.useFakeTimers()` + `jest.setSystemTime()` for time-sensitive unit tests

## Troubleshooting

- If you see ESM import errors, ensure tests run via `npm test` (uses the VM modules flag)
- If a port is occupied or Agenda fails, re-run tests; everything uses in-memory DB so no persistent state
- For verbose output: `npm test -- --verbose`
