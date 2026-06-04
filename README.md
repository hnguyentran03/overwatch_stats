# Overwatch Statistics Tracker

A comprehensive web application for tracking and analyzing Overwatch game statistics. Track your match history, hero performance, map win rates, and identify areas for improvement.

## Features

- **Player Statistics Dashboard**: Overview of total matches, win rates, and performance metrics
- **Hero Analytics**: Win percentages per hero with detailed performance stats (eliminations, deaths, damage, healing)
- **Map Analytics**: Identify your weakest maps and track win rates across all map types
- **Trend Analysis**: Visualize performance trends over time to track improvement
- **Match History**: Detailed match-by-match breakdown with hero played and stats
- **Hero Bans Tracking**: Track which heroes were banned in each match

## Technology Stack

### Backend
- **Python 3.8+**
- **Flask**: REST API framework
- **SQLAlchemy**: ORM for database operations
- **PostgreSQL/SQLite**: Database (SQLite for development, PostgreSQL recommended for production)

### Frontend
- **React 18**: UI framework
- **Recharts**: Data visualization library
- **Axios**: HTTP client

## Project Structure

```
overwatch_stats/
├── backend/
│   ├── app.py                 # Flask application entry point
│   ├── models.py              # Database models
│   ├── config.py              # Configuration
│   ├── seed_sample_data.py    # Sample data generator
│   ├── requirements.txt       # Python dependencies
│   ├── routes/
│   │   ├── matches.py         # Match endpoints
│   │   ├── players.py         # Player endpoints
│   │   └── stats.py           # Analytics endpoints
│   └── utils/
│       ├── db.py              # Database utilities
│       └── calculations.py    # Statistics calculations
├── frontend/
│   ├── package.json
│   ├── src/
│   │   ├── App.js
│   │   ├── App.css
│   │   ├── index.js
│   │   ├── components/
│   │   │   ├── Dashboard.js
│   │   │   ├── HeroStats.js
│   │   │   ├── MapStats.js
│   │   │   ├── TrendChart.js
│   │   │   └── MatchHistory.js
│   │   └── api/
│   │       └── client.js
│   └── public/
└── spec.md
```

## Installation & Setup

### Prerequisites
- Python 3.8 or higher
- Node.js 16 or higher
- npm or yarn

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Create a virtual environment (recommended):**
   ```bash
   python -m venv venv
   
   # On Windows:
   venv\Scripts\activate
   
   # On macOS/Linux:
   source venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the application:**
   ```bash
   python app.py
   ```

   The backend API will start on `http://localhost:5000`

5. **Generate sample data (optional):**
   ```bash
   python seed_sample_data.py
   ```

### Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm start
   ```

   The frontend will start on `http://localhost:3000`

## API Endpoints

### Matches
- `GET /api/matches` - List all matches (supports `start_date` and `end_date` filters)
- `GET /api/matches/{match_id}/banned_heroes` - Get banned heroes for a match

### Players
- `GET /api/players/{player_id}/stats` - Get overall player statistics
- `GET /api/players/{player_id}/match_outcomes` - Get match history with outcomes
- `GET /api/players/{player_id}/preferred_heroes/{map_id}` - Get preferred heroes on a specific map

### Statistics
- `GET /api/players/{player_id}/win_percentage/hero` - Win percentage per hero
- `GET /api/players/{player_id}/win_percentage/map` - Win percentage per map
- `GET /api/players/{player_id}/map_stats/{map_id}` - Detailed stats for a specific map
- `GET /api/players/{player_id}/map_trends` - Performance trends (supports `time_window` parameter: day/week/month)

## Database Configuration

### SQLite (Default - Development)
The app uses SQLite by default for easy setup. The database file `overwatch_stats.db` will be created automatically in the backend directory.

### PostgreSQL (Recommended for Production)

1. **Install PostgreSQL** and create a database:
   ```sql
   CREATE DATABASE overwatch_stats;
   ```

2. **Set the DATABASE_URL environment variable:**
   ```bash
   # Windows:
   set DATABASE_URL=postgresql://username:password@localhost:5432/overwatch_stats
   
   # macOS/Linux:
   export DATABASE_URL=postgresql://username:password@localhost:5432/overwatch_stats
   ```

3. **Run the application** - tables will be created automatically

## Usage

1. **Start both backend and frontend servers** (in separate terminals)
2. **Open your browser** to `http://localhost:3000`
3. **View player statistics** by entering a player ID (default is 1)
4. **Explore different tabs:**
   - **Overview**: Recent match history
   - **Hero Stats**: Win rates and performance by hero
   - **Map Stats**: Identify weak maps that need improvement
   - **Trends**: Track performance over time

## Sample Data

The `seed_sample_data.py` script generates 50 sample matches for testing:
- 3 sample players with different role preferences
- Matches across all maps and heroes
- Realistic statistics based on hero roles
- Hero bans for each match
- Data spanning the last 3 months

## Key Features Explained

### Weakest Maps Identification
The app automatically identifies your weakest maps (lowest win rates) to help you focus on improvement areas. These are highlighted in the Map Stats tab with visual indicators.

### Trend Analysis
Track your performance over time with configurable time windows (daily, weekly, monthly). The trend chart helps you see if you're improving or if certain periods perform better.

### Role-Based Statistics
Filter hero statistics by role (Tank, DPS, Support) to analyze your performance in different roles.

## Future Enhancements

- User authentication and authorization
- Match upload interface (manual entry or file import)
- Player comparison features
- Season tracking and competitive rank integration
- Advanced filtering options
- Export statistics to PDF/CSV

## Development

### Adding New Heroes or Maps
Edit `backend/utils/db.py` in the `seed_data()` method to add new heroes or maps to the database.

### API Testing
You can test the API endpoints using tools like:
- Postman
- curl
- Python requests library

Example:
```bash
curl http://localhost:5000/api/players/1/stats
```

## Troubleshooting

**Backend won't start:**
- Ensure all dependencies are installed: `pip install -r requirements.txt`
- Check if port 5000 is already in use
- Verify Python version is 3.8+

**Frontend won't start:**
- Ensure all dependencies are installed: `npm install`
- Check if port 3000 is already in use
- Verify Node.js version is 16+

**CORS errors:**
- Ensure the backend is running
- Check that CORS_ORIGINS in `config.py` includes `http://localhost:3000`

**Database errors:**
- Delete the `.db` file and restart to recreate the database
- For PostgreSQL, verify connection string is correct

## License

This project is for educational purposes.

## Contributing

Feel free to submit issues and enhancement requests!
