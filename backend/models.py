from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
import enum

Base = declarative_base()


class OutcomeEnum(enum.Enum):
    win = "win"
    loss = "loss"


class RoleEnum(enum.Enum):
    tank = "tank"
    support = "support"
    dps = "dps"


class MapTypeEnum(enum.Enum):
    hybrid = "Hybrid"
    control = "Control"
    escort = "Escort"
    flashpoint = "Flashpoint"
    push = "Push"


class TeamEnum(enum.Enum):
    team1 = "team1"
    team2 = "team2"


class Match(Base):
    __tablename__ = 'matches'

    match_id = Column(Integer, primary_key=True, autoincrement=True)
    date_time = Column(DateTime, nullable=False)
    map_id = Column(Integer, ForeignKey('maps.map_id'), nullable=False)
    final_score = Column(String, nullable=False)
    outcome = Column(Enum(OutcomeEnum), nullable=False)

    map = relationship("Map", back_populates="matches")
    match_players = relationship("MatchPlayer", back_populates="match")
    banned_heroes = relationship("BannedHero", back_populates="match")


class Player(Base):
    __tablename__ = 'players'

    player_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, nullable=False, unique=True)
    other_stats = Column(String)

    match_players = relationship("MatchPlayer", back_populates="player")


class MatchPlayer(Base):
    __tablename__ = 'match_players'

    id = Column(Integer, primary_key=True, autoincrement=True)
    match_id = Column(Integer, ForeignKey('matches.match_id'), nullable=False)
    player_id = Column(Integer, ForeignKey('players.player_id'), nullable=False)
    hero_id = Column(Integer, ForeignKey('heroes.hero_id'), nullable=False)
    eliminations = Column(Integer, default=0)
    final_blows = Column(Integer, default=0)
    assists = Column(Integer, default=0)
    deaths = Column(Integer, default=0)
    damage_done = Column(Float, default=0.0)
    healing_done = Column(Float, default=0.0)
    damage_mitigated = Column(Float, default=0.0)
    time_played = Column(Float, default=0.0)

    match = relationship("Match", back_populates="match_players")
    player = relationship("Player", back_populates="match_players")
    hero = relationship("Hero", back_populates="match_players")


class Hero(Base):
    __tablename__ = 'heroes'

    hero_id = Column(Integer, primary_key=True, autoincrement=True)
    hero_name = Column(String, nullable=False, unique=True)
    role = Column(Enum(RoleEnum), nullable=False)

    match_players = relationship("MatchPlayer", back_populates="hero")
    banned_heroes = relationship("BannedHero", back_populates="hero")


class Map(Base):
    __tablename__ = 'maps'

    map_id = Column(Integer, primary_key=True, autoincrement=True)
    map_name = Column(String, nullable=False, unique=True)
    map_type = Column(Enum(MapTypeEnum), nullable=False)

    matches = relationship("Match", back_populates="map")


class BannedHero(Base):
    __tablename__ = 'banned_heroes'

    id = Column(Integer, primary_key=True, autoincrement=True)
    match_id = Column(Integer, ForeignKey('matches.match_id'), nullable=False)
    hero_id = Column(Integer, ForeignKey('heroes.hero_id'), nullable=False)
    team = Column(Enum(TeamEnum), nullable=False)

    match = relationship("Match", back_populates="banned_heroes")
    hero = relationship("Hero", back_populates="banned_heroes")
