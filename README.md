# Overwatch Statistics Tracker

A web application for logging Overwatch competitive matches and analyzing performance — hero and map win rates, per-role breakdowns, and trends over time. Live at [ow.hnguyentran.com](https://ow.hnguyentran.com).

## Features

- **Match Logging** — Enter a full match: map, outcome, score, duration, game mode (ranked/unranked), and every player with their heroes, hero swaps, and per-hero stats. The form enforces valid team composition — 1 Tank / 2 Damage / 2 Support for 5v5, or up to 2 Tanks per team for 6v6 — restricts swaps to the primary hero's role, and caps bans at two per team. Players are created automatically the first time a battle tag appears.
- **Scoreboard Autofill** — Upload an end-of-match scoreboard screenshot and a Claude vision model reads every player's hero and stat line, filling the entry form for you. Optional (needs an Anthropic API key) and rate-limited; manual entry always works.
- **Player Dashboard** — Search any battle tag to see total matches, overall win rate, and per-role win rates. Results filter by ranked/unranked and team size, and the active player, tab, and filters survive a page refresh.
- **Hero Analytics** — Win percentage per hero alongside detailed performance stats — eliminations, deaths, damage, healing, and per-10-minute rates — with a drill-down view per hero.
- **Map Analytics** — Win rates across every map type (Hybrid, Control, Escort, Push, Flashpoint), a view of your weakest maps, and per-map preferred heroes.
- **Trend Analysis** — Win rate and volume over time, grouped by day, week, or month.
- **Match History** — A match-by-match list with drill-down popups showing the full scoreboard and each match's hero bans.

## Architecture

Two processes run side by side: a Flask REST API and a React single-page app. In development both run locally; in production they sit behind a single reverse proxy (see [Deployment](#deployment)).

### Backend (`backend/`)

A Flask app built with the app-factory pattern (`app.py`) over a SQLAlchemy data model. The core entities are `Match`, `Player`, and `Hero`/`Map` reference tables, joined by `MatchPlayer` — one row per hero a player played in a match, carrying that hero's stat line — plus `BannedHero` for per-team bans. This shape lets a single player span multiple heroes in one match and drives every aggregate the app reports.

Endpoints are organized into three blueprints mounted under `/api`:

- **`matches`** — match creation and listing, match detail, hero/map reference lists, and scoreboard parsing.
- **`players`** — per-player overall and per-role stats, match history, and preferred heroes.
- **`stats`** — win-percentage and trend queries by hero and by map.

Supporting `utils/` modules keep the routes thin: `calculations.py` holds the pure stat aggregation, `filters.py` parses the shared mode/size query params, `rate_limit.py` throttles scoreboard parsing, and `scoreboard.py` wraps the Claude vision call. On first boot the database auto-creates its tables and seeds the full hero and map roster. In production the app is served by gunicorn via `wsgi.py`.

### Frontend (`frontend/src/`)

A React single-page app written in TypeScript. `Dashboard` is the top-level view — it owns player search and tab state and persists the current view to `localStorage` so a refresh lands you back where you were. `LogMatch` is the match-entry form with all the composition and ban rules; each analytics view (`HeroStats`, `MapStats`, `TrendChart`, `MatchHistory`) and its drill-down modal is a self-contained component. Every HTTP call is centralized in `api/client.ts`, and shared shapes live in `types.ts`.

### Data

SQLite by default (a single file under `backend/`); set `DATABASE_URL` to point at PostgreSQL instead. Reference data (heroes and maps) seeds automatically when the database is empty. For a realistic demo dataset, `seed_sample_data.py` generates a season of matches whose players use Overwatch's baked-in anonymous "streamer mode" names.

### AI scoreboard parsing

The scoreboard endpoint sends the uploaded screenshot to a Claude vision model together with a labeled grid of every hero's portrait. The model matches each portrait on the scoreboard against the reference grid and reads the stat columns, returning structured per-player JSON that the form consumes. Requests are capped on a rolling window to bound cost.

### Deployment

The whole app runs on a single AWS Lightsail instance: Caddy terminates HTTPS and reverse-proxies `/api/*` to gunicorn (Flask), and serves the static React build for everything else with an SPA fallback. The full runbook is in [DEPLOY.md](DEPLOY.md).
