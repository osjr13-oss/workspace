# Selrano for iPhone (work in progress)

Read the repository's `AGENTS.md` and `docs/HANDOFF.md` ("iPhone app") first. This folder is the native iPhone app, built with Expo SDK 57 and expo-router. It is **iPhone only** (owner decision, 2026-10-14) and is designed fresh: do not reuse earlier prototypes or old designs found in git history or tags.

## How it fits together

- Signs in with Supabase directly (session in the iPhone Keychain, `src/lib/supabase.ts`) and reads conversations and projects under row-level security.
- Talks to the website API (`EXPO_PUBLIC_API_URL`, default `https://www.selrano.com`) with `Authorization: Bearer <access token>`: `/api/me` (private-access check after sign-in), `/api/ai/chat` (streamed reply), `/api/ai/chat/stop`, `/api/files/upload-url` and `/api/files/upload` (attachments).
- Shares dependency-free helpers with the website through `@shared/*` (= `../lib/*`): the reply protocol (`chat-stream.ts`), the streaming pacer, the Markdown tidier, `removeEmDashes`, and the data types. Keep those files free of imports and browser-only APIs. `metro.config.js` lets Metro read `../lib`.
- Screens: `app/signin.tsx`, `app/index.tsx` (chats, grouped by day, native search, long press to rename or delete), `app/chat/[id].tsx` (`new` for a new chat), `app/settings.tsx` (sign out).

## Rules

- Same product rules as the website: Selrano is private, never use the em dash, no exact AI allowances in marketing copy, Groq stays the provider until the owner says otherwise.
- Settings come from `mobile/.env` (copy `.env.example`): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL`. They are public values baked into the build.

## Expo has changed: do not trust your training data

Expo ships breaking changes every SDK release. Before writing code that touches an Expo, EAS, or React Native API, check the installed version's type definitions in `node_modules` or the versioned docs at `https://docs.expo.dev/versions/v57.0.0/`.

```bash
npm install
npx expo install <package>   # always, so versions match SDK 57
npm run typecheck
npx expo start               # press i for the iOS Simulator, or scan the QR code with Expo Go on the iPhone
```

The owner develops on a **Windows** laptop, so the iOS Simulator and Xcode are not available. Test on the owner's iPhone with **Expo Go**: `npx expo start`, then scan the QR code with the iPhone camera. The phone and laptop must be on the same Wi-Fi, and Windows Firewall must allow Node; if the phone still cannot connect, use `npx expo start --tunnel`. Expo Go covers everything in this app today. Installable builds (EAS Build in Expo's cloud, which works from Windows) need an Expo account and, for TestFlight, an Apple Developer account; ask the owner before setting either up.
