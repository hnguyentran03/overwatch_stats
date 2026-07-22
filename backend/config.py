import os


class Config:
    # Database configuration
    # Default to SQLite for development, use PostgreSQL for production
    DATABASE_URL = os.getenv(
        'DATABASE_URL',
        'sqlite:///overwatch_stats.db'  # Default to SQLite for easy setup
    )

    # Flask configuration
    DEBUG = os.getenv('DEBUG', 'True') == 'True'
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')

    # CORS configuration
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', 'http://localhost:3000').split(',')


class DevelopmentConfig(Config):
    DEBUG = True
    DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///overwatch_stats.db')


class ProductionConfig(Config):
    DEBUG = False


config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
