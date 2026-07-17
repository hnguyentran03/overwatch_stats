"""Shared parsing of the mode/size match filters from request query args.

Each read endpoint calls parse_match_filters(request.args) and, if there is no
error, applies the returned clauses to any query joined on Match.
"""
from models import Match, GameModeEnum

# Extended in Phase 2 with ("size", "team_size", TeamSizeEnum).
_FILTER_SPECS = [
    ("mode", "game_mode", GameModeEnum),
]


def parse_match_filters(args):
    """Return (clauses, error).

    clauses: list of SQLAlchemy filter expressions on Match columns.
    error: a message string if a param value was invalid, else None.
    A missing param or the literal value "all" means no filter on that axis.
    """
    clauses = []
    for param, column, enum_cls in _FILTER_SPECS:
        raw = args.get(param)
        if raw is None or raw == "all":
            continue
        try:
            value = enum_cls(raw)
        except ValueError:
            valid = ", ".join(e.value for e in enum_cls)
            return [], f"Invalid {param}. Use one of: {valid} (or 'all')"
        clauses.append(getattr(Match, column) == value)
    return clauses, None
