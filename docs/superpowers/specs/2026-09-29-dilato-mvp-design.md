# Dilato — MVP Design Spec

- **Date:** 2026-09-29
- **Status:** Draft — awaiting owner review
- **Source of truth for look & copy:** `stylebook/` (Stylebook v1.0, open `stylebook/index.html`)
- **Content tables:** `docs/content/`

---

## 1. Purpose

Dilato is a smoking-cessation app built on **delay, not abstinence**: each day the user pushes their *first* cigarette a little later — 15 minutes, an hour, a day — until it disappears over the horizon. The strongest craving comes in the morning after a night without nicotine; Dilato fights only that one moment.

**Audience:** daily smokers who have already tried "quitting from tomorrow" and find 15 minutes easier to commit to than a lifetime.

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

### 3.2 `challenges` (at most one per day)

| Column | Type | Notes |
|---|---|---|
| `day` | date | "Dilato day" per §4.1 |
| `last_cigarette_at` | timestamp | answer to the morning question |
| `started_at` | timestamp | tap on "Zaczynam" |
| `target_kind` | `'minutes' \| 'until_noon' \| 'until_evening'` | |
| `target_minutes` | int | resolved at start for all kinds |
| `target_at` | timestamp | `started_at + target_minutes` |
| `status` | `'running' \| 'achieved' \| 'overtime' \| 'completed' \| 'interrupted'` | §4.5 |
| `achieved_at` | timestamp? | = `target_at` when reached |
| `overtime_target_minutes` | int | sum of overtime blocks chosen (15/30/60 each) |
| `overtime_minutes` | int | overtime actually completed |
| `ended_at` | timestamp? | |
| `result_minutes` | int? | §4.6 |
| `first_cigarette_at` | timestamp? | = `ended_at` (§4.7) |
| `used_craving_help` | bool | true if any craving session during this challenge |

### 3.3 `craving_sessions`

`challenge_id`, `started_at`, `ended_at`, `technique` (`'breathing' \| 'water' \| 'walk' \| 'hands' \| 'message'`).

### 3.4 `badges_earned`

`badge_id` (string key, see `docs/content/badges.md`), `first_earned_at`, `last_earned_at`, `times` (≥1; only "Nowy rekord" increments), `challenge_id` (of first earning). Unique on (`user_id`, `badge_id`). Badges are never deleted except by account deletion.

### 3.5 Local-only tables

- `outbox` — `id`, `table`, `row_id`, `op`, `payload`, `attempts`, `next_attempt_at`.
- `sync_state` — last successful pull timestamp per table.
- `notification_log` — scheduled/sent notifications per day (enforces the daily cap).

---

## 4. Domain rules (`src/domain`)

### 4.1 Day boundary

A "Dilato day" runs from **04:00 to 03:59 local time** (device's current time zone), so late smokers don't split one night across two days. At most **one challenge per day**; overtime extends it, it never creates a second one.

### 4.2 Delay ladder

Ordered steps:

| Key | Target |
|---|---|
| `m5`* | 5 min |
| `m10`* | 10 min |
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
| `custom` | user-entered, 5 min – 24 h, 5-min granularity |

\* `m5` and `m10` ("short steps") are available only when `habit_profile = 'wake'` **or** `cigs_per_day > 20`.

- `noon` / `evening` resolve to minutes at start time; they are **hidden** in the picker when fewer than 15 minutes remain until 12:00 / 20:00.
- For ordering and suggestions, `noon` and `evening` sit at their fixed position in the list above regardless of their resolved minutes.
- `custom` is never suggested; it counts as the nearest ladder step at or below its value for suggestion purposes.

### 4.3 Starting ladder per profile

The first suggestion and the four steps shown in onboarding (S02b "Twoja pierwsza drabina"):

| Profile | First ladder | First suggestion |
|---|---|---|
| `wake` | 5 · 10 · 15 · 30 min | 5 min |
| `coffee` | 15 · 30 · 45 min · 1 h | 15 min |
| `situation` | 15 · 30 min · 1 h · 2 h | 15 min |
| `later` | 30 min · 1 h · 2 h · do wieczora | 30 min |

If `cigs_per_day > 20`, short steps are unlocked and the first suggestion is one step lower on the full ladder: `wake` stays at 5 min (the floor), `coffee`/`situation` → 10 min, `later` → 15 min. The onboarding ladder preview shifts accordingly (e.g. `coffee` → 10 · 15 · 30 · 45 min).

### 4.4 Daily suggestion

Computed each day from the history of closed challenges:

1. No history → first suggestion (§4.3).
2. Last two closed challenges both `completed` and last result ≥ its target → suggest **one step above** the last target.
3. Last closed challenge `interrupted` → suggest the **same step** as default, and show "one step lower" as a highlighted alternative (S09 "Plan na jutro").
4. Otherwise → the same step as the last target.

The user can always pick any step, including jumps of several steps. A "plan for tomorrow" chosen on S09 overrides the computed suggestion for the next day.

### 4.5 Challenge state machine

```
            start
  (ready) ────────▶ running ──── now ≥ target_at ───▶ achieved ──"Dokładam X"──▶ overtime
                       │                                  │                         │
            "Tym razem się nie udało"            "Na dziś wystarczy"      overtime target reached
                       ▼                          or next day rollover     or "Tym razem się nie udało"
                  interrupted                             ▼                         ▼
                                                      completed ◀───────────────────┘
```

- `achieved` is derived: any read of a `running` challenge with `now ≥ target_at` transitions it to `achieved` with `achieved_at = target_at` (not `now`).
- From `achieved` the user may add overtime of 15, 30 or 60 minutes; from `overtime` they may add another block after reaching it (S07 offer repeats).
- Tapping "Tym razem się nie udało" during `overtime` closes the challenge as **`completed`** (the goal was reached); only the completed part of overtime counts.
- An `achieved` challenge left untouched is closed as `completed` at the next day rollover, with `ended_at = achieved_at`.
- **Confirmation check ("Nadal trwa?"):** if a challenge reached `achieved` (or was auto-completed at rollover) without the app being opened between `started_at` and `target_at`, the next app open shows a gentle sheet: "Tak, udało się" keeps it; "Zapaliłem(-am) wcześniej" changes it to `interrupted` with a user-entered time between `started_at` and `target_at`. Badges already awarded by that challenge stay (badges are never lost); the record is recomputed.

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

Ten thresholds (5 min, 20 min, 8 h, 12 h, 24 h, 48 h, 72 h, 2 weeks, 1 month, 1 year) — content in `docs/content/body-benefits.md`. A card is **unlocked** when `max(longest_smoke_free, current_live_smoke_free) ≥ threshold`. Unlocks are permanent. S10 shows the next locked threshold with a percent progress and a tip ("Najbliżej, gdy wybierzesz wyzwanie «do wieczora»"). Three extra "poza ciałem" cards (money, time, smell) are always visible with live values.

### 4.9 Badges

Full list and copy in `docs/content/badges.md`.

- **Threshold badges** are awarded when a challenge's `result_minutes` (target + overtime) reaches the threshold; overtime can award badges mid-overtime.
  - Earnable in MVP: 15, 30, 45 min, 1, 2, 3, 6, 12, 24 h, plus bonus 5 and 10 min when short steps are available (§4.2).
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

- The badge counter on S11 is "X z N", where N = 22, or 24 when short steps are available.
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
4. The ">20 cigs/day" rule: unlocks 5/10-min short steps and lowers the first suggestion one step.
5. The onboarding "Krok 1 z 3" is account creation (the stylebook shows steps 2 and 3 only).
6. Pack price is collected on S02.
7. The Skarbonka threshold per currency.
8. An unanswered `achieved` auto-completes at rollover.
9. Short-step bonus badges (5, 10 min) extend the badge total to 24 for users with short steps.
10. Celebration tier selection (§4.10).
