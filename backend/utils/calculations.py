from collections import defaultdict
from datetime import datetime, timedelta


def calculate_win_percentage(matches):
    """
    Calculate win percentage from a list of matches.
    Returns a dict with wins, losses, total, and percentage.
    """
    if not matches:
        return {
            'wins': 0,
            'losses': 0,
            'total': 0,
            'win_percentage': 0.0
        }

    wins = sum(1 for match in matches if match.outcome.value == 'win')
    losses = len(matches) - wins
    total = len(matches)
    win_percentage = (wins / total * 100) if total > 0 else 0.0

    return {
        'wins': wins,
        'losses': losses,
        'total': total,
        'win_percentage': round(win_percentage, 2)
    }


def aggregate_hero_stats(match_players):
    """
    Aggregate statistics from multiple MatchPlayer records.
    Returns totals and averages for eliminations, deaths, damage, etc.
    """
    if not match_players:
        return {
            'games_played': 0,
            'total_eliminations': 0,
            'total_assists': 0,
            'total_deaths': 0,
            'total_damage_done': 0.0,
            'total_healing_done': 0.0,
            'total_damage_mitigated': 0.0,
            'total_time_played': 0.0,
            'avg_eliminations': 0.0,
            'avg_assists': 0.0,
            'avg_deaths': 0.0,
            'avg_damage_done': 0.0,
            'avg_healing_done': 0.0,
            'avg_damage_mitigated': 0.0,
        }

    games_played = len(match_players)
    total_eliminations = sum(mp.eliminations for mp in match_players)
    total_assists = sum(mp.assists for mp in match_players)
    total_deaths = sum(mp.deaths for mp in match_players)
    total_damage_done = sum(mp.damage_done for mp in match_players)
    total_healing_done = sum(mp.healing_done for mp in match_players)
    total_damage_mitigated = sum(mp.damage_mitigated for mp in match_players)
    total_time_played = sum(mp.time_played for mp in match_players)

    return {
        'games_played': games_played,
        'total_eliminations': total_eliminations,
        'total_assists': total_assists,
        'total_deaths': total_deaths,
        'total_damage_done': round(total_damage_done, 2),
        'total_healing_done': round(total_healing_done, 2),
        'total_damage_mitigated': round(total_damage_mitigated, 2),
        'total_time_played': round(total_time_played, 2),
        'avg_eliminations': round(total_eliminations / games_played, 2) if games_played > 0 else 0.0,
        'avg_assists': round(total_assists / games_played, 2) if games_played > 0 else 0.0,
        'avg_deaths': round(total_deaths / games_played, 2) if games_played > 0 else 0.0,
        'avg_damage_done': round(total_damage_done / games_played, 2) if games_played > 0 else 0.0,
        'avg_healing_done': round(total_healing_done / games_played, 2) if games_played > 0 else 0.0,
        'avg_damage_mitigated': round(total_damage_mitigated / games_played, 2) if games_played > 0 else 0.0,
    }


def calculate_map_trends(matches, time_window='week'):
    """
    Calculate performance trends over time on maps.
    Groups matches by time windows and calculates win rates.
    Returns list of time periods with win percentages.
    """
    if not matches:
        return []

    # Sort matches by date
    sorted_matches = sorted(matches, key=lambda m: m.date_time)

    # Determine time window delta
    if time_window == 'day':
        delta = timedelta(days=1)
    elif time_window == 'week':
        delta = timedelta(weeks=1)
    elif time_window == 'month':
        delta = timedelta(days=30)
    else:
        delta = timedelta(weeks=1)

    # Group matches by time window
    time_groups = defaultdict(list)
    for match in sorted_matches:
        # Round down to start of time window
        if time_window == 'week':
            window_start = match.date_time - timedelta(days=match.date_time.weekday())
        elif time_window == 'month':
            window_start = match.date_time.replace(day=1)
        else:  # day
            window_start = match.date_time.replace(hour=0, minute=0, second=0, microsecond=0)

        time_groups[window_start].append(match)

    # Calculate win percentage for each time window
    trends = []
    for window_start in sorted(time_groups.keys()):
        matches_in_window = time_groups[window_start]
        win_stats = calculate_win_percentage(matches_in_window)
        trends.append({
            'period_start': window_start.isoformat(),
            'period_end': (window_start + delta).isoformat(),
            'matches_played': win_stats['total'],
            'wins': win_stats['wins'],
            'losses': win_stats['losses'],
            'win_percentage': win_stats['win_percentage']
        })

    return trends


def identify_weakest_maps(player_map_stats):
    """
    Identify weakest maps based on win percentage.
    Takes a list of dicts with map_id, map_name, and win stats.
    Returns sorted list with weakest maps first.
    """
    if not player_map_stats:
        return []

    # Sort by win percentage (ascending) and then by number of games (descending)
    # This prioritizes maps with more games played when win rates are similar
    sorted_maps = sorted(
        player_map_stats,
        key=lambda x: (x['win_percentage'], -x['total'])
    )

    return sorted_maps


def calculate_kda_ratio(eliminations, deaths, assists):
    """
    Calculate KDA ratio: (Kills + Assists) / Deaths
    Returns 'Perfect' if no deaths, otherwise the ratio.
    """
    if deaths == 0:
        return 'Perfect'
    return round((eliminations + assists) / deaths, 2)
