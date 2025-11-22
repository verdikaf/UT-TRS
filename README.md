# Reminder Task App (Express, Vue, MongoDB, Agenda, Fonnte, JWT)

A simple reminder system where users register/login and create tasks with deadlines and WhatsApp reminders. Supports one-time and weekly recurring reminders, sent via Fonnte API and scheduled by Agenda.js.

## Features
- Encrypted register/login/password change (client-side RSA-OAEP, server-side bcrypt storage)
- Secure logout (server-side revocation)
- Auto-logout on inactivity (configurable idle timeout)
- Create, edit, delete tasks
- Reminder offsets: 3 days, 1 day, or 3 hours before deadline
- One-time or weekly recurring reminders
- Weekly recurring can be bounded by an `endDate` (required for weekly)
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
- Registration: `POST /api/auth/register` `{ name, phone, passwordEncrypted }`
- Login: `POST /api/auth/login` `{ phone, passwordEncrypted }` → returns JWT
- Logout: `POST /api/auth/logout` (Authorization required)
- Change password: `PUT /api/profile/password` `{ currentPasswordEncrypted, newPasswordEncrypted }`
- Tasks CRUD under `/api/tasks` (Authorization: `Bearer <token>`)
  - Weekly tasks require `endDate` (ISO date) where recurrence stops once the next schedule would exceed `endDate`.

### Password Encryption Flow (Static Key)
1. Public RSA key (SPKI PEM) is provisioned at build time (frontend env var `VITE_RSA_PUBLIC_KEY`).
2. Client imports key using Web Crypto: `subtle.importKey('spki', pemDer, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['encrypt'])`.
3. Password is UTF-8 encoded and encrypted via RSA-OAEP SHA-256.
4. Ciphertext (Base64) sent as `passwordEncrypted`; plaintext never sent.
5. Server performs RSA-OAEP decrypt → bcrypt hash/compare/store.

### Postman Encryption Snippet (Static Key)
Set environment variable `PUBLIC_KEY_PEM` with the RSA public key. Then use:
```javascript
const pem = pm.environment.get('PUBLIC_KEY_PEM');
if(!pem) { throw new Error('PUBLIC_KEY_PEM not set'); }
const { publicEncrypt, constants } = require('crypto');
const pwd = pm.environment.get('PASSWORD') || 'password123';
const enc = publicEncrypt({ key: pem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(pwd,'utf8')).toString('base64');
pm.environment.set('PASSWORD_ENC', enc);
```
Use `"passwordEncrypted": "{{PASSWORD_ENC}}"` in request body.

### Security Notes
- Bcrypt cost factor currently `10`; can be raised later without breaking encryption.
- RSA keypair persisted in `server/keys/` (single static key).
- To rotate, update server files and redeploy frontend with new `VITE_RSA_PUBLIC_KEY`.

### Setting up VITE_RSA_PUBLIC_KEY for the Client
1. **Start the server once** to generate the RSA keypair. This will create `server/keys/rsa_public.pem` and `server/keys/rsa_private.pem`.
2. **Copy the contents** of `server/keys/rsa_public.pem`.
3. **Open** `client/.env` (create it if it doesn't exist).
4. **Add** the following line (all on one line, no line breaks):

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
