import sqlite3
import os
import json
import hashlib
import binascii

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'database.db')

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS deepfake_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            prediction TEXT,
            confidence REAL,
            risk_level TEXT,
            duration_sec REAL,
            language TEXT,
            result_json TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS interview_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            overall_score INTEGER,
            language TEXT,
            question TEXT,
            result_json TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')
    # Migration: add result_json if tables already existed without it
    for table, col in [('deepfake_results', 'result_json'), ('interview_results', 'result_json')]:
        try:
            c.execute(f'ALTER TABLE {table} ADD COLUMN {col} TEXT')
        except sqlite3.OperationalError:
            pass
    conn.commit()
    conn.close()

def hash_password(password):
    """Hash a password for storing."""
    # Using simple SHA-256 for demonstration. In prod, use bcrypt/werkzeug.security
    # Adding salt is recommended but kept simple here
    salt = b'antigravity_salt' 
    pwdhash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
    return binascii.hexlify(pwdhash).decode('ascii')

def verify_password(stored_password, provided_password):
    """Verify a stored password against one provided by user"""
    salt = b'antigravity_salt'
    pwdhash = hashlib.pbkdf2_hmac('sha256', provided_password.encode('utf-8'), salt, 100000)
    return stored_password == binascii.hexlify(pwdhash).decode('ascii')

def create_user(name, email, password):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    try:
        hashed_pw = hash_password(password)
        c.execute('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', (name, email, hashed_pw))
        conn.commit()
        return True, "User created successfully"
    except sqlite3.IntegrityError:
        return False, "Email already exists"
    finally:
        conn.close()

def authenticate_user(email, password):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT id, name, password FROM users WHERE email = ?', (email,))
    user = c.fetchone()
    conn.close()

    if user:
        user_id, name, stored_password = user
        if verify_password(stored_password, password):
            return True, {'id': user_id, 'name': name, 'email': email}
        
    return False, None


def insert_deepfake_result(user_id, prediction, confidence, risk_level=None, duration_sec=None, language=None, result_json=None):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''INSERT INTO deepfake_results (user_id, prediction, confidence, risk_level, duration_sec, language, result_json)
                  VALUES (?, ?, ?, ?, ?, ?, ?)''',
              (user_id, prediction, confidence, risk_level, duration_sec, language, result_json))
    conn.commit()
    rid = c.lastrowid
    conn.close()
    return rid


def insert_interview_result(user_id, overall_score, language=None, question=None, result_json=None):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''INSERT INTO interview_results (user_id, overall_score, language, question, result_json)
                  VALUES (?, ?, ?, ?, ?)''',
              (user_id, overall_score, language, question, result_json))
    conn.commit()
    rid = c.lastrowid
    conn.close()
    return rid


def get_history(user_id, limit=50, kind=None):
    """kind: 'deepfake' | 'interview' | None for both interleaved by date."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    out = []
    if kind != 'interview':
        c.execute('''SELECT id, 'deepfake' as type, prediction as title, confidence as score, risk_level, duration_sec, language, created_at
                      FROM deepfake_results WHERE user_id = ? ORDER BY created_at DESC LIMIT ?''', (user_id, limit))
        for row in c.fetchall():
            out.append(dict(row))
    if kind != 'deepfake':
        c.execute('''SELECT id, 'interview' as type, 'Interview' as title, overall_score as score, NULL as risk_level, NULL as duration_sec, language, question, created_at
                      FROM interview_results WHERE user_id = ? ORDER BY created_at DESC LIMIT ?''', (user_id, limit))
        for row in c.fetchall():
            out.append(dict(row))
    conn.close()
    out.sort(key=lambda x: x['created_at'], reverse=True)
    return out[:limit]


def get_history_item(user_id, kind, record_id):
    """Return full result for one history record. For old rows without result_json, build a minimal result from summary columns."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    if kind == 'deepfake':
        c.execute('''SELECT prediction, confidence, risk_level, duration_sec, language, result_json
                      FROM deepfake_results WHERE id = ? AND user_id = ?''', (record_id, user_id))
        row = c.fetchone()
        conn.close()
        if not row:
            return None
        if row['result_json']:
            try:
                return json.loads(row['result_json'])
            except (json.JSONDecodeError, TypeError):
                pass
        # Old record: build minimal result from summary columns
        return {
            'prediction': row['prediction'] or 'Unknown',
            'confidence': row['confidence'] or 0,
            'risk_level': row['risk_level'],
            'duration_sec': row['duration_sec'],
            'language': row['language'] or 'Unknown',
            'explanation': 'Full report was not saved for this older analysis. New analyses will show full details here.',
            'transcript': '',
            'features': {},
            'advice': [],
        }
    else:
        c.execute('''SELECT overall_score, language, question, result_json
                      FROM interview_results WHERE id = ? AND user_id = ?''', (record_id, user_id))
        row = c.fetchone()
        conn.close()
        if not row:
            return None
        if row['result_json']:
            try:
                return json.loads(row['result_json'])
            except (json.JSONDecodeError, TypeError):
                pass
        # Old record: build minimal result from summary columns
        return {
            'overall_score': row['overall_score'] or 0,
            'language': row['language'] or 'Unknown',
            'question': row['question'],
            'transcript': '',
            'overall_feedback': 'Full report was not saved for this older analysis. Run a new evaluation to see the full breakdown and suggestions here.',
            'criteria_scores': {},
            'improvement_suggestions': [],
            'strengths': [],
        }


def get_stats(user_id):
    """Aggregate stats for dashboard."""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''SELECT COUNT(*) as total, SUM(CASE WHEN prediction LIKE '%AI%' THEN 1 ELSE 0 END) as ai_count
                 FROM deepfake_results WHERE user_id = ?''', (user_id,))
    row = c.fetchone()
    df_total = row[0] or 0
    df_ai = row[1] or 0
    c.execute('''SELECT COUNT(*) as total, AVG(overall_score) as avg_score FROM interview_results WHERE user_id = ?''', (user_id,))
    row = c.fetchone()
    int_total = row[0] or 0
    int_avg = round(row[1], 1) if row[1] is not None else None
    conn.close()
    return {
        'deepfake_total': df_total,
        'deepfake_ai_count': df_ai,
        'deepfake_ai_percent': round(100 * df_ai / df_total, 1) if df_total else 0,
        'interview_total': int_total,
        'interview_avg_score': int_avg,
    }
