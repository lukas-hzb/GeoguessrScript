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
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      raw.githubusercontent.com
// @connect      api.github.com
// ==/UserScript==

(function() {
    'use strict';


    const SHOW_LOCATION_HUD = false; // Set to true to show debug location info
    const REPO_OWNER = 'lukas-hzb';
    const REPO_NAME = 'GeoguessrScript';
    const LOCATIONS_FILE = 'data/locations.json';
    const USER_METAS_FILE = 'data/metas.json';
    const SYSTEM_METAS_FILE = 'data/plonkit_data.json';
    const getRawLocationsUrl = () => `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${LOCATIONS_FILE}?t=${Date.now()}`;
    const getRawUserMetasUrl = () => `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${USER_METAS_FILE}?t=${Date.now()}`;
    const getRawSystemMetasUrl = () => `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${SYSTEM_METAS_FILE}?t=${Date.now()}`;
    const API_LOCATIONS_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${LOCATIONS_FILE}`;
    const API_USER_METAS_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${USER_METAS_FILE}`;
    
    // Access true window for hooks
    const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

    let locationMap = {};  // panoid -> [metaIds]
    let metasData = [];    // [{id, title, desc, ...}]
    let currentPanoid = null;
    
    // State for Robust Lock & Visibility
    let lastResultSeenTime = 0;
    let nextPanoid = null; // Queue for ID updates blocked by lock
    let userDismissed = false; // Prevent sticky logic from showing HUD after manual hide

    // Location Data
    let svInstance = null; // Store the active StreetViewPanorama instance
    let currentLocationData = {
        address: null,
        country: null,
        region: null,
        lat: null,
        lng: null
    };



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
            display: flex;
            flex-direction: column;

            background: rgba(0, 0, 0, 0.8); /* "Etwas dunkler" -> Pure black, slightly more opacity but still transparent */
            color: #fff;
            padding: 12px 16px;
            border-radius: 16px;

            z-index: 99999;
            font-family: inherit !important;
            font-weight: 700;

            border: none;
            border: none;
            /* display: flex controlled via opacity now */
            display: flex; 
            flex-direction: column;
            
            /* Initial State: Hidden */
            opacity: 0;
            pointer-events: none;
            transform: translateY(10px); /* Slide up effect */
            transition: opacity 0.3s cubic-bezier(0.2, 0, 0, 1), transform 0.3s cubic-bezier(0.2, 0, 0, 1);
            
            box-shadow: none;
            text-shadow: 0 1px 4px rgba(0,0,0,0.9);

            /* Custom Scrollbar for sleek look */
            scrollbar-width: thin;
            scrollbar-color: rgba(255,255,255,0.3) transparent;
        }

        #gg-meta-hud.gg-visible {
            opacity: 1;
            pointer-events: auto;
            transform: translateY(0);
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
            flex: 1;
            overflow-y: auto;
            margin-bottom: 8px; /* Spacing above status */
        }
        .gg-meta-tag, .gg-tag-pill {
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

        .gg-tag-pill {
            cursor: pointer;
            border: 1px solid rgba(255, 255, 255, 0.1);
            transition: background 0.2s;
        }

        .gg-tag-pill:hover {
            background: rgba(255, 255, 255, 0.4);
        }

        .gg-tag-pill.gg-tag-selected {
            background: #8cd45a; /* GeoGuessr Green */
            color: #fff;
            border-color: #3d8c2a;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }

        .gg-tag-static {
            display: inline-block;
            background: rgba(255, 255, 255, 0.2);
            color: #fff;
            padding: 1px 6px;
            border-radius: 12px;
            font-size: 0.65rem;
            margin-right: 0;
            font-weight: 600;
            border: 1px solid rgba(255, 255, 255, 0.1);
            cursor: default;
            white-space: nowrap;
        }

        .gg-meta-row {
            margin-bottom: 12px;
            padding-bottom: 12px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .gg-meta-item-title {
            font-size: 1.1rem;
            font-weight: 800;
            color: #fff;
            margin-bottom: 6px;
            line-height: 1.3;
        }
        #gg-meta-hud .gg-meta-description {
            font-size: 0.75rem;
            color: rgba(255, 255, 255, 0.8);
            margin-bottom: 8px;
            line-height: 1.4;
            font-weight: 400 !important;
            font-family: inherit;
        }
        .gg-meta-image {
            max-width: 100%;
            height: auto;
            max-height: 25vh;
            border-radius: 8px;
            margin-bottom: 8px;
            border: 1px solid rgba(255,255,255,0.1);
            display: block;
        }
        .gg-meta-row:last-child {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
        }

        /* Location Info Box */
        #gg-location-info {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 8px;
            margin-bottom: 12px;
            font-size: 0.8rem;
            border: 1px solid rgba(255,255,255,0.1);
        }
        .gg-loc-row {
            display: flex;
            align-items: flex-start;
            margin-bottom: 4px;
        }
        .gg-loc-row:last-child { margin-bottom: 0; }
        .gg-loc-label {
            color: rgba(255,255,255,0.5);
            width: 70px;
            flex-shrink: 0;
            font-weight: 600;
        }
        .gg-loc-val {
            color: #fff;
            font-weight: 500;
            word-break: break-word;
        }
        .gg-loc-coords {
            font-family: monospace;
            color: #ffd700;
        }

        #gg-meta-add-btn, #gg-settings-btn {
            background: rgba(255, 255, 255, 0.2);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
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

        /* Modal Spacing System */
        :root {
            --modal-spacing-xs: 8px;
            --modal-spacing-sm: 12px;
            --modal-spacing-md: 16px;
            --modal-spacing-lg: 24px;
            --modal-radius: 16px;
            --modal-btn-radius: 25px;
        }

        /* Modal Base Styles - GeoGuessr Native Style */
        #gg-meta-modal {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(180deg, #252060 0%, #1a1a40 100%);
            border: 1px solid rgba(80, 70, 120, 0.5);
            border-radius: var(--modal-radius);
            color: white;
            font-family: inherit;
            font-weight: 700;
            z-index: 100000;
            max-height: 85vh;
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: rgba(255,255,255,0.3) transparent;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
            text-align: center;
            width: 550px;
            padding: var(--modal-spacing-lg);
            transition: all 0.3s ease-in-out;
        }

        .gg-modal-subview {
            transition: opacity 0.3s ease-in-out, transform 0.3s ease-in-out;
            opacity: 1;
            transform: translateX(0);
        }

        .gg-modal-subview.gg-hidden {
            display: none;
            opacity: 0;
            transform: translateX(20px);
        }

        #gg-settings-modal .gg-modal-container {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(180deg, #252060 0%, #1a1a40 100%);
            border: 1px solid rgba(80, 70, 120, 0.5);
            border-radius: var(--modal-radius);
            color: white;
            font-family: inherit;
            font-weight: 700;
            z-index: 100001;
            max-height: 85vh;
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: rgba(255,255,255,0.3) transparent;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
            text-align: center;
            width: 360px;
            padding: var(--modal-spacing-lg);
        }

        /* Modal Header */
        .gg-modal-header {
            font-size: 1.1rem;
            font-weight: 800;
            color: #fff;
            margin-bottom: var(--modal-spacing-lg);
            text-align: center;
            letter-spacing: 0.02em;
        }

        .gg-modal-section-title {
            font-size: 0.8rem;
            font-weight: 700;
            color: #d4af37; /* Muted Gold instead of Orange */
            text-transform: uppercase;
            letter-spacing: 0.06em;
            margin: var(--modal-spacing-lg) 0 var(--modal-spacing-md) 0;
            text-align: center;
        }

        /* Form Elements */
        .gg-form-group {
            margin-bottom: var(--modal-spacing-sm);
        }

        .gg-form-label {
            display: block;
            margin-bottom: 4px;
            font-size: 0.75rem;
            color: rgba(255, 255, 255, 0.5);
            font-weight: 600;
            text-align: center;
        }

        .gg-form-input {
            width: 100%;
            padding: var(--modal-spacing-sm) var(--modal-spacing-md);
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(100, 90, 150, 0.4);
            color: white;
            border-radius: 8px;
            box-sizing: border-box;
            font-family: inherit;
            font-size: 0.95rem;
            font-weight: 400;
            text-align: center;
            transition: border-color 0.2s, background 0.2s;
        }

        .gg-form-input::placeholder {
            color: rgba(255, 255, 255, 0.4);
        }

        .gg-form-input:focus {
            outline: none;
            background: rgba(0, 0, 0, 0.4);
            border-color: rgba(150, 140, 200, 0.6);
        }

        textarea.gg-form-input {
            resize: vertical;
            min-height: 42px;
            text-align: center; /* Center horizontally like other inputs */
            /* Vertical centering handled by padding inherited from .gg-form-input */
        }

        .gg-form-hint {
            font-size: 0.7rem;
            color: rgba(255, 255, 255, 0.4);
            margin-top: 4px;
            font-weight: 400;
            text-align: center;
        }

        /* Buttons - GeoGuessr Green Style */
        .gg-btn-primary {
            background: linear-gradient(180deg, #8cd45a 0%, #6cc04a 50%, #5ab840 100%);
            color: #fff;
            border: none;
            border-bottom: 2px solid #3d8c2a;
            padding: 10px var(--modal-spacing-lg); /* Reduced padding further */
            border-radius: 30px;
            cursor: pointer;
            width: 100%;
            font-weight: 800;
            font-size: 0.85rem; /* Slightly smaller font to reduce height */
            font-style: italic;
            letter-spacing: 0.03em;
            text-transform: uppercase;
            margin-top: var(--modal-spacing-md);
            transition: transform 0.1s, box-shadow 0.1s, border-bottom 0.1s;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
            text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
        }

        .gg-btn-primary:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
        }

        .gg-btn-primary:active {
            transform: translateY(1px);
            border-bottom: 1px solid #3d8c2a;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        }

        .gg-btn-secondary {
            background: rgba(0, 0, 0, 0.3);
            color: rgba(255, 255, 255, 0.7);
            border: 1px solid rgba(100, 90, 150, 0.4);
            padding: var(--modal-spacing-sm) var(--modal-spacing-md);
            cursor: pointer;
            margin-top: var(--modal-spacing-md);
            width: 100%;
            font-size: 0.8rem;
            font-weight: 600;
            border-radius: var(--modal-btn-radius);
            transition: background 0.2s, color 0.2s;
        }

        .gg-btn-secondary:hover {
            background: rgba(0, 0, 0, 0.4);
            color: #fff;
        }

        .gg-btn-danger {
            background: transparent;
            color: #f97316;
            border: 2px solid #f97316;
            padding: var(--modal-spacing-sm) var(--modal-spacing-md);
            border-radius: var(--modal-btn-radius);
            cursor: pointer;
            width: 100%;
            font-size: 0.8rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            transition: background 0.2s, color 0.2s;
        }

        .gg-btn-danger:hover {
            background: rgba(249, 115, 22, 0.15);
        }

        /* Divider */
        .gg-modal-divider {
            border: 0;
            border-top: 1px solid rgba(100, 90, 150, 0.3);
            margin: var(--modal-spacing-md) 0; /* Reduced from lg to md */
        }

        /* Existing Metas List */
        #gg-existing-metas {
            max-height: 150px;
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: rgba(255,255,255,0.2) transparent;
            width: 100%;
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(100, 90, 150, 0.4);
            border-radius: 8px;
            box-sizing: border-box;
            margin-top: 8px;
        }

        .gg-meta-list-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            border-bottom: 1px solid rgba(255,255,255,0.06);
        }

        .gg-meta-list-item:last-child {
            border-bottom: none;
        }

        .gg-meta-list-title {
            font-size: 0.8rem;
            font-weight: 600;
            color: #fff;
        }

        .gg-meta-list-tags {
            font-size: 0.65rem;
            color: rgba(255,255,255,0.4);
            margin-top: 2px;
        }

        .gg-btn-link-meta {
            background: linear-gradient(180deg, #8cd45a 0%, #6cc04a 50%, #5ab840 100%);
            color: #fff;
            border: none;
            border-bottom: 2px solid #3d8c2a;
            padding: 4px 10px;
            border-radius: 12px;
            cursor: pointer;
            font-size: 0.7rem;
            font-weight: 800;
            font-style: italic;
            text-transform: uppercase;
            letter-spacing: 0.03em;
            transition: transform 0.1s, box-shadow 0.1s, border-bottom 0.1s;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
            text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.3);
            flex-shrink: 0;
        }

        .gg-btn-link-meta:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.35);
        }

        .gg-btn-link-meta:active {
            transform: translateY(1px);
            border-bottom: 1px solid #3d8c2a;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        }

        /* JSON Output */
        #gg-json-output {
            margin-top: 12px;
            background: rgba(0, 0, 0, 0.4);
            padding: 10px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 0.7rem;
            color: #6f6;
            white-space: pre-wrap;
            display: none;
            word-break: break-all;
        }

        /* Spinner */
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

        /* Hide reaction wheel when HUD is active */
        body.gg-hud-active button.styles_hudButton__kzfFK.styles_sizeSmall__O7Bw_.styles_roundBoth__hcuEN {
            display: none !important;
        }

        /* Backdrop */
        #gg-modal-backdrop {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(5px);
            -webkit-backdrop-filter: blur(5px);
            z-index: 99999;
            display: none;
            opacity: 0;
            transition: opacity 0.3s;
        }

        #gg-modal-backdrop.gg-visible {
            display: block;
            opacity: 1;
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
            <div id="gg-location-info" style="display:none;">
                <!-- Filled by JS -->
            </div>

            <div id="gg-meta-container" class="gg-meta-content">
                <div style="color: #ccc; font-style: italic;">Waiting for location...</div>
            </div>
            <div id="gg-status" class="gg-status-msg" style="cursor:pointer;" title="Click to retry finding location">Waiting for location...</div>
        `;
        document.body.appendChild(hud);

        // Backdrop
        const backdrop = document.createElement('div');
        backdrop.id = 'gg-modal-backdrop';
        document.body.appendChild(backdrop);

        // SETTINGS MODAL
        const settingsModal = document.createElement('div');
        settingsModal.id = 'gg-settings-modal';
        settingsModal.style.display = 'none';
        settingsModal.innerHTML = `
            <div class="gg-modal-container">
                <div class="gg-modal-header">Settings</div>
                
                <div class="gg-form-group">
                    <label class="gg-form-label">GitHub Personal Access Token</label>
                    <input type="password" id="gg-gh-token" class="gg-form-input" placeholder="ghp_...">
                    <div class="gg-form-hint">Required to save new metas directly.</div>
                </div>
                <!-- Reduced margin-top for button to bring it closer -->
                <button class="gg-btn-primary" id="gg-save-settings" style="margin-top: 8px;">Save Token</button>
                
                <hr class="gg-modal-divider">
                
                <button class="gg-btn-danger" id="gg-reset-db">Reset Database (Clear All)</button>
                
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
        modal.style.display = 'none';
        modal.innerHTML = `
            <div id="meta-main-view" class="gg-modal-subview">
                <div class="gg-modal-header">Add metas to location</div>
                
                <div class="gg-form-group">
                    <input type="text" id="meta-search" class="gg-form-input" placeholder="Search Title, Desc, Tags (use ; to refine)...">
                </div>
                <div id="gg-existing-metas"></div>

                <div id="gg-selection-actions" style="margin-top: 10px;">
                    <button class="gg-btn-primary" id="gg-link-selected-btn" style="display: none; width: 100%; margin-bottom: 10px;">
                        Link Selected Metas (0)
                    </button>
                </div>

                <hr class="gg-modal-divider">

                <div>
                    <button class="gg-btn-primary" id="meta-details-btn" style="margin-top: 0;">
                        Add another meta
                    </button>
                </div>

                <div id="gg-json-output"></div>

                <button class="gg-btn-secondary" id="meta-close-btn">Close</button>
            </div>

            <div id="meta-details-view" class="gg-modal-subview gg-hidden">
                <div class="gg-modal-header" style="position: relative; display: flex; align-items: center; justify-content: center;">
                    <button id="meta-back-btn" style="background:none; border:none; color:rgba(255,255,255,0.5); cursor:pointer; position:absolute; left:0; display: flex; align-items: center; padding: 0;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    </button>
                    Meta Details
                </div>

                <div class="gg-form-group">
                    <label class="gg-form-label">Title</label>
                    <input type="text" id="meta-title" class="gg-form-input" placeholder="e.g. Kenya Snorkel">
                </div>

                <div class="gg-form-group">
                    <label class="gg-form-label">Description</label>
                    <textarea id="meta-desc" class="gg-form-input" rows="3" placeholder="Describe the hint..."></textarea>
                </div>

                <div class="gg-form-group">
                    <label class="gg-form-label">Image URL (optional)</label>
                    <input type="text" id="meta-image" class="gg-form-input" placeholder="https://...">
                </div>

                <div class="gg-form-group">
                    <label class="gg-form-label">Scope</label>
                    <input type="text" id="meta-scope" class="gg-form-input" style="display:none;">
                    <div id="meta-scope-presets" style="margin-top: 8px; text-align: center;">
                        <span class="gg-tag-pill" data-value="countrywide">Countrywide</span>
                        <span class="gg-tag-pill" data-value="region">Region</span>
                        <span class="gg-tag-pill" data-value="longitude">Longitude</span>
                        <span class="gg-tag-pill" data-value="1000km">1000km</span>
                        <span class="gg-tag-pill" data-value="100km">100km</span>
                        <span class="gg-tag-pill" data-value="10km">10km</span>
                        <span class="gg-tag-pill" data-value="1km">1km</span>
                        <span class="gg-tag-pill" data-value="unique">Unique</span>
                    </div>
                </div>

                <div class="gg-form-group">
                    <label class="gg-form-label">Tags</label>
                    <!-- Input hidden, using pills only -->
                    <input type="text" id="meta-tags" class="gg-form-input" placeholder="" style="display:none;">
                    <div id="meta-tag-presets" style="margin-top: 8px; text-align: center;">
                        <span class="gg-tag-pill">plants</span>
                        <span class="gg-tag-pill">bollards</span>
                        <span class="gg-tag-pill">poles</span>
                        <span class="gg-tag-pill">signs</span>
                        <span class="gg-tag-pill">plates</span>
                        <span class="gg-tag-pill">cars</span>
                        <span class="gg-tag-pill">soil</span>
                        <span class="gg-tag-pill">structures</span>
                        <span class="gg-tag-pill">road</span>
                        <span class="gg-tag-pill">camera</span>
                        <span class="gg-tag-pill">language</span>
                        <span class="gg-tag-pill">architecture</span>
                    </div>
                </div>

                <button class="gg-btn-primary" id="meta-generate-btn">Save Meta</button>
            </div>
        `;

        // Presets Logic (Multi-select)
        const presetContainer = modal.querySelector('#meta-tag-presets');
        
        const updateHiddenInput = () => {
            const selected = Array.from(presetContainer.querySelectorAll('.gg-tag-selected'))
                                  .map(el => el.textContent.trim());
            document.getElementById('meta-tags').value = selected.join(', ');
        };

        presetContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('gg-tag-pill')) {
                e.target.classList.toggle('gg-tag-selected');
                updateHiddenInput();
            }
        });

        // Scope Logic (Single-select)
        const scopeContainer = modal.querySelector('#meta-scope-presets');
        
        scopeContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('gg-tag-pill')) {
                // Deselect all others
                Array.from(scopeContainer.querySelectorAll('.gg-tag-pill')).forEach(el => {
                   if (el !== e.target) el.classList.remove('gg-tag-selected');
                });
                
                // Toggle clicked
                const wasSelected = e.target.classList.contains('gg-tag-selected');
                if (!wasSelected) {
                    e.target.classList.add('gg-tag-selected');
                } else {
                    e.target.classList.remove('gg-tag-selected');
                }

                // Update hidden input
                const selected = scopeContainer.querySelector('.gg-tag-selected');
                document.getElementById('meta-scope').value = selected ? selected.dataset.value : '';
            }
        });



        // Add Toggle logic
        const showDetails = () => {
            document.getElementById('meta-main-view').classList.add('gg-hidden');
            document.getElementById('meta-details-view').classList.remove('gg-hidden');
        };
        const hideDetails = () => {
            document.getElementById('meta-details-view').classList.add('gg-hidden');
            document.getElementById('meta-main-view').classList.remove('gg-hidden');
        };

        modal.querySelector('#meta-details-btn').addEventListener('click', showDetails);
        modal.querySelector('#meta-back-btn').addEventListener('click', hideDetails);

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
            document.getElementById('gg-settings-modal').style.display = 'none'; // Close settings
            document.getElementById('gg-modal-backdrop').classList.add('gg-visible');
            document.getElementById('meta-main-view').classList.remove('gg-hidden');
            document.getElementById('meta-details-view').classList.add('gg-hidden');
            document.getElementById('gg-json-output').style.display = 'none';
            renderExistingMetas(); // Populate existing metas list
        });

        document.getElementById('gg-settings-btn').addEventListener('click', () => {
            const token = localStorage.getItem('gg_gh_token') || '';
            document.getElementById('gg-gh-token').value = token;
            document.getElementById('gg-gh-token').value = token;
            document.getElementById('gg-settings-modal').style.display = 'block';
            document.getElementById('gg-meta-modal').style.display = 'none'; // Close meta modal
            document.getElementById('gg-modal-backdrop').classList.add('gg-visible');
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
            document.getElementById('gg-modal-backdrop').classList.remove('gg-visible');
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
            document.getElementById('gg-modal-backdrop').classList.remove('gg-visible');
        });

        // Close when clicking backdrop
        document.getElementById('gg-link-selected-btn').addEventListener('click', () => {
            linkMultipleMetas(Array.from(selectedMetaIds));
        });

        backdrop.addEventListener('click', () => {
            document.getElementById('gg-meta-modal').style.display = 'none';
            document.getElementById('gg-settings-modal').style.display = 'none';
            backdrop.classList.remove('gg-visible');
        });

        document.getElementById('meta-generate-btn').addEventListener('click', generateJSON);



        document.getElementById('gg-status').addEventListener('click', () => {
            updateStatus('Refreshing Data...');
            fetchLocationData();
        });

        // --- Existing Metas Browser ---
        document.getElementById('meta-search').addEventListener('input', (e) => {
            renderExistingMetas(e.target.value);
        });
    }

    function renderExistingMetas(searchTerm = '') {
        const container = document.getElementById('gg-existing-metas');
        if (!container) return;

        // Multi-term search: split by ";" and trim
        const terms = searchTerm.toLowerCase().split(';').map(s => s.trim()).filter(s => s);

        const filtered = metasData.filter(m => {
            if (terms.length === 0) return true;

            const searchableContent = [
                m.title || '',
                m.description || '',
                (m.tags || []).join(' ')
            ].join(' ').toLowerCase();

            // Meta must match ALL terms
            return terms.every(term => searchableContent.includes(term));
        });

        if (filtered.length === 0) {
            container.innerHTML = '<div class="gg-form-hint" style="padding:8px 0;">No metas found.</div>';
            return;
        }

        container.innerHTML = filtered.map(m => `
            <div class="gg-meta-list-item">
                <div style="display: flex; align-items: center; gap: 8px; flex: 1; overflow: hidden; height: 100%;">
                    <div class="gg-meta-list-title" style="white-space: nowrap; line-height: 1;">${m.title}</div>
                    <div class="gg-meta-list-tags" style="display: flex; align-items: center; gap: 4px; overflow-x: auto; scrollbar-width: none; height: 100%;">
                        ${(m.tags || []).map(t => `<span class="gg-tag-static">${t}</span>`).join('')}
                    </div>
                </div>
                <button class="gg-btn-link-meta" data-meta-id="${m.id}">Link</button>
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

            if (!locations[panoid]) {
                locations[panoid] = {
                    metas: [],
                    lat: currentLocationData.lat,
                    lng: currentLocationData.lng,
                    country: currentLocationData.country,
                    region: currentLocationData.region
                };
            } else if (Array.isArray(locations[panoid])) {
                const oldMetas = locations[panoid];
                locations[panoid] = {
                    metas: oldMetas,
                    lat: currentLocationData.lat,
                    lng: currentLocationData.lng,
                    country: currentLocationData.country,
                    region: currentLocationData.region
                };
            }
            if (!locations[panoid].metas.includes(metaId)) {
                locations[panoid].metas.push(metaId);
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
        const scope = document.getElementById('meta-scope').value;
        
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
            country: currentLocationData.country || "Unknown",
            region: currentLocationData.region || null,
            lat: currentLocationData.lat,
            lng: currentLocationData.lng,
            section: "User Submitted",
            title: title,
            description: desc,
            note: "",
            imageUrl: imageUrl,
            scope: scope,
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
            const metasFile = await getFile(API_USER_METAS_URL);
            
            updateStatus('Fetching locations.json...');
            const locsFile = await getFile(API_LOCATIONS_URL);

            // 2. Add meta to metas.json
            metasFile.content.push(newMeta);

            // 3. Link panoid in locations.json
            if (!locsFile.content[panoid]) {
                locsFile.content[panoid] = {
                    metas: [],
                    lat: currentLocationData.lat,
                    lng: currentLocationData.lng,
                    country: currentLocationData.country,
                    region: currentLocationData.region
                };
            } else if (Array.isArray(locsFile.content[panoid])) {
                 const oldMetas = locsFile.content[panoid];
                 locsFile.content[panoid] = {
                    metas: oldMetas,
                    lat: currentLocationData.lat,
                    lng: currentLocationData.lng,
                    country: currentLocationData.country,
                    region: currentLocationData.region
                };
            }

            if (!locsFile.content[panoid].metas.includes(newMeta.id)) {
                locsFile.content[panoid].metas.push(newMeta.id);
            }

            // 4. Commit metas.json
            updateStatus('Saving metas.json...');
            await putFile(API_USER_METAS_URL, metasFile.sha, metasFile.content, `Add meta ${newMeta.id} via BetterMetas`);

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

    function updateHUD(metas, predicted = []) {
        const container = document.getElementById('gg-meta-container');

        if ((!metas || metas.length === 0) && (!predicted || predicted.length === 0)) {
            container.innerHTML = '<div style="opacity:0.6; font-style:italic;">No active hints for this location.</div>';
            return;
        }

        const renderMeta = (m, isPredicted = false) => `
            <div class="gg-meta-row" ${isPredicted ? 'style="border-left: 2px solid rgba(255,255,255,0.2); padding-left: 10px; margin-left: -12px;"' : ''}>
                <div class="gg-meta-item-title">
                    ${m.title}
                    ${isPredicted ? '<span style="font-size: 0.65rem; background: rgba(255,255,255,0.15); padding: 1px 6px; border-radius: 4px; margin-left: 8px; vertical-align: middle; color: rgba(255,255,255,0.7); font-weight: 500;">PREDICTED</span>' : ''}
                </div>
                ${m.imageUrl ? `<img src="${m.imageUrl}" class="gg-meta-image">` : ''}
                <div class="gg-meta-description">${m.description}</div>
                <div>${m.tags.map(t => `<span class="gg-tag-static">${t}</span>`).join('')}</div>
            </div>
        `;

        const exactHtml = (metas || []).map(m => renderMeta(m, false)).join('');
        const predictedHtml = (predicted || []).map(m => renderMeta(m, true)).join('');

        container.innerHTML = exactHtml + predictedHtml;
    }

    function updateStatus(msg) {
        const el = document.getElementById('gg-status');
        if (el) el.textContent = msg;
    }

    function showDebug(msg) {
        console.log('[GG Meta]', msg);
    }

    // --- Logic ---
    function getHaversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    function getDistanceForScope(scope) {
        const s = (scope || '').toLowerCase();
        if (s === '1km') return 1;
        if (s === '10km') return 10;
        if (s === '100km') return 100;
        if (s === '1000km') return 1000;
        if (s === 'unique') return 0; // Unique means no radius/proximity prediction
        return 0;
    }

    function evaluateProximityMetas() {
        const curLat = parseFloat(currentLocationData.lat);
        const curLng = parseFloat(currentLocationData.lng);
        const curCountry = currentLocationData.country;
        const curRegion = currentLocationData.region;

        if (isNaN(curLat) || isNaN(curLng)) return [];

        const predictedIds = new Set();
        
        // 1. Check all pinned locations in locations.json
        for (const panoId in locationMap) {
            const entry = locationMap[panoId];
            const metaIds = Array.isArray(entry) ? entry : (entry.metas || []);
            const entryLat = entry.lat ? parseFloat(entry.lat) : null;
            const entryLng = entry.lng ? parseFloat(entry.lng) : null;

            metaIds.forEach(id => {
                const meta = metasData.find(m => m.id === id);
                if (!meta) return;

                const scope = (meta.scope || '').toLowerCase();
                
                // Distance-based logic
                const maxDist = getDistanceForScope(scope);
                if (maxDist > 0 && entryLat !== null && entryLng !== null) {
                    const d = getHaversineDistance(curLat, curLng, entryLat, entryLng);
                    if (d <= maxDist) predictedIds.add(id);
                }
            });
        }

        // 2. Check general Country/Region scope against current location
        // This makes metas visible if you are in the right country/region, even if no nearby link exists
        metasData.forEach(meta => {
            const scope = (meta.scope || '').toLowerCase();
            if (scope === 'countrywide') {
                if (meta.country === curCountry) predictedIds.add(meta.id);
            } else if (scope === 'region') {
                if (meta.country === curCountry && meta.region === curRegion) predictedIds.add(meta.id);
            }
        });

        return Array.from(predictedIds).map(id => metasData.find(m => m.id === id)).filter(Boolean);
    }

    function isRanked() {
        const url = window.location.href;
        return url.includes('/duels') ||
               url.includes('/battle-royale') ||
               url.includes('/team-duels') ||
               url.includes('/competitive');
               // url.includes('/challenge'); // Removed to allow HUD in challenges
    }

    function isRoundResult() {
        // Check for common result screen elements
        const selector = 'div[class*="result-layout_root__"], div[class*="round-result_root__"]';
        const el = document.querySelector(selector);
        const visible = !!(el && el.offsetParent);
        
        if (visible) lastResultSeenTime = Date.now();
        
        // Sticky True: Return true if we saw it recently (500ms grace period)
        return visible || (Date.now() - lastResultSeenTime < 500);
    }

    function updateVisibility() {
        const hud = document.getElementById('gg-meta-hud');
        if (!hud) return;

        const resultActive = isRoundResult();

        // If we are completely out of the result window (including sticky), reset dismissal
        if (!resultActive) {
            userDismissed = false;
        }

        // Wrapper to check both active state AND dismissal
        const shouldShow = resultActive && !userDismissed;

        // Sync body class for element blocking
        document.body.classList.toggle('gg-hud-active', shouldShow);

        // In Ranked/Duels, ONLY show on result screen (Evaluation)
        if (isRanked()) {
             if (shouldShow) {
                 hud.classList.add('gg-visible');
             } else {
                 hud.classList.remove('gg-visible');
             }
             return;
        }

        // In Single Player / Challenge, show if result OR if mapped (optional, but requested to stick to result for now)
        if (shouldShow) {
             hud.classList.add('gg-visible');
        } else {
             hud.classList.remove('gg-visible');
        }
    }

    function checkLocation(panoid) {
        if (!panoid || typeof panoid !== 'string' || panoid.length <= 5) return;
        
        // LOCK MECHANISM:
        // If we already have a Panoid set, and we are still on the result screen, 
        // DO NOT change it to something else unless explicitly reset.
        const onResultScreen = isRoundResult();
        if (currentPanoid && currentPanoid !== panoid && onResultScreen) {
            // console.warn(`[BetterMetas] Ignored ID change: ${currentPanoid} -> ${panoid} (Locked on Result Screen)`);
            nextPanoid = panoid; // Queue it
            return;
        }

        const changed = (panoid !== currentPanoid);
        currentPanoid = panoid;
        nextPanoid = null; // Clear queue since we accepted a new one
        
        if (changed) {
            console.log('[BetterMetas] New Location detected:', panoid);
            updateStatus(`ID: ${panoid.substring(0,12)}...`);
            
            // Trigger Location Data Extraction Immediately
            extractLocationData();
        } else {
             return;
        }

        // If data isn't loaded yet, we'll wait for checkDataLoaded to trigger us
        // Check BOTH locationMap AND metasData are loaded to avoid missing metas
        if (Object.keys(locationMap).length === 0 || metasData.length === 0) {
            console.log('[BetterMetas] Data not fully loaded yet, waiting...');
            return;
        }

        // Join: locationMap[panoid] -> metaIds -> metasData

        // Join: locationMap[panoid] -> metaIds -> metasData
        // DEBUG: Log all available location keys for comparison
        const allLocationKeys = Object.keys(locationMap);
        console.log(`[BetterMetas] Checking panoid: "${panoid}"`);
        console.log(`[BetterMetas] Available location keys (${allLocationKeys.length}):`, allLocationKeys);
        
        // Check for exact match
        const entry = locationMap[panoid];
        let metaIds = [];
        if (Array.isArray(entry)) {
            metaIds = entry;
        } else if (entry && entry.metas) {
            metaIds = entry.metas;
        }

        console.log(`[BetterMetas] Found ${metaIds.length} exact meta IDs for this location.`);
        
        // Get exact metas
        const exactMetas = metaIds.map(id => {
            const found = metasData.find(m => m.id === id);
            if (!found) console.warn('[BetterMetas] Could not find exact meta data for ID:', id);
            return found;
        }).filter(Boolean);

        // Get predicted/nearby metas
        const predictedMetas = evaluateProximityMetas().filter(pm => !metaIds.includes(pm.id));

        if (exactMetas.length > 0 || predictedMetas.length > 0) {
            updateHUD(exactMetas, predictedMetas);
        } else {
            updateHUD(null);
        }

        // Trigger Location Data Extraction
        extractLocationData();
    }
    
    function extractLocationData(attempt = 0) {
        const maxAttempts = 10;
        
        if (!svInstance) {
            console.log(`[BetterMetas] extractLocationData: No svInstance available yet (Attempt ${attempt+1}/${maxAttempts}).`);
            if (attempt < maxAttempts) {
                setTimeout(() => extractLocationData(attempt + 1), 500);
            }
            return;
        }

        if (attempt === 0) console.log('[BetterMetas] extractLocationData: Triggered.');

        // Give it a moment for data to populate in the instance if it's fresh
        setTimeout(() => {
            try {
                // Check if we can get location data
                let loc = null;
                if (typeof svInstance.getLocation === 'function') {
                    loc = svInstance.getLocation();
                } 
                
                if (loc) {
                    const desc = loc.description || loc.shortDescription || "Unknown Location";
                    const latLng = loc.latLng;
                    const lat = latLng ? (typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat) : 0;
                    const lng = latLng ? (typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng) : 0;
                    
                    console.log(`[BetterMetas] Location Found: ${desc} (${lat}, ${lng})`);

                    // Simple heuristic for "Country" from address (last part after comma)
                    let country = "Unknown";
                    if (desc && desc.includes(',')) {
                        const parts = desc.split(',');
                        country = parts[parts.length - 1].trim();
                        // Filter out zip codes if mixed in (basic check)
                        if (/^\d+$/.test(country) && parts.length > 1) {
                            country = parts[parts.length - 2].trim();
                        }
                    } else {
                        country = desc; // Fallback
                    }

                    currentLocationData = {
                        address: desc,
                        country: country,
                        region: null,
                        lat: lat.toFixed(5),
                        lng: lng.toFixed(5)
                    };
                    
                    updateLocationUI();

                    // Reverse Geocoding for better accuracy
                    if (win.google && win.google.maps && win.google.maps.Geocoder) {
                        const geocoder = new win.google.maps.Geocoder();
                        const latVal = parseFloat(lat);
                        const lngVal = parseFloat(lng);
                        
                        // console.log('[BetterMetas] Requesting Reverse Geocode...');
                        geocoder.geocode({ location: { lat: latVal, lng: lngVal } }, (results, status) => {
                            if (status === 'OK' && results && results.length > 0) {
                                const res = results[0];
                                const address = res.formatted_address;
                                let realCountry = country;
                                
                                // Find country in address components
                                const countryComponent = res.address_components.find(c => c.types.includes('country'));
                                if (countryComponent) {
                                    realCountry = countryComponent.long_name;
                                }

                                // Find administrative_area_level_1 (Region/State)
                                let region = null;
                                const regionComponent = res.address_components.find(c => c.types.includes('administrative_area_level_1'));
                                if (regionComponent) {
                                    region = regionComponent.long_name;
                                }

                                // console.log(`[BetterMetas] Geocode Success: ${address} | ${realCountry} | ${region}`);

                                currentLocationData.address = address;
                                currentLocationData.country = realCountry;
                                currentLocationData.region = region;
                                updateLocationUI();
                                // Refresh metas now that we have better country/region info
                                if (currentPanoid) checkLocation(currentPanoid);
                            } else {
                                console.log('[BetterMetas] Geocode failed: ' + status);
                            }
                        });
                    } else {
                         console.log('[BetterMetas] Geocoder API not available.');
                    }
                } else {
                    console.log(`[BetterMetas] svInstance.getLocation() returned null/empty (Attempt ${attempt+1}/${maxAttempts}).`);
                    if (attempt < maxAttempts) {
                        extractLocationData(attempt + 1);
                    }
                }
            } catch (e) {
                console.warn('[BetterMetas] Error accessing location data:', e);
            }
        }, 500); 
    }

    function updateLocationUI() {
        const box = document.getElementById('gg-location-info');
        console.log('[BetterMetas] updateLocationUI called. Box:', box, 'Data:', currentLocationData);
        if (!box) return;

        // Respect configuration
        if (!SHOW_LOCATION_HUD) {
            box.style.display = 'none';
            return;
        }

        const { address, country, region, lat, lng } = currentLocationData;
        
        if (!lat || !lng) {
            console.log('[BetterMetas] updateLocationUI: Missing lat/lng, hiding box.');
            box.style.display = 'none';
            return;
        }

        box.innerHTML = `
            <div class="gg-loc-row">
                <div class="gg-loc-label">Address:</div>
                <div class="gg-loc-val">${address || 'N/A'}</div>
            </div>
             <div class="gg-loc-row">
                <div class="gg-loc-label">Country:</div>
                <div class="gg-loc-val" style="color: #8cd45a;">${country || 'N/A'}</div>
            </div>
            ${region ? `
            <div class="gg-loc-row">
                <div class="gg-loc-label">Region:</div>
                <div class="gg-loc-val">${region}</div>
            </div>` : ''}
            <div class="gg-loc-row">
                <div class="gg-loc-label">Coords:</div>
                <div class="gg-loc-val gg-loc-coords">${lat}, ${lng}</div>
            </div>
        `;
        box.style.display = 'block';
    }




    // --- Data Fetching ---
    function fetchLocationData() {
        console.log('[BetterMetas] Fetching data...');
        updateStatus('Loading DB...');

        let locLoaded = false;
        let userMetasLoaded = false;
        let systemMetasLoaded = false;

        let tempUserMetas = [];
        let tempSystemMetas = [];

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
                        checkAllLoaded();
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

        // Fetch User Metas Collection
        GM_xmlhttpRequest({
            method: "GET",
            url: getRawUserMetasUrl(),
            onload: function(response) {
                if (response.status === 200) {
                    try {
                        tempUserMetas = JSON.parse(response.responseText);
                        console.log(`[BetterMetas] Loaded ${tempUserMetas.length} user metas.`);
                        userMetasLoaded = true;
                        checkAllLoaded();
                    } catch (e) {
                        console.error('[BetterMetas] Error parsing metas.json:', e);
                        useFallback("User Metas Parse Error");
                    }
                } else {
                    console.log('[BetterMetas] User metas file empty or 404, proceeding...');
                    userMetasLoaded = true;
                    checkAllLoaded();
                }
            }
        });

        // Fetch System Metas Collection (Plonkit)
        GM_xmlhttpRequest({
            method: "GET",
            url: getRawSystemMetasUrl(),
            onload: function(response) {
                if (response.status === 200) {
                    try {
                        const rawData = JSON.parse(response.responseText);
                        tempSystemMetas = [];
                        rawData.forEach(countryObj => {
                            if (countryObj.metas) {
                                tempSystemMetas.push(...countryObj.metas);
                            }
                        });
                        console.log(`[BetterMetas] Loaded ${tempSystemMetas.length} system metas.`);
                        systemMetasLoaded = true;
                        checkAllLoaded();
                    } catch (e) {
                        console.error('[BetterMetas] Error parsing plonkit_data.json:', e);
                        useFallback("System Metas Parse Error");
                    }
                } else {
                    console.error('[BetterMetas] Failed to fetch system metas:', response.statusText);
                    useFallback("System Metas 404");
                }
            }
        });

        function checkAllLoaded() {
            if (locLoaded && userMetasLoaded && systemMetasLoaded) {
                const combined = [...tempUserMetas, ...tempSystemMetas];
                const seen = new Set();
                metasData = combined.filter(m => {
                    if (!m.id || seen.has(m.id)) return false;
                    seen.add(m.id);
                    return true;
                });

                const locCount = Object.keys(locationMap).length;
                console.log(`[BetterMetas] DB Ready: ${locCount} locs, ${metasData.length} unique metas (${tempUserMetas.length} user, ${tempSystemMetas.length} system).`);
                
                if (currentPanoid) {
                     updateStatus(`ID: ${currentPanoid.substring(0,12)}...`);
                     const entry = locationMap[currentPanoid];
                     let metaIds = [];
                     if (Array.isArray(entry)) {
                         metaIds = entry;
                     } else if (entry && entry.metas) {
                         metaIds = entry.metas;
                     }

                     const exactMetas = metaIds.map(id => metasData.find(m => m.id === id)).filter(Boolean);
                     const predictedMetas = evaluateProximityMetas().filter(pm => !metaIds.includes(pm.id));

                     if (exactMetas.length > 0 || predictedMetas.length > 0) {
                         updateHUD(exactMetas, predictedMetas);
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



    // --- Google Maps Hooks ---
    function installHooks() {
        // Check if Google Maps is loaded
        if (!win.google || !win.google.maps || !win.google.maps.StreetViewPanorama) {
            return false;
        }

        console.log('[BetterMetas] Google Maps API found. Installing hooks...');
        
        // 1. Constructor Hook (catch new instances)
        const OriginalStreetViewPanorama = win.google.maps.StreetViewPanorama;
        
        win.google.maps.StreetViewPanorama = function(node, opts) {
            const instance = new OriginalStreetViewPanorama(node, opts);
            
            // Immediate check on creation
            if (opts && opts.pano) {
                checkLocation(opts.pano);
            }

            // Capture Instance
            svInstance = instance;

            // Add Event Listener
            win.google.maps.event.addListener(instance, 'pano_changed', () => {
                const panoId = instance.getPano();
                checkLocation(panoId);
            });
            
            // Listen for status_changed or similar to capture data load
            win.google.maps.event.addListener(instance, 'status_changed', () => {
                 extractLocationData();
            });

            return instance;
        };

        // Copy prototype and static properties
        win.google.maps.StreetViewPanorama.prototype = OriginalStreetViewPanorama.prototype;
        for (let prop in OriginalStreetViewPanorama) {
            if (OriginalStreetViewPanorama.hasOwnProperty(prop)) {
                win.google.maps.StreetViewPanorama[prop] = OriginalStreetViewPanorama[prop];
            }
        }

        // 2. Prototype Hook for setPano (catch updates on existing instances)
        const originalSetPano = win.google.maps.StreetViewPanorama.prototype.setPano;
        win.google.maps.StreetViewPanorama.prototype.setPano = function(pano) {
            if (!svInstance) {
                svInstance = this;
                console.log('[BetterMetas] Captured svInstance via setPano hook.');
            }
            checkLocation(pano);
            return originalSetPano.apply(this, arguments);
        };
        
        console.log('[BetterMetas] Hooks installed successfully.');
        return true;
    }



    function startObserver() {
         // UI Poller
         setInterval(() => {
             updateVisibility();
             
             // Process queued panoid if lock is released
             if (nextPanoid && !isRoundResult()) {
                 console.log('[BetterMetas] Applying queued panoid:', nextPanoid);
                 checkLocation(nextPanoid);
             }
         }, 200);

         // Hook Poller - wait for Google Maps
         const timer = setInterval(() => {
            if (installHooks()) {
                clearInterval(timer);
            }
         }, 50);

         // Input Capture for Instant Hide
         document.addEventListener('keydown', (e) => {
             if (e.code === 'Space' || e.key === ' ') {
                 // Only hide if currently visible (on result screen)
                 // And ensure we aren't typing in an input
                 const activeTag = document.activeElement.tagName.toLowerCase();
                 if (activeTag === 'input' || activeTag === 'textarea') return;

                 if (isRoundResult()) {
                     const hud = document.getElementById('gg-meta-hud');
                     if (hud) {
                         // Instant hide via class removal (transitions out)
                         hud.classList.remove('gg-visible');
                         userDismissed = true;
                     }
                 }
             }
         });

         // Next Button Click Capture (Heuristic)
         document.addEventListener('click', (e) => {
             // Look for buttons that might be "Next" or "Play Again"
             // This is a best-effort heuristic based on common button texts or classes
             const target = e.target;
             if (target.tagName !== 'BUTTON' && !target.closest('button')) return;
             
             // Check if we are on result screen
             if (isRoundResult()) {
                  // If we click ANY button on result screen that isn't inside our HUD or modals, hide HUD
                  // Exclude: HUD, Settings Modal, Add Meta Modal
                  // Exclude: HUD, Settings Modal, Add Meta Modal
                  if (!target.closest('#gg-meta-hud') && 
                      !target.closest('#gg-settings-modal') && 
                      !target.closest('#gg-meta-modal')) {
                       
                       // Close HUD
                       const hud = document.getElementById('gg-meta-hud');
                       if (hud && hud.classList.contains('gg-visible')) {
                           hud.classList.remove('gg-visible');
                           userDismissed = true;
                       }

                       // Close Modals
                       const metaModal = document.getElementById('gg-meta-modal');
                       if (metaModal) metaModal.style.display = 'none';

                       const settingsModal = document.getElementById('gg-settings-modal');
                       if (settingsModal) settingsModal.style.display = 'none';
                  }
             }
         }, true); // Capture phase to catch it early

         console.log('[BetterMetas] Observer started.');
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
