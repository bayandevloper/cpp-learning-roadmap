# C++ Learning Roadmap

A project-based C++ learning site: 36 lessons across 6 phases, each paired with
its own hands-on project. Students identify with a name only (no password) and
build a personal portfolio of submitted project code as they progress.

Live site: https://coral-grove-kc1kd.surething.host

## Stack
- Hono worker (Cloudflare Workers) for the API
- SQLite via drizzle-orm for student + submission storage
- Vite-built static client (vanilla TS)

## Structure
- `src/client/data.ts` — lesson/phase content (rewritten from harmash.com's C++ tutorial series)
- `src/client/main.ts` — client app (identity gate, roadmap, portfolio)
- `src/worker.ts` — API: create/find student by name, save/list project submissions
- `src/schema.ts` — drizzle schema (students, submissions)
- `migrations/db/0000_init.sql` — initial SQL migration
