# src/frontend

Expo (React Native) app for the GS0106 audit duration calculator — runs on
iOS, Android, and web from one codebase. Talks to the backend API in
`src/backend/` over HTTP (see `src/config/api.ts` for how the base URL is
resolved).

## Running locally

```bash
npm install
npm run web       # or: npx expo start   (then press 'i' / 'a' / 'w')
```

By default the app points at `http://localhost:8000` for the API (matching
`make dev-backend`'s `php -S localhost:8000`) — that only works when running
in a web browser or the iOS simulator on the same machine as the API. For a
physical device or Android emulator, set the API URL explicitly:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.23:8000 npx expo start
```

(Replace with your machine's actual LAN IP — find it with `ipconfig` on
Windows or `ifconfig`/`ip addr` on Mac/Linux. Your phone and computer need to
be on the same Wi-Fi network.)

In production this is built with `EXPO_PUBLIC_API_URL` pointed at the real
deployed API instead — see the root `docs/DEPLOY.md`.

## Status

This folder still keeps its own `CHANGELOG.md`, `ROADMAP.md`, `BUGLOG.md`
from before the repository architecture consolidation (`audit-mobile/` →
`src/frontend/`). They predate, and are not the same numbering sequence as,
the canonical `docs/BUGLOG.md`/`docs/ROADMAP.md`/`docs/DEV_STATUS.md` at the
repo root — see the warning headers in this folder's `BUGLOG.md`/`ROADMAP.md`
and `docs/DEV_STATUS.md`'s sixth-session entry. Read `docs/DEV_STATUS.md`
first for current, authoritative status; treat this folder's own logs as
historical until a future session merges/renumbers them.
