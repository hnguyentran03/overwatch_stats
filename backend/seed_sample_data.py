"""
Script to generate sample match data for testing.
"""
from datetime import datetime, timedelta
import random
from utils.db import init_db
from models import Player, Match, MatchPlayer, Hero, Map, BannedHero, OutcomeEnum, TeamEnum
from config import DevelopmentConfig


def generate_sample_data():
    # Initialize database
    db = init_db(DevelopmentConfig.DATABASE_URL)
    session = db.get_session()

    try:
        # Check if sample data already exists
        if session.query(Player).count() > 0:
            print("Sample data already exists. Skipping generation.")
            return

        # Create sample players
        players = [
            Player(user_id='PlayerOne#1234', other_stats='Main DPS player'),
            Player(user_id='FlexSupport#5678', other_stats='Flex support player'),
            Player(user_id='TankMain#9012', other_stats='Tank main'),
        ]
        for player in players:
            session.add(player)
        session.commit()
        print(f"Created {len(players)} players")

        # Get all heroes and maps
        heroes = session.query(Hero).all()
        maps = session.query(Map).all()

        # Group heroes by role
        tanks = [h for h in heroes if h.role.value == 'tank']
        dps = [h for h in heroes if h.role.value == 'dps']
        supports = [h for h in heroes if h.role.value == 'support']

        # Generate matches over the last 3 months
        num_matches = 50
        start_date = datetime.now() - timedelta(days=90)

        for i in range(num_matches):
            # Random date in the last 3 months
            days_offset = random.randint(0, 90)
            hours_offset = random.randint(0, 23)
            match_date = start_date + timedelta(days=days_offset, hours=hours_offset)

            # Random map
            map_obj = random.choice(maps)

            # Random outcome
            outcome = random.choice([OutcomeEnum.win, OutcomeEnum.loss])

            # Generate score based on map type
            if map_obj.map_type.value == 'Control':
                # Control maps: best of 3/5
                if outcome == OutcomeEnum.win:
                    score = random.choice(['2-0', '2-1', '3-1', '3-2'])
                else:
                    score = random.choice(['0-2', '1-2', '1-3', '2-3'])
            else:
                # Other maps: distance based
                if outcome == OutcomeEnum.win:
                    score = random.choice(['3-2', '4-3', '2-1', '3-1'])
                else:
                    score = random.choice(['2-3', '3-4', '1-2', '1-3'])

            match = Match(
                date_time=match_date,
                map_id=map_obj.map_id,
                final_score=score,
                outcome=outcome
            )
            session.add(match)
            session.flush()

            # Add banned heroes (2 per team)
            team1_bans = random.sample(heroes, 2)
            team2_bans = random.sample([h for h in heroes if h not in team1_bans], 2)

            for hero in team1_bans:
                session.add(BannedHero(match_id=match.match_id, hero_id=hero.hero_id, team=TeamEnum.team1))
            for hero in team2_bans:
                session.add(BannedHero(match_id=match.match_id, hero_id=hero.hero_id, team=TeamEnum.team2))

            # Add match players - focus on player1 for most matches
            selected_player = players[0] if i < 40 else random.choice(players)

            # Select hero based on player preference
            if selected_player.user_id == 'PlayerOne#1234':
                # DPS main
                hero = random.choice(dps)
            elif selected_player.user_id == 'FlexSupport#5678':
                # Support main
                hero = random.choice(supports)
            else:
                # Tank main
                hero = random.choice(tanks)

            # Generate realistic stats based on role
            if hero.role.value == 'tank':
                eliminations = random.randint(15, 35)
                final_blows = int(eliminations * random.uniform(0.4, 0.6))  # 40-60% of elims
                assists = random.randint(10, 25)
                deaths = random.randint(3, 12)
                damage_done = random.uniform(8000, 18000)
                healing_done = 0
                damage_mitigated = random.uniform(15000, 35000)
            elif hero.role.value == 'support':
                eliminations = random.randint(5, 20)
                final_blows = int(eliminations * random.uniform(0.3, 0.5))  # 30-50% of elims
                assists = random.randint(15, 35)
                deaths = random.randint(2, 10)
                damage_done = random.uniform(3000, 12000)
                healing_done = random.uniform(8000, 18000)
                damage_mitigated = random.uniform(0, 5000)
            else:  # DPS
                eliminations = random.randint(20, 45)
                final_blows = int(eliminations * random.uniform(0.6, 0.8))  # 60-80% of elims
                assists = random.randint(5, 20)
                deaths = random.randint(4, 15)
                damage_done = random.uniform(12000, 25000)
                healing_done = 0
                damage_mitigated = random.uniform(0, 2000)

            # Winning matches tend to have better stats
            if outcome == OutcomeEnum.win:
                eliminations = int(eliminations * 1.2)
                final_blows = int(final_blows * 1.2)
                assists = int(assists * 1.1)
                deaths = max(1, int(deaths * 0.8))

            time_played = random.uniform(8, 15)  # 8-15 minutes

            match_player = MatchPlayer(
                match_id=match.match_id,
                player_id=selected_player.player_id,
                hero_id=hero.hero_id,
                eliminations=eliminations,
                final_blows=final_blows,
                assists=assists,
                deaths=deaths,
                damage_done=round(damage_done, 2),
                healing_done=round(healing_done, 2),
                damage_mitigated=round(damage_mitigated, 2),
                time_played=round(time_played, 2)
            )
            session.add(match_player)

        session.commit()
        print(f"Created {num_matches} matches with player performance data")
        print("Sample data generation complete!")

        # Print summary
        print("\nSummary:")
        print(f"Total players: {session.query(Player).count()}")
        print(f"Total matches: {session.query(Match).count()}")
        print(f"Total match records: {session.query(MatchPlayer).count()}")

    except Exception as e:
        session.rollback()
        print(f"Error generating sample data: {e}")
        raise
    finally:
        session.close()


if __name__ == '__main__':
    generate_sample_data()
