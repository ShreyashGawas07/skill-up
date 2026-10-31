# SkillUp — Habit Rank Tracker: Design Spec

Date: 2026-10-31
Status: Draft, awaiting review

## 1. Purpose

A personal Android app for building up to two serious habits (e.g. "Learn Japanese") by
committing a fixed number of hours every day. Phase one forms the habit: 30 consecutive
days at or above the commitment. Phase two is mastery: keep going until a target total
(default 10,000 h). Consistency is enforced like a competitive game's ranked ladder: hours
earn rank, missed days cost rank.

Single user, offline, no account, no server.

### Success criteria

- I can add up to 2 habits, time my sessions with a live timer, and see my day count toward
  my commitment.
- Missing a day has visible, painful consequences (streak reset, rank loss), and completing
  a day feels rewarding (animation, haptics, badges).
- Reminders arrive on time on my Android phone even when the app is closed and offline.
- The app is visual first: progress is shown with rings, badges, flames and calendars
  rather than paragraphs of text.

### Decisions made with the user

| Topic | Decision |
|---|---|
| Missed day during Days 1–30 | Hard reset of forming streak to Day 1; logged hours still count toward target |
| What counts as a day "done" | Timer total for that calendar day ≥ committed hours. Overtime is allowed and counts; undertime is a miss |
| Logging method | Live timer only. No manual entry of hours |
| Platform | Android |
| Approach | React web app wrapped as a native APK with Capacitor; local notifications; local data |
| Penalty after Day 30 | Gamified rank system: each miss = −2 tiers; each 7 consecutive done days restores 1 tier |
| Look & feel | Highly visual, animated, minimal text, game-like "dopamine" feedback |

## 2. Habit rules

### 2.1 Creating a habit

- Fields: name, icon (emoji/glyph picker), colour accent, daily commitment (0.25 h – 12 h in
  15-minute steps), target total hours (default 10,000), reminder time.
- Max **2 active habits**. The "+" slot is replaced by a locked slot graphic when both are
  used; tapping it explains "2 habits max — master or delete one to unlock".
- Daily commitment is **locked during Days 1–30** (Forming). Editable afterwards (applies
  from the next day).

### 2.2 Days

- A day is local midnight to midnight.
- **Done day:** sum of session minutes in that day ≥ commitment. Minutes beyond the
  commitment are **overtime**: they count toward total hours and are celebrated, but do not
  bank against future days.
- **Missed day:** any day after the creation day that is not done (including partial days).
- **Creation day:** counts as Day 1 if completed; if not completed, it is not a miss.
- A session crossing midnight is split at midnight; each part counts toward its own day.

### 2.3 Phases

- **Forming (Days 1–30):** each done day advances the forming counter. Any miss resets it to
  Day 1. Completing Day 30 awards the "Habit Formed" badge and moves to Mastery. Forming
  can only be completed once.
- **Mastery (after Day 30):** no forming counter; misses are penalised through rank only.
- **Eternal:** when total hours ≥ target the habit is complete, retired to the Hall of
  Fame, and its slot is freed. Eternal is permanent.

### 2.4 Rank system

Two quantities per habit:

- **Hours logged**: permanent, never reduced.
- **Rank**: `max(1, earnedTier − lostTiers)`.

**Earned tier** comes from hours, as a share of the target:

| Tier | Name | % of target | At 10,000 h |
|---|---|---|---|
| 1 | Novice | 0% | 0 h |
| 2 | Apprentice | 0.5% | 50 h |
| 3 | Adept | 2% | 200 h |
| 4 | Skilled | 5% | 500 h |
| 5 | Expert | 10% | 1,000 h |
| 6 | Elite | 20% | 2,000 h |
| 7 | Master | 40% | 4,000 h |
| 8 | Grandmaster | 65% | 6,500 h |
| 9 | Legend | 85% | 8,500 h |
| 10 | Eternal | 100% | 10,000 h |

**Penalties and recovery** apply in both phases:

- Each missed day: `lostTiers += 2`.
- `lostTiers` can grow beyond what is visible, but displayed rank never drops below Novice.
  To keep recovery bounded, `lostTiers` is capped at `earnedTier − 1` at the moment of
  each miss.
- Each run of 7 consecutive done days: `lostTiers −= 1` (min 0). The recovery counter
  resets on any miss and restarts after each restoration.
- During Forming, a miss also resets the forming counter (2.3).
- Reaching tier 10 (Eternal) by hours clears `lostTiers`. The target is complete.

**Streak flame:** current run of consecutive done days (all phases). Longest streak is kept.

### 2.5 Events

Replaying the history produces events, each shown once:
`DAY_COMPLETE`, `OVERTIME`, `STREAK_MILESTONE` (7, 14, 30, 50, 100, 365…), `RANK_UP`,
`RANK_LOST`, `RANK_RECOVERED`, `STREAK_RESET`, `HABIT_FORMED`, `ETERNAL`.

## 3. Visual & UX design

Principle: **show, don't tell.** Every number on the home screen has a graphic form; text
is short labels only. Large touch targets, one primary action per screen.

### 3.1 Theme

- Dark, game-like base (near-black with subtle gradient), plus a light theme that follows
  the system setting.
- Each tier has a colour and material: Novice stone grey, Apprentice bronze, Adept silver,
  Skilled gold, Expert emerald, Elite sapphire, Master amethyst, Grandmaster crimson,
  Legend prismatic, Eternal animated cosmic gold.
- Each habit carries its own accent colour on its card and ring.
- Typography: one bold display font for numbers and ranks (e.g. Google Font "Outfit" or
  "Rajdhani", bundled locally) and one clean body font.

### 3.2 Visual assets (created in code, no stock images)

- **Rank emblems:** 10 hand-built SVG badges with distinct shapes (shield, then winged
  shield, crown, star crest…) whose detail increases by tier. Higher tiers have animated
  glow and shimmer.
- **Progress ring:** the day's progress around the habit icon. When the commitment is met
  the ring closes with a burst; overtime then draws a second **golden "overdrive" ring**
  outside it.
- **Streak flame:** an animated flame whose size and colour grow with streak length
  (orange, then blue at 30, then violet at 100).
- **Forming track:** 30 dots/beads in a path that fill as days are done. A reset visibly
  drains them.
- **Calendar heatmap:** done = habit colour (brighter with overtime), missed = red cross,
  partial = dim, future = outline.
- **Empty-state illustrations:** an SVG scene for "no habits yet" and for the locked slot.
- **Android app icon and splash:** generated from the brand emblem.

### 3.3 Dopamine & achievement moments

| Moment | Effect |
|---|---|
| Timer start | Button morphs into a pulsing timer; soft haptic tick |
| Commitment reached (live, while timer runs) | Ring closes, confetti burst in habit colour, strong haptic, "+1 🔥" pops up, flame grows |
| Overtime | Golden overdrive ring starts; every extra 15 min shows a small "+15m" sparkle |
| Streak milestone | Full-screen flame flare with the milestone number |
| Rank up | Full-screen cinematic: old emblem shatters, new emblem rises with light rays, tier name slams in, heavy haptic |
| Rank recovered | Grey emblem re-ignites in colour |
| Rank lost | Emblem cracks and drops 2 steps on the ladder; red vignette; short, not punishing to sit through |
| Streak reset (Forming) | 30-bead track drains back to bead 1 |
| Habit Formed (Day 30) | Badge unlock with fireworks, and the badge added to the cabinet |
| Eternal | Longest celebration: cosmic emblem, then the habit flies into the Hall of Fame |

Rules: celebrations are skippable with a tap, never stack more than one full-screen moment
at a time (queued), and respect the system "reduce motion" setting (fade instead of
motion). An optional sound effects toggle is off by default.

### 3.4 Screens

1. **Home:** up to two large habit cards, each with emblem, ring with Start/Stop in the
   centre, flame + streak number, forming beads (or "Formed" badge), and a slim total
   hours bar to the next tier and target. An empty slot shows the "+" illustration.
2. **Habit detail:** a vertical rank ladder (current tier glowing, lost tiers cracked, next
   tier locked with hours remaining), calendar heatmap, badge cabinet grid, session list,
   and stats (total hours, longest streak, overtime total).
3. **Add/Edit habit:** a 4-step swipe flow (name+icon, then daily hours dial, then target,
   then reminder time), each step one visual control.
4. **Celebration overlay:** the full-screen moments in 3.3.
5. **Hall of Fame:** Eternal habits as trophies on a shelf.
6. **Settings:** theme, sound, reduce-motion override, notifications status, export/import
   backup.

## 4. Notifications

All scheduled locally with `@capacitor/local-notifications`. They work offline and with
the app closed. Messages rotate from a pool per type so they don't feel repetitive, and
include live context (rank name, minutes left, streak). Notification large icon = the
habit's current rank emblem (PNG rendered at build time).

| Type | When | Example copy |
|---|---|---|
| Daily reminder | User's chosen time, if not done | "🔥 Day 12 of 30. Your Japanese flame is waiting — 2h to go." / "Expert rank on the line. 2h. You've got this." |
| Last chance | 22:30, if not done | "⏳ 90 min left or Japanese drops 2 tiers to Adept." / "Your 23-day streak ends at midnight. Save it?" |
| Running session | While a timer runs (ongoing) | "🎧 Japanese — session running since 18:12" + **Stop** action |
| Day complete | When commitment is reached with the app in background | "✅ 2h done. Streak 24 🔥 — anything more is overtime glory." |
| Morning after a miss | 08:00 the day after a miss | "💔 You dropped to Skilled. 7 clean days wins a tier back." |

- "Day complete" is scheduled when a timer starts, for the moment the commitment will be
  reached, and is cancelled if the timer stops before then.
- Reminders for a habit are cancelled for the rest of the day once that day is done.
- All future notifications are rescheduled whenever the app opens, a session ends or a
  habit is edited.
- Known limit: the ongoing notification shows the start time, not a ticking clock. A live
  chronometer would need a custom native plugin and is out of scope for v1.

## 5. Architecture

### 5.1 Stack

Vite + React + TypeScript, Tailwind CSS, Framer Motion (animation), canvas-confetti,
Dexie (IndexedDB), Capacitor (Android) with `@capacitor/local-notifications`,
`@capacitor/haptics`, and `@capacitor/filesystem` + `@capacitor/share` for backup export.
Vitest + Testing Library for tests.

### 5.2 Data model (stored)

```ts
Habit {
  id, name, icon, color,
  dailyMinutes, targetHours, reminderTime,
  createdAt, commitmentHistory: { fromDate, dailyMinutes }[],
  archivedAt?
}
Session { id, habitId, start, end? }   // end undefined = running
SeenEvent { habitId, eventKey }        // eventKey e.g. "RANK_UP:2026-11-20:5"
Settings { theme, sound, reduceMotion }
```

Nothing derived (streak, rank, phase) is stored.

### 5.3 Rules engine

`evaluate(habit, sessions, now) → HabitState` is a pure function. It splits sessions into
per-day minutes, replays every day from creation to `now`, and returns:
`{ todayMinutes, dayStatus[], formingDay | 'formed', streak, longestStreak, earnedTier,
lostTiers, recoveryProgress, rank, totalMinutes, overtimeMinutes, badges, events[] }`.

Because the state is computed from scratch, days the app wasn't opened are handled
correctly, and no midnight job is needed.

### 5.4 Modules

- `src/domain/`: rules engine, tier table, date/day helpers. Pure TypeScript, no UI or I/O.
- `src/data/`: Dexie schema, repositories, backup export/import with schema validation.
- `src/timer/`: start/stop, single active timer (starting B stops A), stale-session check.
- `src/notify/`: builds and reschedules notification sets from `HabitState`; message pools.
- `src/ui/`: screens, components (Emblem, Ring, Flame, BeadTrack, Heatmap, Ladder),
  celebration queue.
- `android/`: Capacitor project, generated.

## 6. Error handling & edge cases

- **Running timer survives** app close or phone reboot (open session in the DB). A session
  open longer than 16 h asks "Did you forget to stop?" and lets you keep or trim it to the
  stop time you choose (trim only; no extending).
- **Notification permission denied:** a persistent banner on Home with a button to the
  system settings.
- **Import:** the file is validated (version + shape). A preview of what will be replaced
  is shown, and the import happens only after confirmation.
- **Clock changes:** not defended against (single user; cheating only cheats yourself).
- **Third habit attempt:** blocked by the locked slot.
- **Delete habit:** confirmation, then removed with its sessions. Eternal habits can't be
  deleted from the Hall of Fame by accident (double confirmation).

## 7. Testing

- **Rules engine, test-first (Vitest):** done/partial/miss days; overtime counted but not
  banked; midnight split; creation-day rule; forming reset; Day 30 formed; −2 tiers per
  miss with floor at Novice and cap; 7-day recovery and reset-on-miss; multi-day absence;
  earned tier thresholds for non-default targets; Eternal clears penalties; event dedupe.
- **Notification scheduler:** given a `HabitState` and time, the expected set of
  notifications (pure function, unit tested).
- **UI:** component tests for card states and the celebration queue.
- **On device:** build the debug APK, install it, and check reminders with the app killed,
  the running-session notification + Stop, haptics, and reduce motion.

## 8. Out of scope (v1)

Cloud sync, multiple devices, iOS, manual time entry, social/sharing, a live ticking
notification, home-screen widgets, statistics beyond those listed.
