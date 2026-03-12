# SoundSense – Audio Confidence & AI Voice Detection

This project provides:

- **Deepfake / AI voice detection**: Upload audio to detect if the voice is authentic or AI-generated. Returns confidence, risk level (Low/Medium/High), duration, SNR & prosody metrics, advice bullets, transcript, and language.
- **Mock interview evaluation**: Upload interview audio for speech and behavioral analysis (9 criteria, overall score, strengths, improvement suggestions). Optional “interview question” field tailors feedback.
- **History & stats**: Logged per user (JWT). Dashboard shows recent analyses and aggregates (e.g. % AI detected, average interview score).

## How to run the UI

1. **Install dependencies** (from project root):

   ```bash
   cd backend
   python -m venv venv
   venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Optional – environment config**  
   Copy `backend/.env.example` to `backend/.env` and set `SECRET_KEY` (and optionally `PORT`, `FLASK_DEBUG`). If you skip this, defaults are used.

3. **Start the app** (backend serves both API and frontend):

   ```bash
   cd backend
   python app.py
   ```

4. **Open in browser**: **http://localhost:3000**
   - Landing → Sign In (or register).
   - **Deepfake Detection** or **Mock Interview** (optional question) → view results.
   - **History** tab: recent analyses and summary stats.

## Project structure

- **backend/** – Flask API, JWT auth, SQLite (users + deepfake_results + interview_results):
  - `app.py` – Auth (register/login with JWT), protected analyze/evaluate, `/api/history`, `/api/stats`, static frontend.
  - `config.py` – Config from env (SECRET_KEY, PORT, DEBUG).
  - `auth.py` – JWT encode/decode and `@require_auth` for protected routes.
  - `database.py` – Users, insert/get history and stats.
  - `models/deepfake_detector.py` – Acoustic features (MFCC, centroid, ZCR, duration, SNR, prosody), risk level, advice list, transcript.
  - `models/interview_evaluator.py` – STT, NLP, 9 criteria, strengths (top 3), optional question-aware feedback.
- **frontend/** – Static HTML/CSS/JS: landing, login, app (tabs: Deepfake, Interview, History), df_result, int_result. Toasts and optional question input.

## Notes

- **Audio formats**: WAV, MP3, OGG, FLAC. Non-WAV is converted to WAV for speech recognition.
- **Speech-to-text**: Google Speech Recognition (internet required).
- **AI detection**: Heuristic-based (acoustic features); for production use a trained model.
