const DB_NAME = 'MonsterDriveDB'; const STORE_NAME = 'files'; let db;
        const initDB = () => { const r = indexedDB.open(DB_NAME, 1); r.onupgradeneeded = (e) => { const d = e.target.result; if (!d.objectStoreNames.contains(STORE_NAME)) d.createObjectStore(STORE_NAME, { keyPath: 'id' }); }; r.onsuccess = (e) => { db = e.target.result; renderFiles(); }; r.onerror = (e) => console.error("DB Error", e); };

        const defaultData = { 
            tasks: [{id: 1, title: "Welcome! Add tasks.", day: new Date().getDay()-1, completed: false}], 
            habits: [], 
            goals: [], 
            exams: [], 
            notes: "<h1>My Notes</h1><p>Start typing here...</p>", 
            timetable: Array(24).fill(""), 
            currentVideo: "WQoB2z67hvY", 
            playlist: [
                {id: 'WQoB2z67hvY', title: 'Intro to Programming (DSA)', completed: false},
                {id: 'tHqmt18Upy0', title: 'Flowcharts & Pseudocode', completed: false},
                {id: '0fWrXwdfeKA', title: 'Variables & Datatypes', completed: false}
            ],
            settings: { name: "Captain", darkMode: false, notifications: false }, 
            analytics: { focusMinutes: 0 } 
        };
        
        let appData = JSON.parse(localStorage.getItem('monster_v14')) || defaultData;
        
        if(!appData.analytics) appData.analytics = { focusMinutes: 0 }; 
        if(!appData.goals) appData.goals = [];
        if(!appData.timetable || appData.timetable.length !== 24) appData.timetable = Array(24).fill("");
        if(!appData.playlist) appData.playlist = defaultData.playlist;

        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

        function init() { try { initDB(); checkDailyHabits(); applySettings(); renderApp(); initWhiteboard(); } catch (e) { console.error("Init failed", e); } }
        function saveData() { localStorage.setItem('monster_v14', JSON.stringify(appData)); renderApp(); }

        function toggleSidebar() { document.getElementById('sidebar').classList.toggle('expanded'); }
        
        function switchView(view) {
            document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active')); document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
            const viewEl = document.getElementById(`view-${view}`); if(viewEl) viewEl.classList.add('active');
            const btn = document.getElementById(`btn-${view}`); if(btn) btn.classList.add('active');
            document.getElementById('page-title').innerText = view.charAt(0).toUpperCase() + view.slice(1);
            
            if(view === 'focus') {
                document.getElementById('editor').innerHTML = appData.notes || "";
                renderPlaylist();
                if(window.YT && window.YT.Player && !player) {
                    loadPlayer(appData.currentVideo);
                } else if (!window.YT) {
                } else if(player) {
                }
            }
            if(view === 'timetable') renderTimetable();
            if(view === 'whiteboard') setTimeout(resizeCanvas, 50); 
            if(view === 'analytics') setTimeout(renderAnalytics, 50);
            if(view === 'dashboard') setTimeout(updateCharts, 50);
        }

        let player;
        let sessionTimerInt;
        let sessionSeconds = 0;

        function onYouTubeIframeAPIReady() {
            if(document.getElementById('view-focus').classList.contains('active')) {
                loadPlayer(appData.currentVideo);
            }
        }

        function extractVideoID(url) {
            url = url.trim();
            if (url.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(url)) {
                return url;
            }
            try {
                const urlObj = new URL(url);
                if (urlObj.hostname.includes('youtu.be')) return urlObj.pathname.slice(1);
                if (urlObj.hostname.includes('youtube.com')) {
                    if (urlObj.searchParams.has('v')) return urlObj.searchParams.get('v');
                    const pathParts = urlObj.pathname.split('/');
                    if (pathParts.includes('embed') || pathParts.includes('shorts') || pathParts.includes('v')) return pathParts[pathParts.length - 1];
                }
            } catch (e) {
                const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
                const match = url.match(regExp);
                if (match && match[2].length === 11) return match[2];
            }
            return false;
        }

        function loadPlayer(videoId) {
            if (!window.YT || !window.YT.Player) {
                setTimeout(() => loadPlayer(videoId), 1000);
                return;
            }
            if (player && typeof player.loadVideoById === 'function') {
                player.loadVideoById(videoId);
            } else {
                if(player) { try { player.destroy(); } catch(e){} }
                player = new YT.Player('yt-player-container', {
                    height: '100%',
                    width: '100%',
                    videoId: videoId,
                    playerVars: { 'playsinline': 1, 'rel': 0 },
                    events: { 'onStateChange': onPlayerStateChange }
                });
            }
        }

        function onPlayerStateChange(event) {
            if (event.data == YT.PlayerState.PLAYING) {
                startSessionTimer();
            } else if (event.data == YT.PlayerState.PAUSED || event.data == YT.PlayerState.ENDED) {
                stopSessionTimer();
            }
        }

        function startSessionTimer() {
            if(sessionTimerInt) return;
            document.getElementById('yt-status').innerText = "Tracking Time...";
            sessionTimerInt = setInterval(() => {
                sessionSeconds++;
                updateSessionDisplay();
                
                if(sessionSeconds % 60 === 0) {
                    if(!appData.analytics) appData.analytics = { focusMinutes: 0 };
                    appData.analytics.focusMinutes++;
                    saveData();
                }
            }, 1000);
        }

        function stopSessionTimer() {
            clearInterval(sessionTimerInt);
            sessionTimerInt = null;
            document.getElementById('yt-status').innerText = "Paused";
        }

        function resetSessionTimer() {
            stopSessionTimer();
            sessionSeconds = 0;
            updateSessionDisplay();
            if(player && player.getPlayerState() === YT.PlayerState.PLAYING) {
                startSessionTimer();
            }
        }

        function updateSessionDisplay() {
            const hrs = Math.floor(sessionSeconds / 3600);
            const mins = Math.floor((sessionSeconds % 3600) / 60);
            const secs = sessionSeconds % 60;
            document.getElementById('session-timer').innerText = 
                `${String(hrs).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
        }

        function formatDoc(cmd, value = null) {
            if(value) {
                document.execCommand(cmd, false, value);
            } else {
                document.execCommand(cmd);
            }
            document.getElementById('editor').focus();
        }
        function saveNotes() { 
            appData.notes = document.getElementById('editor').innerHTML; 
            localStorage.setItem('monster_v14', JSON.stringify(appData)); 
        }

        function addToPlaylist() {
            const urlInput = document.getElementById('playlist-input');
            const titleInput = document.getElementById('playlist-title');
            
            const url = urlInput.value;
            const id = extractVideoID(url);
            
            if (id) {
                const title = titleInput.value.trim() || `Video ${appData.playlist.length + 1}`;
                if(appData.playlist.some(v => v.id === id)) {
                    alert("This video is already in your playlist!");
                    urlInput.value = '';
                    return;
                }
                appData.playlist.push({ id, title, completed: false });
                urlInput.value = '';
                titleInput.value = '';
                saveData();
                renderPlaylist();
                const container = document.getElementById('playlist-container');
                container.scrollTop = container.scrollHeight;
            } else {
                alert("Invalid YouTube URL. Please use a valid link (Video, Short, or ID).");
            }
        }

        // UPDATED: More robust playlist rendering
        function renderPlaylist() {
            const container = document.getElementById('playlist-container');
            const progLabel = document.getElementById('playlist-progress');
            
            if(!container) return;
            
            // Safety check
            if (!Array.isArray(appData.playlist)) {
                appData.playlist = [];
            }

            container.innerHTML = '';
            
            const total = appData.playlist.length;
            const done = appData.playlist.filter(v => v.completed).length;
            const pct = total ? Math.round((done/total)*100) : 0;
            if(progLabel) progLabel.innerText = `${pct}% Done`;

            if (total === 0) {
                container.innerHTML = `
                    <div class="flex flex-col items-center justify-center h-full text-gray-400 opacity-60">
                        <i class="ph-duotone ph-playlist text-4xl mb-2"></i>
                        <p class="text-xs">Playlist is empty</p>
                    </div>
                `;
                return;
            }

            appData.playlist.forEach((video, index) => {
                const isActive = video.id === appData.currentVideo;
                const activeClass = isActive ? 'bg-indigo-50 border-[#6C5DD3] dark:bg-indigo-900/20' : 'bg-white border-transparent dark:bg-gray-800';
                
                container.innerHTML += `
                    <div class="flex items-center gap-2 p-2 rounded-xl border hover:bg-gray-50 dark:hover:bg-gray-700 transition group ${activeClass}">
                        <div onclick="toggleVideoStatus(${index})" class="cursor-pointer text-xl ${video.completed ? 'text-green-500' : 'text-gray-300 hover:text-green-400'}">
                            <i class="${video.completed ? 'ph-fill ph-check-circle' : 'ph-bold ph-circle'}"></i>
                        </div>
                        <div onclick="playFromList('${video.id}')" class="flex-1 cursor-pointer truncate">
                            <h4 class="text-xs font-bold ${video.completed ? 'text-gray-400 line-through' : ''}">${video.title}</h4>
                            <span class="text-[10px] text-gray-400">ID: ${video.id}</span>
                        </div>
                        <button onclick="removeFromPlaylist(${index})" class="opacity-0 group-hover:opacity-100 text-red-400 text-xs"><i class="ph-bold ph-trash"></i></button>
                    </div>
                `;
            });
        }

        function playFromList(id) {
            appData.currentVideo = id;
            saveData();
            loadPlayer(id);
            renderPlaylist(); 
        }

        function toggleVideoStatus(index) {
            appData.playlist[index].completed = !appData.playlist[index].completed;
            saveData();
            renderPlaylist();
        }

        function removeFromPlaylist(index) {
            if(confirm("Remove this video?")) {
                appData.playlist.splice(index, 1);
                saveData();
                renderPlaylist();
            }
        }

        function renderTimetable() {
            const container = document.getElementById('timetable-container');
            if(!container) return;
            container.innerHTML = '';
            const currentHour = new Date().getHours();

            appData.timetable.forEach((activity, hour) => {
                const isCurrent = hour === currentHour;
                const timeLabel = `${String(hour).padStart(2, '0')}:00`;
                const activeClass = isCurrent ? 'border-[#6C5DD3] ring-1 ring-[#6C5DD3] bg-indigo-50 dark:bg-indigo-900/20 shadow-md' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800';
                
                container.innerHTML += `
                    <div class="flex items-center gap-3 p-3 rounded-xl border ${activeClass} transition-all">
                        <div class="w-14 font-mono font-bold text-gray-500 dark:text-gray-400 ${isCurrent ? 'text-[#6C5DD3] dark:text-[#6C5DD3]' : ''}">${timeLabel}</div>
                        <input type="text" 
                            value="${activity}" 
                            placeholder="Plan for ${timeLabel}..." 
                            onchange="updateTimetable(${hour}, this.value)"
                            class="flex-1 bg-transparent border-none focus:outline-none text-sm font-medium dark:text-gray-200 placeholder-gray-400"
                        >
                    </div>
                `;
            });
        }

        function updateTimetable(hour, val) { appData.timetable[hour] = val; saveData(); }
        function clearTimetable() { if(confirm("Clear entire 24h schedule?")) { appData.timetable = Array(24).fill(""); saveData(); renderTimetable(); } }

        function applySettings() {
            const name = appData.settings.name || "S"; document.getElementById('user-avatar').innerText = name.charAt(0).toUpperCase(); document.getElementById('setting-name').value = name;
            const html = document.documentElement; const btnDark = document.getElementById('btn-darkmode').firstElementChild;
            if (appData.settings.darkMode) { html.classList.add('dark'); document.getElementById('btn-darkmode').classList.replace('bg-gray-300', 'bg-[#6C5DD3]'); btnDark.style.transform = 'translateX(24px)'; } 
            else { html.classList.remove('dark'); document.getElementById('btn-darkmode').classList.replace('bg-[#6C5DD3]', 'bg-gray-300'); btnDark.style.transform = 'translateX(0)'; }
            const btnNotif = document.getElementById('btn-notif').firstElementChild;
            if (appData.settings.notifications) { document.getElementById('btn-notif').classList.replace('bg-gray-300', 'bg-[#6C5DD3]'); btnNotif.style.transform = 'translateX(24px)'; } 
            else { document.getElementById('btn-notif').classList.replace('bg-[#6C5DD3]', 'bg-gray-300'); btnNotif.style.transform = 'translateX(0)'; }
        }
        function saveProfileSettings() { appData.settings.name = document.getElementById('setting-name').value; saveData(); applySettings(); alert("Profile Updated!"); }
        function toggleDarkMode() { appData.settings.darkMode = !appData.settings.darkMode; saveData(); applySettings(); }
        function toggleNotifications() { if (!appData.settings.notifications) { Notification.requestPermission().then(p => { if (p === "granted") { appData.settings.notifications = true; saveData(); applySettings(); } else alert("Denied."); }); } else { appData.settings.notifications = false; saveData(); applySettings(); } }
        function clearData() { if(confirm("Factory Reset: Delete ALL data?")) { localStorage.removeItem('monster_v14'); try { db.transaction([STORE_NAME], 'readwrite').objectStore(STORE_NAME).clear(); } catch(e){} location.reload(); } }

        function uploadFile() { const input = document.getElementById('file-input'); const file = input.files[0]; if(!file) return; document.getElementById('upload-loading').classList.remove('hidden'); const fileData = { id: Date.now(), name: file.name, type: file.type, size: (file.size / (1024 * 1024)).toFixed(2) + ' MB', blob: file }; db.transaction([STORE_NAME], 'readwrite').objectStore(STORE_NAME).add(fileData).onsuccess = () => { input.value = ''; document.getElementById('upload-loading').classList.add('hidden'); renderFiles(); }; }
        function deleteFile(id) { if(confirm("Delete?")) db.transaction([STORE_NAME], 'readwrite').objectStore(STORE_NAME).delete(id).onsuccess = () => renderFiles(); }
        function renderFiles() { const container = document.getElementById('file-list'); if(!container || !db) return; container.innerHTML = ''; db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME).getAll().onsuccess = (e) => { const files = e.target.result; if(files.length === 0) { container.innerHTML = '<p class="text-gray-400 col-span-3 text-center">No files yet.</p>'; return; } files.forEach(f => { const url = URL.createObjectURL(f.blob); container.innerHTML += `<div class="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700 relative group"><div class="flex items-center gap-3 mb-2 overflow-hidden"><i class="ph-fill ph-file text-3xl text-[#6C5DD3]"></i><div class="truncate"><h4 class="font-bold text-sm">${f.name}</h4><p class="text-xs text-gray-500">${f.size}</p></div></div><div class="flex gap-2"><a href="${url}" download="${f.name}" class="flex-1 text-center bg-white dark:bg-gray-700 border dark:border-gray-600 text-xs py-1 rounded hover:bg-gray-50">Download</a><button onclick="previewFile(${f.id})" class="flex-1 text-center bg-[#6C5DD3] text-white text-xs py-1 rounded hover:opacity-90">View</button></div><button onclick="deleteFile(${f.id})" class="absolute top-2 right-2 text-red-400 opacity-0 group-hover:opacity-100 transition"><i class="ph-bold ph-trash"></i></button></div>`; }); }; }
        function previewFile(id) { db.transaction([STORE_NAME], 'readonly').objectStore(STORE_NAME).get(id).onsuccess = (e) => { const f = e.target.result; if(!f) return; const url = URL.createObjectURL(f.blob); const modal = document.getElementById('modal-preview'); const content = document.getElementById('preview-content'); document.getElementById('preview-title').innerText = f.name; content.innerHTML = ''; if(f.type.startsWith('image/')) { content.innerHTML = `<img src="${url}" class="max-w-full max-h-[80vh] rounded-lg shadow-lg">`; modal.classList.remove('hidden'); } else if(f.type === 'application/pdf') { content.innerHTML = `<iframe src="${url}" class="w-full h-[80vh] rounded-lg border-none"></iframe>`; modal.classList.remove('hidden'); } else { alert("This file type cannot be previewed. Please download it."); } }; }

        function openModal() { document.getElementById('modal').classList.remove('hidden'); }
        function saveTask() { const title = document.getElementById('input-title').value; const day = parseInt(document.getElementById('input-day').value); if(!title) return; appData.tasks.push({ id: Date.now(), title, day, completed: false }); document.getElementById('modal').classList.add('hidden'); saveData(); switchView('dashboard'); }
        function toggleTask(id) { const t = appData.tasks.find(x => x.id === id); if(t) { t.completed = !t.completed; saveData(); } }
        function deleteTask(id) { appData.tasks = appData.tasks.filter(x => x.id !== id); saveData(); }
        
        function checkDailyHabits() {
            const today = new Date();
            today.setHours(0,0,0,0);
            
            let changed = false;
            
            appData.habits.forEach(h => {
                if (!h.lastDate) return;

                const last = new Date(h.lastDate);
                last.setHours(0,0,0,0);
                
                const diffTime = Math.abs(today - last);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

                if (diffDays >= 1) {
                    if(h.completed) {
                        h.completed = false;
                        changed = true;
                    }
                }
                
                if (diffDays > 1) {
                    h.streak = 0;
                    changed = true;
                }
            });
            if(changed) saveData();
        }

        function addHabit() { const t = document.getElementById('habit-input').value; if(t) { appData.habits.push({ id: Date.now(), title: t, streak: 0, completed: false, lastDate: null }); document.getElementById('habit-input').value=''; saveData(); } }
        
        function toggleHabit(id) {
            const h = appData.habits.find(x => x.id === id);
            if(h) {
                const today = new Date().toDateString();
                
                if (!h.completed) {
                    h.completed = true;
                    h.lastDate = today;
                    h.streak++;
                } else {
                    h.completed = false;
                    if(h.streak > 0) h.streak--;
                }
                saveData();
            }
        }
        
        function resetHabitStreak(id) {
            const h = appData.habits.find(x => x.id === id);
            if(h && confirm("Didn't do it fully? Reset streak to 0?")) {
                h.streak = 0;
                h.completed = false;
                saveData();
            }
        }

        function deleteHabit(id) { appData.habits = appData.habits.filter(x => x.id !== id); saveData(); }
        function addGoal() { const t = document.getElementById('goal-input').value; if(t) { appData.goals.push({ id: Date.now(), title: t, achieved: false }); document.getElementById('goal-input').value=''; saveData(); } }
        function toggleGoal(id) { const g = appData.goals.find(x => x.id === id); if(g) { g.achieved = !g.achieved; saveData(); } }
        function deleteGoal(id) { appData.goals = appData.goals.filter(x => x.id !== id); saveData(); }
        function saveExam() { const s = document.getElementById('exam-subj').value; const d = document.getElementById('exam-date').value; if(s && d) { appData.exams.push({ id: Date.now(), subject: s, date: d }); document.getElementById('modal-exam').classList.add('hidden'); saveData(); } }
        function deleteExam(id) { appData.exams = appData.exams.filter(x => x.id !== id); saveData(); }
        
        let canvas, ctx, isDrawing = false;
        function initWhiteboard() { canvas = document.getElementById('whiteboard'); ctx = canvas.getContext('2d'); window.addEventListener('resize', resizeCanvas); canvas.addEventListener('mousedown', startDraw); canvas.addEventListener('mousemove', draw); canvas.addEventListener('mouseup', stopDraw); canvas.addEventListener('mouseout', stopDraw); canvas.addEventListener('touchstart', (e) => { startDraw(e.touches[0]); e.preventDefault(); }); canvas.addEventListener('touchmove', (e) => { draw(e.touches[0]); e.preventDefault(); }); canvas.addEventListener('touchend', stopDraw); setTimeout(resizeCanvas, 500); }
        function resizeCanvas() { const parent = canvas.parentElement; if(parent.clientWidth > 0 && parent.clientHeight > 0) { const tempCanvas = document.createElement('canvas'); const tempCtx = tempCanvas.getContext('2d'); tempCanvas.width = canvas.width; tempCanvas.height = canvas.height; tempCtx.drawImage(canvas, 0, 0); canvas.width = parent.clientWidth; canvas.height = parent.clientHeight; ctx.drawImage(tempCanvas, 0, 0); ctx.strokeStyle = '#000000'; ctx.lineWidth = 3; ctx.lineCap = 'round'; } }
        function startDraw(e) { isDrawing = true; ctx.beginPath(); const rect = canvas.getBoundingClientRect(); ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top); }
        function draw(e) { if (!isDrawing) return; const rect = canvas.getBoundingClientRect(); ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top); ctx.stroke(); }
        function stopDraw() { isDrawing = false; }
        function setPenColor(color) { ctx.strokeStyle = color; ctx.lineWidth = color === '#ffffff' ? 20 : 3; }
        function clearCanvas() { ctx.clearRect(0, 0, canvas.width, canvas.height); }
        function downloadCanvas() { const link = document.createElement('a'); link.download = 'whiteboard.png'; const t = document.createElement('canvas'); t.width=canvas.width; t.height=canvas.height; const tx=t.getContext('2d'); tx.fillStyle='#fff'; tx.fillRect(0,0,t.width,t.height); tx.drawImage(canvas,0,0); link.href = t.toDataURL(); link.click(); }

        let doughnutChart, barChart, dashChart;
        function renderAnalytics() {
            const viewEl = document.getElementById('view-analytics'); if(!viewEl || viewEl.style.display === 'none' && !viewEl.classList.contains('active')) return;
            document.getElementById('ana-task-total').innerText = appData.tasks.length;
            const ctxDough = document.getElementById('doughnutChart').getContext('2d'); if(doughnutChart) doughnutChart.destroy(); const doneTasks = appData.tasks.filter(t => t.completed).length; const pendingTasks = appData.tasks.length - doneTasks;
            doughnutChart = new Chart(ctxDough, { type: 'doughnut', data: { labels: ['Done', 'Pending'], datasets: [{ data: [doneTasks, pendingTasks], backgroundColor: ['#6C5DD3', '#e2e8f0'], borderWidth: 0, hoverOffset: 10 }] }, options: { cutout: '70%', plugins: { legend: { display: false } } } });
            const ctxBar = document.getElementById('barChart').getContext('2d'); if(barChart) barChart.destroy(); const hLabels = appData.habits.length ? appData.habits.map(h => h.title) : ['No Habits']; const hData = appData.habits.length ? appData.habits.map(h => h.streak) : [0];
            barChart = new Chart(ctxBar, { type: 'bar', data: { labels: hLabels, datasets: [{ label: 'Streak Days', data: hData, backgroundColor: '#22c55e', borderRadius: 4 }] }, options: { maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } } });
        }
        
        function updateCharts() { 
            const viewEl = document.getElementById('view-dashboard'); 
            if(!viewEl || viewEl.style.display === 'none' && !viewEl.classList.contains('active')) return; 
            
            const ctx = document.getElementById('progressChart').getContext('2d'); 
            if(dashChart) dashChart.destroy(); 
            
            const totalTasksPerDay = [0,0,0,0,0,0,0];
            const completedTasksPerDay = [0,0,0,0,0,0,0];
            
            appData.tasks.forEach(t => { 
                totalTasksPerDay[t.day]++;
                if(t.completed) completedTasksPerDay[t.day]++;
            }); 
            
            const wData = totalTasksPerDay.map((total, i) => {
                return total === 0 ? 0 : Math.round((completedTasksPerDay[i] / total) * 100);
            });

            let gradient = ctx.createLinearGradient(0, 0, 0, 400); 
            gradient.addColorStop(0, 'rgba(108, 93, 211, 0.5)'); 
            gradient.addColorStop(1, 'rgba(108, 93, 211, 0)'); 
            
            dashChart = new Chart(ctx, { 
                type: 'line', 
                data: { 
                    labels: days, 
                    datasets: [{ 
                        label: 'Completion (%)', 
                        data: wData, 
                        borderColor: '#6C5DD3', 
                        backgroundColor: gradient, 
                        fill: true, 
                        tension: 0.5, 
                        borderWidth: 3, 
                        pointBackgroundColor: '#fff', 
                        pointBorderColor: '#6C5DD3', 
                        pointRadius: 6 
                    }] 
                }, 
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false, 
                    plugins: { 
                        legend: { display: false },
                        tooltip: { callbacks: { label: (ctx) => `Completion: ${ctx.parsed.y}%` } }
                    }, 
                    scales: { 
                        y: { 
                            beginAtZero: true, 
                            max: 100, 
                            grid: { color: appData.settings.darkMode ? '#334155' : '#e2e8f0' } 
                        }, 
                        x: { grid: { display: false } } 
                    } 
                } 
            }); 
        }

        let timerInt, timeLeft=1500, isRunning=false;
        function setTimer(m) { clearInterval(timerInt); isRunning=false; timeLeft=m*60; updateDisplay(); }
        function toggleTimer() { const btn = document.getElementById('btn-timer'); if(isRunning) { clearInterval(timerInt); btn.innerText="Resume"; } else { timerInt = setInterval(() => { if(timeLeft>0) { timeLeft--; updateDisplay(); } else { clearInterval(timerInt); alert("Time's up!"); if(!appData.analytics) appData.analytics = { focusMinutes: 0 }; appData.analytics.focusMinutes += 25; saveData(); resetTimer(); } }, 1000); btn.innerText="Pause"; } isRunning = !isRunning; }
        function resetTimer() { setTimer(25); document.getElementById('btn-timer').innerText="Start"; }
        function updateDisplay() { document.getElementById('timer-display').innerText=`${String(Math.floor(timeLeft/60)).padStart(2,'0')}:${String(timeLeft%60).padStart(2,'0')}`; }
        function toggleWidget(s) { document.getElementById('pomo-widget').style.display=s?'block':'none'; document.getElementById('pomo-toggle').style.display=s?'none':'flex'; }
        
        function renderApp() {
            const grid = document.getElementById('week-grid'); if(grid) { 
                grid.innerHTML = ''; 
                
                // ADDED: Logic to highlight current day dynamically
                const systemDay = new Date().getDay(); // 0 is Sunday
                const currentDayIndex = systemDay === 0 ? 6 : systemDay - 1; 

                days.forEach((d, i) => { 
                    const dayTasks = appData.tasks.filter(t => t.day === i); 
                    const done = dayTasks.filter(t => t.completed).length; 
                    const pct = dayTasks.length ? (done/dayTasks.length)*100 : 0; 
                    
                    // ADDED: Compare loop index with calculated current day
                    const isToday = i === currentDayIndex;
                    const cls = isToday ? 'bg-[#FFF5CC] border-yellow-400 dark:bg-yellow-900/30 shadow-md ring-2 ring-yellow-400/50' : 'bg-white dark:bg-dark-card border-gray-100 dark:border-gray-700'; 
                    
                    grid.innerHTML += `<div class="${cls} border rounded-2xl p-4 h-36 flex flex-col justify-between transition-all duration-300"><div><h4 class="font-bold flex justify-between items-center">${d} ${isToday ? '<span class="text-[10px] bg-yellow-400 text-black px-2 py-0.5 rounded-full">TODAY</span>' : ''}</h4><p class="text-xs opacity-70">${done}/${dayTasks.length} Done</p><div class="w-full bg-gray-200 dark:bg-gray-600 h-1.5 mt-2 rounded-full overflow-hidden"><div class="bg-[#6C5DD3] h-full" style="width:${pct}%"></div></div></div></div>`; 
                }); 
            }
            const tList = document.getElementById('task-list'); if(tList) { tList.innerHTML=''; if(appData.tasks.length === 0) { tList.innerHTML = `<div class="text-center py-10 opacity-50"><i class="ph-duotone ph-check-circle text-6xl text-[#6C5DD3] mb-3"></i><p>All caught up!</p></div>`; } else { appData.tasks.forEach(t => { tList.innerHTML += `<div class="group flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 mb-2 task-card"><div class="flex items-center gap-4"><div onclick="toggleTask(${t.id})" class="cursor-pointer w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${t.completed ? 'bg-[#6C5DD3] border-[#6C5DD3]' : 'border-gray-300 hover:border-[#6C5DD3]'}">${t.completed ? '<i class="ph-bold ph-check text-white text-xs"></i>' : ''}</div><div><h4 class="font-bold text-gray-800 dark:text-gray-200 ${t.completed ? 'line-through text-gray-400' : ''}">${t.title}</h4><span class="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md mt-1 inline-block">${days[t.day] || 'Today'}</span></div></div><button onclick="deleteTask(${t.id})" class="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><i class="ph-bold ph-trash text-lg"></i></button></div>`; }); } }
            
            const hList = document.getElementById('habit-list'); if(hList) { 
                hList.innerHTML=''; 
                appData.habits.forEach(h => { 
                    hList.innerHTML += `
                    <div class="flex justify-between items-center p-4 border rounded-xl dark:border-gray-700 shadow-sm bg-white dark:bg-dark-card">
                        <div class="flex items-center gap-3">
                            <button onclick="toggleHabit(${h.id})" class="w-10 h-10 rounded-full border-2 flex justify-center items-center transition-all ${h.completed?'bg-green-500 border-green-500 text-white':'border-gray-300 text-transparent hover:border-green-400'}"><i class="ph-bold ph-check"></i></button>
                            <div>
                                <h4 class="font-bold text-sm">${h.title}</h4>
                                <div class="flex items-center gap-2">
                                    <div class="text-xs text-orange-500 font-bold">🔥 ${h.streak} Streak</div>
                                    <button onclick="resetHabitStreak(${h.id})" title="Didn't do fully? Reset Streak" class="text-xs text-gray-400 hover:text-red-500"><i class="ph-bold ph-arrow-counter-clockwise"></i></button>
                                </div>
                            </div>
                        </div>
                        <button onclick="deleteHabit(${h.id})" class="text-gray-300 hover:text-red-400"><i class="ph-bold ph-trash"></i></button>
                    </div>`; 
                }); 
            }
            
            const gList = document.getElementById('goal-list'); if(gList) { gList.innerHTML=''; appData.goals.forEach(g => { gList.innerHTML += `<div class="flex justify-between items-center p-4 border rounded-xl dark:border-gray-700 shadow-sm bg-white dark:bg-dark-card ${g.achieved ? 'opacity-70' : ''}"><div class="flex items-center gap-3"><button onclick="toggleGoal(${g.id})" class="w-6 h-6 rounded-md border-2 flex justify-center items-center transition-all ${g.achieved?'bg-blue-500 border-blue-500 text-white':'border-gray-300 text-transparent hover:border-blue-400'}"><i class="ph-bold ph-check text-xs"></i></button><h4 class="font-bold text-sm ${g.achieved ? 'line-through text-gray-400' : ''}">${g.title}</h4></div><button onclick="deleteGoal(${g.id})" class="text-gray-300 hover:text-red-400"><i class="ph-bold ph-trash"></i></button></div>`; }); }
            const eList = document.getElementById('exam-list'); if(eList) { eList.innerHTML=''; appData.exams.forEach(e => { const left = Math.ceil((new Date(e.date)-new Date())/(1000*60*60*24)); eList.innerHTML += `<div class="bg-white dark:bg-dark-card p-4 border-l-4 border-[#6C5DD3] shadow-sm rounded-lg relative"><h4 class="font-bold text-lg">${e.subject}</h4><p class="text-sm opacity-70">${e.date}</p><span class="absolute top-4 right-4 text-xs font-bold ${left<3?'text-red-500':'text-green-500'}">${left} days left</span><button onclick="deleteExam(${e.id})" class="text-red-400 text-sm mt-2">Remove</button></div>`; }); }
            document.getElementById('stat-total').innerText = appData.tasks.length;
            const doneTotal = appData.tasks.filter(t=>t.completed).length;
            document.getElementById('stat-done').innerText = doneTotal;
            document.getElementById('stat-percent').innerText = appData.tasks.length ? Math.round((doneTotal/appData.tasks.length)*100)+"%" : "0%";
            updateCharts();
        }

        init();