from flask import Flask, jsonify
from flask_cors import CORS
from config import config
from utils.db import init_db
from routes.matches import matches_bp
from routes.players import players_bp
from routes.stats import stats_bp
import os


def create_app(config_name='development'):
    app = Flask(__name__)

    # Load configuration
    app.config.from_object(config[config_name])

    # Enable CORS
    CORS(app, origins=app.config['CORS_ORIGINS'])

    # Initialize database
    database_url = app.config['DATABASE_URL']
    db = init_db(database_url)
    db.create_tables()
    db.seed_data()

    # Register blueprints
    app.register_blueprint(matches_bp, url_prefix='/api')
    app.register_blueprint(players_bp, url_prefix='/api')
    app.register_blueprint(stats_bp, url_prefix='/api')

    # Health check endpoint
    @app.route('/')
    def index():
        return jsonify({
            'message': 'Overwatch Stats API',
            'version': '1.0.0',
            'status': 'running'
        }), 200

    @app.route('/api/health')
    def health():
        return jsonify({'status': 'healthy'}), 200

    return app


if __name__ == '__main__':
    # Get config from environment
    config_name = os.getenv('FLASK_ENV', 'development')
    app = create_app(config_name)

    # Run the app
    port = int(os.getenv('PORT', 5000))
    app.run(
        host='0.0.0.0',
        port=port,
        debug=app.config['DEBUG']
    )
