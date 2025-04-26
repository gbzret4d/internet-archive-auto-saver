// ==UserScript==
// @name         Internet Archive Saver
// @description  Saves every visited page to the Internet Archive if it hasn't been saved in the last 4 hours, showing smaller FontAwesome icons as status badges and additional console logs when archiving is needed or started.
// @namespace    https://github.com/gbzret4d/internet-archive-auto-saver
// @homepage     https://github.com/gbzret4d/internet-archive-auto-saver
// @updateURL    https://raw.githubusercontent.com/gbzret4d/internet-archive-auto-saver/main/internet-archive-saver.user.js
// @downloadURL  https://raw.githubusercontent.com/gbzret4d/internet-archive-auto-saver/main/internet-archive-saver.user.js
// @author       gbzret4d
// @version      1.1
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @connect      raw.githubusercontent.com
// @connect      web.archive.org
// @noframes
// @match        *://*/*
// ==/UserScript==

(function() {
    'use strict';

    // --- Configuration ---
    const LOAD_EXTERNAL_BLACKLIST = true;
    const EXTERNAL_BLACKLIST_URL = 'https://raw.githubusercontent.com/gbzret4d/internet-archive-auto-saver/main/blacklist.json';

    const BLACKLIST_KEY = 'ia_saver_blacklist';
    const CACHE_KEY_PREFIX = 'ia_saver_cache_';
    const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes cache duration

    const ARCHIVE_CHECK_URL = 'https://archive.org/wayback/available?url=';
    const ARCHIVE_SAVE_URL = 'https://web.archive.org/save/';

    const SHOW_BADGES = true;

    // Inject FontAwesome CSS
    function injectFontAwesome() {
        if (document.getElementById('fontawesome-css')) return;
        const link = document.createElement('link');
        link.id = 'fontawesome-css';
        link.rel = 'stylesheet';
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
    }
    injectFontAwesome();

    // Load local blacklist or initialize
    let localBlacklist = GM_getValue(BLACKLIST_KEY, []);
    if (localBlacklist.length && typeof localBlacklist[0] === 'string') {
        localBlacklist = localBlacklist.map(pat => ({ pattern: pat, mode: 'domain' }));
        GM_setValue(BLACKLIST_KEY, localBlacklist);
    }

    let externalBlacklist = [];
    let combinedBlacklist = [];

    // Utility: sleep
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    // Load external blacklist
    async function loadExternalBlacklist() {
        if (!LOAD_EXTERNAL_BLACKLIST || !EXTERNAL_BLACKLIST_URL) return [];
        return new Promise(resolve => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: EXTERNAL_BLACKLIST_URL,
                onload: function(response) {
                    if (response.status === 200) {
                        try {
                            const data = JSON.parse(response.responseText);
                            if (Array.isArray(data) && data.every(e => e.pattern && e.mode && ['domain', 'prefix', 'exact'].includes(e.mode))) {
                                resolve(data);
                            } else {
                                console.warn('[IA Saver] Invalid external blacklist format');
                                resolve([]);
                            }
                        } catch {
                            console.warn('[IA Saver] Could not parse external blacklist JSON');
                            resolve([]);
                        }
                    } else {
                        console.warn('[IA Saver] Failed to load external blacklist, status:', response.status);
                        resolve([]);
                    }
                },
                onerror: function() {
                    console.warn('[IA Saver] Error loading external blacklist');
                    resolve([]);
                }
            });
        });
    }

    // Merge blacklists avoiding duplicates
    function mergeBlacklists(localList, externalList) {
        const combined = [...localList];
        for (const extEntry of externalList) {
            if (!combined.some(l => l.pattern === extEntry.pattern && l.mode === extEntry.mode)) {
                combined.push(extEntry);
            }
        }
        return combined;
    }

    // Check if URL is blacklisted
    function isBlacklisted(url) {
        try {
            const u = new URL(url);
            return combinedBlacklist.some(entry => {
                if (entry.mode === 'exact') {
                    return url === entry.pattern;
                }
                if (entry.mode === 'prefix') {
                    let prefix = entry.pattern;
                    if (prefix.endsWith('*')) prefix = prefix.slice(0, -1);
                    return url.startsWith(prefix);
                }
                if (entry.mode === 'domain') {
                    const hostname = u.hostname.toLowerCase();
                    const pattern = entry.pattern.toLowerCase();
                    return hostname === pattern || hostname.endsWith('.' + pattern);
                }
                return false;
            });
        } catch {
            return false;
        }
    }

    // Cache management
    function getCachedArchiveInfo(url) {
        const cacheStr = GM_getValue(CACHE_KEY_PREFIX + url, null);
        if (!cacheStr) return null;
        try {
            const cache = JSON.parse(cacheStr);
            if (Date.now() - cache.timestamp < CACHE_DURATION_MS) {
                return cache.data;
            }
            return null;
        } catch {
            return null;
        }
    }
    function setCachedArchiveInfo(url, data) {
        const cache = { timestamp: Date.now(), data };
        GM_setValue(CACHE_KEY_PREFIX + url, JSON.stringify(cache));
    }

    // Show status badge
    function showBadge(bgColor, tooltip, faIconClass, link) {
        if (!SHOW_BADGES) return;
        const existing = document.getElementById('ia-saver-badge');
        if (existing) existing.remove();

        const badge = document.createElement('div');
        badge.id = 'ia-saver-badge';
        badge.style.position = 'fixed';
        badge.style.bottom = '5px';
        badge.style.right = '5px';
        badge.style.backgroundColor = bgColor;
        badge.style.color = '#fff';
        badge.style.padding = '4px';
        badge.style.fontSize = '16px';
        badge.style.fontFamily = 'Arial, sans-serif';
        badge.style.borderRadius = '50%';
        badge.style.width = '26px';
        badge.style.height = '26px';
        badge.style.display = 'flex';
        badge.style.alignItems = 'center';
        badge.style.justifyContent = 'center';
        badge.style.cursor = link ? 'pointer' : 'default';
        badge.title = tooltip;
        badge.style.zIndex = 2147483647;

        if (faIconClass) {
            const icon = document.createElement('i');
            icon.className = faIconClass;
            badge.appendChild(icon);
        } else {
            badge.textContent = '?';
        }

        if (link) {
            badge.addEventListener('click', () => {
                window.open(link, '_blank');
            });
        }

        document.body.appendChild(badge);
    }

    // Parse archive.org timestamp
    function parseTimestamp(ts) {
        const year = ts.substr(0, 4);
        const month = ts.substr(4, 2);
        const day = ts.substr(6, 2);
        const hour = ts.substr(8, 2);
        const min = ts.substr(10, 2);
        const sec = ts.substr(12, 2);
        return Date.UTC(year, month - 1, day, hour, min, sec);
    }

    // Check archive status and archive if needed
    async function checkAndArchive(url) {
        if (isBlacklisted(url)) {
            console.log('[IA Saver] URL blacklisted, skipping:', url);
            showBadge('gray', 'Archiving skipped (blacklist) ⛔', 'fas fa-ban');
            return;
        }

        const cached = getCachedArchiveInfo(url);
        if (cached) {
            const lastTs = cached.archived_snapshots?.closest?.timestamp;
            if (lastTs) {
                const lastArchiveDate = parseTimestamp(lastTs);
                if (Date.now() - lastArchiveDate < 4 * 60 * 60 * 1000) {
                    console.log('[IA Saver] Recently archived (cached), skipping:', url);
                    showBadge('darkorange', 'Recently archived (cached) 🕒', 'fas fa-clock', `https://web.archive.org/web/${lastTs}/${url}`);
                    return;
                }
            }
        }

        showBadge('#007bff', 'Checking archive status... 🔄', 'fas fa-spinner fa-spin');

        const data = await new Promise(resolve => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: ARCHIVE_CHECK_URL + encodeURIComponent(url),
                onload: res => {
                    try {
                        resolve(JSON.parse(res.responseText));
                    } catch {
                        resolve(null);
                    }
                },
                onerror: () => resolve(null),
            });
        });

        setCachedArchiveInfo(url, data);

        if (!data || !data.archived_snapshots || !data.archived_snapshots.closest) {
            console.log('[IA Saver] No archive found, archiving now:', url);
            archiveUrl(url);
            return;
        }

        const lastTimestamp = data.archived_snapshots.closest.timestamp;
        const lastArchiveTime = parseTimestamp(lastTimestamp);

        if (Date.now() - lastArchiveTime > 4 * 60 * 60 * 1000) {
            console.log('[IA Saver] Archive outdated, archiving now:', url);
            archiveUrl(url);
        } else {
            console.log('[IA Saver] Archive up to date:', url);
            showBadge('darkorange', `Recently archived: ${new Date(lastArchiveTime).toLocaleString()} 🕒`, 'fas fa-clock', `https://web.archive.org/web/${lastTimestamp}/${url}`);
        }
    }

    // Archive URL
    function archiveUrl(url) {
        showBadge('#28a745', 'Archiving now... ⏳', 'fas fa-upload');

        GM_xmlhttpRequest({
            method: 'GET',
            url: ARCHIVE_SAVE_URL + encodeURIComponent(url),
            onload: res => {
                if (res.status >= 200 && res.status < 300) {
                    console.log('[IA Saver] Archived successfully:', url);
                    showBadge('green', 'Archived successfully ✅', 'fas fa-check', `https://web.archive.org/web/*/${url}`);
                } else {
                    console.error('[IA Saver] Archive failed:', res.status, res.statusText);
                    showBadge('red', 'Archive failed ❗', 'fas fa-exclamation-triangle');
                }
            },
            onerror: () => {
                console.error('[IA Saver] Archive request failed');
                showBadge('red', 'Archive request failed ❗', 'fas fa-exclamation-triangle');
            }
        });
    }

    // Blacklist GUI with import/export
    function createBlacklistGUI() {
        if (!document.body) {
            document.addEventListener('DOMContentLoaded', createBlacklistGUI);
            return;
        }
        if (document.getElementById('ia-saver-blacklist-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'ia-saver-blacklist-panel';
        panel.style.position = 'fixed';
        panel.style.top = '10px';
        panel.style.right = '10px';
        panel.style.background = '#222';
        panel.style.color = '#fff';
        panel.style.padding = '15px';
        panel.style.zIndex = '2147483647';
        panel.style.fontFamily = 'Arial, sans-serif';
        panel.style.fontSize = '14px';
        panel.style.borderRadius = '8px';
        panel.style.width = '340px';
        panel.style.boxShadow = '0 0 15px rgba(0,0,0,0.8)';
        panel.style.userSelect = 'none';
        panel.style.display = 'none';

        // Title and close button
        const titleBar = document.createElement('div');
        titleBar.style.display = 'flex';
        titleBar.style.justifyContent = 'space-between';
        titleBar.style.alignItems = 'center';
        titleBar.style.marginBottom = '10px';

        const title = document.createElement('div');
        title.textContent = 'IA Saver Blacklist';
        title.style.fontWeight = 'bold';
        title.style.fontSize = '16px';

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.title = 'Close';
        closeBtn.style.background = 'transparent';
        closeBtn.style.border = 'none';
        closeBtn.style.color = '#fff';
        closeBtn.style.fontSize = '20px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.lineHeight = '1';
        closeBtn.style.padding = '0 5px';

        closeBtn.onclick = () => { panel.style.display = 'none'; };

        titleBar.appendChild(title);
        titleBar.appendChild(closeBtn);
        panel.appendChild(titleBar);

        // Instructions
        const infoText = document.createElement('div');
        infoText.style.fontSize = '12px';
        infoText.style.color = '#ccc';
        infoText.style.marginBottom = '10px';
        infoText.innerHTML = `
            Add blacklist entries:<br>
            <b>Domain:</b> blocks all pages on the domain and its subdomains (e.g. <i>google.com</i>).<br>
            <b>Prefix:</b> blocks all URLs starting with the pattern (use * at the end, e.g. <i>https://www.google.com/search*</i>).<br>
            <b>Exact:</b> blocks only the exact URL (e.g. <i>https://www.google.com/search?q=test</i>).<br>
            Examples:<br>
            • domain: google.com<br>
            • prefix: https://www.google.com/search*<br>
            • exact: https://www.google.com/search?q=test&ie=UTF-8
        `;
        panel.appendChild(infoText);

        // Input area
        const inputContainer = document.createElement('div');
        inputContainer.style.marginBottom = '10px';
        inputContainer.style.display = 'flex';
        inputContainer.style.gap = '6px';
        inputContainer.style.flexWrap = 'wrap';

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Domain, prefix* or exact URL';
        input.style.flexGrow = '1';
        input.style.minWidth = '170px';
        input.style.padding = '6px';

        const select = document.createElement('select');
        select.style.padding = '6px';
        select.title = 'Select blacklist mode';

        ['domain', 'prefix', 'exact'].forEach(mode => {
            const option = document.createElement('option');
            option.value = mode;
            option.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
            select.appendChild(option);
        });

        const addButton = document.createElement('button');
        addButton.textContent = 'Add';
        addButton.style.cursor = 'pointer';
        addButton.style.padding = '6px 12px';

        inputContainer.appendChild(input);
        inputContainer.appendChild(select);
        inputContainer.appendChild(addButton);
        panel.appendChild(inputContainer);

        // List of entries
        const list = document.createElement('ul');
        list.style.listStyle = 'none';
        list.style.padding = '0';
        list.style.margin = '0';
        list.style.maxHeight = '180px';
        list.style.overflowY = 'auto';
        list.style.borderTop = '1px solid #444';
        list.style.paddingTop = '8px';
        panel.appendChild(list);

        function refreshList() {
            list.innerHTML = '';
            if (localBlacklist.length === 0) {
                const li = document.createElement('li');
                li.textContent = 'No entries in blacklist.';
                li.style.fontStyle = 'italic';
                li.style.color = '#aaa';
                list.appendChild(li);
                return;
            }
            localBlacklist.forEach((entry, index) => {
                const li = document.createElement('li');
                li.style.display = 'flex';
                li.style.justifyContent = 'space-between';
                li.style.alignItems = 'center';
                li.style.marginBottom = '6px';
                li.style.wordBreak = 'break-word';

                const textSpan = document.createElement('span');
                textSpan.textContent = `${entry.pattern} [${entry.mode}]`;
                li.appendChild(textSpan);

                const delBtn = document.createElement('button');
                delBtn.textContent = 'X';
                delBtn.title = 'Remove this entry';
                delBtn.style.background = 'red';
                delBtn.style.color = 'white';
                delBtn.style.border = 'none';
                delBtn.style.cursor = 'pointer';
                delBtn.style.padding = '0 6px';
                delBtn.style.borderRadius = '3px';

                delBtn.addEventListener('click', () => {
                    localBlacklist.splice(index, 1);
                    GM_setValue(BLACKLIST_KEY, localBlacklist);
                    refreshList();
                    combinedBlacklist = mergeBlacklists(localBlacklist, externalBlacklist);
                });

                li.appendChild(delBtn);
                list.appendChild(li);
            });
        }

        function validateInput(value, mode) {
            if (!value) return false;
            if (mode === 'domain') {
                return /^[a-z0-9.-]+$/i.test(value);
            } else if (mode === 'prefix') {
                if (!value.startsWith('http://') && !value.startsWith('https://')) return false;
                if (!value.endsWith('*')) return false;
                return true;
            } else if (mode === 'exact') {
                if (value.includes('*')) return false;
                try {
                    new URL(value);
                    return true;
                } catch {
                    return false;
                }
            }
            return false;
        }

        addButton.addEventListener('click', () => {
            const val = input.value.trim();
            const mode = select.value;

            if (!validateInput(val, mode)) {
                alert('Invalid input for mode "' + mode + '".\n' +
                    (mode === 'domain' ? 'Enter a valid domain (e.g. example.com)' :
                        mode === 'prefix' ? 'Enter a valid URL that starts with http(s) and ends with * (e.g. https://example.com/path*)' :
                            'Enter a valid full URL without * (e.g. https://example.com/page)'));
                return;
            }

            if (localBlacklist.some(e => e.pattern === val && e.mode === mode)) {
                alert('This entry is already in the blacklist.');
                return;
            }

            localBlacklist.push({ pattern: val, mode });
            GM_setValue(BLACKLIST_KEY, localBlacklist);
            input.value = '';
            refreshList();
            combinedBlacklist = mergeBlacklists(localBlacklist, externalBlacklist);
        });

        refreshList();
        addExportImportButtons(panel);

        document.body.appendChild(panel);
    }

    // Toggle GUI visibility
    function toggleBlacklistGUI() {
        let panel = document.getElementById('ia-saver-blacklist-panel');
        if (!panel) {
            createBlacklistGUI();
            panel = document.getElementById('ia-saver-blacklist-panel');
            if (!panel) {
                console.error('[IA Saver] Failed to create blacklist panel.');
                return;
            }
        }
        panel.style.display = (panel.style.display === 'none' || panel.style.display === '') ? 'block' : 'none';
    }

    // Add export/import buttons
    function addExportImportButtons(panel) {
        if (!panel) return;

        const container = document.createElement('div');
        container.style.marginTop = '10px';
        container.style.display = 'flex';
        container.style.gap = '10px';

        const exportBtn = document.createElement('button');
        exportBtn.textContent = 'Export Blacklist';
        exportBtn.style.flex = '1';
        exportBtn.style.cursor = 'pointer';
        exportBtn.onclick = exportBlacklist;

        const importBtn = document.createElement('button');
        importBtn.textContent = 'Import Blacklist';
        importBtn.style.flex = '1';
        importBtn.style.cursor = 'pointer';

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json,application/json';
        fileInput.style.display = 'none';
        fileInput.onchange = () => {
            if (fileInput.files.length > 0) {
                importBlacklist(fileInput.files[0]);
                fileInput.value = '';
            }
        };

        importBtn.onclick = () => fileInput.click();

        container.appendChild(exportBtn);
        container.appendChild(importBtn);
        panel.appendChild(container);
        panel.appendChild(fileInput);
    }

    // Export blacklist as JSON file
    function exportBlacklist() {
        const dataStr = JSON.stringify(localBlacklist, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ia_saver_blacklist.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    // Import blacklist from JSON file
    function importBlacklist(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                if (Array.isArray(data) && data.every(e => e.pattern && e.mode && ['domain', 'prefix', 'exact'].includes(e.mode))) {
                    localBlacklist = data;
                    GM_setValue(BLACKLIST_KEY, localBlacklist);
                    if (document.getElementById('ia-saver-blacklist-panel')) {
                        createBlacklistGUI(); // Recreate GUI to refresh
                    }
                    combinedBlacklist = mergeBlacklists(localBlacklist, externalBlacklist);
                    alert('Blacklist imported successfully.');
                } else {
                    alert('Invalid blacklist data format in file.');
                }
            } catch (ex) {
                alert('Error parsing blacklist file: ' + ex.message);
            }
        };
        reader.readAsText(file);
    }

    // Register menu command for blacklist management
    GM_registerMenuCommand('Manage Blacklist', toggleBlacklistGUI);

    // Main function
    (async function main() {
        externalBlacklist = await loadExternalBlacklist();
        combinedBlacklist = mergeBlacklists(localBlacklist, externalBlacklist);

        // Load current page without cookies to get final URL
        GM_xmlhttpRequest({
            method: 'GET',
            url: location.href,
            anonymous: true,
            onload: function(response) {
                const finalUrl = response.finalUrl || location.href;
                checkAndArchive(finalUrl);
            },
            onerror: function() {
                console.error('[IA Saver] Failed to load URL without cookies');
                showBadge('red', 'Failed to load URL without cookies ❗', 'fas fa-exclamation-triangle');
            }
        });
    })();

})();
