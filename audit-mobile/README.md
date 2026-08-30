# audit-mobile

Expo (React Native) app for the GS0106 audit duration calculator — runs on iOS,
Android, and web from one codebase. Talks to the `audit-engine` API over HTTP.

## Running locally

```bash
npm install
npm run web       # or: npx expo start   (then press 'i' / 'a' / 'w')
```

By default the app points at `http://localhost:4000` for the API — that only
works when running in a web browser or the iOS simulator on the same machine as
the API. For a physical device or Android emulator, set the API URL explicitly:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.23:4000 npx expo start
```

(Replace with your machine's actual LAN IP — find it with `ipconfig` on Windows
or `ifconfig`/`ip addr` on Mac/Linux. Your phone and computer need to be on the
same Wi-Fi network.)

Once `audit-engine` is deployed to cPanel, point this at the real URL instead
(e.g. `EXPO_PUBLIC_API_URL=https://api.yourdomain.com`).

## Status

See `CHANGELOG.md`, `ROADMAP.md`, `BUGLOG.md` for what's built, what's next, and
what's been fixed. Short version: NAE Calculator is fully working end-to-end;
the full multi-site Case Builder is next.
