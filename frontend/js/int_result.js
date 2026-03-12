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
            const res = await fetch(`/api/history/interview/${historyId}`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.status === 401) {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user_name');
                window.location.href = 'login.html';
                return;
            }
            if (!res.ok) {
                document.getElementById('res-overall-feedback').textContent = 'Result not found';
                return;
            }
            const json = await res.json();
            data = json.result;
        } catch (e) {
            document.getElementById('res-overall-feedback').textContent = 'Error loading result';
            return;
        }
    } else {
        const resultData = sessionStorage.getItem('int_analysis_result');
        if (!resultData) {
            window.location.href = 'app.html';
            return;
        }
        data = JSON.parse(resultData);
    }

    if (!data) return;

    try {

        // Overall Score Ring
        const score = data.overall_score;
        document.getElementById('res-overall-score').textContent = score;
        document.getElementById('res-overall-feedback').textContent = data.overall_feedback;
        document.getElementById('res-transcript').textContent = `"${data.transcript}"`;

        if (data.strengths && data.strengths.length) {
            document.getElementById('res-strengths').innerHTML = data.strengths.map(s => `<li>${s}</li>`).join('');
        }
        if (data.question) {
            document.getElementById('res-question').textContent = data.question;
            document.getElementById('question-card').style.display = 'block';
        }
        if (data.language) {
            document.getElementById('res-language').textContent = data.language;
        }

        // Load Audio only when not viewing from history
        if (!historyId) {
            const request = indexedDB.open('VoiceAIDB', 1);
            request.onsuccess = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('audios')) {
                    document.getElementById('audio-unavailable-msg') && (document.getElementById('audio-unavailable-msg').style.display = 'block');
                    return;
                }
                const tx = db.transaction('audios', 'readonly');
                const getReq = tx.objectStore('audios').get('int_audio');
                getReq.onsuccess = () => {
                    const file = getReq.result;
                    if (file) {
                        const audioUrl = URL.createObjectURL(file);
                        const player = document.getElementById('res-audio-player');
                        player.src = audioUrl;
                        player.style.display = 'block';
                    } else {
                        document.getElementById('audio-unavailable-msg') && (document.getElementById('audio-unavailable-msg').style.display = 'block');
                    }
                };
            };
        } else {
            // Show message that audio is not available for historical results
            document.getElementById('audio-unavailable-msg') && (document.getElementById('audio-unavailable-msg').style.display = 'block');
        }

        const ring = document.getElementById('score-ring');
        // Math for circle progress (circumference = 2 * PI * r = 2 * 3.1415 * 70 ≈ 440)
        const circumference = 440;
        const offset = Math.max(0, circumference - (circumference * score / 100));
        
        setTimeout(() => {
            ring.style.strokeDashoffset = offset;
        }, 100);

        if (score >= 80) ring.style.stroke = 'var(--success)';
        else if (score >= 60) ring.style.stroke = 'var(--warning)';
        else ring.style.stroke = 'var(--danger)';

        // Criteria list
        const criteriaList = document.getElementById('res-criteria-list');
        for (const [criterion, critScore] of Object.entries(data.criteria_scores)) {
            
            let gradient = `linear-gradient(90deg, var(--primary), var(--accent))`;
            if (critScore < 60) gradient = `linear-gradient(90deg, var(--danger), #f87171)`;
            else if (critScore < 80) gradient = `linear-gradient(90deg, var(--warning), #fbbf24)`;

            const html = `
                <div class="criterion-item">
                    <div class="criterion-header">
                        <span>${criterion}</span>
                        <span>${critScore}/100</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: 0%; background: ${gradient};"></div>
                    </div>
                </div>
            `;
            criteriaList.insertAdjacentHTML('beforeend', html);
        }

        // Animate fills
        setTimeout(() => {
            const fills = document.querySelectorAll('.progress-fill');
            Object.values(data.criteria_scores).forEach((val, idx) => {
                fills[idx].style.width = `${val}%`;
            });
        }, 300);

        // Suggestions
        const suggList = document.getElementById('res-suggestions');
        if (data.improvement_suggestions && data.improvement_suggestions.length > 0) {
            data.improvement_suggestions.forEach(sugg => {
                suggList.insertAdjacentHTML('beforeend', `<li>${sugg}</li>`);
            });
        } else {
            suggList.innerHTML = '<li style="list-style: none; padding-left: 0;">Great job! You have no major areas to improve.</li>';
        }

    } catch (e) {
        console.error("Error parsing int results", e);
        document.getElementById('res-overall-feedback').textContent = "Failed to load dashboard data.";
    }
});
