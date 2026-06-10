"""
Script to generate sample match data for testing.
Drops and recreates all data on every run.
"""
from datetime import datetime, timedelta
import random
from utils.db import init_db
from models import Player, Match, MatchPlayer, Hero, Map, BannedHero, OutcomeEnum, TeamEnum
from config import DevelopmentConfig


def make_score(outcome, map_type):
    if outcome == OutcomeEnum.tie:
        return random.choice(['2-2', '1-1', '3-3'])
    if map_type == 'Control':
        if outcome == OutcomeEnum.win:
            return random.choice(['2-0', '2-1'])
        return random.choice(['0-2', '1-2'])
    if outcome == OutcomeEnum.win:
        return random.choice(['3-2', '4-3', '2-1', '3-1'])
    return random.choice(['2-3', '3-4', '1-2', '1-3'])


def make_stats(role, outcome):
    if role == 'tank':
        elims = random.randint(15, 35)
        final_blows = int(elims * random.uniform(0.4, 0.6))
        assists = random.randint(10, 25)
        deaths = random.randint(3, 12)
        damage = random.uniform(8000, 18000)
        healing = 0
        mitigation = random.uniform(15000, 35000)
    elif role == 'support':
        elims = random.randint(5, 20)
        final_blows = int(elims * random.uniform(0.3, 0.5))
        assists = random.randint(15, 35)
        deaths = random.randint(2, 10)
        damage = random.uniform(3000, 12000)
        healing = random.uniform(8000, 18000)
        mitigation = random.uniform(0, 5000)
    else:  # dps
        elims = random.randint(20, 45)
        final_blows = int(elims * random.uniform(0.6, 0.8))
        assists = random.randint(5, 20)
        deaths = random.randint(4, 15)
        damage = random.uniform(12000, 25000)
        healing = 0
        mitigation = random.uniform(0, 2000)

    if outcome == OutcomeEnum.win:
        elims = int(elims * 1.2)
        final_blows = int(final_blows * 1.2)
        assists = int(assists * 1.1)
        deaths = max(1, int(deaths * 0.8))

    return elims, final_blows, assists, deaths, damage, healing, mitigation


def add_match(session, player, hero_pool, maps, start_date, day_range):
    days_offset = random.randint(0, day_range)
    hours_offset = random.randint(0, 23)
    match_date = start_date + timedelta(days=days_offset, hours=hours_offset)

    map_obj = random.choice(maps)
    outcome = random.choices(
        [OutcomeEnum.win, OutcomeEnum.loss, OutcomeEnum.tie],
        weights=[47, 47, 6]
    )[0]
    score = make_score(outcome, map_obj.map_type.value)

    match = Match(
        date_time=match_date,
        map_id=map_obj.map_id,
        final_score=score,
        outcome=outcome,
    )
    session.add(match)
    session.flush()

    all_heroes = session.query(Hero).all()
    team1_bans = random.sample(all_heroes, 2)
    team2_bans = random.sample([h for h in all_heroes if h not in team1_bans], 2)
    for h in team1_bans:
        session.add(BannedHero(match_id=match.match_id, hero_id=h.hero_id, team=TeamEnum.team1))
    for h in team2_bans:
        session.add(BannedHero(match_id=match.match_id, hero_id=h.hero_id, team=TeamEnum.team2))

    hero = random.choice(hero_pool)
    elims, final_blows, assists, deaths, damage, healing, mitigation = make_stats(hero.role.value, outcome)
    time_played = random.uniform(8, 15)

    session.add(MatchPlayer(
        match_id=match.match_id,
        player_id=player.player_id,
        hero_id=hero.hero_id,
        eliminations=elims,
        final_blows=final_blows,
        assists=assists,
        deaths=deaths,
        damage_done=round(damage, 2),
        healing_done=round(healing, 2),
        damage_mitigated=round(mitigation, 2),
        time_played=round(time_played, 2),
    ))


def generate_sample_data():
    db = init_db(DevelopmentConfig.DATABASE_URL)

    # Replace all existing data
    db.drop_tables()
    db.create_tables()
    db.seed_data()

    session = db.get_session()

    try:
        players = [
            Player(user_id='PlayerOne#1234', other_stats='Main player'),
            Player(user_id='FlexSupport#5678', other_stats='Flex support player'),
            Player(user_id='TankMain#9012', other_stats='Tank main'),
        ]
        for p in players:
            session.add(p)
        session.commit()

        heroes = session.query(Hero).all()
        maps = session.query(Map).all()
        tanks = [h for h in heroes if h.role.value == 'tank']
        supports = [h for h in heroes if h.role.value == 'support']

        start_date = datetime.now() - timedelta(days=365)

        # Player 1: 560 matches across all heroes and maps
        for _ in range(560):
            add_match(session, players[0], heroes, maps, start_date, 365)

        # Player 2: support main, 30 matches
        for _ in range(30):
            add_match(session, players[1], supports, maps, start_date, 365)

        # Player 3: tank main, 30 matches
        for _ in range(30):
            add_match(session, players[2], tanks, maps, start_date, 365)

        session.commit()
        print('Sample data generated successfully.')
        print(f'  Players:      {session.query(Player).count()}')
        print(f'  Matches:      {session.query(Match).count()}')
        print(f'  Match records:{session.query(MatchPlayer).count()}')

    except Exception as e:
        session.rollback()
        print(f'Error generating sample data: {e}')
        raise
    finally:
        session.close()


if __name__ == '__main__':
    generate_sample_data()
