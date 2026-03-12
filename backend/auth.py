"""Simple session token auth (no JWT). Tokens stored in memory."""
import logging
import uuid
from functools import wraps
from flask import request, jsonify, g

logger = logging.getLogger(__name__)

# In-memory: token -> { user_id, email }. Resets on server restart.
_SESSIONS = {}


def encode_token(user_id, email):
    token = str(uuid.uuid4())
    _SESSIONS[token] = {'user_id': user_id, 'email': email}
    return token


def _get_user_from_token(token):
    return _SESSIONS.get(token)


def require_auth(f):
    @wraps(f)
    def wrapped(*args, **kwargs):
        auth = request.headers.get('Authorization')
        if not auth or not auth.startswith('Bearer '):
            return jsonify({'error': 'Authorization token required'}), 401
        token = auth[7:]
        session = _get_user_from_token(token)
        if not session:
            return jsonify({'error': 'Invalid or expired token'}), 401
        g.user_id = session['user_id']
        g.user_email = session.get('email')
        return f(*args, **kwargs)
    return wrapped
