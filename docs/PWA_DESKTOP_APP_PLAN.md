# GAMVerse Installable App Plan

## Current implementation

GAMVerse is a React and Vite client backed by separate API and Colyseus realtime services, with LiveKit handling voice and video. Installing the client must keep those hosted services authoritative. The first release will make the existing website installable as a Progressive Web App (PWA); it will not claim that multiplayer rooms or voice work offline.

## Phase 1 PWA installation

Deliver an HTTPS installable PWA with a GAMVerse app icon, standalone window display, a browser-supported install action, an offline startup fallback, and a service worker that precaches only the built app shell. Keep API, authentication, room, and media traffic network-only. Do not automatically replace a running client when a new app version is waiting; an open office session must not be interrupted by an update.

Acceptance checks:

- The production build emits a valid manifest, icon assets, and service worker.
- Chrome and Edge can install the app from an HTTPS deployment and launch it in a standalone window.
- The first launch requires connectivity; after the app shell is cached, an offline launch shows a clear connection state rather than a blank page.
- API, Colyseus, and LiveKit requests are never served from the app-shell cache.
- New versions become available after existing app windows close and reopen; no active session is forced to reload.
- Browser checks cover sign-in, office entry, microphone and camera permissions, reconnect, and install/standalone launch.

## Phase 2 Desktop wrapper evaluation

If users need a downloaded installer rather than browser installation, evaluate Tauri around the same Vite client. Build a proof of concept for Windows and test WebRTC, screen sharing, device permissions, deep links, and updates before committing to a production desktop wrapper. Keep the hosted API, Colyseus, and LiveKit services unchanged.

## Phase 3 Installer release

After the Phase 2 proof of concept passes, configure platform-specific packaging, signing, release channels, and secure update delivery. Treat signing credentials as release secrets and keep them out of source control. Publish Windows and macOS installers only after platform QA.

## Boundaries

- Offline access is limited to the static client shell and any explicitly approved immutable assets.
- No user, office, authentication, presence, movement, voice, or video data is cached for offline use.
- Production domain, TLS, release signing, and installer publishing remain deployment-owner decisions.
