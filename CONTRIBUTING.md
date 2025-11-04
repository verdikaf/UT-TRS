# Contributing to UT-TRS

Thanks for contributing! This doc explains how we work together.

## Workflow
- Use a feature branch from `main`: `feat/<short-name>` or `fix/<short-name>`
- Keep PRs small and focused; reference any related issue.
- Use conventional commits in messages, e.g.:
  - `feat(auth): add JWT middleware`
  - `fix(tasks): correct weekly scheduler offset`

## Setup
```bash
# backend
cd server
npm i
npm run dev

# frontend
cd ../client
npm i
npm run dev
```

## Environment
- Copy `.env.example` to `.env` in both `server/` and `client/` if needed.
- For WhatsApp delivery set `FONNTE_TOKEN` in `server/.env`.

## Code Style
- JavaScript (ESM), Node 18+
- Keep functions small; avoid inlined comments unless clarifying non-obvious logic.

## Testing
- Manual: register/login, create task, verify scheduled behavior.
- Add lightweight unit tests if expanding logic (optional).

## PR Checklist
- [ ] Builds locally (server + client)
- [ ] No secrets committed (check `.env` files ignored)
- [ ] Descriptive title and summary
- [ ] Screenshots for UI changes (if applicable)
