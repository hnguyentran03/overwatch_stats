"""
Script to generate sample match data for testing.
Drops and recreates all data on every run.
"""
from datetime import datetime, timedelta
import random
from utils.db import init_db
from models import Player, Match, MatchPlayer, Hero, Map, BannedHero, OutcomeEnum, TeamEnum, GameModeEnum, TeamSizeEnum
from config import DevelopmentConfig

FILLER_COUNT = 25


def make_score(outcome, map_type):
    if outcome == OutcomeEnum.draw:
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


def add_match(session, player, hero_pool, maps, start_date, day_range, filler_players, heroes_by_role):
    days_offset = random.randint(0, day_range)
    hours_offset = random.randint(0, 23)
    match_date = start_date + timedelta(days=days_offset, hours=hours_offset)

    map_obj = random.choice(maps)
    outcome = random.choices(
        [OutcomeEnum.win, OutcomeEnum.loss, OutcomeEnum.draw],
        weights=[47, 47, 6]
    )[0]
    score = make_score(outcome, map_obj.map_type.value)

    match = Match(
        date_time=match_date,
        map_id=map_obj.map_id,
        final_score=score,
        outcome=outcome,
        duration=round(random.uniform(10, 22), 2),
        game_mode=random.choices([GameModeEnum.ranked, GameModeEnum.unranked], weights=[60, 40])[0],
        team_size=random.choice([TeamSizeEnum.five_v_five, TeamSizeEnum.six_v_six]),
    )
    session.add(match)
    session.flush()

    # 4 total bans (2 per team), max 2 heroes per role across both teams
    ban_role_pool = ['tank', 'tank', 'dps', 'dps', 'support', 'support']
    ban_roles = random.sample(ban_role_pool, 4)
    banned_ids = set()
    team1_bans, team2_bans = [], []
    for i, role in enumerate(ban_roles):
        candidates = [h for h in heroes_by_role[role] if h.hero_id not in banned_ids]
        chosen = random.choice(candidates)
        banned_ids.add(chosen.hero_id)
        (team1_bans if i < 2 else team2_bans).append(chosen)
    for h in team1_bans:
        session.add(BannedHero(match_id=match.match_id, hero_id=h.hero_id, team=TeamEnum.team1))
    for h in team2_bans:
        session.add(BannedHero(match_id=match.match_id, hero_id=h.hero_id, team=TeamEnum.team2))

    # Tracked player — always team1, same role, not banned, 1–3 heroes
    # Pick one role for this match (for Player 1 who has all heroes, this is random)
    roles_in_pool = list(set(h.role.value for h in hero_pool))
    tracked_role = random.choice(roles_in_pool)
    role_pool = [h for h in hero_pool if h.role.value == tracked_role and h.hero_id not in banned_ids]

    num_slots = random.choices([1, 2, 3], weights=[50, 35, 15])[0]
    chosen_heroes = random.sample(role_pool, min(num_slots, len(role_pool)))
    time_fracs = [random.random() for _ in chosen_heroes]
    total = sum(time_fracs)
    time_fracs = [f / total for f in time_fracs]

    # Track heroes used per team to prevent duplicates across teammates
    team1_used = set()
    team2_used = set()
    for hero in chosen_heroes:
        team1_used.add(hero.hero_id)

    for hero, frac in zip(chosen_heroes, time_fracs):
        e, fb, a, d, dmg, heal, mit = make_stats(tracked_role, outcome)
        session.add(MatchPlayer(
            match_id=match.match_id,
            player_id=player.player_id,
            hero_id=hero.hero_id,
            team=TeamEnum.team1,
            eliminations=int(e * frac),
            final_blows=int(fb * frac),
            assists=int(a * frac),
            deaths=max(0, int(d * frac)),
            damage_done=round(dmg * frac, 2),
            healing_done=round(heal * frac, 2),
            damage_mitigated=round(mit * frac, 2),
            time_played=round(frac * match.duration, 2),
        ))

    # 9 filler players: 4 complete team1 (1T2D2S), 5 fill team2 (1T2D2S)
    team1_roles = {'tank': 1, 'dps': 2, 'support': 2}
    team1_roles[tracked_role] -= 1
    team1_role_list = []
    for role, count in team1_roles.items():
        team1_role_list.extend([role] * count)
    random.shuffle(team1_role_list)

    team2_role_list = ['tank', 'dps', 'dps', 'support', 'support']
    random.shuffle(team2_role_list)

    chosen_fillers = random.sample(filler_players, 9)
    slots = [(r, TeamEnum.team1) for r in team1_role_list] + [(r, TeamEnum.team2) for r in team2_role_list]

    for filler, (filler_role, filler_team) in zip(chosen_fillers, slots):
        used_set = team1_used if filler_team == TeamEnum.team1 else team2_used
        # Same role, not banned, not already played by a teammate this match
        available_filler = [h for h in heroes_by_role[filler_role]
                            if h.hero_id not in banned_ids and h.hero_id not in used_set]
        if not available_filler:
            available_filler = [h for h in heroes_by_role[filler_role] if h.hero_id not in banned_ids]
        if not available_filler:
            available_filler = heroes_by_role[filler_role]
        num_filler_slots = random.choices([1, 2], weights=[70, 30])[0]
        filler_heroes = random.sample(available_filler, min(num_filler_slots, len(available_filler)))
        for fh in filler_heroes:
            used_set.add(fh.hero_id)
        filler_fracs = [random.random() for _ in filler_heroes]
        filler_total = sum(filler_fracs)
        filler_fracs = [f / filler_total for f in filler_fracs]

        for fh, ff in zip(filler_heroes, filler_fracs):
            fe, ffb, fa, fd, fdmg, fheal, fmit = make_stats(filler_role, outcome)
            session.add(MatchPlayer(
                match_id=match.match_id,
                player_id=filler.player_id,
                hero_id=fh.hero_id,
                team=filler_team,
                eliminations=int(fe * ff),
                final_blows=int(ffb * ff),
                assists=int(fa * ff),
                deaths=max(0, int(fd * ff)),
                damage_done=round(fdmg * ff, 2),
                healing_done=round(fheal * ff, 2),
                damage_mitigated=round(fmit * ff, 2),
                time_played=round(ff * match.duration, 2),
            ))


def generate_sample_data():
    db = init_db(DevelopmentConfig.DATABASE_URL)

    # Replace all existing data
    db.drop_tables()
    db.create_tables()
    db.seed_data()

    session = db.get_session()

    try:
        tracked_players = [
            Player(user_id='PlayerOne#1234', other_stats='Main player'),
            Player(user_id='FlexSupport#5678', other_stats='Flex support player'),
            Player(user_id='TankMain#9012', other_stats='Tank main'),
        ]
        for p in tracked_players:
            session.add(p)

        filler_players = [
            Player(user_id=f'Player{i:02d}#{1000 + i}') for i in range(1, FILLER_COUNT + 1)
        ]
        for p in filler_players:
            session.add(p)

        session.commit()

        heroes = session.query(Hero).all()
        maps = session.query(Map).all()
        heroes_by_role = {
            'tank':    [h for h in heroes if h.role.value == 'tank'],
            'dps':     [h for h in heroes if h.role.value == 'dps'],
            'support': [h for h in heroes if h.role.value == 'support'],
        }

        start_date = datetime.now() - timedelta(days=365)

        # Player 1: 560 matches across all heroes and maps
        for _ in range(560):
            add_match(session, tracked_players[0], heroes, maps, start_date, 365, filler_players, heroes_by_role)

        # Player 2: support main, 30 matches
        for _ in range(30):
            add_match(session, tracked_players[1], heroes_by_role['support'], maps, start_date, 365, filler_players, heroes_by_role)

        # Player 3: tank main, 30 matches
        for _ in range(30):
            add_match(session, tracked_players[2], heroes_by_role['tank'], maps, start_date, 365, filler_players, heroes_by_role)

        session.commit()
        print('Sample data generated successfully.')
        print(f'  Players:       {session.query(Player).count()} ({len(tracked_players)} tracked, {len(filler_players)} filler)')
        print(f'  Matches:       {session.query(Match).count()}')
        print(f'  Match records: {session.query(MatchPlayer).count()}')

    except Exception as e:
        session.rollback()
        print(f'Error generating sample data: {e}')
        raise
    finally:
        session.close()


if __name__ == '__main__':
    generate_sample_data()
