# Overwatch Statistics Tracker

A web application for logging Overwatch competitive matches and analyzing performance — hero and map win rates, per-role breakdowns, and trends over time. Live at [ow.hnguyentran.com](https://ow.hnguyentran.com).

For setup, the full API reference, and other details, see [DOCS.md](DOCS.md); for the production deployment runbook, see [DEPLOY.md](DEPLOY.md).

## Features

- **Match Logging** — Enter full match data (map, outcome, score, duration, all players, hero swaps, and bans), with team-composition rules enforced for both 5v5 and 6v6.
- **Scoreboard Autofill** — Upload an end-of-match scoreboard screenshot and a Claude vision model reads every player's hero and stats to fill the form. (Optional; needs an Anthropic API key.)
- **Player Dashboard** — Search any battle tag for total matches, overall win rate, and per-role win rates, filterable by ranked/unranked and team size.
- **Hero Analytics** — Win percentage and detailed stats per hero (eliminations, deaths, damage, healing, per-10-minute rates).
- **Map Analytics** — Win rates across every map type (Hybrid, Control, Escort, Push, Flashpoint) plus a view of your weakest maps.
- **Trend Analysis** — Performance over time with daily, weekly, or monthly windows.
- **Match History** — Match-by-match breakdown with drill-down detail popups, including per-match hero bans.

## Architecture

Two processes run side by side: a Flask REST API and a React single-page app.

- **Backend** — Flask app factory (`backend/app.py`) over a SQLAlchemy data model: `Match`, `Player`, `MatchPlayer` (join table), `Hero`, `Map`, and `BannedHero`. Endpoints are split into three blueprints under `/api` — `matches`, `players`, and `stats` — with pure stat aggregation isolated in `utils/calculations.py`. The database auto-creates its tables and seeds the hero/map roster on first boot.
- **Frontend** — React SPA (`frontend/src`). `Dashboard` is the top-level view (player search, tabs, and view state that survives a refresh); `LogMatch` handles match entry; each analytics view and drill-down modal is its own component. All HTTP calls live in `api/client.ts`.
- **Data** — SQLite by default; set `DATABASE_URL` to use PostgreSQL. `seed_sample_data.py` populates a realistic demo dataset using Overwatch's baked-in anonymous "streamer mode" names.
- **AI** — Scoreboard parsing sends the screenshot plus a labeled hero-portrait reference grid to a Claude vision model, which returns structured per-player JSON.
