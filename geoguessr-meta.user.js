// ==UserScript==
// @name         BetterMetas
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Displays crowdsourced metas and hints for Geoguessr locations.
// @author       Lukas Hzb
// @updateURL    https://raw.githubusercontent.com/lukas-hzb/GeoguessrScript/main/geoguessr-meta.user.js
// @downloadURL  https://raw.githubusercontent.com/lukas-hzb/GeoguessrScript/main/geoguessr-meta.user.js
// @match        https://www.geoguessr.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=geoguessr.com
// @grant        GM_xmlhttpRequest
// @connect      raw.githubusercontent.com
// @connect      api.github.com
// ==/UserScript==

(function() {
    'use strict';


    const REPO_OWNER = 'lukas-hzb';
    const REPO_NAME = 'GeoguessrScript';
    const LOCATIONS_FILE = 'data/locations.json';
    const METAS_FILE = 'data/metas.json';
    const getRawLocationsUrl = () => `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${LOCATIONS_FILE}?t=${Date.now()}`;
    const getRawMetasUrl = () => `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${METAS_FILE}?t=${Date.now()}`;
    const API_LOCATIONS_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${LOCATIONS_FILE}`;
    const API_METAS_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${METAS_FILE}`;
    
    let locationMap = {};  // panoid -> [metaIds]
    let metasData = [];    // [{id, title, desc, ...}]
    let currentPanoid = null;



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
        #gg-meta-add-btn, #gg-settings-btn {
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            cursor: pointer;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: bold;
            transition: background 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        #gg-meta-add-btn:hover, #gg-settings-btn:hover {
            background: rgba(255, 255, 255, 0.4);
        }
        #gg-settings-btn {
            padding: 4px 8px;
            margin-right: 8px;
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
                    <button id="gg-settings-btn" title="Settings">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    </button>

                    <button id="gg-meta-add-btn">+ Add</button>
                </div>
            </div>
            <div id="gg-meta-container" class="gg-meta-content">
                <div style="color: #ccc; font-style: italic;">Waiting for location...</div>
            </div>
            <div id="gg-status" class="gg-status-msg" style="cursor:pointer;" title="Click to retry finding location">Waiting for location...</div>
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
                <div style="margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 10px;">
                    <div style="color: #ff6b6b; font-size: 0.8em; margin-bottom: 5px;">Danger Zone</div>
                    <button class="gg-btn-secondary" id="gg-reset-db" style="border-color: #ff6b6b; color: #ff6b6b;">Reset Database (Clear All)</button>
                </div>
                <button class="gg-btn-secondary" id="gg-close-settings" style="margin-top: 10px;">Close</button>
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

            <div class="gg-form-group">
                <label class="gg-form-label">Image (optional, paste URL)</label>
                <input type="text" id="meta-image" class="gg-form-input" placeholder="https://...">
            </div>

            <button class="gg-btn-primary" id="meta-generate-btn">Save New Meta</button>
            <div id="gg-json-output"></div>

            <hr style="border:0; border-top:1px solid rgba(255,255,255,0.2); margin: 16px 0;">

            <div class="gg-modal-header" style="font-size:0.9rem;">Or Link Existing Meta</div>
            <div class="gg-form-group">
                <input type="text" id="meta-search" class="gg-form-input" placeholder="Search metas by title...">
            </div>
            <div id="gg-existing-metas" style="max-height: 150px; overflow-y: auto; font-size: 0.8rem;"></div>

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
            renderExistingMetas(); // Populate existing metas list
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

        document.getElementById('gg-reset-db').addEventListener('click', async () => {
             if (confirm("ARE YOU SURE? This will DELETE ALL metas and locations from your GitHub repository. This cannot be undone.")) {
                 if (confirm("Really sure? All date will be lost.")) {
                     await resetDatabase();
                 }
             }
        });

        document.getElementById('meta-close-btn').addEventListener('click', () => {
            document.getElementById('gg-meta-modal').style.display = 'none';
        });

        document.getElementById('meta-generate-btn').addEventListener('click', generateJSON);



        document.getElementById('gg-status').addEventListener('click', () => {
            updateStatus('Finding location...');
            tryRecoverPanoid();
        });

        // --- Existing Metas Browser ---
        document.getElementById('meta-search').addEventListener('input', (e) => {
            renderExistingMetas(e.target.value);
        });
    }

    function renderExistingMetas(searchTerm = '') {
        const container = document.getElementById('gg-existing-metas');
        if (!container) return;

        const filtered = metasData.filter(m => 
            m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (m.tags || []).some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
        );

        if (filtered.length === 0) {
            container.innerHTML = '<div style="color:#aaa; padding:8px;">No metas found.</div>';
            return;
        }

        container.innerHTML = filtered.map(m => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.1);">
                <div>
                    <strong>${m.title}</strong>
                    <div style="font-size:0.7em; color:#aaa;">${(m.tags || []).join(', ')}</div>
                </div>
                <button class="gg-btn-link-meta" data-meta-id="${m.id}" style="font-size:0.7rem; padding:4px 8px;">Link</button>
            </div>
        `).join('');

        // Add click handlers
        container.querySelectorAll('.gg-btn-link-meta').forEach(btn => {
            btn.addEventListener('click', () => linkExistingMeta(btn.dataset.metaId));
        });
    }

    async function linkExistingMeta(metaId) {
        const panoid = currentPanoid;
        if (!panoid || panoid === "YOUR_PANOID_HERE") {
            alert("No location detected! Please try on a game result screen.");
            return;
        }

        const token = localStorage.getItem('gg_gh_token');
        if (!token) {
            // Community Mode: Open Issue
            const submission = { action: "link_meta", panoid: panoid, metaId: metaId };
            const jsonStr = JSON.stringify(submission, null, 2);
            const repo = `${REPO_OWNER}/${REPO_NAME}`;
            const issueTitle = encodeURIComponent(`[Link Meta] ${metaId} to ${panoid.substring(0,15)}`);
            const body = encodeURIComponent(`## Link Existing Meta\n\n\`\`\`json\n${jsonStr}\n\`\`\`\n\n_(Automated)_`);
            const issueUrl = `https://github.com/${repo}/issues/new?title=${issueTitle}&body=${body}`;
            window.open(issueUrl, '_blank');
            return;
        }

        // Admin Mode: Direct API
        updateStatus('Linking meta...');
        
        try {
            // Helper for GitHub API via GM_xmlhttpRequest
            const ghAPI = (url, method = 'GET', body = null) => {
                return new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method,
                        url,
                        headers: {
                            'Authorization': `token ${token}`,
                            'Accept': 'application/vnd.github.v3+json',
                            'Content-Type': 'application/json'
                        },
                        data: body ? JSON.stringify(body) : null,
                        onload: (res) => {
                            if (res.status >= 200 && res.status < 300) {
                                try {
                                    const data = JSON.parse(res.responseText);
                                    resolve(data);
                                } catch(e) { resolve(res.responseText); }
                            } else {
                                reject(new Error(`GitHub API ${res.status}: ${res.statusText}`));
                            }
                        },
                        onerror: (err) => reject(err)
                    });
                });
            };

            const data = await ghAPI(API_LOCATIONS_URL);
            let locations = JSON.parse(decodeURIComponent(escape(window.atob(data.content.replace(/\n/g, "")))));

            if (!locations[panoid]) locations[panoid] = [];
            if (!locations[panoid].includes(metaId)) {
                locations[panoid].push(metaId);
            }

            const contentBase64 = window.btoa(unescape(encodeURIComponent(JSON.stringify(locations, null, 2))));
            await ghAPI(API_LOCATIONS_URL, 'PUT', { 
                message: `Link ${metaId} to ${panoid} via BetterMetas`, 
                content: contentBase64, 
                sha: data.sha 
            });

            updateStatus('Linked!');
            document.getElementById('gg-meta-modal').style.display = 'none';
            fetchLocationData();
        } catch (e) {
            console.error(e);
            alert(`Error: ${e.message}`);
            updateStatus('Link Failed');
        }
    }

    async function generateJSON() {
        const title = document.getElementById('meta-title').value;
        const desc = document.getElementById('meta-desc').value;
        const tagsStr = document.getElementById('meta-tags').value;
        const tags = tagsStr.split(',').map(t => t.trim()).filter(t => t);
        const imageUrl = document.getElementById('meta-image').value;
        
        if (!title || !desc) {
            alert('Please fill in Title and Description');
            return;
        }

        const panoid = currentPanoid || "YOUR_PANOID_HERE";
        if (panoid === "YOUR_PANOID_HERE") {
            alert("No location detected! Please try again on a game result screen.");
            return;
        }

        // Generate unique meta ID
        const metaId = `meta_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

        const newMeta = {
            id: metaId,
            type: "hint",
            title: title,
            description: desc,
            imageUrl: imageUrl,
            tags: tags
        };

        // For Issue submission, we send both the meta and the panoid to link
        const submission = {
            action: "add_meta",
            panoid: panoid,
            meta: newMeta
        };

        const btn = document.getElementById('meta-generate-btn');
        const output = document.getElementById('gg-json-output');
        
        // Save to GitHub
        const token = localStorage.getItem('gg_gh_token');
        
        // --- COMMUNITY MODE (No Token) ---
        if (!token) {
            const jsonStr = JSON.stringify(submission, null, 2);
            
            // Create Issue URL
            const repo = `${REPO_OWNER}/${REPO_NAME}`;
            const issueTitle = encodeURIComponent(`[Meta Submission] ${panoid.substring(0,15)}`);
            const body = encodeURIComponent(
                `## New Meta Submission\n\n` +
                `**Location:** ${panoid}\n\n` +
                `\`\`\`json\n${jsonStr}\n\`\`\`\n\n` +
                `_(Automated submission via BetterMetas Script)_`
            );
            
            const issueUrl = `https://github.com/${repo}/issues/new?title=${issueTitle}&body=${body}`;
            
            if (confirm("No GitHub Token found. Submit this as a Community Contribution via GitHub Issues?")) {
                window.open(issueUrl, '_blank');
                document.getElementById('gg-meta-modal').style.display = 'none';
            } else {
                 // Fallback to copy-paste
                output.textContent = "Token missing. Copy this:\n" + jsonStr;
                output.style.display = 'block';
            }
            return;
        }

        // --- ADMIN MODE (Token Present) ---
        btn.disabled = true;
        btn.innerHTML = '<span class="gg-spinner"></span>Saving...';
        output.style.display = 'none';

        try {
            // Helper for GitHub API via GM_xmlhttpRequest
            const ghAPI = (url, method = 'GET', body = null) => {
                return new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method,
                        url,
                        headers: {
                            'Authorization': `token ${token}`,
                            'Accept': 'application/vnd.github.v3+json',
                            'Content-Type': 'application/json'
                        },
                        data: body ? JSON.stringify(body) : null,
                        onload: (res) => {
                            if (res.status >= 200 && res.status < 300) {
                                try {
                                    const data = JSON.parse(res.responseText);
                                    resolve(data);
                                } catch(e) { resolve(res.responseText); }
                            } else {
                                reject(new Error(`GitHub API ${res.status}: ${res.statusText}`));
                            }
                        },
                        onerror: (err) => reject(err)
                    });
                });
            };

            const getFile = async (apiUrl) => {
                const data = await ghAPI(apiUrl);
                const content = decodeURIComponent(escape(window.atob(data.content.replace(/\n/g, ""))));
                return { sha: data.sha, content: JSON.parse(content) };
            };

            const putFile = async (apiUrl, sha, content, message) => {
                const contentBase64 = window.btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2))));
                return await ghAPI(apiUrl, 'PUT', { message, content: contentBase64, sha });
            };

            // 1. Fetch both files
            updateStatus('Fetching metas.json...');
            const metasFile = await getFile(API_METAS_URL);
            
            updateStatus('Fetching locations.json...');
            const locsFile = await getFile(API_LOCATIONS_URL);

            // 2. Add meta to metas.json
            metasFile.content.push(newMeta);

            // 3. Link panoid in locations.json
            if (!locsFile.content[panoid]) {
                locsFile.content[panoid] = [];
            }
            if (!locsFile.content[panoid].includes(newMeta.id)) {
                locsFile.content[panoid].push(newMeta.id);
            }

            // 4. Commit metas.json
            updateStatus('Saving metas.json...');
            await putFile(API_METAS_URL, metasFile.sha, metasFile.content, `Add meta ${newMeta.id} via BetterMetas`);

            // 5. Commit locations.json
            updateStatus('Saving locations.json...');
            await putFile(API_LOCATIONS_URL, locsFile.sha, locsFile.content, `Link ${panoid} to ${newMeta.id} via BetterMetas`);

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
            output.textContent = `Error saving to GitHub:\n${err.message}\n\nBackup JSON:\n${JSON.stringify(submission, null, 2)}`;
            output.style.display = 'block';
            alert(`Error: ${err.message}`);
        }
    }

    async function resetDatabase() {
        const token = localStorage.getItem('gg_gh_token');
        if (!token) {
            alert("No token saved. Cannot reset DB.");
            return;
        }
        
        updateStatus('Clearing DB...');
        const btn = document.getElementById('gg-reset-db');
        const origText = btn.innerText;
        btn.innerText = "Clearing...";
        btn.disabled = true;

        try {
             // Helper for GitHub API
             const ghAPI = (url, method = 'GET', body = null) => {
                return new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method,
                        url,
                        headers: {
                            'Authorization': `token ${token}`,
                            'Accept': 'application/vnd.github.v3+json',
                            'Content-Type': 'application/json'
                        },
                        data: body ? JSON.stringify(body) : null,
                        onload: (res) => {
                            if (res.status >= 200 && res.status < 300) {
                                try {
                                    const data = JSON.parse(res.responseText);
                                    resolve(data);
                                } catch(e) { resolve(res.responseText); }
                            } else {
                                reject(new Error(`GitHub API ${res.status}: ${res.statusText}`));
                            }
                        },
                        onerror: (err) => reject(err)
                    });
                });
            };

            const getSha = async (apiUrl) => {
                try {
                    const data = await ghAPI(apiUrl);
                    return data.sha;
                } catch (e) { return null; }
            };

            const putFile = async (apiUrl, sha, content, message) => {
                const contentBase64 = window.btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2))));
                const body = { message, content: contentBase64 };
                if (sha) body.sha = sha;
                return await ghAPI(apiUrl, 'PUT', body);
            };

            // 1. Get SHAs
            const metasSha = await getSha(API_METAS_URL);
            const locsSha = await getSha(API_LOCATIONS_URL);

            // 2. Overwrite with empty
            await putFile(API_METAS_URL, metasSha, [], "Reset Database (Metas)");
            await putFile(API_LOCATIONS_URL, locsSha, {}, "Reset Database (Locations)");

            alert("Database Cleared!");
            location.reload();

        } catch (e) {
            console.error(e);
            alert("Error clearing DB: " + e.message);
            updateStatus('Reset Failed');
        } finally {
            btn.innerText = origText;
            btn.disabled = false;
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
        if (!panoid) return;
        
        // LOCK MECHANISM:
        // If we already have a Panoid set, and we are still on the result screen, 
        // DO NOT change it to something else unless explicitly reset.
        if (currentPanoid && currentPanoid !== panoid) {
            console.warn(`[BetterMetas] Ignored ID change: ${currentPanoid} -> ${panoid} (Locked)`);
            return;
        }

        const changed = (panoid !== currentPanoid);
        currentPanoid = panoid;
        
        if (changed) {
            console.log('[BetterMetas] New Location detected (Locked):', panoid);
            updateStatus(`ID: ${panoid.substring(0,12)}...`);
        } else {
             return; // No change, do nothing
        }

        // If data isn't loaded yet, we'll wait for checkDataLoaded to trigger us
        if (Object.keys(locationMap).length === 0) {
            console.log('[BetterMetas] Data not loaded yet, waiting...');
            return;
        }

        // Join: locationMap[panoid] -> metaIds -> metasData
        const metaIds = locationMap[panoid] || [];
        console.log(`[BetterMetas] Found ${metaIds.length} meta IDs for this location.`);
        
        if (metaIds.length > 0) {
            const metas = metaIds.map(id => {
                const found = metasData.find(m => m.id === id);
                if (!found) console.warn('[BetterMetas] Could not find meta data for ID:', id);
                return found;
            }).filter(Boolean);
            
            console.log('[BetterMetas] Match found!', metas);
            updateHUD(metas);
        } else {
            console.log('[BetterMetas] No hints linked to this panoid in our map.');
            updateHUD(null);
        }
    }

    // --- Active Fetching Logic ---

    // Decode hex-encoded panoId (Geoguessr encodes them)
    // Hex encoded IDs are usually ~44 chars (22 bytes). Raw IDs are ~22 chars.
    function decodePanoId(encoded) {
        if (!encoded || typeof encoded !== 'string') return null;
        
        // strict check: If it's short (likely already decoded/raw), don returns as is.
        // Standard Google Panos are 22 chars. Encoded are 44.
        if (encoded.length < 30) {
            return encoded;
        }

        // Must be valid hex
        if (!/^[0-9a-fA-F]+$/.test(encoded)) {
            return encoded;
        }

        try {
            const len = Math.floor(encoded.length / 2);
            let panoId = [];
            for (let i = 0; i < len; i++) {
                const code = parseInt(encoded.slice(i * 2, i * 2 + 2), 16);
                const char = String.fromCharCode(code);
                panoId.push(char);
            }
            const decoded = panoId.join("");
            return decoded;
        } catch (e) {
            console.warn('[BetterMetas] Decode failed, using original:', e);
            return encoded;
        }
    }

    function getCanonicalPanoId(round) {
        if (!round) return null;

        // 1. Try deep payload (Most reliable for modern Geoguessr)
        // Matches vorlage.txt logic
        const panorama = round.question?.panoramaQuestionPayload?.panorama;
        if (panorama?.panoId) {
             return decodePanoId(panorama.panoId);
        }

        // 2. Try location object (Standard v3 API)
        if (round.location?.panoId) {
            return decodePanoId(round.location.panoId);
        }

        // 3. Try top-level panoId (Older API / Challenges)
        if (round.panoId) {
            return decodePanoId(round.panoId);
        }
        
        // 4. Streak code (Last resort)
        if (round.streakLocationCode) {
            return decodePanoId(round.streakLocationCode);
        }
        
        return null;
    }

    async function tryRecoverPanoid() {
        const url = window.location.href;
        let gameId = null;
        let isLiveChallenge = false;
        let isChallenge = false;

        console.log('[BetterMetas] Attempting to recover Panoid from URL:', url);

        if (url.includes('/live-challenge/')) {
            const match = url.match(/\/live-challenge\/([^\/\?]+)/);
            gameId = match ? match[1] : null;
            isLiveChallenge = true;
        } else if (url.includes('/challenge/')) {
            const match = url.match(/\/challenge\/([^\/\?]+)/);
            gameId = match ? match[1] : null;
            isChallenge = true;
        } else if (url.includes('/game/')) {
            const match = url.match(/\/game\/([^\/\?]+)/);
            gameId = match ? match[1] : null;
        }

        // Fallback: Check __NEXT_DATA__
        if (!gameId) {
            try {
                const nextData = document.getElementById('__NEXT_DATA__');
                if (nextData) {
                    const json = JSON.parse(nextData.innerHTML);
                    gameId = json.query?.id || json.props?.pageProps?.game?.token;
                }
            } catch(e) { console.log('[BetterMetas] NextData lookup failed', e); }
        }

        if (!gameId) {
            console.log('[BetterMetas] Could not find Game ID');
            updateStatus('No Game ID detected');
            return;
        }

        console.log(`[BetterMetas] Found GameID: ${gameId}`);

        try {
            let panoid = null;
            let currentRoundData = null;

            if (isLiveChallenge) {
                const apiUrl = `https://game-server.geoguessr.com/api/live-challenge/${gameId}`;
                const res = await fetch(apiUrl, { credentials: 'include' });
                if (!res.ok) throw new Error(`Live Challenge API: ${res.status}`);
                const data = await res.json();
                
                const currentRoundIndex = (data.currentRoundNumber || 1) - 1;
                const rounds = data.rounds || [];
                currentRoundData = rounds[currentRoundIndex];
            } else {
                let apiUrl;
                if (isChallenge) {
                    apiUrl = `https://www.geoguessr.com/api/v3/challenges/${gameId}/game`;
                } else {
                    apiUrl = `https://www.geoguessr.com/api/v3/games/${gameId}`;
                }

                const res = await fetch(apiUrl, { credentials: 'include' });
                if (!res.ok) throw new Error(`v3 API: ${res.status}`);
                const data = await res.json();
                
                const rounds = data.rounds || [];
                if (rounds.length > 0) {
                    // Standard games and Maps often return an array of ALL rounds (past and future).
                    // We must find the CURRENT round index to get the correct location.
                    // 'data.round' (or 'data.currentRound') is 1-indexed.
                    // Fallback to rounds.length covers cases where we might be at the end or data structure differs.
                    const currentRoundIndex = (data.round || data.currentRound || rounds.length) - 1;
                    /* console.log(`[BetterMetas] v3 API: round=${data.round}, currentRound=${data.currentRound}, using index=${currentRoundIndex}, total rounds=${rounds.length}`); */
                    currentRoundData = rounds[currentRoundIndex];
                }
            }

            if (currentRoundData) {
                panoid = getCanonicalPanoId(currentRoundData);
                console.log(`[BetterMetas] ID Recovery: Extracted=${panoid}`);
                
                // Only update if legitimate (remove old lock logic, trust the new robust extraction)
                if (panoid) {
                    checkLocation(panoid);
                } else {
                     updateStatus('Panoid Not Found in Round');
                }
            } else {
                console.warn('[BetterMetas] Could not extract round data');
                updateStatus('Round Data Not Found');
            }

        } catch (e) {
            console.error('[BetterMetas] Recovery failed:', e);
            updateStatus('Recovery Failed');
        }
    }

    // Hacky polling for Panoid & Visibility
    function startObserver() {
         if (isRoundResult() && !currentPanoid) {
             setTimeout(tryRecoverPanoid, 1000);
         }

         const originalFetch = window.fetch;
         window.fetch = async function(url, options) {
             const response = await originalFetch(url, options);
             if (!url || typeof url.toString !== 'function') return response;
             
             const urlStr = url.toString();

             // Intercept Game calls
             if (urlStr.includes('geoguessr.com') && (urlStr.includes('/games/') || urlStr.includes('/game'))) {
                 const clone = response.clone();
                 clone.json().then(data => {
                     if (data.rounds && data.rounds.length > 0) {
                          // Maps/Standard games return all rounds in the array.
                          // We use 'data.round' or 'data.currentRound' (1-based) to identify the current active round.
                          const currentRoundIndex = (data.round || data.currentRound || data.rounds.length) - 1;
                          /* console.log(`[BetterMetas] Intercepted: round=${data.round}, currentRound=${data.currentRound}, index=${currentRoundIndex}`); */
                          const currentRound = data.rounds[currentRoundIndex];
                         const pId = getCanonicalPanoId(currentRound);
                         if (pId) {
                             console.log(`[BetterMetas] Intercepted ID: ${pId}`);
                             checkLocation(pId);
                         }
                     }
                 }).catch(() => {});
             }
             return response;
         };

         // UI Poller
         let wasResult = false;
         setInterval(() => {
             updateVisibility();
             
             const isResult = isRoundResult();
             // Reset when leaving result screen to ensure fresh ID for next round
             if (wasResult && !isResult) {
                 console.log('[BetterMetas] Left result screen, resetting Panoid.');
                 currentPanoid = null;
                 updateStatus('Waiting for location...');
                 updateHUD(null);
             }
             wasResult = isResult;

             // Only try to recover if we don't have one and we are visible
             const hud = document.getElementById('gg-meta-hud');
             if (hud && hud.style.display !== 'none' && !currentPanoid) {
                 tryRecoverPanoid();
             }
         }, 1000);

         console.log('[Geoguessr Meta] Observer started.');
    }


    // --- Data Fetching ---
    function fetchLocationData() {
        console.log('[BetterMetas] Fetching data...');
        updateStatus('Loading DB...');

        let locLoaded = false;
        let metasLoaded = false;

        // Fetch Locations Map
        GM_xmlhttpRequest({
            method: "GET",
            url: getRawLocationsUrl(),
            onload: function(response) {
                if (response.status === 200) {
                    try {
                        locationMap = JSON.parse(response.responseText);
                        console.log(`[BetterMetas] Loaded ${Object.keys(locationMap).length} location mappings.`);
                        locLoaded = true;
                        checkDataLoaded();
                    } catch (e) {
                        console.error('[BetterMetas] Error parsing locations.json:', e);
                        useFallback("Locations Parse Error");
                    }
                } else {
                    console.error('[BetterMetas] Failed to fetch locations:', response.statusText);
                    useFallback("Locations 404");
                }
            },
            onerror: function(err) {
                console.error('[BetterMetas] Locations request error:', err);
                useFallback("Network Error (Locations)");
            }
        });

        // Fetch Metas Collection
        GM_xmlhttpRequest({
            method: "GET",
            url: getRawMetasUrl(),
            onload: function(response) {
                if (response.status === 200) {
                    try {
                        metasData = JSON.parse(response.responseText);
                        console.log(`[BetterMetas] Loaded ${metasData.length} metas.`);
                        metasLoaded = true;
                        checkDataLoaded();
                    } catch (e) {
                        console.error('[BetterMetas] Error parsing metas.json:', e);
                        useFallback("Metas Parse Error");
                    }
                } else {
                    console.error('[BetterMetas] Failed to fetch metas:', response.statusText);
                    useFallback("Metas 404");
                }
            },
            onerror: function(err) {
                console.error('[BetterMetas] Metas request error:', err);
                useFallback("Network Error (Metas)");
            }
        });

        function checkDataLoaded() {
            if (locLoaded && metasLoaded) {
                const locCount = Object.keys(locationMap).length;
                console.log(`[BetterMetas] DB Ready: ${locCount} locs, ${metasData.length} metas.`);
                // If we have a locked panoid, re-check it against new data
                if (currentPanoid) {
                     updateStatus(`ID: ${currentPanoid.substring(0,12)}...`);
                     // Force re-check of metas for this ID
                     const metaIds = locationMap[currentPanoid] || [];
                     if (metaIds.length > 0) {
                         const metas = metaIds.map(id => metasData.find(m => m.id === id)).filter(Boolean);
                         updateHUD(metas);
                     } else {
                         updateHUD(null);
                     }
                } else {
                     updateStatus(`DB Ready (${metasData.length} metas)`);
                }
            }
        }
    }

    function useFallback(reason) {
        console.warn(`[BetterMetas] Could not load data. Reason: ${reason}`);
        updateStatus(`Offline (${reason})`);
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

