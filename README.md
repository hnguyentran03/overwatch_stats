# Overwatch Statistics Tracker

A web application for tracking and analyzing Overwatch competitive match statistics. Log matches, track hero performance, view map win rates, and identify areas for improvement.

## Features

- **Match Logging**: Manually enter full match data — map, outcome, score, duration, all 10 players, hero swaps, and hero bans. Enforces 5v5 composition (1 Tank / 2 Damage / 2 Support per team).
- **Scoreboard Autofill**: Upload a screenshot of the in-game end-of-match scoreboard and the entry form fills itself in — all 10 players' heroes and stats are read by a Claude vision model. Requires an `ANTHROPIC_API_KEY` (see [Scoreboard Autofill](#scoreboard-autofill)).
- **Player Dashboard**: Overview of total matches, overall win rate, and per-role win rates.
- **Hero Analytics**: Win percentages per hero with detailed performance stats (eliminations, deaths, damage, healing, per-10-min rates).
- **Map Analytics**: Identify your weakest maps and track win rates across all map types (Hybrid, Control, Escort, Push, Flashpoint).
- **Trend Analysis**: Visualize performance over time with configurable windows (daily, weekly, monthly).
- **Match History**: Match-by-match breakdown with hero played, score, and drill-down stat popup.
- **Hero Bans**: Track bans per match, visible in match detail popups.

## Technology Stack

### Backend
- **Python 3.8+** / **Flask** — REST API
- **SQLAlchemy** — ORM
- **SQLite** (default) / **PostgreSQL** (production)
- **anthropic** — Claude vision API for scoreboard parsing
- **Pillow** — builds the hero-portrait reference image (asset script only)

### Frontend
- **React 18**
- **Recharts** — data visualization
- **Axios** — HTTP client

## Project Structure

```
overwatch_stats/
├── backend/
│   ├── app.py                 # Flask app factory
│   ├── models.py              # SQLAlchemy models (Match, Player, MatchPlayer, Hero, Map, BannedHero)
│   ├── config.py              # Environment config
│   ├── seed_sample_data.py    # Generates 50 sample matches
│   ├── requirements.txt
│   ├── assets/
│   │   └── hero_reference.png # Labeled hero-portrait grid (built by the script below)
│   ├── scripts/
│   │   └── build_hero_reference.py  # Downloads portraits + builds the reference grid
│   ├── routes/
│   │   ├── matches.py         # Match CRUD + GET /api/heroes, GET /api/maps, POST /api/matches/parse_scoreboard
│   │   ├── players.py         # Player stats endpoints
│   │   └── stats.py           # Win % and trend endpoints
│   └── utils/
│       ├── db.py              # Database class + hero/map seed data
│       ├── scoreboard.py      # Claude vision scoreboard parser
│       └── calculations.py    # Stat aggregation functions
└── frontend/
    └── src/
        ├── App.js / App.css
        ├── components/
        │   ├── Dashboard.js         # Top-level layout and player search
        │   ├── LogMatch.js          # Match entry form
        │   ├── HeroStats.js         # Hero win rate table
        │   ├── HeroStatsView.js
        │   ├── HeroDetailModal.js   # Hero drill-down popup
        │   ├── MapStats.js          # Map win rate table
        │   ├── MapDetailModal.js    # Map drill-down popup
        │   ├── TrendChart.js        # Performance trend chart
        │   ├── MatchHistory.js      # Match list table
        │   └── MatchDetailModal.js  # Match drill-down popup
        └── api/
            └── client.js            # All API calls
```

## Installation & Setup

### Prerequisites
- Python 3.8+
- Node.js 16+

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py                 # API starts on http://localhost:5000
```

Optionally seed 50 sample matches:
```bash
python seed_sample_data.py
```

**Scoreboard Autofill (optional)** — to enable reading scoreboards from screenshots, set a Claude API key in the **same shell** that runs `python app.py`:
```bash
export ANTHROPIC_API_KEY=sk-ant-...   # required only for /api/matches/parse_scoreboard
```
Without it the endpoint returns `503` and manual entry still works. The repo ships
`backend/assets/hero_reference.png`; regenerate it after changing the hero roster:
```bash
python scripts/build_hero_reference.py
```

### Frontend

```bash
cd frontend
npm install
npm start                     # Dev server starts on http://localhost:3000
```

Both processes must run simultaneously.

## API Endpoints

### Reference
- `GET /api/heroes` — All heroes with roles (used for form dropdowns)
- `GET /api/maps` — All maps with types (used for form dropdowns)

### Matches
- `GET /api/matches` — List matches (`start_date`, `end_date` query params)
- `POST /api/matches` — Create a match (see Match Logging below)
- `POST /api/matches/parse_scoreboard` — Parse a scoreboard screenshot (multipart `image`); returns `{ "players": [...] }` (see [Scoreboard Autofill](#scoreboard-autofill))
- `GET /api/matches/{match_id}/details` — Full match details with player stats and bans
- `GET /api/matches/{match_id}/banned_heroes` — Bans for a match

### Players
- `GET /api/players/{battle_tag}/stats` — Overall stats and per-role win rates
- `GET /api/players/{battle_tag}/match_outcomes` — Match history
- `GET /api/players/{battle_tag}/preferred_heroes/{map_id}` — Preferred heroes on a map

### Statistics
- `GET /api/players/{battle_tag}/win_percentage/hero` — Win % per hero
- `GET /api/players/{battle_tag}/win_percentage/map` — Win % per map (role filter supported)
- `GET /api/players/{battle_tag}/map_stats/{map_id}` — Detailed stats for a map
- `GET /api/players/{battle_tag}/map_trends` — Trend data (`time_window`: day/week/month)

All `{battle_tag}` values must be percent-encoded (the `#` in `Name#1234` becomes `Name%231234`).

## Match Logging

The **+ Log Match** button in the dashboard header opens the match entry form. Rules enforced by the UI:

- **Both teams required** before saving.
- **Exact 5v5 composition** per team: 1 Tank, 2 Damage, 2 Support. The hero dropdown is filtered in real time to only show roles with remaining slots on that team.
- **Hero swaps** are locked to the same role as the primary hero. Changing the primary hero's role clears any existing swap slots.
- **Bans**: max 2 per team. Chips that would exceed the limit are disabled.
- All battle tags are required.

### POST /api/matches payload

```json
{
  "date_time": "2026-06-15T14:00:00",
  "map_id": 1,
  "outcome": "win",
  "final_score": "3-2",
  "duration": 22.5,
  "players": [
    {
      "battle_tag": "Name#1234",
      "team": "team1",
      "heroes": [
        {
          "hero_name": "Ana",
          "time_played": 22.5,
          "eliminations": 8,
          "final_blows": 2,
          "assists": 20,
          "deaths": 3,
          "damage_done": 4500,
          "healing_done": 15000,
          "damage_mitigated": 0
        }
      ]
    }
  ],
  "bans": {
    "team1": ["Genji", "Winston"],
    "team2": ["Ana", "Lucio"]
  }
}
```

New players (by `battle_tag`) are created automatically.

## Scoreboard Autofill

Click **📷 Upload Scoreboard** at the top of the Log Match form and pick a screenshot of the in-game end-of-match scoreboard. A blocking "Reading scoreboard…" dialog shows while the image is processed, then the form autofills.

**How it works:** the image is sent to `POST /api/matches/parse_scoreboard`, which forwards it to a Claude vision model (`claude-opus-4-8`) along with a labeled grid of every hero's portrait (`backend/assets/hero_reference.png`). The model matches each scoreboard portrait against the reference grid and reads the stat columns, returning structured JSON. Blue/top team → Team 1, red/bottom → Team 2.

**What it fills:** hero plus eliminations, assists, deaths, damage, healing, and mitigation for all 10 players. Autofilled rows are highlighted.

**What you still enter:** map, outcome, final score, duration, final blows, time played, and the `#1234` discriminator on battle tags (scoreboards show display names only). Heroes the model can't confidently identify are left blank for you to pick; the 5v5 validation flags anything off.

**Requirements & cost:** needs `ANTHROPIC_API_KEY` set on the backend process (otherwise the endpoint returns `503` and the form shows that message). Each scoreboard costs roughly 3–4¢. Higher-resolution screenshots (fullscreen / native resolution) noticeably improve hero and name accuracy.

## Database Configuration

**SQLite (default):** `backend/overwatch_stats.db` is created automatically. To reset, delete the file and restart.

**PostgreSQL:**
```bash
export DATABASE_URL=postgresql://username:password@localhost:5432/overwatch_stats
```

## Adding New Heroes or Maps

Edit `seed_data()` in `backend/utils/db.py`. The function only runs when the database is empty, so delete the `.db` file and restart to pick up changes.

## Troubleshooting

| Problem | Fix |
|---|---|
| Backend won't start | `pip install -r requirements.txt`; check port 5000 |
| Frontend won't start | `npm install`; check port 3000 |
| CORS errors | Ensure backend is running; check `CORS_ORIGINS` in `config.py` |
| Database errors | Delete `overwatch_stats.db` and restart the backend |
| Scoreboard upload says "not configured" (503) | `export ANTHROPIC_API_KEY=...` in the **same shell** that runs `python app.py`, then restart the backend |
| Scoreboard heroes/names inaccurate | Upload a higher-resolution (fullscreen / native-res) screenshot; rerun `python scripts/build_hero_reference.py` if the roster changed |
