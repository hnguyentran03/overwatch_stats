from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session
from models import Base, Hero, Map, RoleEnum, MapTypeEnum


class Database:
    def __init__(self, database_url):
        self.engine = create_engine(database_url, echo=False)
        self.Session = scoped_session(sessionmaker(bind=self.engine))

    def create_tables(self):
        Base.metadata.create_all(self.engine)

    def drop_tables(self):
        Base.metadata.drop_all(self.engine)

    def get_session(self):
        return self.Session()

    def seed_data(self):
        session = self.get_session()
        try:
            # Check if data already exists
            if session.query(Hero).count() > 0 or session.query(Map).count() > 0:
                print("Database already seeded.")
                return

            # Seed Heroes (Overwatch 2 roster as of 2024)
            heroes_data = [
                # Tanks
                ("D.Va", RoleEnum.tank),
                ("Doomfist", RoleEnum.tank),
                ("Junker Queen", RoleEnum.tank),
                ("Mauga", RoleEnum.tank),
                ("Orisa", RoleEnum.tank),
                ("Ramattra", RoleEnum.tank),
                ("Reinhardt", RoleEnum.tank),
                ("Roadhog", RoleEnum.tank),
                ("Sigma", RoleEnum.tank),
                ("Winston", RoleEnum.tank),
                ("Wrecking Ball", RoleEnum.tank),
                ("Zarya", RoleEnum.tank),
                ("Domina", RoleEnum.tank),
                ("Hazard", RoleEnum.tank),
                # DPS
                ("Ashe", RoleEnum.dps),
                ("Bastion", RoleEnum.dps),
                ("Cassidy", RoleEnum.dps),
                ("Echo", RoleEnum.dps),
                ("Genji", RoleEnum.dps),
                ("Hanzo", RoleEnum.dps),
                ("Junkrat", RoleEnum.dps),
                ("Mei", RoleEnum.dps),
                ("Pharah", RoleEnum.dps),
                ("Reaper", RoleEnum.dps),
                ("Sojourn", RoleEnum.dps),
                ("Soldier: 76", RoleEnum.dps),
                ("Sombra", RoleEnum.dps),
                ("Symmetra", RoleEnum.dps),
                ("Torbjörn", RoleEnum.dps),
                ("Tracer", RoleEnum.dps),
                ("Anran", RoleEnum.dps),
                ("Emre", RoleEnum.dps),
                ("Shion", RoleEnum.dps),
                ("Sierra", RoleEnum.dps),
                ("Vendetta", RoleEnum.dps),
                ("Venture", RoleEnum.dps),
                ("Widowmaker", RoleEnum.dps),
                ("Freja", RoleEnum.dps),
                # Support
                ("Ana", RoleEnum.support),
                ("Baptiste", RoleEnum.support),
                ("Brigitte", RoleEnum.support),
                ("Illari", RoleEnum.support),
                ("Kiriko", RoleEnum.support),
                ("Lifeweaver", RoleEnum.support),
                ("Lúcio", RoleEnum.support),
                ("Mercy", RoleEnum.support),
                ("Moira", RoleEnum.support),
                ("Jetpack Cat", RoleEnum.support),
                ("Mizuki", RoleEnum.support),
                ("Wuyang", RoleEnum.support),
                ("Zenyatta", RoleEnum.support),
                ("Juno", RoleEnum.support),
            ]

            for hero_name, role in heroes_data:
                hero = Hero(hero_name=hero_name, role=role)
                session.add(hero)

            # Seed Maps (Overwatch 2 maps)
            maps_data = [
                # Hybrid
                ("Blizzard World", MapTypeEnum.hybrid),
                ("Eichenwalde", MapTypeEnum.hybrid),
                ("Hollywood", MapTypeEnum.hybrid),
                ("King's Row", MapTypeEnum.hybrid),
                ("Midtown", MapTypeEnum.hybrid),
                ("Numbani", MapTypeEnum.hybrid),
                ("Paraíso", MapTypeEnum.hybrid),
                ("Neon Junction", MapTypeEnum.hybrid),
                # Control
                ("Busan", MapTypeEnum.control),
                ("Ilios", MapTypeEnum.control),
                ("Lijiang Tower", MapTypeEnum.control),
                ("Nepal", MapTypeEnum.control),
                ("Oasis", MapTypeEnum.control),
                ("Antarctic Peninsula", MapTypeEnum.control),
                ("Samoa", MapTypeEnum.control),
                # Escort
                ("Circuit Royal", MapTypeEnum.escort),
                ("Dorado", MapTypeEnum.escort),
                ("Havana", MapTypeEnum.escort),
                ("Junkertown", MapTypeEnum.escort),
                ("Rialto", MapTypeEnum.escort),
                ("Route 66", MapTypeEnum.escort),
                ("Shambali Monastery", MapTypeEnum.escort),
                ("Watchpoint: Gibraltar", MapTypeEnum.escort),
                # Push
                ("Colosseo", MapTypeEnum.push),
                ("Esperança", MapTypeEnum.push),
                ("New Queen Street", MapTypeEnum.push),
                ("Runasapi", MapTypeEnum.push),
                # Flashpoint
                ("Aatlis", MapTypeEnum.flashpoint),
                ("New Junk City", MapTypeEnum.flashpoint),
                ("Suravasa", MapTypeEnum.flashpoint),
            ]

            for map_name, map_type in maps_data:
                map_obj = Map(map_name=map_name, map_type=map_type)
                session.add(map_obj)

            session.commit()
            print(f"Database seeded successfully with {len(heroes_data)} heroes and {len(maps_data)} maps.")

        except Exception as e:
            session.rollback()
            print(f"Error seeding database: {e}")
            raise
        finally:
            session.close()


# Global database instance
db_instance = None


def init_db(database_url):
    global db_instance
    db_instance = Database(database_url)
    return db_instance


def get_db():
    return db_instance
