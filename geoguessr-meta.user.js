// ==UserScript==
// @name         BetterMetas
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Displays crowdsourced metas and hints for Geoguessr locations.
// @author       Lukas Hzb
// @match        https://www.geoguessr.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=geoguessr.com
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';


    const REPO_OWNER = 'lukas-hzb';
    const REPO_NAME = 'GeoguessrScript';
    const FILE_PATH = 'data/locations.json';
    const RAW_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${FILE_PATH}`;
    const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
    
    let locationData = [];
    let currentPanoid = null;

    // Fallback data for local testing (so UI works before GitHub repo is live)
    const FALLBACK_DATA = [
        {
            "id": "EXAMPLE_ID",
            "tags": ["test", "fallback"],
            "metas": [{
                "title": "Welcome to GeoGuessr Meta",
                "description": "This is a placeholder. Push your code to GitHub to load real data!",
                "tags": ["demo"]
            }]
        }
    ];

    // --- Styles ---
    const STYLES = `
        #gg-meta-hud {
            position: fixed;
            top: 0.5rem; /* Below the top bar */
            left: 0.5rem; /* Aligned to left */
            right: auto;
            transform: none;

            width: 320px;
            /* HIER ANPASSEN: Höhe des Fensters */
            height: 75.6vh; /* Fest auf 70% der Bildschirmhöhe setzen (oder min-height für Mindesthöhe) */
            max-height: 80vh;
            overflow-y: auto;

            background: rgba(0, 0, 0, 0.65); /* "Etwas dunkler" -> Pure black, slightly more opacity but still transparent */
            color: #fff;
            padding: 12px 16px;
            border-radius: 16px;

            z-index: 99999;
            font-family: inherit !important;
            font-weight: 700;

            border: none;
            /* display: block !important; Removed to allow JS visibility toggling */
            display: none; /* Default hidden until round end */
            box-shadow: none;
            text-shadow: 0 1px 4px rgba(0,0,0,0.9);
            transition: none;

            /* Custom Scrollbar for sleek look */
            scrollbar-width: thin;
            scrollbar-color: rgba(255,255,255,0.3) transparent;
        }

        #gg-meta-hud * {
            font-family: inherit !important;
            font-weight: inherit;
        }
        /* Hover effect removed */
        .gg-meta-title {
            font-weight: 800;
            color: #fff; /* White title like compass directions */
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.95rem;
            /* text-transform: uppercase; Removed to allow BetterMetas mixed case */
            letter-spacing: 0.05em;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            padding-bottom: 8px;
        }
        .gg-meta-content {
            font-size: 0.9rem;
            min-height: 40px;
        }
        .gg-meta-tag {
            display: inline-block;
            background: rgba(255, 255, 255, 0.2);
            color: #fff;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 0.75rem;
            margin-right: 4px;
            margin-bottom: 4px;
            font-weight: 600;
        }
        .gg-meta-row {
            margin-bottom: 8px;
            padding-bottom: 8px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .gg-meta-row:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
        }
        #gg-meta-add-btn {
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            cursor: pointer;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: bold;
            transition: background 0.2s;
        }
        #gg-meta-add-btn:hover {
            background: rgba(255, 255, 255, 0.4);
        }
        .gg-status-msg {
            font-size: 0.75em;
            color: rgba(255, 255, 255, 0.5);
            margin-top: 8px;
            font-style: normal;
            text-align: right;
        }

        /* Modal Styles matching the theme */
        #gg-meta-modal {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 420px;
            background: rgba(30, 30, 35, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 24px;
            padding: 24px;
            z-index: 100000;
            color: white;
            font-family: 'Neo Sans', sans-serif;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            backdrop-filter: blur(15px);
            display: none;
        }
        .gg-modal-header {
            font-size: 1.1rem;
            color: #fff;
            margin-bottom: 1.5rem;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            text-align: center;
        }
        .gg-form-group {
            margin-bottom: 1.2rem;
        }
        .gg-form-label {
            display: block;
            margin-bottom: 0.5rem;
            font-size: 0.8rem;
            color: rgba(255, 255, 255, 0.7);
            font-weight: 600;
        }
        .gg-form-input {
            width: 100%;
            padding: 10px 14px;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: white;
            border-radius: 12px;
            box-sizing: border-box;
            font-family: inherit;
        }
        .gg-form-input:focus {
            outline: none;
            border-color: rgba(255, 255, 255, 0.4);
            background: rgba(0, 0, 0, 0.5);
        }
        .gg-btn-primary {
            background: #fff;
            color: #000;
            border: none;
            padding: 10px 20px;
            border-radius: 20px;
            cursor: pointer;
            width: 100%;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-top: 10px;
            transition: transform 0.1s;
        }
        .gg-btn-primary:active {
            transform: scale(0.98);
        }
        .gg-btn-secondary {
            background: transparent;
            color: rgba(255, 255, 255, 0.6);
            border: none;
            padding: 10px;
            cursor: pointer;
            margin-top: 8px;
            width: 100%;
            font-size: 0.85rem;
        }
        .gg-btn-secondary:hover {
            color: #fff;
        }
        #gg-json-output {
            margin-top: 1rem;
            background: rgba(0, 0, 0, 0.5);
            padding: 12px;
            border-radius: 12px;
            font-family: monospace;
            font-size: 0.8rem;
            color: #00ff9d;
            white-space: pre-wrap;
            display: none;
            word-break: break-all;
            border: 1px solid rgba(255,255,255,0.1);
        }
        #gg-settings-btn {
            background: transparent;
            border: none;
            color: rgba(255,255,255,0.4);
            cursor: pointer;
            font-size: 1.2rem;
            padding: 0 8px;
            transition: color 0.2s;
        }
        #gg-settings-btn:hover {
            color: #fff;
        }
        .gg-spinner {
            display: inline-block;
            width: 12px;
            height: 12px;
            border: 2px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top-color: #fff;
            animation: gg-spin 1s ease-in-out infinite;
            margin-right: 8px;
        }
        @keyframes gg-spin {
            to { transform: rotate(360deg); }
        }
    `;

    function addStyles() {
        const style = document.createElement('style');
        style.innerText = STYLES;
        document.head.appendChild(style);
    }

    // --- UI Construction ---
    function createHUD() {
        if (document.getElementById('gg-meta-hud')) return;

        // HUD
        const hud = document.createElement('div');
        hud.id = 'gg-meta-hud';
        hud.innerHTML = `
            <div class="gg-meta-title">
                <span>BetterMetas</span>
                <div style="display:flex; align-items:center;">
                    <button id="gg-settings-btn" title="Settings">Settings</button>
                    <button id="gg-meta-add-btn">+ Add</button>
                </div>
            </div>
            <div id="gg-meta-container" class="gg-meta-content">
                <div style="color: #ccc; font-style: italic;">Waiting for location...</div>
            </div>
            <div id="gg-status" class="gg-status-msg">Waiting for location...</div>
        `;
        document.body.appendChild(hud);

        // SETTINGS MODAL
        const settingsModal = document.createElement('div');
        settingsModal.id = 'gg-settings-modal';
        settingsModal.style.display = 'none';
        settingsModal.innerHTML = `
            <div id="gg-settings-content" style="
                position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                width: 300px; background: rgba(30, 30, 35, 0.95);
                border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 20px;
                z-index: 100001; font-family: 'Neo Sans', sans-serif; color: white;
                backdrop-filter: blur(10px); box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            ">
                <div style="font-weight:bold; margin-bottom:12px; font-size:1.1rem;">Settings</div>
                <div class="gg-form-group">
                    <label class="gg-form-label">GitHub Personal Access Token</label>
                    <input type="password" id="gg-gh-token" class="gg-form-input" placeholder="ghp_...">
                    <div style="font-size:0.7em; color:#aaa; margin-top:4px;">Required to save new metas.</div>
                </div>
                <button class="gg-btn-primary" id="gg-save-settings">Save Token</button>
                <button class="gg-btn-secondary" id="gg-close-settings">Close</button>
            </div>
        `;
        document.body.appendChild(settingsModal);

        // Stop propagation for Settings inputs
        const settInputs = settingsModal.querySelectorAll('input');
        settInputs.forEach(input => {
            input.addEventListener('keydown', (e) => e.stopPropagation());
            input.addEventListener('keypress', (e) => e.stopPropagation());
            input.addEventListener('keyup', (e) => e.stopPropagation());
        });

        // MODAL
        const modal = document.createElement('div');
        modal.id = 'gg-meta-modal';
        modal.innerHTML = `
            <div class="gg-modal-header">Add New Meta</div>

            <div class="gg-form-group">
                <label class="gg-form-label">Title</label>
                <input type="text" id="meta-title" class="gg-form-input" placeholder="e.g. Kenya Snorkel">
            </div>

            <div class="gg-form-group">
                <label class="gg-form-label">Description</label>
                <textarea id="meta-desc" class="gg-form-input" rows="3" placeholder="Describe the hint..."></textarea>
            </div>

            <div class="gg-form-group">
                <label class="gg-form-label">Tags (comma separated)</label>
                <input type="text" id="meta-tags" class="gg-form-input" placeholder="car, snorkel, gen3">
            </div>

            <button class="gg-btn-primary" id="meta-generate-btn">Generate JSON</button>
            <div id="gg-json-output"></div>
            <button class="gg-btn-secondary" id="meta-close-btn">Close</button>
        `;
        // Stop propagation for inputs to prevent game shortcuts
        const inputs = modal.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            input.addEventListener('keydown', (e) => e.stopPropagation());
            input.addEventListener('keypress', (e) => e.stopPropagation());
            input.addEventListener('keyup', (e) => e.stopPropagation());
        });

        document.body.appendChild(modal);

        // Event Listeners
        document.getElementById('gg-meta-add-btn').addEventListener('click', async () => {
            // Try to recover Panoid if missing (e.g. script loaded late on result screen)
            if (!currentPanoid) {
                updateStatus('Finding location...');
                await tryRecoverPanoid();
            }

            // Allow opening even without active location for testing, but warn
            const idToUse = currentPanoid || "YOUR_PANOID_HERE";
            if (!currentPanoid) {
                console.log('No active location found even after recovery attempt.');
                // Optional: Alert user?
            }
            document.getElementById('gg-meta-modal').style.display = 'block';
            document.getElementById('gg-json-output').style.display = 'none';
        });

        document.getElementById('gg-settings-btn').addEventListener('click', () => {
            const token = localStorage.getItem('gg_gh_token') || '';
            document.getElementById('gg-gh-token').value = token;
            document.getElementById('gg-settings-modal').style.display = 'block';
        });

        document.getElementById('gg-save-settings').addEventListener('click', () => {
             const token = document.getElementById('gg-gh-token').value.trim();
             if (token) {
                 localStorage.setItem('gg_gh_token', token);
                 alert('Token saved!');
                 document.getElementById('gg-settings-modal').style.display = 'none';
             } else {
                 alert('Please enter a token.');
             }
        });

        document.getElementById('gg-close-settings').addEventListener('click', () => {
            document.getElementById('gg-settings-modal').style.display = 'none';
        });

        document.getElementById('meta-close-btn').addEventListener('click', () => {
            document.getElementById('gg-meta-modal').style.display = 'none';
        });

        document.getElementById('meta-generate-btn').addEventListener('click', generateJSON);
    }

    async function generateJSON() {
        const title = document.getElementById('meta-title').value;
        const desc = document.getElementById('meta-desc').value;
        const tagsStr = document.getElementById('meta-tags').value;
        const tags = tagsStr.split(',').map(t => t.trim()).filter(t => t);
        
        if (!title || !desc) {
            alert('Please fill in Title and Description');
            return;
        }

        const newEntry = {
            id: currentPanoid || "YOUR_PANOID_HERE",
            metas: [{
                type: "hint",
                tags: tags,
                title: title,
                description: desc,
                imageUrl: ""
            }]
        };

        const btn = document.getElementById('meta-generate-btn');
        const output = document.getElementById('gg-json-output');
        
        // Save to GitHub
        const token = localStorage.getItem('gg_gh_token');
        
        // --- COMMUNITY MODE (No Token) ---
        if (!token) {
            const jsonStr = JSON.stringify(newEntry, null, 2);
            
            // Create Issue URL
            const repo = `${REPO_OWNER}/${REPO_NAME}`;
            const title = encodeURIComponent(`[Meta Submission] ${newEntry.id}`);
            const body = encodeURIComponent(
                `Here is a new meta submission:\n\n` +
                `\`\`\`json\n${jsonStr}\n\`\`\`\n\n` +
                `_(Automated submission via BetterMetas Script)_`
            );
            
            const issueUrl = `https://github.com/${repo}/issues/new?title=${title}&body=${body}`;
            
            if (confirm("No GitHub Token found. Submit this as a Community Contribution via GitHub Issues?")) {
                window.open(issueUrl, '_blank');
                document.getElementById('gg-meta-modal').style.display = 'none';
            } else {
                 // Fallback to copy-paste
                output.textContent = "Token missing. Copy this:\n" + jsonStr + ',';
                output.style.display = 'block';
            }
            return;
        }

        // --- ADMIN MODE (Token Present) ---
        btn.disabled = true;
        btn.innerHTML = '<span class="gg-spinner"></span>Saving...';
        output.style.display = 'none';

        try {
            // 1. Get current file to get SHA (and content to append)
            updateStatus('Fetching repo...');
            const getRes = await fetch(API_URL, {
                headers: { 
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!getRes.ok) throw new Error(`Fetch failed: ${getRes.status}`);
            
            const getData = await getRes.json();
            const sha = getData.sha;
            // Decode content (GitHub API returns base64)
            // Fix for UTF-8 characters: decodeURIComponent(escape(window.atob(str)))
            const currentContent = decodeURIComponent(escape(window.atob(getData.content.replace(/\n/g, ""))));
            
            let dataArr = [];
            try {
                dataArr = JSON.parse(currentContent);
            } catch(e) {
                console.error("JSON Parse error on repo content", e);
                dataArr = [];
            }

            // 2. Append/Update
            const existingIndex = dataArr.findIndex(d => d.id === newEntry.id);
            if (existingIndex !== -1) {
                // Merge metas
                dataArr[existingIndex].metas.push(...newEntry.metas);
            } else {
                dataArr.push(newEntry);
            }

            // 3. Commit back
            const newContentStr = JSON.stringify(dataArr, null, 2);
            // Encode UTF-8 to Base64
            const newContentBase64 = window.btoa(unescape(encodeURIComponent(newContentStr)));

            updateStatus('Committing...');
            const putRes = await fetch(API_URL, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `Add meta for ${newEntry.id} via BetterMetas`,
                    content: newContentBase64,
                    sha: sha
                })
            });

            if (!putRes.ok) throw new Error(`Commit failed: ${putRes.status}`);

            updateStatus('Saved!');
            btn.innerHTML = 'Saved!';
            setTimeout(() => {
                document.getElementById('gg-meta-modal').style.display = 'none';
                btn.innerHTML = 'Generate JSON';
                btn.disabled = false;
                // Reload data to show new meta immediately
                fetchLocationData(); 
            }, 1000);

        } catch (err) {
            console.error('Save error:', err);
            btn.innerHTML = 'Error';
            btn.disabled = false;
            output.textContent = `Error saving to GitHub:\n${err.message}\n\nBackup JSON:\n${JSON.stringify(newEntry, null, 2)}`;
            output.style.display = 'block';
            alert(`Error: ${err.message}`);
        }
    }

    function updateHUD(metas) {
        const container = document.getElementById('gg-meta-container');

        if (!metas || metas.length === 0) {
            container.innerHTML = '<div style="opacity:0.6; font-style:italic;">No active hints for this location.</div>';
            return;
        }

        container.innerHTML = metas.map(m => `
            <div class="gg-meta-row">
                <div style="font-weight:bold; margin-bottom:4px;">${m.title}</div>
                <div style="margin-bottom:4px;">${m.description}</div>
                <div>${m.tags.map(t => `<span class="gg-meta-tag">${t}</span>`).join('')}</div>
            </div>
        `).join('');
    }

    function updateStatus(msg) {
        const el = document.getElementById('gg-status');
        if (el) el.textContent = msg;
    }

    function showDebug(msg) {
        console.log('[GG Meta]', msg);
    }

    // --- Logic ---
    function isRanked() {
        const url = window.location.href;
        return url.includes('/duels') ||
               url.includes('/battle-royale') ||
               url.includes('/team-duels') ||
               url.includes('/competitive') ||
               url.includes('/challenge'); // Maybe challenge too? User said "not in ranked".
               // keeping it strict to competitive modes usually implies ranked.
    }

    function isRoundResult() {
        // Check for common result screen elements
        // The result screen overlay typically has classes containing "result-layout"
        return !!document.querySelector('div[class*="result-layout_root__"]') ||
               !!document.querySelector('div[class*="round-result_root__"]');
    }

    function updateVisibility() {
        const hud = document.getElementById('gg-meta-hud');
        if (!hud) return;

        if (isRanked()) {
            hud.style.display = 'none';
            return;
        }

        if (isRoundResult()) {
            hud.style.display = 'block';
        } else {
            hud.style.display = 'none';
        }
    }

    function checkLocation(panoid) {
        if (!panoid || panoid === currentPanoid) return;
        currentPanoid = panoid;
        showDebug(`New Location: ${panoid}`);
        updateStatus(`ID: ${panoid.substring(0,10)}...`);

        const match = locationData.find(l => l.id === panoid);
        if (match) {
            console.log('Match found!', match);
            updateHUD(match.metas);
        } else {
            // Optional: Check if we have a partial or something?
            // For now, empty.
            updateHUD(null);
        }
    }

    // --- Active Fetching Logic ---
    async function tryRecoverPanoid() {
        const url = window.location.href;
        let gameId = null;
        let isChallenge = false;

        // Extract ID
        // Standard Game: /game/ID
        // Challenge: /challenge/ID
        if (url.includes('/game/')) {
            const parts = url.split('/game/');
            gameId = parts[1]?.split('/')[0];
        } else if (url.includes('/challenge/')) {
            const parts = url.split('/challenge/');
            gameId = parts[1]?.split('/')[0];
            isChallenge = true;
        }

        if (!gameId) return;

        console.log(`[GG Meta] Recovering Panoid for GameID: ${gameId} (Chall: ${isChallenge})`);

        try {
            let apiUrl = '';
            if (isChallenge) {
                 // Challenge API often returns the game token, then we might need to fetch the game
                 // But often /api/v3/games/ID works for the *game* token associated with the challenge?
                 // Actually, for challenges, the ID in the URL is the Challenge ID. The Game ID is internal.
                 // We can try fetching the challenge payload.
                 apiUrl = `https://www.geoguessr.com/api/v3/challenges/${gameId}/game`; 
            } else {
                 apiUrl = `https://www.geoguessr.com/api/v3/games/${gameId}`;
            }

            const res = await fetch(apiUrl);
            if (!res.ok) throw new Error(res.statusText);
            const data = await res.json();

            // Logic to find the current/last round
            let rounds = data.rounds || [];
            if (rounds.length > 0) {
                // Usually the last round in the array is the current/latest one
                const lastRound = rounds[rounds.length - 1];
                if (lastRound && lastRound.panoid) {
                    checkLocation(lastRound.panoid);
                    updateStatus(`Recovered: ${lastRound.panoid.substring(0,10)}`);
                    return;
                }
            }
        } catch (e) {
            console.error('[GG Meta] Failed to recover panoid:', e);
            updateStatus('Loc Recovery Failed');
        }
    }

    // Hacky polling for Panoid & Visibility
    function startObserver() {
         // Active recovery on load if on result screen
         if (isRoundResult()) {
             setTimeout(tryRecoverPanoid, 1000);
         }

         const originalFetch = window.fetch;
         window.fetch = async function(url, options) {
             const response = await originalFetch(url, options);
             const clone = response.clone();

             if (url && url.toString().includes('Geoguessr') && url.toString().includes('Game')) {
                 clone.json().then(data => {
                     if (data.rounds && data.rounds.length > 0) {
                         const currentRound = data.rounds[data.rounds.length - 1];
                         if (currentRound && currentRound.panoid) {
                             checkLocation(currentRound.panoid);
                         }
                     }
                 }).catch(() => {});
             }
             return response;
         };

         // UI Poller
         setInterval(() => {
             updateVisibility();
         }, 500);

         console.log('[Geoguessr Meta] Observer started.');
    }


    // --- Data Fetching ---
    function fetchLocationData() {
        console.log('[Geoguessr Meta] Fetching data...');
        updateStatus('Fetching database...');

        GM_xmlhttpRequest({
            method: "GET",
            url: RAW_URL,
            onload: function(response) {
                if (response.status === 200) {
                    try {
                        locationData = JSON.parse(response.responseText);
                        console.log(`[Geoguessr Meta] Loaded ${locationData.length} locations.`);
                        updateStatus(`DB Loaded (${locationData.length} locs)`);
                    } catch (e) {
                        console.error('[Geoguessr Meta] Error parsing JSON:', e);
                        useFallback("JSON Parse Error");
                    }
                } else {
                    console.error('[Geoguessr Meta] Failed to fetch data:', response.statusText);
                    useFallback("Repo not found (404)");
                }
            },
            onerror: function(err) {
                console.error('[Geoguessr Meta] Request error:', err);
                useFallback("Network Error");
            }
        });
    }

    function useFallback(reason) {
        console.warn(`[Geoguessr Meta] Using fallback data. Reason: ${reason}`);
        locationData = FALLBACK_DATA;
        updateStatus(`Offline Mode (${reason})`);

        // Show demo data immediately so user sees SOMETHING
        updateHUD(locationData[0].metas);
    }

    // --- Initialization ---
    function init() {
        console.log('[Geoguessr Meta] Initializing UI...');
        addStyles();
        createHUD();
        fetchLocationData();
        startObserver();
    }


    init();

})();
