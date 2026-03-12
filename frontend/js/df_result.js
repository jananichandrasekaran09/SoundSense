document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const historyId = params.get('historyId');
    let data = null;

    if (historyId) {
        try {
            const res = await fetch(`/api/history/deepfake/${historyId}`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.status === 401) {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user_name');
                window.location.href = 'login.html';
                return;
            }
            if (!res.ok) {
                document.getElementById('res-prediction').textContent = 'Result not found';
                return;
            }
            const json = await res.json();
            data = json.result;
        } catch (e) {
            document.getElementById('res-prediction').textContent = 'Error loading result';
            return;
        }
    } else {
        const resultData = sessionStorage.getItem('df_analysis_result');
        if (!resultData) {
            window.location.href = 'app.html';
            return;
        }
        data = JSON.parse(resultData);
    }

    if (!data) return;

    try {

        const predictionEl = document.getElementById('res-prediction');
        const confCircle = document.getElementById('conf-circle');
        const pulseBg = document.getElementById('pulse-bg');

        const isFake = data.prediction.includes('AI');
        
        // Enhance UI based on fake/real
        if (isFake) {
            predictionEl.textContent = "AI-Generated Voice";
            predictionEl.className = "huge-prediction fake-text";
            confCircle.style.borderColor = "var(--danger)";
            confCircle.style.boxShadow = "0 0 40px rgba(239, 68, 68, 0.4)";
            pulseBg.style.background = "radial-gradient(circle at 50% 50%, rgba(239, 68, 68, 0.15), transparent 70%)";
        } else {
            predictionEl.textContent = "Authentic Human Voice";
            predictionEl.className = "huge-prediction authentic-text";
            confCircle.style.borderColor = "var(--success)";
            confCircle.style.boxShadow = "0 0 40px rgba(16, 185, 129, 0.4)";
            pulseBg.style.background = "radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.15), transparent 70%)";
        }

        document.getElementById('res-confidence').textContent = `${Number(data.confidence).toFixed(1)}%`;
        document.getElementById('res-explanation').textContent = data.explanation;

        const riskEl = document.getElementById('res-risk-badge');
        if (data.risk_level) {
            riskEl.textContent = data.risk_level + ' risk';
            riskEl.className = 'risk-badge ' + (data.risk_level || '').toLowerCase();
        } else riskEl.style.display = 'none';

        const dur = data.duration_sec != null ? Number(data.duration_sec) : null;
        document.getElementById('res-duration').textContent = dur != null ? `Duration: ${dur.toFixed(1)}s` : 'Duration: --';
        document.getElementById('res-duration-val').textContent = dur != null ? `${dur.toFixed(1)} s` : '--';

        const adviceList = document.getElementById('res-advice');
        if (data.advice && data.advice.length) {
            adviceList.innerHTML = data.advice.map(a => `<li>${a}</li>`).join('');
            adviceList.style.display = 'block';
        } else adviceList.style.display = 'none';

        document.getElementById('res-language').textContent = data.language || "Unknown";
        document.getElementById('res-transcript').textContent = data.transcript ? `"${data.transcript}"` : "No spoken words detected clearly.";

        if (data.voice_summary && data.voice_summary.length) {
            const box = document.getElementById('voice-summary-box');
            const list = document.getElementById('res-voice-summary');
            list.innerHTML = data.voice_summary.map(item =>
                `<li><span class="vs-label">${item.label}</span><span class="vs-desc">${item.description}</span></li>`
            ).join('');
            box.style.display = 'block';
        }

        // Load Audio only when not viewing from history (no stored audio for past results)
        if (!historyId) {
            const request = indexedDB.open('VoiceAIDB', 1);
            request.onsuccess = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('audios')) {
                    document.getElementById('audio-unavailable-msg').style.display = 'block';
                    return;
                }
                const tx = db.transaction('audios', 'readonly');
                const getReq = tx.objectStore('audios').get('df_audio');
                getReq.onsuccess = () => {
                    const file = getReq.result;
                    if (file) {
                        const audioUrl = URL.createObjectURL(file);
                        const player = document.getElementById('res-audio-player');
                        player.src = audioUrl;
                        player.style.display = 'block';
                    } else {
                        document.getElementById('audio-unavailable-msg').style.display = 'block';
                    }
                };
            };
        } else {
            // Show message that audio is not available for historical results
            document.getElementById('audio-unavailable-msg').style.display = 'block';
        }

    } catch (e) {
        console.error("Error parsing results:", e);
        document.getElementById('res-prediction').textContent = "Error loading results";
    }
});
