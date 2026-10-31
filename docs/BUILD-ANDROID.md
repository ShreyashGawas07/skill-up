# Building the SkillUp Android app

SkillUp is a Vite/React web app wrapped by Capacitor 6 (app id `com.skillup.app`, name `SkillUp`).
The `android/` folder is a committed, generated Capacitor project; build output is gitignored.

## One-time setup

1. Install **Android Studio** (it bundles a JDK 17 at `<Android Studio>/jbr` and the SDK manager).
2. In Android Studio → *SDK Manager*, install **Android SDK Platform 34** and **Build-Tools 34.x**
   (Capacitor 6 compiles against API 34). Accept the SDK licences there when prompted.
3. Tell Gradle where the SDK is, either:
   - create `android/local.properties` (gitignored) containing
     `sdk.dir=C:/Users/<you>/AppData/Local/Android/Sdk` (Windows) or `sdk.dir=/Users/<you>/Library/Android/sdk` (macOS), or
   - set the `ANDROID_HOME` environment variable.
4. Java: `npm run apk` uses `JAVA_HOME` if set, otherwise Android Studio's bundled JDK at its default
   install path (`C:\Program Files\Android\Android Studio\jbr`, or `/Applications/Android Studio.app/...` on macOS).
   If Android Studio lives elsewhere, set `JAVA_HOME` to its `jbr` folder.
5. `npm install` in the repo root.

## Build

| Command | What it does |
| --- | --- |
| `npm run icons` | Renders icons into `android/app/src/main/res` (see below). |
| `npm run android` | `vite build` → render icons → `npx cap sync android` (copies `dist/` + plugins). |
| `npm run apk` | `npm run android`, then `gradlew assembleDebug` via `scripts/apk.mjs` (works from npm on Windows, macOS, Linux). |

Output: **`android/app/build/outputs/apk/debug/app-debug.apk`** (debug-signed, installable for testing).

To open the project in Android Studio instead: `npx cap open android`, then *Run* or *Build → Build APK(s)*.

### Icons (`scripts/render-icons.mjs`, run with `tsx`)

All generated from the app's own SVG art with `@resvg/resvg-js`:

- `drawable-nodpi/rank_1.png … rank_10.png` (256 px, nodpi so Android never rescales them) — tier emblems from `emblemSvg()`, used as the notification **large icon** (`largeIcon: 'rank_N'`).
- `drawable/ic_stat_flame.png` (96 px) — white flame on transparent (path shared with the in-app flame via `src/ui/art/flamePath.ts`), the notification **small icon** (`smallIcon: 'ic_stat_flame'`).
- `mipmap-*/ic_launcher.png`, `ic_launcher_round.png` (48/72/96/144/192 px) — tier-10 emblem on `#0b0b12`.
- `mipmap-*/ic_launcher_foreground.png` (108 dp layers) + `ic_launcher_background` colour `#0B0B12` — adaptive icon (Android 8+).
- `drawable*/splash.png` — tier-10 emblem centred on `#0b0b12`, at each existing splash size.

Re-run `npm run icons` (or `npm run android`) after changing emblem art.

### Permissions (`android/app/src/main/AndroidManifest.xml`)

`POST_NOTIFICATIONS` (Android 13+ runtime prompt), `SCHEDULE_EXACT_ALARM` (exact reminder times; scheduled
notifications use `allowWhileIdle: true` so they fire in Doze). On Android 14+ exact alarms are **off by default**:
without them reminders fall back to inexact alarms and may arrive late. The app shows a Home banner
("Reminders may be late — allow exact alarms") and a Settings → *Exact reminders* row whose **Enable** button opens
the system *Alarms & reminders* screen; the state is re-checked when you return to the app.
`VIBRATE` (haptics). The local-notifications plugin
adds `RECEIVE_BOOT_COMPLETED` / `WAKE_LOCK` itself (reschedules after reboot).

On Android 13+ nothing is shown until the notification permission is granted. The app asks right after the
first habit is saved, and while it has never been asked Home shows a "Turn on reminders" banner with an
**Enable** button (Settings → *Notifications* has one too).

### Reminder horizon

Reminders are scheduled locally **7 days ahead** and the whole plan is rebuilt whenever the app opens or
resumes (and after any change). There is no background job: if the app is not opened for more than 7 days,
the scheduled reminders run out and stop until it is opened again.

## Installing the APK on a phone

**USB (adb):** enable *Developer options → USB debugging* on the phone, connect it, then
`"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb" install -r android\app\build\outputs\apk\debug\app-debug.apk`
(macOS/Linux: `~/Library/Android/sdk/platform-tools/adb install -r ...`).

**File transfer:** copy `app-debug.apk` to the phone (USB, cloud drive, etc.), open it in the Files app and allow
*Install unknown apps* for that app when asked.

Data lives in the app's IndexedDB on the device; uninstalling deletes it — export a backup first (Settings → Export).

## Build status

- Android project generated and synced (`npx cap add android`, `npx cap sync android`): **done**.
- Debug APK build: **verified 2026-11-01** on the dev PC (Windows 11, Android Studio JBR, SDK platform 34) —
  `npm run apk` → `BUILD SUCCESSFUL`, `app-debug.apk` ~6.9 MB. `aapt dump badging` shows package `com.skillup.app`,
  label `SkillUp`, the permissions above, and the rank/flame/launcher resources.
- On-device behaviour: **UNVERIFIED** — the checklist below has not been run.

## Device checklist — NOT YET RUN

To be run by a person on a real phone with the debug APK. Tick each item and note the phone model / Android version.

Phone / Android version: ________

- [ ] **Permission prompt** — on Android 13+ (fresh install) the notification permission prompt appears right after saving the first habit (or via the Home "Turn on reminders" banner / Settings **Enable**); granting it enables reminders.
- [ ] **Exact alarms** — on Android 12+/14+, if Settings → *Exact reminders* shows **Enable** (and Home shows the "Reminders may be late" banner), tap it, allow *Alarms & reminders* for SkillUp, return: the row shows **On** and the banner is gone.
- [ ] **Reminder while killed** — set a reminder 2 minutes ahead, swipe the app away from recents; the reminder arrives on time showing the habit's rank emblem (large icon) and the flame in the status bar.
- [ ] **Running-session notification** — start a timer: an ongoing (non-dismissable) notification appears; its **Stop** action stops the session and the app reflects it.
- [ ] **Commitment reached** — completing the day's commitment shows confetti and the phone vibrates.
- [ ] **Reboot mid-session** — start a timer, reboot the phone, reopen the app: the elapsed time is still correct (stale-session dialog if applicable); pending reminders still fire after reboot.
- [ ] **Reduce motion** — with the system *Remove animations* setting (or the in-app reduce-motion option) on, celebrations/animations are reduced.
- [ ] **Backup round-trip** — Settings → Export a backup, then Import it (e.g. after clearing data); habits and history are restored.
- [ ] Launcher icon shows the tier-10 emblem on a dark background; splash is dark with the emblem.
