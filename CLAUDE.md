# Dilato

A smoking-cessation app built on **delay**: each day the user pushes their first cigarette a little later (30 min → 1 h → 1 day). Polish + English, iOS + Android, free, account required.

## Read first (in this order)

1. `docs/superpowers/specs/2026-09-29-dilato-mvp-design.md` — the MVP design spec, the **source of truth** for scope, rules, data model and architecture.
2. `docs/content/` — all user-facing copy (PL + EN): `badges.md`, `body-benefits.md`, `notifications.md`, `voice.md`.
3. `stylebook/index.html` (or `stylebook/project/*.dc.html`) — visual source of truth: tokens, components, screen mockups S01–S13.
4. `docs/superpowers/plans/` — implementation plan(s), once written.

## Stack

Expo (React Native, TypeScript, expo-router) · expo-sqlite (local source of truth) · Supabase EU (Postgres + RLS, email/password auth, Edge Functions) · react-native-svg + Reanimated · expo-notifications · iOS Live Activity (Swift widget target) · i18next · Jest / RNTL / Maestro · EAS.

## Invariants — never break

- `app/src/domain` is **pure** TypeScript: no React, no I/O, the current time is passed in. Every rule is unit-tested (TDD).
- Clocks are **derived from timestamps** (`now − started_at`), never tick-counted.
- **Offline-first:** the UI talks to SQLite only; sync to Supabase goes through the outbox.
- **No red, no ash grey.** Interruption = Zmierzch (#5F559A). No state is an "error".
- **Tone:** never shame, never scare. "Tym razem się nie udało", never "porażka".
- All copy comes from `src/i18n/{pl,en}.json`, sourced from `docs/content/`.
- Badges are never lost.

## Git

The repo lives on a drive without ownership info. Run git as `git -c safe.directory=F:/DATA_1/CC/Projekty/Dilato …` (or the user can add a global `safe.directory` exception).

## Status

- 2026-09-29 — Owner decision: no 5/10-min steps; first suggestion 30 min for all profiles (15 min stays as a manual choice).
- 2026-09-29 — Brainstorming done; MVP design spec + content tables written. Spec approved.
- 2026-09-30 — Plan 1 (foundation & domain core) implemented: `app/src/domain` complete and tested; spec clarified in §13 items 11–14. **Next:** write plan 2 (local data & app services) — read "Carried from plan 1" in `docs/superpowers/plans/2026-09-29-00-roadmap.md` first.
- 2026-10-04 — Domain refinement (quality + architecture review): one exported `advance(ch, now)` replaces `refresh`/`rollover`; `isClosed` narrows to `ClosedChallenge`; one internal close path; attitude badges as a typed rule table. Caller contract in the roadmap updated. No behaviour change.
- 2026-10-04 — Plan 2 (local data & app services) implemented: `src/data` (SQLite seam, schema v1, validated mappers, outbox write path, repositories, `ChallengeService`) and `reconcile` in the domain. **Next:** write plan 3 (UI system & core screens) — read "Carried from plan 2" in the roadmap first.
- 2026-10-05 — Plan 2 merged to `main` (f993acb) and pushed; issues #10–#14, #44, #45, #56 closed (Done on project #6). Repo: https://github.com/jaroslawlojko/dilato, backlog board = user project #6.
- **Resume here:** (1) optionally file the 7 deferred review findings from plan 2 as backlog issues — listed under "Deferred from the plan 2 review" in the roadmap; (2) owner decisions #49–#52 (they shape plan 3 screens); (3) write plan 3 (#15) — read "Carried from plan 2" in the roadmap first.
- Open owner tasks:
  - medical review of body-benefit copy (launch blocker);
  - native-speaker review of the EN copy;
  - privacy policy + ToS (PL/EN);
  - Apple/Google developer accounts;
  - Supabase EU project.
