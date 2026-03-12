"""App configuration from environment variables."""
import os
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-change-in-production'
PORT = int(os.environ.get('PORT', 3000))
DEBUG = os.environ.get('FLASK_DEBUG', 'true').lower() in ('1', 'true', 'yes')
