import os
from app import create_app

# Module-level app for gunicorn (gunicorn wsgi:app). Defaults to production;
# override with FLASK_ENV. Local dev still uses `python app.py`.
app = create_app(os.getenv('FLASK_ENV', 'production'))
