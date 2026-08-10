# TestFlight & Deployment — How We Did It (Study Guide)

Written after the 2026-08-08 session where we shipped the first TestFlight builds. This is meant to be read, not just referenced — each section explains *why*, not just *what to type*, so you can do it yourself next time.

---

## 1. The big picture: three separate moving parts

It's easy to conflate these, so keep them distinct in your head:

1. **Your code** — lives in this folder, tracked by git. Only exists on your Mac until you `git push`.
2. **GitHub** (`origin/main`) — the shared copy of your code. Nothing outside your Mac can see your work until it's here.
3. **Two independent places that *run* your code:**
   - **Render** (`wafina-api-rd0q.onrender.com`) — hosts the API. Auto-deploys whenever GitHub's `main` branch changes.
   - **EAS / Apple / TestFlight** — builds and distributes the iOS/Android apps. Does **not** auto-update — you have to explicitly build and submit each time.

The bug that started this whole exercise ("Partners isn't showing up") was exactly this: I'd committed everything *locally* but never pushed to GitHub, so Render kept running old code. The mobile app looked broken, but the real gap was three commits sitting un-pushed on my machine.

**Lesson:** after any real batch of fixes, always check `git status -sb` — if it says `ahead of origin/main`, nothing you built is actually live anywhere except your own machine.

---

## 2. Git: commit and push

```bash
git add -A
git commit -m "short description of what changed and why"
git push origin main
```

Before pushing something that updates a **live production service** (like our API on Render), it's worth a quick self-check first:

```bash
# What's about to go out that isn't live yet?
git log origin/main..main --oneline

# Does it touch anything sensitive?
git diff origin/main..main --name-status
git diff origin/main..main | grep -iE "(api[_-]?key|secret|password|token)"
```

We did exactly this before pushing — confirmed the commits were only the intended features, no `.env` files or credentials, and that any new environment variables the code needed (`RESEND_API_KEY` for email) were optional, so production wouldn't break without them.

---

## 3. Building and submitting an iOS app to TestFlight

This is a two-step process: **build** (compile the app into an installable file), then **submit** (upload that file to Apple).

### Step 1 — Build

```bash
cd apps/mobile-donor        # or apps/mobile-institution
npx eas-cli build --platform ios --profile production --non-interactive
```

- `npx eas-cli` — you don't need `eas` installed globally, `npx` downloads and runs it on demand.
- `--profile production` — refers to the `"production"` block in that app's `eas.json`, which sets things like the API URL the built app will talk to.
- `--non-interactive` — fail immediately instead of hanging on a prompt I can't answer. If credentials are already set up (they were — Apple Distribution Certificate + Provisioning Profile, valid until 2027), this runs start-to-finish with no input needed.
- Takes 10–20+ minutes on Expo's servers. It prints a build URL (`expo.dev/accounts/.../builds/...`) you can watch progress on.

### Step 2 — Submit to App Store Connect / TestFlight

```bash
npx eas-cli submit --platform ios --latest
```

**The first time** for any given app, this needs to log into your actual Apple ID (to create the App Store Connect app record) — it'll prompt interactively in your terminal. That's the one step that genuinely has to be you; I can't and shouldn't enter your Apple credentials.

On success, it prints something like:
```
https://appstoreconnect.apple.com/apps/6799295890/testflight/ios
```
**That number (`6799295890`) is the ASC App ID.** Save it — see step 4.

Apple then processes the build for 5–10 minutes (you get an email), after which you can add it to a TestFlight group.

### Step 4 — Save the ASC App ID so you never need to log in again

Add it to that app's `eas.json`:
```json
{
  "submit": {
    "production": {
      "ios": {
        "ascAppId": "6799295890"
      }
    }
  }
}
```
With this saved, `eas submit --platform ios --latest --non-interactive` works with zero prompts, every time, from then on. Commit this file — it's not a secret, just a public app identifier.

### Getting testers on TestFlight

App Store Connect → your app → **TestFlight** tab:
- **Internal Testing** — add people by Apple ID email, up to 100, no Apple review, available almost instantly.
- **External Testing** — needs Apple's Beta App Review first (usually 24–48h), but can be a public link.

---

## 4. Android: two very different testing paths

**Path A — Expo Go (what we're using right now)**
Your Mac runs a dev server (`npm run start --workspace=apps/mobile-donor -- --port 8081`), and testers install the free "Expo Go" app and connect to `exp://<your-Mac's-IP>:8081`. Fast to iterate, but:
- Only works while your Mac is on, awake, and on the same Wi-Fi as the tester.
- The API it talks to is whatever's in `.env` (`EXPO_PUBLIC_API_BASE_URL`) — in our case, my local dev API, not production.

**Path B — a real installable APK (not built yet, ready when you want it)**
```bash
cd apps/mobile-donor
eas build --platform android --profile preview
```
No Apple-style login needed for Android. ~10–20 min, then EAS gives you a direct download link + QR code. Testers download and install it directly (one-time "allow unknown sources" permission) — no Play Store, no Expo Go, no dependency on your Mac being on. This talks to whatever API URL is set in the `preview` profile's `env` block in `eas.json` (currently also pointed at production).

---

## 5. Dev servers — what's running, and how to restart them yourself

Everything below runs as ordinary processes **on your own Mac** — not on any server of mine. If your Mac restarts, sleeps, or you close the terminal tab, these stop, and testers relying on Expo Go lose connection until you start them again.

From the project root (`/Users/zuinder/Downloads/WAFINA PROJECT`), each in its own terminal tab (they need to keep running):

```bash
# API — required by everything (web, admin, both mobile apps)
npm run dev --workspace=apps/api

# Donor mobile app dev server (Expo Go)
npm run start --workspace=apps/mobile-donor -- --port 8081

# Institution mobile app dev server (Expo Go)
npm run start --workspace=apps/mobile-institution -- --port 8082

# Web apps, if you need them
npm run dev --workspace=apps/web           # port 3000
npm run dev --workspace=apps/institution   # port 3001
npm run dev --workspace=apps/admin         # port 3002
```

If a port says "already in use," something's already running — that's fine, nothing to fix.

Your Mac's local IP (needed for the `exp://` links, and it can change if you switch Wi-Fi networks):
```bash
ipconfig getifaddr en0
```

---

## 6. Quick troubleshooting patterns from today

- **"It looks like features are missing in the app"** → check whether the API it's talking to is actually up to date. `curl` a route that only exists in the new code (we used `/partners`) — if it 404s, the backend hasn't been redeployed; if it 401s (needs auth), the route exists and the new code is live.
- **A native module (like `expo-sharing`) crashes only on a real device, not in the bundler** → Metro successfully *compiling* the code only proves the JavaScript resolves. It does **not** prove the native module is actually present in whatever app binary is running on the phone (Expo Go ships a fixed set of native modules; it doesn't have every Expo library built in). The only real test is running it on the actual device/build.
- **Something "went wrong" with a vague error from Apple** → these are usually transient auth hiccups. A retry is often enough; if it keeps failing specifically at Apple ID login, an **app-specific password** (generated at appleid.apple.com) instead of your normal password is the usual fix.

---

## 7. Where to find the actual full conversation

This document is a distilled version — the real, complete back-and-forth (including all the dead ends, my reasoning, every command's exact output) is preserved in this chat session itself. If your Claude Code / Cowork interface has a session history or transcript export feature, that's the verbatim record; this file is the "if I only remember one thing" version.
