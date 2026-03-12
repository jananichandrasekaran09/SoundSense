document.addEventListener('DOMContentLoaded', () => {

    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    const authHeaders = () => ({ 'Authorization': `Bearer ${token}` });

    function toast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const el = document.createElement('div');
        el.className = `toast toast-${type}`;
        el.textContent = message;
        container.appendChild(el);
        setTimeout(() => el.remove(), 4000);
    }

    const userName = localStorage.getItem('user_name') || 'User';
    document.getElementById('user-display-name').textContent = userName;

    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_name');
        window.location.href = 'login.html';
    });

    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.add('hidden'));
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-tab');
            document.getElementById(targetId).classList.remove('hidden');
            if (targetId === 'history') {
                loadHistory();
                loadStats();
            }
        });
    });

    // File Upload Handlers (Deepfake)
    setupFileUpload('df');
    // File Upload Handlers (Interview)
    setupFileUpload('int');

    function setupFileUpload(module) {
        const dropArea = document.getElementById(`drop-area-${module}`);
        const fileInput = document.getElementById(`file-${module}`);
        const fileNameDisplay = document.getElementById(`file-name-${module}`);
        const analyzeBtn = document.getElementById(`analyze-btn-${module}`);
        const recordBtn = document.getElementById(`record-btn-${module}`);

        let mediaRecorder;
        let audioChunks = [];
        let isRecording = false;

        // Recording logic
        recordBtn.addEventListener('click', async () => {
            if (!isRecording) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    mediaRecorder = new MediaRecorder(stream);
                    audioChunks = [];

                    mediaRecorder.addEventListener('dataavailable', event => {
                        audioChunks.push(event.data);
                    });

                    mediaRecorder.addEventListener('stop', () => {
                        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                        // Create a file object from blob
                        const file = new File([audioBlob], "live_recording.wav", { type: 'audio/wav' });
                        
                        fileNameDisplay.textContent = `Selected: Live Recording (${Math.round(file.size / 1024)} KB)`;
                        fileNameDisplay.style.color = 'var(--text-light)';
                        analyzeBtn.disabled = false;
                        analyzeBtn.onclick = () => processFile(file, module);
                        
                        stream.getTracks().forEach(track => track.stop());
                    });

                    mediaRecorder.start();
                    isRecording = true;
                    recordBtn.innerHTML = '<i class="fa-solid fa-stop"></i> Stop Recording';
                    recordBtn.style.backgroundColor = 'var(--danger)';
                    recordBtn.classList.add('pulse-animation');
                } catch (err) {
                    console.error("Microphone access denied:", err);
                    alert("Please allow microphone access to record audio.");
                }
            } else {
                mediaRecorder.stop();
                isRecording = false;
                recordBtn.innerHTML = '<i class="fa-solid fa-microphone"></i> Record Live';
                recordBtn.style.backgroundColor = '';
                recordBtn.classList.remove('pulse-animation');
            }
        });

        // Drag events
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => dropArea.classList.add('dragover'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => dropArea.classList.remove('dragover'), false);
        });

        dropArea.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            handleFiles(files);
        });

        fileInput.addEventListener('change', function() {
            handleFiles(this.files);
        });

        function handleFiles(files) {
            if (files.length > 0) {
                const file = files[0];
                const validTypes = ['audio/wav', 'audio/mpeg', 'audio/ogg', 'audio/flac'];
                if (validTypes.includes(file.type) || file.name.match(/\.(wav|mp3|ogg|flac)$/i)) {
                    fileNameDisplay.textContent = `Selected: ${file.name}`;
                    analyzeBtn.disabled = false;
                    
                    // Attach file to button for processing
                    analyzeBtn.onclick = () => processFile(file, module);
                } else {
                    fileNameDisplay.textContent = 'Please select a valid audio file (.wav, .mp3, .ogg)';
                    fileNameDisplay.style.color = 'var(--danger)';
                    analyzeBtn.disabled = true;
                }
            }
        }
    }

    function handle401(res) {
        if (res && res.status === 401) {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_name');
            window.location.href = 'login.html';
            return true;
        }
        return false;
    }

    async function loadStats() {
        try {
            const res = await fetch('/api/stats', { headers: authHeaders() });
            if (handle401(res)) return;
            if (!res.ok) return;
            const s = await res.json();
            document.getElementById('stat-df-total').textContent = s.deepfake_total || 0;
            document.getElementById('stat-df-ai').textContent = (s.deepfake_ai_percent != null ? s.deepfake_ai_percent + '%' : '0%');
            document.getElementById('stat-int-total').textContent = s.interview_total || 0;
            document.getElementById('stat-int-avg').textContent = s.interview_avg_score != null ? s.interview_avg_score : '--';
        } catch (e) {
            console.warn('Stats load failed', e);
        }
    }

    async function loadHistory() {
        const listEl = document.getElementById('history-list');
        if (!listEl) return;
        try {
            const res = await fetch('/api/history?limit=30', { headers: authHeaders() });
            if (!res.ok) {
                listEl.innerHTML = '<p class="text-muted">Could not load history.</p>';
                return;
            }
            const data = await res.json();
            const items = data.history || [];
            if (items.length === 0) {
                listEl.innerHTML = '<p class="text-muted">No analyses yet. Run an AI Voice Check or Interview Coach.</p>';
                return;
            }
            listEl.innerHTML = items.map(item => {
                const date = new Date(item.created_at).toLocaleString();
                const typeLabel = item.type === 'deepfake' ? 'AI Voice Check' : 'Interview Coach';
                const score = item.score != null ? item.score : '--';
                const extra = item.risk_level ? ` · ${item.risk_level}` : '';
                const viewUrl = item.type === 'deepfake' ? `df_result.html?historyId=${item.id}` : `int_result.html?historyId=${item.id}`;
                return `<div class="history-item">
                    <span class="history-type">${typeLabel}</span>
                    <span class="history-title">${item.title || typeLabel}</span>
                    <span class="history-meta">${score}${item.type === 'deepfake' ? '%' : '/100'}${extra} · ${date}</span>
                    <a href="${viewUrl}" class="history-view-btn">View</a>
                </div>`;
            }).join('');
        } catch (e) {
            listEl.innerHTML = '<p class="text-muted">Could not load history.</p>';
        }
    }

    async function processFile(file, module) {
        const formData = new FormData();
        formData.append('audio', file);
        if (module === 'int') {
            const q = document.getElementById('interview-question');
            if (q && q.value.trim()) formData.append('question', q.value.trim());
        }

        const analyzeBtn = document.getElementById(`analyze-btn-${module}`);
        const loadingState = document.getElementById(`loading-${module}`);
        analyzeBtn.disabled = true;
        loadingState.classList.remove('hidden');

        try {
            const endpoint = module === 'df' ? '/api/analyze-deepfake' : '/api/evaluate-interview';
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: authHeaders(),
                body: formData
            });

            if (handle401(response)) return;

            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.error || 'API Error');
            loadingState.classList.add('hidden');

            try {
                const db = await new Promise((resolve, reject) => {
                    const req = indexedDB.open('VoiceAIDB', 1);
                    req.onupgradeneeded = e => e.target.result.createObjectStore('audios');
                    req.onsuccess = e => resolve(e.target.result);
                    req.onerror = e => reject(e.target.error);
                });
                const tx = db.transaction('audios', 'readwrite');
                tx.objectStore('audios').put(file, module + '_audio');
                await new Promise(r => tx.oncomplete = r);
            } catch (e) {
                console.warn('IndexedDB save failed', e);
            }

            if (module === 'df') {
                sessionStorage.setItem('df_analysis_result', JSON.stringify(data));
                window.location.href = 'df_result.html';
            } else {
                sessionStorage.setItem('int_analysis_result', JSON.stringify(data));
                window.location.href = 'int_result.html';
            }
        } catch (error) {
            console.error('Error:', error);
            loadingState.classList.add('hidden');
            toast(error.message || 'Analysis failed', 'error');
        } finally {
            analyzeBtn.disabled = false;
        }
    }
});
