# Deployment Guide (Render All-In-One)

## Overview
Backend (Web Service) + Frontend (Static Site) deployed on Render, MongoDB Atlas for database. Agenda scheduler gated by `WORKER` env var so only designated instance runs jobs.

## Services
1. **Backend** (`ut-trs-backend`)
   - Root: `server/`
   - Build: `npm install`
   - Start: `npm start`
   - Health Check: `/api/health`
   - Instances: `1` (keep single worker)
   - Env Vars:
     - `MONGODB_URI` (Atlas connection string)
     - `MONGODB_DB=ut_trs`
     - `JWT_SECRET` (strong random)
     - `FONNTE_TOKEN` (WhatsApp API token)
     - `CLIENT_URL` (frontend origin, e.g. https://ut-trs-frontend.onrender.com)
     - `TIMEZONE=Asia/Jakarta`
     - `WORKER=1`

2. **Frontend** (`ut-trs-frontend`)
   - Root: `client/`
   - Build: `npm install && npm run build`
   - Publish: `dist/`
   - Env Vars:
     - `VITE_API_URL` (backend base URL)

## WORKER Gating
`server/src/config/agenda.js` only starts Agenda when `WORKER` is unset or equals `1`. If you scale horizontally later:
- Keep exactly one instance with `WORKER=1`
- Set others to `WORKER=0` to disable scheduling.

## MongoDB Atlas Setup
1. Create Cluster → Shared tier.
2. Create database user.
3. Network Access: allow `0.0.0.0/0` initially, then restrict.
4. Get connection string and place into Render `MONGODB_URI`.

## Local Verification
```bash
# Backend
cd server
npm install
npm start
# Frontend
cd ../client
npm install
npm run build
npm run dev
```

## CORS
- Backend uses `CLIENT_URL` for allowed origin.
- Ensure final frontend domain matches `CLIENT_URL` exactly.

## Adding Custom Domains
- Render dashboard → Domains → add `api.example.com` to backend and `app.example.com` to frontend.
- Update `CLIENT_URL` and `VITE_API_URL` accordingly.

## Environment Promotion
For production vs staging:
- Create two backend services (`ut-trs-backend-staging`, `ut-trs-backend-prod`) with separate Atlas DBs or separate databases.
- Use different `JWT_SECRET` values.

## Logs & Monitoring
- Render dashboard for logs.
- Optional: UptimeRobot hitting `/api/health` every 5 minutes.

## Common Issues
| Issue | Cause | Fix |
|-------|-------|-----|
| Reminders not firing | Multiple workers started Agenda | Ensure only one service has `WORKER=1` |
| CORS errors | Mismatch origin | Set `CLIENT_URL` to deployed frontend origin |
| 401 after idle | Session timeout | Increase `MAX_IDLE_MINUTES` env var (add if needed) |
| Phone not validated | Invalid format | Ensure E.164 style, include country code |

## Future Enhancements
- Add retry/backoff for WhatsApp failures.
- Add metrics endpoint `/api/metrics` for health detail.
- Introduce `render.yaml` for automated reproducible infra (already included).

## Render YAML
See `render.yaml` in repo root for declarative service definition.

---
Generated on: 2025-11-11
