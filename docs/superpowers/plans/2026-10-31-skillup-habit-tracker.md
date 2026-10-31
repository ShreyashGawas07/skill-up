# SkillUp Habit Rank Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An offline Android app (React + Capacitor) for tracking up to 2 timed daily habits through a 30-day forming streak and a 10-tier rank ladder up to a target number of hours.

**Architecture:** Only raw facts are stored (habits, sessions, seen events, settings) in IndexedDB via Dexie. A pure rules engine `evaluate()` replays history day by day to derive streak, rank, badges and events. Pure planners turn that state into a notification schedule and a celebration queue, and thin adapters hand them to Capacitor plugins. The UI is React with Framer Motion and code-drawn SVG art.

**Tech Stack:** Vite 5, React 18, TypeScript 5 (strict), Tailwind CSS 3, Framer Motion 11, canvas-confetti, Zustand 4, Dexie 4, date-fns 3, Capacitor 6 (`@capacitor/android`, `local-notifications`, `haptics`, `filesystem`, `share`, `app`), Vitest + @testing-library/react + jsdom + fake-indexeddb, @resvg/resvg-js (build-time PNG rendering).

**Spec:** `docs/superpowers/specs/2026-10-31-skillup-habit-tracker-design.md`

## Global Constraints

- Max **2 active habits** (not archived, not Eternal).
- Daily commitment: 15–720 minutes in 15-minute steps; **locked during Forming**; after Forming, edits apply from the next day.
- Target hours default **10,000**; integer ≥ 1.
- Day = local midnight to midnight; compute with date-fns `startOfDay`/`addDays`, never `+86_400_000` (DST).
- Done day: minutes ≥ commitment. Overtime counts toward total and is never banked.
- Forming = 30 done days in a row; any miss resets it to 0. Formed is permanent.
- Rank penalty: miss → `lostTiers += 2`, capped at `earnedTier − 1`; 7 consecutive done days while `lostTiers > 0` → `lostTiers −= 1`.
- Tier thresholds (% of target): 0, 0.5, 2, 5, 10, 20, 40, 65, 85, 100. Names: Novice, Apprentice, Adept, Skilled, Expert, Elite, Master, Grandmaster, Legend, Eternal.
- Last-chance notification at **22:30**; morning-after-miss at **08:00**; stale running session threshold **16 h**.
- Streak milestones: 7, 14, 30, 50, 100, 200, 365, then every 365.
- Live timer is the only way to log time. No manual entry anywhere in the UI.
- Celebrations: one full-screen at a time (queued), tap to skip, respect reduce-motion; sound off by default.
- Copy is short; no paragraphs on main screens.

## Review Focus

1. **Forgot to stop the timer and didn't open the app for days.** A running session older than 16 h must not count toward totals or mark days done until the user resolves it. (Task 3 test `stale running session is excluded`)
2. **DST change days** (23 h / 25 h): sessions split at true local midnight; day keys never skip or repeat. (Task 2 test `splits correctly across DST change`)
3. **Commitment edited after Forming:** earlier days keep being judged by their old commitment. (Task 3 test `commitment history applies per day`)
4. **Target edited below hours already logged:** this must not instantly retire the habit. Validation requires target > current total hours. (Task 9 test `rejects target at or below logged hours`)
5. **Corrupt or foreign backup file imported:** reject with a message and leave existing data untouched. (Task 4 test `invalid backup leaves db unchanged`)

---

## File Structure

```
src/
  domain/types.ts         shared types (Habit, Session, DayStatus, HabitState, AppEvent…)
  domain/days.ts          day keys, per-day minute splitting, commitment lookup
  domain/tiers.ts         tier table, earnedTier()
  domain/evaluate.ts      rules engine
  data/db.ts              Dexie schema
  data/repo.ts            CRUD for habits/sessions/seenEvents/settings
  data/backup.ts          export/import + validation
  timer/timer.ts          start/stop, single-active rule, stale detection
  notify/messages.ts      message pools + pickMessage()
  notify/plan.ts          buildSchedule() pure planner
  notify/scheduler.ts     Capacitor adapter (cancel+schedule, actions)
  feedback/haptics.ts     haptic helpers (no-op on web)
  feedback/celebrations.ts  event → celebration queue
  store/useApp.ts         Zustand store wiring repo + evaluate + scheduler
  ui/theme.ts             tier colours/materials, habit accent palette
  ui/art/emblemSvg.ts     emblemSvg(tier): string — 10 rank emblems
  ui/art/Emblem.tsx, Ring.tsx, Flame.tsx, BeadTrack.tsx, Heatmap.tsx, Ladder.tsx, EmptyState.tsx
  ui/screens/Home.tsx, HabitCard.tsx, HabitDetail.tsx, AddHabit.tsx, Settings.tsx, HallOfFame.tsx
  ui/overlay/CelebrationOverlay.tsx, StaleSessionDialog.tsx, PermissionBanner.tsx
  App.tsx, main.tsx, index.css
scripts/render-icons.mjs  emblem/app icons → Android PNG resources
tests/…                   mirrors src/
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `vitest.setup.ts`, `.gitignore`
- Test: `tests/smoke.test.tsx`

**Interfaces:**
- Produces: `npm test` (vitest run), `npm run dev`, `npm run build`; path alias `@/` → `src/`.

- [ ] **Step 1:** `git init`; scaffold with `npm create vite@latest . -- --template react-ts`; install the deps from the Tech Stack; configure Tailwind, jsdom test env, `fake-indexeddb/auto` and `@testing-library/jest-dom` in `vitest.setup.ts`, `@/` alias; `.gitignore` includes `node_modules`, `dist`, `android/app/build`.
- [ ] **Step 2: Write the failing test** `tests/smoke.test.tsx`: renders `<App/>` and expects text `SkillUp`.
- [ ] **Step 3:** Run `npm test`. Expected: FAIL (App lacks text).
- [ ] **Step 4:** `App.tsx` renders a dark full-screen shell with heading `SkillUp`. Load fonts "Outfit" (display) and "Inter" (body) via `@fontsource/outfit` and `@fontsource/inter` (bundled, works offline).
- [ ] **Step 5:** Run `npm test && npm run build`. Expected: PASS, build succeeds.
- [ ] **Step 6:** Commit `chore: scaffold SkillUp (vite, react, tailwind, vitest)` (include the existing `docs/`).

---

### Task 2: Domain types and day math

**Files:**
- Create: `src/domain/types.ts`, `src/domain/days.ts`
- Test: `tests/domain/days.test.ts`

**Interfaces:**
- Produces:
```ts
type DayKey = string; // 'YYYY-MM-DD' local
interface CommitmentChange { fromDate: DayKey; dailyMinutes: number }
interface Habit { id: string; name: string; icon: string; color: string;
  targetHours: number; reminderTime: string /* 'HH:mm' */; createdAt: number;
  commitmentHistory: CommitmentChange[]; archivedAt?: number }
interface Session { id: string; habitId: string; start: number; end?: number }
dayKey(ts: number): DayKey
dayStart(key: DayKey): number
nextDay(key: DayKey): DayKey
daysBetween(fromKey: DayKey, toKey: DayKey): DayKey[]          // inclusive
minutesByDay(sessions: Session[], now: number): Map<DayKey, number> // splits at midnight; open session ends at now
commitmentOn(habit: Habit, key: DayKey): number                 // last change with fromDate <= key
```

- [ ] **Step 1: Write failing tests:**
  - `dayKey` of 2026-10-31 23:59 local → `'2026-10-31'`.
  - `minutesByDay` for session 23:00–01:30 → `{ '2026-10-31': 60, '2026-11-01': 90 }`.
  - `splits correctly across DST change`: run with `TZ=Europe/London` (set `process.env.TZ` in test file header); session 2026-10-24 23:00 → 2026-10-26 01:00 gives `{ '2026-10-24': 60, '2026-10-25': 1500, '2026-10-26': 60 }`.
  - Open session (no end) counts up to `now`.
  - `daysBetween('2026-10-30','2026-11-02')` has 4 keys.
  - `commitmentOn` with changes `[{2026-10-01,120},{2026-11-05,90}]` → 120 on 2026-11-04, 90 on 2026-11-05.
- [ ] **Step 2:** Run `npx vitest run tests/domain/days.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement with date-fns (`format`, `parse`, `startOfDay`, `addDays`, `differenceInCalendarDays`). Minutes are floored to whole minutes per day segment.
- [ ] **Step 4:** Run tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(domain): day keys and per-day minute splitting`.

---

### Task 3: Tiers and rules engine

**Files:**
- Create: `src/domain/tiers.ts`, `src/domain/evaluate.ts` (extend `types.ts`)
- Test: `tests/domain/tiers.test.ts`, `tests/domain/evaluate.test.ts`

**Interfaces:**
- Consumes: Task 2.
- Produces:
```ts
const TIERS: { tier: number; name: string; pct: number }[]  // 10 entries, Global Constraints
earnedTier(totalMinutes: number, targetHours: number): number // 1..10
tierThresholdHours(tier: number, targetHours: number): number
type DayStatus = 'done' | 'missed' | 'pending' | 'grace'      // grace = unfinished creation day
type EventType = 'DAY_COMPLETE'|'OVERTIME'|'STREAK_MILESTONE'|'RANK_UP'|'RANK_LOST'
  |'RANK_RECOVERED'|'STREAK_RESET'|'HABIT_FORMED'|'ETERNAL'
interface AppEvent { key: string; type: EventType; habitId: string; day: DayKey; value?: number }
// key = `${type}:${day}` or `${type}:${day}:${value}`
interface HabitState { habitId: string; today: DayKey; todayMinutes: number; commitment: number;
  days: { key: DayKey; minutes: number; commitment: number; status: DayStatus }[];
  formingDone: number; formed: boolean; streak: number; longestStreak: number;
  totalMinutes: number; overtimeMinutes: number; earnedTier: number; lostTiers: number;
  recoveryProgress: number; rank: number; eternal: boolean;
  badges: { formed: boolean; tiersReached: number[] };
  missedYesterday: boolean; staleSession?: Session; events: AppEvent[] }
evaluate(habit: Habit, sessions: Session[], now: number): HabitState
STALE_MS = 16 * 3600_000
```

- [ ] **Step 1: Write failing tier tests:** `earnedTier(0,10000)=1`, `earnedTier(50*60,10000)=2`, `earnedTier(49*60+59,10000)=1`, `earnedTier(10000*60,10000)=10`, `earnedTier(50*60,1000)=5` (non-default target), `tierThresholdHours(7,10000)=4000`.
- [ ] **Step 2: Write failing engine tests.** Use a helper `day(n, minutes)` that makes a session on creation day + n. Commitment 120, target 10000 unless stated.
  - done / partial (119 min = missed) / creation day unfinished = `grace`, not a miss.
  - overtime: 180 min → `overtimeMinutes` 60, total 180, next day with 0 min is still missed (not banked).
  - forming: 30 done days → `formed`, `HABIT_FORMED` event on day 29 (0-indexed); miss on day 10 → `formingDone` 0 + `STREAK_RESET`; after formed, a miss does not unset `formed`.
  - penalty: totals giving earnedTier 5, then one miss → `lostTiers` 2, `rank` 3, `RANK_LOST` event; at earnedTier 2 a miss → `lostTiers` 1 (cap), rank 1; two misses at tier 1 → rank 1, no `RANK_LOST` event.
  - recovery (earnedTier 5): lostTiers 2 then 7 done days → lostTiers 1 + `RANK_RECOVERED`; from lostTiers 2, 6 done + miss → recoveryProgress 0 and lostTiers 4 (cap = earned − 1 = 4).
  - `multi-day absence`: earnedTier 6, 5 days no sessions → lostTiers 5 (cap at earned−1), rank 1.
  - `RANK_UP` when total crosses a threshold, value = new rank.
  - streak milestones emitted at 7 and 14; event keys unique and stable across two calls.
  - eternal: total reaches target → `eternal` true, `lostTiers` 0, `ETERNAL` event; days after are not evaluated.
  - today with 0 minutes → `pending`, no penalty; `missedYesterday` true when yesterday missed.
  - `commitment history applies per day`: change 120→60 effective day 40; day 39 with 60 min = missed, day 40 with 60 min = done.
  - `stale running session is excluded`: open session started 20 h before `now` → contributes 0 minutes, returned as `staleSession`.
- [ ] **Step 3:** Run `npx vitest run tests/domain`. Expected: FAIL.
- [ ] **Step 4:** Implement. Replay algorithm (the part tests don't fully pin):
```
sessions' = exclude open session if now - start > STALE_MS (set staleSession)
for key in daysBetween(creationKey, today):
  m = minutes[key] ?? 0; c = commitmentOn(habit,key); total += m
  if m >= c: status done; overtime += m - c
  elif key == today: pending
  elif key == creationKey: grace
  else: missed
  if done: streak++; longest = max; milestone events;
           DAY_COMPLETE (+ OVERTIME if m > c)
           if !formed: formingDone++; if formingDone == 30: formed, HABIT_FORMED
           if lostTiers > 0: recovery++; if recovery == 7: lostTiers--, recovery = 0, RANK_RECOVERED
  if missed: if !formed && formingDone > 0: STREAK_RESET; formingDone = 0
           streak = 0; recovery = 0
           prevRank = rank; lostTiers = min(lostTiers + 2, earned - 1); rank changed → RANK_LOST
  earnedNow = earnedTier(total); if earnedNow > earned: RANK_UP (value = new rank); record tiersReached
  if earnedNow == 10: eternal, lostTiers = 0, ETERNAL, break
  rank = max(1, earned - lostTiers)
```
- [ ] **Step 5:** Run tests. Expected: PASS.
- [ ] **Step 6:** Commit `feat(domain): tier table and replay rules engine`.

---

### Task 4: Persistence and backup

**Files:**
- Create: `src/data/db.ts`, `src/data/repo.ts`, `src/data/backup.ts`
- Test: `tests/data/repo.test.ts`, `tests/data/backup.test.ts`

**Interfaces:**
- Consumes: `Habit`, `Session` (Task 2).
- Produces:
```ts
interface Settings { theme: 'system'|'dark'|'light'; sound: boolean; reduceMotion: 'system'|'on'|'off' }
const DEFAULT_SETTINGS: Settings // { theme:'system', sound:false, reduceMotion:'system' }
repo.listHabits(): Promise<Habit[]>; repo.putHabit(h): Promise<void>; repo.deleteHabit(id): Promise<void> // deletes its sessions + seen events
repo.listSessions(habitId?): Promise<Session[]>; repo.putSession(s): Promise<void>
repo.openSession(): Promise<Session | undefined>
repo.seenKeys(): Promise<Set<string>>; repo.markSeen(keys: string[]): Promise<void>
repo.getSettings(): Promise<Settings>; repo.putSettings(s): Promise<void>
interface Backup { app: 'skillup'; version: 1; exportedAt: number; habits; sessions; seen: string[]; settings }
exportBackup(): Promise<Backup>
parseBackup(json: string): { ok: true; backup: Backup } | { ok: false; error: string }
importBackup(b: Backup): Promise<void>  // single Dexie transaction: clear all, bulkAdd
```

- [ ] **Step 1: Write failing tests:** CRUD round-trip; `deleteHabit` removes its sessions; `openSession` returns the one with no `end`; export→parse→import round-trip equals the original; `parseBackup` rejects non-JSON, wrong `app`, `version` ≠ 1, a habit missing `commitmentHistory`, and a session with `end < start`, each with an `error` message; `invalid backup leaves db unchanged` (seed data, attempt import of a bad file via parse+guard, data still present).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Dexie DB `skillup` v1 stores: `habits: 'id'`, `sessions: 'id, habitId, start'`, `seen: 'key'`, `settings: 'id'` (single row id `'app'`). Validation is hand-written type guards (no extra library).
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(data): dexie repo and validated backup`.

---

### Task 5: Timer

**Files:**
- Create: `src/timer/timer.ts`
- Test: `tests/timer/timer.test.ts`

**Interfaces:**
- Consumes: repo (Task 4), `STALE_MS` (Task 3).
- Produces:
```ts
startTimer(habitId: string, now: number): Promise<{ started: Session; stopped?: Session }>
stopTimer(now: number): Promise<Session | undefined>
resolveStale(session: Session, endAt: number): Promise<void> // endAt in [start, start+STALE_MS]; else throws
isStale(s: Session, now: number): boolean
```

- [ ] **Step 1: Write failing tests:** start creates an open session; starting habit B while A runs stops A at `now` and returns it as `stopped`; starting the same habit again is a no-op returning the existing session; stop closes it; `resolveStale` rejects `endAt` beyond start+16h or before start, and accepts a valid trim.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement; ids via `crypto.randomUUID()`.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(timer): single active timer with stale resolution`.

---

### Task 6: Notification planner and messages

**Files:**
- Create: `src/notify/messages.ts`, `src/notify/plan.ts`
- Test: `tests/notify/plan.test.ts`, `tests/notify/messages.test.ts`

**Interfaces:**
- Consumes: `Habit`, `HabitState`, `TIERS`.
- Produces:
```ts
type NotifKind = 'reminder'|'lastChance'|'running'|'dayComplete'|'missed'
interface NotifSpec { id: number; habitId: string; kind: NotifKind; at: number | null /* null = now */;
  title: string; body: string; ongoing?: boolean; largeIconTier?: number; actionTypeId?: 'SESSION' }
pickMessage(kind: NotifKind, ctx: MsgCtx, seed: string): { title: string; body: string }
interface MsgCtx { habit: string; minutesLeft: number; streak: number; formingDay?: number;
  rankName: string; dropToName: string; startedAt?: string }
buildSchedule(input: { habits: Habit[]; states: Record<string, HabitState>;
  running?: Session; now: number; horizonDays?: number /* default 7 */ }): NotifSpec[]
notifId(slot: 0|1, kind: NotifKind, dayOffset: number): number // slot*1000 + kindIndex*100 + dayOffset
```

- [ ] **Step 1: Write failing tests** (now = 2026-11-01 12:00, reminder 19:00, commitment 120):
  - today not done → reminder today 19:00 and lastChance today 22:30, plus both for days +1…+7.
  - today done → no reminder/lastChance for today; future days still scheduled.
  - now = 23:00 → nothing for today.
  - `missedYesterday` and now < 08:00 → `missed` at 08:00; now ≥ 08:00 → none.
  - running session → one `running` spec (`at: null`, `ongoing: true`, `actionTypeId: 'SESSION'`) and `dayComplete` at start + remaining minutes; if already met, no `dayComplete`.
  - eternal or archived habits produce nothing; ids are unique across 2 habits.
  - lastChance body names `dropToName` = tier name of `max(1, rank-2)`.
  - messages: each kind has ≥ 4 variants; same seed gives the same variant; different day seeds rotate; every output has no unfilled `{placeholder}`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Pools use `{habit}`, `{left}` (formatted "1h 30m"), `{streak}`, `{day}`, `{rank}`, `{drop}`, `{start}` and the example copy in spec §4 as the first variant of each kind; write the remaining variants in the same short, punchy, emoji-led voice. Future-day variants must not cite today's minutes. Seed = `habitId+day+kind`, simple string hash.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(notify): pure schedule planner and rotating copy`.

---

### Task 7: Native adapters (notifications, haptics) and app store

**Files:**
- Create: `src/notify/scheduler.ts`, `src/feedback/haptics.ts`, `src/feedback/celebrations.ts`, `src/store/useApp.ts`
- Test: `tests/feedback/celebrations.test.ts`, `tests/store/useApp.test.ts`

**Interfaces:**
- Consumes: Tasks 3–6.
- Produces:
```ts
applySchedule(specs: NotifSpec[]): Promise<void>   // cancel all pending, then schedule; no-op when !Capacitor.isNativePlatform()
registerNotificationActions(onStop: () => void): Promise<void> // action type 'SESSION' with action 'STOP'
notificationPermission(): Promise<'granted'|'denied'|'prompt'>; requestNotificationPermission(): Promise<boolean>
haptic.tick(); haptic.success(); haptic.heavy(); haptic.warn()  // @capacitor/haptics; swallow errors on web
type CelebrationKind = 'dayComplete'|'overtime'|'streak'|'rankUp'|'rankLost'|'rankRecovered'|'streakReset'|'formed'|'eternal'
interface Celebration { key: string; kind: CelebrationKind; habitId: string; value?: number; fullScreen: boolean }
toCelebrations(events: AppEvent[], seen: Set<string>): Celebration[]
// order: rankLost, streakReset, rankRecovered, dayComplete, overtime, streak, rankUp, formed, eternal
// fullScreen: all except dayComplete and overtime (those are inline card effects)
useApp: Zustand store { habits, sessions, settings, states: Record<id, HabitState>, running?: Session,
  queue: Celebration[], now: number, load(), tick(now), addHabit(input), updateHabit(id, patch),
  deleteHabit(id), start(habitId), stop(), resolveStale(endAt), dismiss(key), saveSettings(s) }
```

- [ ] **Step 1: Write failing tests:** `toCelebrations` filters seen keys, orders as above, only the latest `OVERTIME` per day; store: `load()` with seeded DB computes `states`; `start` then `stop` updates `sessions` and calls `applySchedule` (mock module); `dismiss(key)` removes from queue and persists via `markSeen`; `addHabit` throws `'2 habits max'` when 2 are active.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. The store recomputes `states` on load, after every mutation, and in `tick()` (called each second by the UI while a timer runs, else each minute and on `App` resume via `@capacitor/app` `appStateChange`). Reschedule notifications after each mutation and on resume. On first launch, events from before install don't exist; on `load()` mark all events dated before today as seen only if the DB has no seen rows yet (prevents a celebration flood after importing a backup).
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat: app store, notification/haptics adapters, celebration queue`.

---

### Task 8: Visual art components

**Files:**
- Create: `src/ui/theme.ts`, `src/ui/art/emblemSvg.ts`, `Emblem.tsx`, `Ring.tsx`, `Flame.tsx`, `BeadTrack.tsx`, `Heatmap.tsx`, `Ladder.tsx`, `EmptyState.tsx`
- Test: `tests/ui/art.test.tsx`

**Interfaces:**
- Produces:
```ts
TIER_STYLE: Record<1..10, { primary: string; secondary: string; glow: string; material: string }>
HABIT_COLORS: string[] // 8 accents
emblemSvg(tier: number, opts?: { cracked?: boolean; locked?: boolean }): string // standalone <svg viewBox="0 0 128 128">
<Emblem tier size cracked? locked? animate? />
<Ring progress /* 0..1 */ overtime /* 0..1 per extra commitment */ color size>{children}</Ring>
<Flame streak size />          // orange <30, blue ≥30, violet ≥100; scale grows with log(streak)
<BeadTrack done /* 0..30 */ formed />
<Heatmap days={HabitState['days']} month={DayKey} color />
<Ladder state={HabitState} targetHours />
<EmptyState variant: 'add' | 'locked' />
```

- [ ] **Step 1: Write failing tests:** `emblemSvg(t)` for t = 1..10 returns valid SVG strings (parse with DOMParser, no `parsererror`) and all 10 differ; `cracked` adds an element with `data-crack`; `Ring` renders an overdrive arc only when `overtime > 0`; `BeadTrack done=12` renders 12 filled of 30; `Heatmap` marks a missed day with `aria-label` containing "missed"; `Ladder` shows lost tiers with `data-state="lost"`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Emblem silhouettes grow in detail by tier: 1 round stone, 2 bronze shield, 3 silver shield + chevrons, 4 gold shield + star, 5 emerald crest + laurel, 6 sapphire winged shield, 7 amethyst crowned crest, 8 crimson winged crown, 9 prismatic star-burst with wings, 10 cosmic gold sun with orbit rings. Use gradients from `TIER_STYLE`; tiers ≥ 7 get a CSS shimmer (`animate` prop), tier 10 a slow rotation. Ring/Flame/BeadTrack animate with Framer Motion and switch to opacity-only transitions when `useReducedMotion()` or the setting says on.
- [ ] **Step 4:** Run. Expected: PASS. Also run `npm run dev` and eyeball a temporary `?gallery` route that renders all art (remove the route before commit).
- [ ] **Step 5:** Commit `feat(ui): emblems, ring, flame, beads, heatmap, ladder`.

---

### Task 9: Home screen and Add/Edit habit flow

**Files:**
- Create: `src/ui/screens/Home.tsx`, `HabitCard.tsx`, `AddHabit.tsx`; modify `src/App.tsx` (simple state router: `home | add | edit:id | detail:id | settings | hall`)
- Test: `tests/ui/home.test.tsx`, `tests/ui/addHabit.test.tsx`

**Interfaces:**
- Consumes: `useApp`, art components.
- Produces: `validateHabitInput(input, ctx: { formed: boolean; totalHours: number }): string | null` exported from `AddHabit.tsx`.

- [ ] **Step 1: Write failing tests:**
  - Home with 0 habits shows 2 `EmptyState add` slots; with 2 active, no add slot, and a `locked` slot appears only when the user taps "+" via header (it shows "2 habits max").
  - HabitCard shows emblem, ring, flame number, `Day N/30` beads (or Formed badge), total bar `312 / 10,000h`; tapping Start calls `start(id)` and the button becomes Stop with a running clock `0:00:05` after `tick`.
  - When `todayMinutes` crosses commitment during `tick`, the card fires confetti (mock `canvas-confetti`) and `haptic.success` once.
  - AddHabit: 4 steps (name+icon+color → daily hours dial 15-min steps 0:15–12:00 → target default 10000 → reminder time default 19:00); Save creates habit with `commitmentHistory=[{fromDate: today, dailyMinutes}]`.
  - Edit during Forming: daily hours dial disabled with lock icon; after Formed: change saved as a new history entry `fromDate = tomorrow`.
  - `rejects target at or below logged hours`: `validateHabitInput({targetHours: 300}, {formed:true,totalHours:312})` returns an error string.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Large thumb-friendly controls; the hours dial is a circular drag control with ±15 m buttons as an alternative; step transitions are horizontal swipes (Framer Motion `drag="x"`). Card uses the habit accent as a gradient border; while running, the ring pulses.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(ui): home cards with live timer and add/edit flow`.

---

### Task 10: Celebrations and stale-session dialog

**Files:**
- Create: `src/ui/overlay/CelebrationOverlay.tsx`, `src/ui/overlay/StaleSessionDialog.tsx`; modify `App.tsx`
- Test: `tests/ui/overlay.test.tsx`

**Interfaces:**
- Consumes: `useApp().queue`, `dismiss`, `resolveStale`, `haptic`, `emblemSvg`.

- [ ] **Step 1: Write failing tests:** only the first full-screen celebration renders; tapping it calls `dismiss(key)` and the next appears; `rankUp` shows the new tier name; `rankLost` shows "Expert → Skilled"-style text for the drop; with reduce motion on, the overlay has `data-motion="reduced"`; StaleSessionDialog appears when `states[x].staleSession` exists, offers "Keep 16h" and a time picker to trim, and calls `resolveStale(endAt)`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement each kind per spec §3.3 table: rankUp (old emblem shatters into shards, new one rises with rays, name slams in, `haptic.heavy`), rankLost (crack + drop 2 rungs, red vignette, `haptic.warn`, ≤ 2.5 s), rankRecovered (grey → colour re-ignite), streak (flame flare + number), streakReset (beads drain), formed (badge unlock + fireworks via canvas-confetti), eternal (cosmic emblem, then "Moved to Hall of Fame"). Auto-advance after the animation; tap skips. When `settings.sound` is on, play short chimes synthesised with the Web Audio API (rising for wins, low thud for losses), so there are no audio files to bundle.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(ui): celebration overlays and stale session dialog`.

---

### Task 11: Habit detail, Hall of Fame, Settings

**Files:**
- Create: `src/ui/screens/HabitDetail.tsx`, `HallOfFame.tsx`, `Settings.tsx`, `src/ui/overlay/PermissionBanner.tsx`
- Test: `tests/ui/screens.test.tsx`

**Interfaces:**
- Consumes: `useApp`, art components, `exportBackup`/`parseBackup`/`importBackup`, `notificationPermission`.

- [ ] **Step 1: Write failing tests:** detail shows Ladder, Heatmap for the current month with prev/next month arrows, badge cabinet (Formed badge + reached tiers, lost tiers greyed), stats (total hours, longest streak, overtime), and session list newest first; delete requires confirm and returns home; Hall of Fame lists eternal habits only, and deleting one needs two confirmations; Settings export triggers share/download of `skillup-backup-YYYY-MM-DD.json`; import of an invalid file shows its error and does not call `importBackup`; a valid file shows a preview ("2 habits, 143 sessions will replace current data") and imports on confirm; PermissionBanner shows on Home when permission is `denied`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Export: on native use `Filesystem.writeFile` (Cache dir) + `Share.share`; on web use a Blob download. Import: `<input type="file" accept="application/json">`. The banner button opens app settings via `@capacitor/app`/Android intent fallback text.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(ui): detail, hall of fame, settings, backup`.

---

### Task 12: Android build, icons and device check

**Files:**
- Create: `capacitor.config.ts`, `scripts/render-icons.mjs`, `android/` (generated), `docs/BUILD-ANDROID.md`
- Modify: `package.json` scripts

**Interfaces:**
- Consumes: `emblemSvg` (Task 8), `registerNotificationActions` (Task 7).

- [ ] **Step 1:** `npx cap init SkillUp com.skillup.app --web-dir dist`; `npx cap add android`.
- [ ] **Step 2:** `scripts/render-icons.mjs` (run via `tsx`): render `emblemSvg(1..10)` to `android/app/src/main/res/drawable/rank_1.png … rank_10.png` (256 px) with @resvg/resvg-js; render a white monochrome flame to `drawable/ic_stat_flame.png` (96 px) as the notification small icon; render the tier-10 emblem on a dark background as the launcher icon and splash source. Wire `largeIcon: 'rank_N'` from `largeIconTier` in `applySchedule`, `smallIcon: 'ic_stat_flame'`.
- [ ] **Step 3:** Add scripts: `"android": "npm run build && tsx scripts/render-icons.mjs && npx cap sync android"`, `"apk": "npm run android && cd android && gradlew assembleDebug"`. Add `POST_NOTIFICATIONS` and `SCHEDULE_EXACT_ALARM` to `AndroidManifest.xml` and set `allowWhileIdle: true` on scheduled notifications so reminders fire in Doze.
- [ ] **Step 4:** Run `npm run apk`. Expected: `android/app/build/outputs/apk/debug/app-debug.apk` exists. (Requires Android Studio / JDK 17. `docs/BUILD-ANDROID.md` lists one-time setup and how to install the APK via USB or file transfer.)
- [ ] **Step 5: Device checklist** (record results in `docs/BUILD-ANDROID.md`): permission prompt on first launch; set a reminder 2 min ahead, kill the app → it arrives with the rank emblem; start timer → ongoing notification, Stop action stops it; reaching commitment → confetti + vibration; reboot phone mid-session → timer still correct; reduce-motion respected; export then import backup.
- [ ] **Step 6:** Run `npm test`. Expected: all PASS.
- [ ] **Step 7:** Commit `build(android): capacitor project, icons, build docs`.
