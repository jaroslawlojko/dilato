# Dilato — MVP Design Spec

- **Date:** 2026-09-29
- **Status:** Approved by the owner on 2026-09-29; clarified during plan 1 execution (see §13).
- **Source of truth for look & copy:** `stylebook/` (Stylebook v1.0, open `stylebook/index.html`)
- **Content tables:** `docs/content/`

---

## 1. Purpose

Dilato is a smoking-cessation app built on **delay, not abstinence**: each day the user pushes their *first* cigarette a little later — 30 minutes, an hour, a day — until it disappears over the horizon. The strongest craving comes in the morning after a night without nicotine; Dilato fights only that one moment.

**Audience:** daily smokers who have already tried "quitting from tomorrow" and find 30 minutes easier to commit to than a lifetime.

**Product principles (from stylebook "00 Okładka"):**
1. **Declaration, not control** — the user picks the challenge and taps start; the app takes their word.
2. **Small steps, distant horizon** — the user sets the pace.
3. **Reward, don't scare** — show what the body gains; no diseased-lung imagery, no fear counters.
4. **Failure is also a result** — "Tym razem się nie udało" saves earned minutes; badges are never lost.

### 1.1 MVP goal and success criteria

| Decision | Value |
|---|---|
| Release type | Public store launch (MVP) |
| Platforms | iOS (App Store) + Android (Google Play) at launch |
| Languages | Polish + English at launch |
| Accounts | Required; email + password only (social logins later) |
| Business model | Free, no payments, no ads |

The MVP is successful when a new user can install from either store, create an account, complete onboarding, run daily delay challenges end-to-end (start → craving help → success/overtime or interruption), see badges, body benefits and progress, and keep all data across reinstall/new device — with the app behaving correctly while closed or offline.

### 1.2 Out of scope for MVP

- Multi-day challenges (stylebook S13) and any ladder step above 24 h
- Location-based reminders ("Gdy dotrę na przystanek")
- Social logins (Apple / Google), magic links
- Payments, subscriptions, ads
- Product analytics SDKs
- Home-screen widgets (the Live Activity is in scope; widgets are not)

---

## 2. Architecture

### 2.1 Stack

| Concern | Choice |
|---|---|
| App framework | Expo (React Native), TypeScript strict, `expo-router` |
| Graphics / animation | `react-native-svg` + `react-native-reanimated` (horizon clock, sunrise) |
| Local storage | `expo-sqlite` — **local source of truth** |
| Backend | Supabase, **EU region**: Postgres + Row Level Security, Auth (email + password), Edge Functions |
| Secure session storage | `expo-secure-store` |
| Notifications | `expo-notifications` (local, scheduled on device) |
| Lock-screen timer | iOS: Live Activity via a Swift widget-extension target; Android: ongoing notification with chronometer |
| Sharing | `react-native-view-shot` + system share sheet |
| i18n | `i18next` + `react-i18next`, `expo-localization` |
| Crash reporting | Sentry (no PII, no health data in events) |
| Build & release | EAS Build / Submit / Update (OTA for JS + copy) |
| Tests | Jest, React Native Testing Library, Maestro (E2E) |

### 2.2 Repository layout

```
Dilato/
├─ stylebook/                    reference only — never imported by the app
├─ docs/
│  ├─ superpowers/specs/         this spec
│  ├─ superpowers/plans/         implementation plan(s)
│  └─ content/                   source tables for all user-facing copy (PL + EN)
├─ app/                          Expo project
│  ├─ app/                       expo-router routes
│  │  ├─ (onboarding)/           welcome, explainer, account, habit, moment, notifications
│  │  ├─ (auth)/                 login, forgot-password, verify-email
│  │  ├─ (tabs)/                 dzis, cialo, odznaki, postep
│  │  ├─ challenge/              morning-question, pick, timer, craving, success, interrupt, result, celebration
│  │  └─ settings/
│  ├─ src/domain/                PURE TypeScript: ladder, suggestion, challenge state machine,
│  │                             badges, body thresholds, stats, day boundary, savings
│  ├─ src/data/                  SQLite schema + repositories, outbox, sync engine, Supabase client
│  ├─ src/ui/                    tokens (color, type, space, radius) + components
│  ├─ src/platform/              notifications, live activity bridge, haptics, share card
│  ├─ src/i18n/                  pl.json, en.json
│  └─ targets/live-activity/     Swift widget extension (iOS)
├─ supabase/
│  ├─ migrations/                SQL schema + RLS policies
│  └─ functions/delete-account/  Edge Function
└─ CLAUDE.md
```

### 2.3 Invariants

1. **`src/domain` is pure.** No React, no I/O, no `Date.now()` — the current time is always passed in. Every rule in §4 lives here and is unit-tested.
2. **Clocks are derived, never counted.** A running challenge is `started_at` + `target_at`; elapsed = `now − started_at`. Nothing depends on a JS timer surviving; the app can be killed, backgrounded or rebooted mid-challenge.
3. **Offline-first.** UI reads and writes SQLite only. Every write also appends to an outbox; the sync engine pushes it to Supabase in the background.
4. **No red, no ash grey.** No state is an "error". Interruption uses Zmierzch (#5F559A); missing data uses Piasek (#F3EADC).
5. **All user-facing strings come from i18n files.** No hard-coded copy in components.

---

## 3. Data model

All tables exist in SQLite (local) and Postgres (Supabase) with identical columns. IDs are UUIDs generated on the client. Every table has `user_id`, `created_at`, `updated_at`, `deleted_at` (soft delete for sync). Timestamps are stored in UTC ISO-8601.

### 3.1 `profiles` (one row per user)

| Column | Type | Notes |
|---|---|---|
| `locale` | `'pl' \| 'en'` | defaults from device |
| `habit_profile` | `'wake' \| 'coffee' \| 'situation' \| 'later'` | S02 |
| `cigs_per_day` | int 1–80 | S02 |
| `pack_price` | decimal | S02, prefilled 18 (PLN) / 7 (EUR) / 8 (USD) / 15 (GBP) by locale/region |
| `pack_size` | int | default 20 |
| `currency` | `'PLN' \| 'EUR' \| 'USD' \| 'GBP'` | from device region, editable |
| `moment_label` | text | S02b, e.g. "wyjście z autobusu" |
| `usual_time` | `HH:mm` local | S02b "Zwykle około 7:10" |
| `reminder_mode` | `'time' \| 'none'` | S02b |
| `reminder_time` | `HH:mm` local | default `usual_time − 5 min` |
| `reminder_days` | int bitmask Mon–Sun | default Mon–Fri |
| `grammar_form` | `'neutral' \| 'f' \| 'm'` | Polish verb forms ("sam/sama"); default `neutral` |
| `theme` | `'system' \| 'light' \| 'dark'` | default `system` |
| `health_consent_at` | timestamp | GDPR Art. 9 explicit consent |
| `terms_accepted_at` | timestamp | |
| `best_smoke_free_minutes` | int ≥ 0 | highest smoke-free value ever reached; never lowered (§4.8); sync merges by max |

### 3.2 `challenges` (at most one per day)

| Column | Type | Notes |
|---|---|---|
| `day` | date | "Dilato day" per §4.1 |
| `ladder_key` | ladder key or `'custom'` | step chosen on S04 (§4.2) |
| `last_cigarette_at` | timestamp | answer to the morning question |
| `started_at` | timestamp | tap on "Zaczynam" |
| `target_kind` | `'minutes' \| 'until_noon' \| 'until_evening'` | |
| `target_minutes` | int | resolved at start for all kinds |
| `target_at` | timestamp | `started_at + target_minutes` |
| `status` | `'running' \| 'achieved' \| 'overtime' \| 'completed' \| 'interrupted'` | §4.5 |
| `achieved_at` | timestamp? | = `target_at` when reached |
| `overtime_block_started_at` | timestamp? | start of the current overtime block (tap on "Dokładam") |
| `overtime_block_minutes` | int? | length of the current block: 15, 30 or 60 |
| `overtime_minutes` | int | overtime completed so far (finished blocks + partial block on close) |
| `overtime_blocks_completed` | int | number of fully completed blocks (for the Dokładka badge) |
| `ended_at` | timestamp? | |
| `result_minutes` | int? | §4.6 |
| `first_cigarette_at` | timestamp? | = `ended_at` (§4.7) |
| `used_craving_help` | bool | true if any craving session during this challenge |
| `last_seen_at` | timestamp | last time the app showed this challenge in the foreground (set at start) |
| `confirmed_at` | timestamp? | answer to the "Nadal trwa?" sheet (§4.5) |

### 3.3 `craving_sessions`

`challenge_id`, `started_at`, `ended_at`, `technique` (`'breathing' \| 'water' \| 'walk' \| 'hands' \| 'message'`).

### 3.4 `badges_earned`

`badge_id` (string key, see `docs/content/badges.md`), `first_earned_at`, `last_earned_at`, `times` (≥1; only "Nowy rekord" increments), `challenge_id` (of first earning). Unique on (`user_id`, `badge_id`). Badges are never deleted except by account deletion.

### 3.5 Local-only tables

- `outbox` — `table_name`, `row_id` (together the key: one pending entry per row, replaced on each write), `op` (`'upsert'`; soft deletes are upserts), `payload` (the stored row as JSON), `attempts`, `next_attempt_at`, `created_at`.
- `sync_state` — last successful pull timestamp per table (created by plan 4).
- `notification_log` — scheduled/sent notifications per day (enforces the daily cap) (created by plan 5).

---

## 4. Domain rules (`src/domain`)

### 4.1 Day boundary

A "Dilato day" runs from **04:00 to 03:59 local time** (device's current time zone), so late smokers don't split one night across two days. At most **one challenge per day**; overtime extends it, it never creates a second one.

### 4.2 Delay ladder

Ordered steps:

| Key | Target |
|---|---|
| `m15` | 15 min |
| `m30` | 30 min |
| `m45` | 45 min |
| `h1` | 1 h |
| `h1_5` | 1.5 h |
| `h2` | 2 h |
| `h3` | 3 h |
| `noon` | until 12:00 local |
| `evening` | until 20:00 local |
| `h24` | 24 h |
| `custom` | user-entered, 15 min – 24 h, 5-min granularity |

The ladder has **no steps below 15 min**. `m15` is available to everyone but is never the default suggestion (§4.3–4.4).

- `noon` / `evening` resolve to minutes at start time; they are **hidden** in the picker when fewer than 15 minutes remain until 12:00 / 20:00.
- For ordering and suggestions, `noon` and `evening` sit at their fixed position in the list above regardless of their resolved minutes.
- `custom` is never suggested; it counts as the nearest ladder step at or below its value for suggestion purposes.

### 4.3 Starting ladder per profile

The first suggestion and the four steps shown in onboarding (S02b "Twoja pierwsza drabina"):

| Profile | First ladder | First suggestion |
|---|---|---|
| `wake` | 30 · 45 min · 1 h · 1.5 h | 30 min |
| `coffee` | 30 · 45 min · 1 h · 2 h | 30 min |
| `situation` | 30 min · 1 h · 2 h · 3 h | 30 min |
| `later` | 30 min · 1 h · 2 h · do wieczora | 30 min |

The **first suggestion is 30 min for every profile.** Profiles differ in the size of the steps shown in the preview (smaller for `wake`, larger for `situation`/`later`). 15 min can always be picked manually.

**Heavier habit (`cigs_per_day > 20`):** the suggestion climbs more slowly: it takes **3** successes in a row, not 2, to suggest the next step (§4.4).

### 4.4 Daily suggestion

Computed each day from the history of closed challenges:

1. No history → first suggestion (§4.3).
2. Last two (or three, if `cigs_per_day > 20`) closed challenges all `completed` **at the same step** as the last one → suggest **one step above** the last target. (30 ✓ 30 ✓ → 45; then 45 ✓ → still 45; 45 ✓ 45 ✓ → 1 h.) Custom targets count as their nearest ladder step at or below.
3. Last closed challenge `interrupted` → suggest the **same step** as default (floored at 30 min per rule 5), and show the step below that suggestion as a highlighted alternative (S09 "Plan na jutro"). The alternative may be 15 min.
4. Otherwise → the same step as the last target.
5. The default suggestion never goes below 30 min. A last target of 15 min (chosen manually) is suggested as 30 min.

The user can always pick any step, including jumps of several steps. A "plan for tomorrow" chosen on S09 overrides the computed suggestion for the next day.

If the suggested step (or a plan for tomorrow) cannot be started at the moment it is shown — `noon` / `evening` past their cutoff (§4.2) — the nearest available step below it is offered instead.

### 4.5 Challenge state machine

```
            start
  (ready) ────────▶ running ──── now ≥ target_at ───▶ achieved ◀──── block reached ──┐
                       │                               │     └──"Dokładam X"──▶ overtime
            "Tym razem się nie udało"         "Na dziś wystarczy"                    │
                       ▼                      or next day rollover     "Tym razem się nie udało"
                  interrupted                          ▼                             ▼
                                                   completed ◀───────────────────────┘
```

- `achieved` is derived: any read of a `running` challenge with `now ≥ target_at` transitions it to `achieved` with `achieved_at = target_at` (not `now`).
- From `achieved` the user may add an overtime block of 15, 30 or 60 minutes. The block starts at the tap (time between reaching the goal and tapping does not count). When the block is reached (derived, like `achieved`), the challenge returns to `achieved`: `overtime_minutes += block`, `overtime_blocks_completed += 1`, `achieved_at = block end`. The S07 offer then repeats.
- Tapping "Tym razem się nie udało" during `overtime` closes the challenge as **`completed`** (the goal was reached); only the completed part of overtime counts.
- "Na dziś wystarczy" closes the challenge as `completed` with `ended_at = now`. An `achieved` challenge left untouched is closed as `completed` at the next day rollover, with `ended_at = achieved_at` (the moment the goal or last block was reached). "Next day rollover" means the first 04:00 boundary after `achieved_at`, not after the start day: a goal reached on a later Dilato day (e.g. a 24 h challenge) stays `achieved` until the following rollover. An overtime block in progress is never cut at 04:00: it runs to its end, the challenge returns to `achieved`, and it is closed at the following rollover.
- **Confirmation check ("Nadal trwa?"):** if a challenge reached `achieved` (or was auto-completed at rollover) without the app having been opened at or after `target_at` (i.e. `last_seen_at < target_at`) and `confirmed_at` is empty, the next app open shows a gentle sheet: "Tak, udało się" keeps it; "Zapaliłem(-am) wcześniej" changes it to `interrupted` with a user-entered time between `started_at` and `target_at`. Badges already awarded by that challenge stay (badges are never lost); the record is recomputed. Both answers are only accepted while this confirmation is pending.

### 4.6 Result

- `completed`: `result_minutes = target_minutes + overtime_minutes`.
- `interrupted`: `result_minutes = floor((ended_at − started_at) / 60 s)`.

### 4.7 Smoke-free time ("Czas bez dymu")

- The morning question "Ostatni papieros wczoraj o…?" (shown before S04 on the first challenge of the day) stores `last_cigarette_at`. Default = same local time as the previous answer; first ever default = 22:00 yesterday.
- The first cigarette of the day is **assumed to happen when the challenge ends** (`first_cigarette_at = ended_at`).
- `smoke_free_minutes(challenge) = first_cigarette_at − last_cigarette_at`; while running: `now − last_cigarette_at`.
- Before a challenge is started today, S03 shows the live value `now − last_cigarette_at` using yesterday's default answer (labelled "od wczoraj, 22:05").
- **Longest smoke-free** = max over all closed challenges (S10 "Najdłużej bez dymu").

### 4.8 Body benefits

Ten thresholds (5 min, 20 min, 8 h, 12 h, 24 h, 48 h, 72 h, 2 weeks, 1 month, 1 year) — content in `docs/content/body-benefits.md`. A card is **unlocked** when `max(longest_smoke_free, current_live_smoke_free) ≥ threshold`. Unlocks are permanent. Permanence is a persistence rule: the data layer stores the highest smoke-free value ever reached and never lowers it, because an untouched `achieved` challenge keeps counting live until rollover closes it at its goal time (§4.5). S10 shows the next locked threshold with a percent progress and a tip ("Najbliżej, gdy wybierzesz wyzwanie «do wieczora»"). Three extra "poza ciałem" cards (money, time, smell) are always visible with live values.

### 4.9 Badges

Full list and copy in `docs/content/badges.md`.

- **Threshold badges** are awarded when a challenge's `result_minutes` (target + overtime) reaches the threshold; overtime can award badges mid-overtime.
  - Earnable in MVP: 15, 30, 45 min, 1, 2, 3, 6, 12, 24 h. The 15-min badge ("Pierwszy krok") is earned by any result ≥ 15 min, including a 30-min goal.
  - Shown locked with label "wkrótce" / "coming soon": 48 h, 72 h, 7, 14, 30, 90, 365 days.
- **Attitude badges:**

| Key | Rule |
|---|---|
| `five_mornings` | 5 consecutive Dilato days with a started challenge (any outcome) |
| `extra_time` | first time an overtime block is fully completed |
| `honesty` | an `interrupted` challenge followed by a started challenge on the next Dilato day |
| `new_record` | `result_minutes` exceeds the previous record (requires a previous record > 0); repeatable (`times++`) |
| `wave_master` | 3 `completed` challenges (cumulative) where `used_craving_help = true` |
| `piggy_bank` | cumulative savings ≥ 100 PLN / 25 EUR / 25 USD / 20 GBP (in the profile's currency) |

- The badge counter on S11 is "X z 22".
- A newly earned badge shows a gold ring and "Nowa" / "New" label for 24 h.

### 4.10 Celebration tier

Chosen by the **highest threshold badge earned** by the event (or, if none, by target size):

| Tier | When | UI |
|---|---|---|
| Small | minute thresholds (≤ 45 min) | toast at bottom + light haptic + arc turns gold |
| Medium | hour thresholds (1–12 h) | full screen S07 with badge, unlocked body benefits, overtime offer |
| Large | 24 h | full-screen sunrise animation, "list od Twojego ciała", share card, then S07 choices |

For the small tier the overtime choice still appears as a bottom sheet on the timer screen.

### 4.11 Statistics

- **Morning streak:** consecutive Dilato days (ending today or yesterday) with a started challenge, any outcome.
- **Record:** max `result_minutes`; the date is shown with it.
- **7-day average:** mean `result_minutes` over challenges in the last 7 Dilato days (days without a challenge excluded).
- **Savings (≈):** `Σ result_minutes ÷ (960 ÷ cigs_per_day) × (pack_price ÷ pack_size)`, where 960 = minutes in a 16-h waking day; always shown with "≈" and "szacunek".
- **Linia (S12):** one row per day for the last 14 days or 1 month; the bar starts at `usual_time` and extends by `result_minutes`; colour = success (Słońce), record (Wschód), interrupted (Zmierzch); days without a challenge are drawn as empty Piasek rows.

---

## 5. Screens & navigation

Route groups: `(onboarding)`, `(auth)`, `(tabs)`, `challenge`, `settings`. Stylebook IDs refer to `stylebook/project/S*.dc.html`. Screens marked **new** are not in the stylebook and must be designed from its tokens/components before implementation.

### 5.1 First launch

1. **S01 Powitanie** — "Zaczynamy" → step 1; "Jak to działa? · 1 min" → **new** 3-card explainer (daily loop, two clocks, failure is a result).
2. **Krok 1 z 3 — Konto (new)** — email, password (min. 8 chars), consent checkboxes: terms + privacy (required), processing of health-related data (required, GDPR Art. 9). Link "Mam już konto" → login; after login of an existing user with a complete profile, go straight to tabs.
3. **Krok 2 z 3 — S02** — habit profile (4 options), cigarettes per day stepper, **added**: pack price + currency.
4. **Krok 3 z 3 — S02b** — moment label, usual time, reminder (`time` / `none`; the location option is not shown in MVP), first ladder preview. "Gotowe — do jutra rana".
5. **Notification pre-prompt (new)** — explains the ≤4 kind notifications, then triggers the system permission dialog. Declining is fine; Settings can re-request.

Email verification: Supabase sends a confirmation email; the user may continue onboarding immediately and use the app locally; sync starts once the email is verified. Dziś shows a calm banner until then.

### 5.2 Tabs (bottom navigation: Dziś · Ciało · Odznaki · Postęp)

- **Dziś — S03:** date, greeting, smoke-free tile, today's challenge card (suggestion, moment, yesterday's result, suggestion reason), "Zaczynam — X", "Wybierz inny próg", record + streak tiles. Gear icon → Settings. If a challenge is running, the card becomes "Wyzwanie trwa" → opens the timer. If today's challenge is closed, the card shows today's result and "Do jutra".
- **Ciało — S10**, **Odznaki — S11** (tap → **new** badge detail sheet), **Postęp — S12**.

### 5.3 Challenge flow (full screen, tabs hidden)

1. **Morning question (new sheet)** — time picker "Ostatni papieros wczoraj o…", prefilled.
2. **S04 Wybór wyzwania** — chips (default / recommended / already earned / custom), badge to earn, body benefit on the way, CTA "Deklaruję: X".
3. **S05 Timer** — dark (Noc) screen with the horizon clock (§6.3), remaining time, elapsed, target time, smoke-free tile, next badge, "Teraz w Twoim ciele" card, "Mam głód — pomóż mi przeczekać", quiet "Tym razem się nie udało". The chevron minimises to Dziś (challenge keeps running).
4. **S06 Pomoc na głód** — breathing circle 4-4-6, wave duration counter, alternative techniques, "Fala minęła — wracam do wyzwania". Creates a `craving_sessions` row.
5. **S07 Cel osiągnięty** / small-tier toast / large-tier celebration (§4.10).
6. **S08 Tym razem się nie udało** — confirmation sheet (Lawenda) with result; "Tak, zapisz wynik" / "Jednak wracam do wyzwania".
7. **S09 Wynik zapisany** — today / 7-day average / start; plan for tomorrow chips; "Ustaw plan na jutro".

### 5.4 Settings (new)

Profile (habit, cigs/day, moment, usual time), reminder (mode, time, days), pack price & currency, language, grammar form, theme, change password, log out, export my data (JSON via share sheet), delete account (confirmation, calls Edge Function), privacy policy, terms, app version.

### 5.5 Auth (new)

Login, forgot password (Supabase reset email → deep link → set new password), email verification landing.

### 5.6 Theming

- Light theme (Kremowy świt background) by default; dark theme per stylebook ("Tryb ciemny": Noc background, cards #1E2F3B, text #FBF6EE / #A9B6BE) following `profiles.theme`.
- The timer, craving and celebration screens are always dark (Noc), regardless of theme.

---

## 6. UI system (`src/ui`)

### 6.1 Tokens (literal from stylebook "02 Kolor, typografia, głos")

| Token | Hex | Use |
|---|---|---|
| `sunrise` (Wschód) | #C2551F | primary action, active challenge |
| `dawn` (Brzask) | #F8DCC8 | highlights, "minutes" tier |
| `sun` (Słońce) | #E9A93A | badges, goal, records (ink text only) |
| `goldenMorning` (Złoty ranek) | #FBEBC8 | success backgrounds, "hours" tier |
| `breath` (Oddech) | #1F7A6D | body & health |
| `mint` (Mięta) | #D6ECE6 | benefit cards, "days" tier |
| `dusk` (Zmierzch) | #5F559A | interrupted (replaces red) |
| `lavender` (Lawenda) | #E6E2F3 | sheets after interruption |
| `night` (Noc) | #13202A | running-challenge background |
| `ink` (Atrament) | #1B2A33 | primary text, "weeks+" tier |
| `cream` (Kremowy świt) | #FBF6EE | app background; cards #FFFFFF |
| `sand` (Piasek) | #F3EADC | secondary surfaces; line #E6DCCB |
| text secondary / caption / accent | #4A5963 / #5E6A73 / #A8461A | |

Typography: **Fraunces** (headings, clock digits, badge names) and **Manrope** (UI, body, labels) via `expo-font`. Scale: Display 48/52, Clock 64 weight 300, H1 32/38, H2 22/28, Body 16/24 w500, Label 12 w700, Caption 13/18. Radii: chip 12, card 20, sheet 28, pill for buttons. Spacing grid 4 pt; steps 8/12/16/24/32; screen margin 20; min touch target 48. Icons: 24 px, stroke 1.75, round caps.

### 6.2 Components

From stylebook "03 Komponenty": Button (primary 56 / secondary 52 / quiet text 48; one Wschód action per screen; "Tym razem się nie udało" always quiet, never red), ChallengeChip (default / selected / recommended / earned / custom), HorizonClock, StatTile, BadgeMark (4 sky tiers + locked + "Nowa"), BenefitCard (unlocked / next / locked), BottomNav, Toast, Sheet, LineChart row (S12).

### 6.3 Horizon clock

An arc from the left to the right edge of the horizon; the sun rises at start, moves along the arc and reaches the goal, turning the whole arc gold. The sun has a 25% glow. In overtime the arc stays gold and a second, thinner arc in Wschód is drawn above it. Motion: smooth per-second movement, no pulsing. Progress = `(now − started_at) / (target_at − started_at)`, clamped to [0, 1].

---

## 7. Platform features (`src/platform`)

### 7.1 Local notifications (max 4 per Dilato day)

| Key | Trigger | Copy source |
|---|---|---|
| `wake` | `reminder_time` on `reminder_days`, if no challenge started today | `notifications.md` |
| `half` | challenge 50% elapsed (only if target ≥ 30 min) | |
| `five_left` | 5 min before `target_at` (only if target ≥ 15 min) | |
| `goal` | at `target_at` | |
| `after_break` | next morning at `reminder_time` after an interrupted day, **replaces** `wake` | |

- The notifications of a challenge are scheduled on start and cancelled on end.
- `notification_log` enforces the cap: priority order is `goal` > `wake`/`after_break` > `five_left` > `half`.
- For the `wake` profile the reminder is the usual wake-up time. iOS does not allow detecting alarm dismissal, so this is a scheduled time only.
- Tapping a notification deep-links to the right screen.

### 7.2 Lock-screen timer

- **iOS Live Activity:** started on challenge start (and on entering overtime), ended when the challenge closes. It shows a mini horizon arc, the remaining time (`Text(timerInterval:)` so it counts down without updates) and the target time. Updated locally only — no push server. Dynamic Island compact view shows the sun icon and the remaining time.
- **Android:** an ongoing, non-dismissable notification with a countdown chronometer, removed when the challenge closes.
- If the user has disabled Live Activities / notifications, the app behaves normally without them.

### 7.3 Share card (large celebration)

An image (1080×1350) rendered from a React view: horizon mark, sunrise, threshold ("24 h"), badge name, "Dilato" wordmark. It contains **no health data and no personal data**, and is shared via the system share sheet.

### 7.4 Haptics

A light impact on a small celebration; success notification haptics on medium/large.

---

## 8. Sync, auth & error handling (`src/data`)

- **Writes:** SQLite transaction + outbox row. The sync engine flushes the outbox on app start, on foreground, on connectivity regained, and after each write (debounced 2 s). Retries use exponential backoff (5 s → 10 min cap).
- **Conflict resolution:** row-level last-write-wins by `updated_at` (client clock). Acceptable because multi-device concurrent use is rare. `badges_earned` merges by taking `min(first_earned_at)` and `max(times)`.
- **Pull:** on login and on foreground, fetch rows with `updated_at > sync_state.last_pull` per table.
- **New device / reinstall:** after login, a full pull runs before showing tabs, with a calm loading state ("Wczytujemy Twoje poranki…").
- **Auth:** the Supabase session is stored in SecureStore and refreshed automatically. If the refresh fails while offline, the app keeps working locally and retries later; if the refresh token is invalid, the user is asked to log in again and no local data is discarded until a successful login under the same user id. Logging out asks for confirmation and deletes the local DB after a final outbox flush, or warns if unsent changes remain.
- **Error copy:** calm, never red, never blaming. Example: "Zapiszemy, gdy wróci internet." Network state is shown only when relevant (e.g. on data export or account deletion).
- **Time:** stored in UTC. Day boundary and `noon`/`evening` use the device's current zone. Time-zone or clock changes during a challenge are safe because elapsed time is a timestamp difference.

---

## 9. Privacy, security & legal

- Smoking-habit data is treated as **health data (GDPR Art. 9)**: explicit, separate consent at registration, stored with a timestamp. Without it the account cannot be created.
- Supabase project in an **EU region**. RLS is enabled on every table with policy `user_id = auth.uid()` for select/insert/update/delete.
- **Data export:** Settings → JSON file with all the user's rows (local DB after sync).
- **Account deletion:** Settings → confirmation → `delete-account` Edge Function (service role) deletes all rows and the auth user; then local wipe. Required by App Store guideline 5.1.1(v).
- No analytics or advertising SDKs. Sentry is configured with `sendDefaultPii: false` and strips breadcrumbs containing app data.
- Store compliance: App Store privacy nutrition labels ("Health & Fitness" data linked to the user, not used for tracking), Google Play Data Safety form, and the age rating in line with tobacco-related content (no promotion).
- **Owner deliverables before submission:** privacy policy and terms of service in PL + EN, hosted at a public URL; a support email/URL.

---

## 10. Content & localisation

- All copy lives in `app/src/i18n/pl.json` and `en.json`. `docs/content/*.md` are the editable source tables (PL + EN side by side); the implementation copies them into JSON.
- Polish copy follows `docs/content/voice.md`: second person "Ty", gender-neutral by default, `grammar_form` selects forms where neutrality is impossible.
- Body-benefit copy uses "zwykle", "zaczyna", "mniej więcej"; benefits only.
- **Launch blocker:** every body-benefit card must have `medical_review: approved` in `docs/content/body-benefits.md` before store submission. The English copy is drafted for review by a native speaker.

---

## 11. Testing strategy

| Layer | Tooling | Coverage expectation |
|---|---|---|
| `src/domain` | Jest, TDD | every rule in §4: ladder availability (profile, noon/evening cutoff), suggestion cases, state transitions incl. derived `achieved` and rollover auto-close, result math, smoke-free, body unlocks, each badge rule, streak across the 04:00 boundary and DST changes, savings per currency |
| `src/data` | Jest + in-memory SQLite; local Supabase (`supabase start`) | repositories, outbox retry/backoff, LWW merge, badge merge, full pull; **RLS isolation test**: user A cannot read or write user B's rows |
| `src/ui` | React Native Testing Library | components render all states; accessibility labels; no hard-coded strings |
| E2E | Maestro, iOS simulator + Android emulator | onboarding → first challenge → success → overtime; start → interrupt → result → plan for tomorrow; kill app mid-challenge → reopen shows correct remaining time |
| Manual device checklist | real iPhone + Android phone | Live Activity/Dynamic Island, ongoing notification, notification cap, deep links, time-zone change mid-challenge, offline for a day then reconnect |

---

## 12. Release

- EAS profiles: `development` (dev client), `preview` (internal distribution), `production`.
- Distribution: TestFlight + Google Play Internal Testing before public release.
- EAS Update for JS and copy fixes (e.g. after the medical review); native changes require a store build.
- Store assets: app icon derived from the horizon mark; screenshots and listings in PL + EN.
- Bundle ids and the Supabase project are created by the owner at plan execution time.

---

## 13. Resolved gaps (decisions not stated in the stylebook)

1. Day boundary at 04:00 local; one challenge per day.
2. The first cigarette is assumed at challenge end.
3. The savings formula uses a 16-h waking day.
4. The ladder minimum is 15 min and the first suggestion is 30 min for every profile. Profile starting ladders differ from the Method board (which starts `wake` at 5 min). The ">20 cigs/day" rule slows progression (3 successes to step up). **S01 and cover copy "15 minut później" becomes "30 minut później"** (see `docs/content/voice.md`).
5. The onboarding "Krok 1 z 3" is account creation (the stylebook shows steps 2 and 3 only).
6. Pack price is collected on S02.
7. The Skarbonka threshold per currency.
8. An unanswered `achieved` auto-completes at rollover.
9. No bonus badges below 15 min; the badge total is 22 for everyone.
10. Celebration tier selection (§4.10).
11. Rollover is measured from `achieved_at`, and an overtime block crossing 04:00 runs to its end (§4.5).
12. A suggestion that cannot be started at display time falls back to the nearest available step below (§4.4).
13. Body-benefit unlocks are kept permanent by persisting the highest smoke-free value ever reached (§4.8).
14. "Nadal trwa?" answers are accepted only while the confirmation is pending; user transitions on a challenge already closed by rollover are rejected (§4.5).
