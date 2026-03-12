import os
import json
import logging
from flask import Flask, request, jsonify, send_from_directory, send_file, g
from flask_cors import CORS
from werkzeug.utils import secure_filename

from config import PORT, DEBUG
from auth import encode_token, require_auth
from models.deepfake_detector import analyze_deepfake
from models.interview_evaluator import evaluate_interview
from database import (
    init_db, create_user, authenticate_user,
    insert_deepfake_result, insert_interview_result, get_history, get_stats, get_history_item
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

init_db()

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(_BASE_DIR, '..', 'frontend')
UPLOAD_FOLDER = os.path.join(_BASE_DIR, 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16 MB max upload size

ALLOWED_EXTENSIONS = {'wav', 'mp3', 'ogg', 'flac'}


def _serve_frontend(path=''):
    """Serve frontend static files; path is relative to frontend folder."""
    if path and path != '':
        full = os.path.join(FRONTEND_DIR, path)
        if os.path.isfile(full):
            return send_from_directory(FRONTEND_DIR, path)
        return "Not Found", 404
    return send_file(os.path.join(FRONTEND_DIR, 'index.html'))


@app.route('/')
def home():
    return _serve_frontend('index.html')


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# --- Authentication Routes ---
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password') or not data.get('name'):
        return jsonify({'error': 'Missing required fields'}), 400
        
    success, message = create_user(data['name'], data['email'], data['password'])
    if success:
        return jsonify({'message': message}), 201
    else:
        return jsonify({'error': message}), 400

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Missing email or password'}), 400
    success, result = authenticate_user(data['email'], data['password'])
    if success:
        token = encode_token(result['id'], result['email'])
        return jsonify({
            'message': 'Login successful',
            'token': token,
            'name': result['name'],
            'email': result['email']
        }), 200
    return jsonify({'error': 'Invalid credentials'}), 401


@app.route('/api/analyze-deepfake', methods=['POST'])
@require_auth
def handle_deepfake_analysis():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file provided'}), 400
    file = request.files['audio']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if not file or not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file format'}), 400
    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)
    try:
        result = analyze_deepfake(filepath)
        insert_deepfake_result(
            user_id=g.user_id,
            prediction=result.get('prediction', ''),
            confidence=result.get('confidence', 0),
            risk_level=result.get('risk_level'),
            duration_sec=result.get('duration_sec'),
            language=result.get('language'),
            result_json=json.dumps(result),
        )
        return jsonify(result)
    except Exception as e:
        logger.exception("Deepfake analysis failed")
        return jsonify({'error': str(e)}), 500
    finally:
        if os.path.exists(filepath):
            os.remove(filepath)


@app.route('/api/evaluate-interview', methods=['POST'])
@require_auth
def handle_interview_evaluation():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file provided'}), 400
    file = request.files['audio']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    if not file or not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file format'}), 400
    question = request.form.get('question', '').strip() or None
    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)
    try:
        result = evaluate_interview(filepath, question=question)
        insert_interview_result(
            user_id=g.user_id,
            overall_score=result.get('overall_score', 0),
            language=result.get('language'),
            question=question,
            result_json=json.dumps(result),
        )
        return jsonify(result)
    except Exception as e:
        logger.exception("Interview evaluation failed")
        return jsonify({'error': str(e)}), 500
    finally:
        if os.path.exists(filepath):
            os.remove(filepath)


@app.route('/api/history', methods=['GET'])
@require_auth
def api_history():
    kind = request.args.get('kind')  # 'deepfake' | 'interview' | None
    limit = min(int(request.args.get('limit', 50)), 100)
    items = get_history(g.user_id, limit=limit, kind=kind)
    for item in items:
        item['created_at'] = item['created_at']
    return jsonify({'history': items})


@app.route('/api/history/<kind>/<int:record_id>', methods=['GET'])
@require_auth
def api_history_item(kind, record_id):
    if kind not in ('deepfake', 'interview'):
        return jsonify({'error': 'Invalid type'}), 400
    result = get_history_item(g.user_id, kind, record_id)
    if result is None:
        return jsonify({'error': 'Not found'}), 404
    return jsonify({'type': kind, 'result': result})


@app.route('/api/stats', methods=['GET'])
@require_auth
def api_stats():
    return jsonify(get_stats(g.user_id))


@app.route('/<path:path>')
def serve_static(path):
    """Serve frontend HTML/CSS/JS so UI works at http://localhost:3000 (register last)."""
    if path.startswith('api/'):
        return "Not Found", 404
    return _serve_frontend(path)


if __name__ == '__main__':
    app.run(debug=DEBUG, port=PORT)
