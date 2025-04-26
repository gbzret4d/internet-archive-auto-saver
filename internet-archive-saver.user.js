// ==UserScript==
// @name         Internet Archive Saver
// @description  Saves every visited page to the Internet Archive if it hasn't been saved in the last 4 hours, showing smaller FontAwesome icons as status badges and additional console logs when archiving is needed or started. / Speichert jede besuchte Seite im Internet Archive, falls sie nicht in den letzten 4 Stunden gespeichert wurde, mit kleineren FontAwesome-Icons als Statusanzeigen und zusätzlichen Konsolenlogs.
// @namespace    https://github.com/gbzret4d/internet-archive-auto-saver
// @homepage     https://github.com/gbzret4d/internet-archive-auto-saver
// @updateURL    https://raw.githubusercontent.com/gbzret4d/internet-archive-auto-saver/main/internet-archive-saver.user.js
// @downloadURL  https://raw.githubusercontent.com/gbzret4d/internet-archive-auto-saver/main/internet-archive-saver.user.js
// @author       gbzret4d
// @version      1.0
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @connect      raw.githubusercontent.com
// @noframes
// @match        *://*/*
// ==/UserScript==

(function() {
    'use strict';

    // --- Configuration / Konfiguration ---
    const LOAD_EXTERNAL_BLACKLIST = true; // Set to false to disable loading external blacklist / Setze auf false, um externe Blacklist zu deaktivieren
    const EXTERNAL_BLACKLIST_URL = 'https://raw.githubusercontent.com/gbzret4d/internet-archive-auto-saver/main/blacklist.json';

    // Inject FontAwesome CSS from CDNJS / FontAwesome CSS von CDNJS einfügen
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

    const SHOW_BADGES = true; // Show status badges / Status-Badges anzeigen
    const ARCHIVE_CHECK_URL = 'https://archive.org/wayback/available?url=';
    const ARCHIVE_SAVE_URL = 'https://web.archive.org/save/';
    const FOUR_HOURS_MS = 4 * 60 * 60 * 1000; // 4 hours in milliseconds / 4 Stunden in Millisekunden

    const BLACKLIST_KEY = 'ia_saver_blacklist';

    // Local blacklist stored in userscript manager / Lokale Blacklist im Userscript-Manager gespeichert
    let localBlacklist = GM_getValue(BLACKLIST_KEY, []);

    // Convert old string array format to new object format if necessary / Konvertiere altes Format in neues Format
    if (localBlacklist.length && typeof localBlacklist[0] === 'string') {
        localBlacklist = localBlacklist.map(pat => ({ pattern: pat, mode: 'domain' }));
        GM_setValue(BLACKLIST_KEY, localBlacklist);
    }

    // External blacklist loaded from URL (read-only) / Externe Blacklist geladen von URL (nur lesbar)
    let externalBlacklist = [];

    // Combined blacklist (local + external) / Kombinierte Blacklist (lokal + extern)
    let combinedBlacklist = [];

    // Load external blacklist from URL if enabled / Lade externe Blacklist, falls aktiviert
    function loadExternalBlacklist() {
        return new Promise((resolve) => {
            if (!LOAD_EXTERNAL_BLACKLIST || !EXTERNAL_BLACKLIST_URL) {
                resolve([]);
                return;
            }
            GM_xmlhttpRequest({
                method: 'GET',
                url: EXTERNAL_BLACKLIST_URL,
                onload: function(response) {
                    if (response.status === 200) {
                        try {
                            const data = JSON.parse(response.responseText);
                            if (Array.isArray(data) && data.every(e => e.pattern && e.mode && ['domain','prefix','exact'].includes(e.mode))) {
                                resolve(data);
                            } else {
                                console.warn('[IA Saver] Invalid external blacklist format / Ungültiges Format der externen Blacklist');
                                resolve([]);
                            }
                        } catch(e) {
                            console.warn('[IA Saver] Failed to parse external blacklist JSON / Externe Blacklist JSON konnte nicht geparst werden', e);
                            resolve([]);
                        }
                    } else {
                        console.warn('[IA Saver] Failed to load external blacklist, status: ' + response.status + ' / Externe Blacklist konnte nicht geladen werden, Status: ' + response.status);
                        resolve([]);
                    }
                },
                onerror: function() {
                    console.warn('[IA Saver] Error loading external blacklist / Fehler beim Laden der externen Blacklist');
                    resolve([]);
                }
            });
        });
    }

    // Merge local and external blacklists, avoiding duplicates / Füge lokale und externe Blacklists zusammen, ohne Duplikate
    function mergeBlacklists(localList, externalList) {
        const combined = [...localList];
        for (const extEntry of externalList) {
            if (!combined.some(l => l.pattern === extEntry.pattern && l.mode === extEntry.mode)) {
                combined.push(extEntry);
            }
        }
        return combined;
    }

    // Check if URL is blacklisted in combined list / Prüfe, ob URL auf Blacklist steht (kombiniert)
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
        } catch(e) {
            console.warn('[IA Saver] Invalid URL in blacklist check / Ungültige URL bei Blacklist-Prüfung:', url, e);
            return false;
        }
    }

    // Blacklist GUI (only local blacklist editable) / Blacklist-GUI (nur lokale Blacklist bearbeitbar)
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
        closeBtn.title = 'Close / Schließen';
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

        const infoText = document.createElement('div');
        infoText.style.fontSize = '12px';
        infoText.style.color = '#ccc';
        infoText.style.marginBottom = '10px';
        infoText.innerHTML = `
            Add blacklist entries:<br>
            Domain: blocks all pages on the domain and its subdomains (e.g. <i>google.com</i>).<br>
            Prefix: blocks all URLs starting with the pattern (use * at the end, e.g. <i>https://www.google.com/search*</i>).<br>
            Exact: blocks only the exact URL (e.g. <i>https://www.google.com/search?q=test</i>).<br>
            Beispiele / Examples:<br>
            • domain: google.com<br>
            • prefix: https://www.google.com/search*<br>
            • exact: https://www.google.com/search?q=test&ie=UTF-8
        `;
        panel.appendChild(infoText);

        const inputContainer = document.createElement('div');
        inputContainer.style.marginBottom = '10px';
        inputContainer.style.display = 'flex';
        inputContainer.style.gap = '6px';
        inputContainer.style.flexWrap = 'wrap';

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Domain, prefix* or exact URL / Domain, Präfix* oder exakte URL';
        input.style.flexGrow = '1';
        input.style.minWidth = '170px';
        input.style.padding = '6px';

        const select = document.createElement('select');
        select.style.padding = '6px';
        select.title = 'Select blacklist mode / Blacklist-Modus wählen';

        const optionDomain = document.createElement('option');
        optionDomain.value = 'domain';
        optionDomain.textContent = 'Domain';

        const optionPrefix = document.createElement('option');
        optionPrefix.value = 'prefix';
        optionPrefix.textContent = 'Prefix';

        const optionExact = document.createElement('option');
        optionExact.value = 'exact';
        optionExact.textContent = 'Exact';

        select.appendChild(optionDomain);
        select.appendChild(optionPrefix);
        select.appendChild(optionExact);

        const addButton = document.createElement('button');
        addButton.textContent = 'Add / Hinzufügen';
        addButton.style.cursor = 'pointer';
        addButton.style.padding = '6px 12px';

        inputContainer.appendChild(input);
        inputContainer.appendChild(select);
        inputContainer.appendChild(addButton);
        panel.appendChild(inputContainer);

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
                li.textContent = 'No entries in blacklist. / Keine Einträge in der Blacklist.';
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
                delBtn.title = 'Remove this entry / Entfernen';
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
                alert('This entry is already in the blacklist. / Dieser Eintrag ist bereits in der Blacklist.');
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

    function addExportImportButtons(panel) {
        if (!panel) return;

        const container = document.createElement('div');
        container.style.marginTop = '10px';
        container.style.display = 'flex';
        container.style.gap = '10px';

        const exportBtn = document.createElement('button');
        exportBtn.textContent = 'Export Blacklist / Blacklist exportieren';
        exportBtn.style.flex = '1';
        exportBtn.style.cursor = 'pointer';
        exportBtn.onclick = exportBlacklist;

        const importBtn = document.createElement('button');
        importBtn.textContent = 'Import Blacklist / Blacklist importieren';
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

    function exportBlacklist() {
        const dataStr = JSON.stringify(localBlacklist, null, 2);
        const blob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ia_saver_blacklist.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    function importBlacklist(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                if (Array.isArray(data) && data.every(e => e.pattern && e.mode && ['domain','prefix','exact'].includes(e.mode))) {
                    localBlacklist = data;
                    GM_setValue(BLACKLIST_KEY, localBlacklist);
                    if (document.getElementById('ia-saver-blacklist-panel')) {
                        createBlacklistGUI(); // Recreate GUI to refresh
                    }
                    combinedBlacklist = mergeBlacklists(localBlacklist, externalBlacklist);
                    alert('Blacklist imported successfully. / Blacklist erfolgreich importiert.');
                } else {
                    alert('Invalid blacklist data format in file. / Ungültiges Blacklist-Datenformat in der Datei.');
                }
            } catch (ex) {
                alert('Error parsing blacklist file: ' + ex.message + ' / Fehler beim Parsen der Blacklist-Datei: ' + ex.message);
            }
        };
        reader.readAsText(file);
    }

    // Register menu command to toggle blacklist GUI / Menüeintrag zum Öffnen der Blacklist-GUI registrieren
    GM_registerMenuCommand('Manage Blacklist / Blacklist verwalten', toggleBlacklistGUI);

    // Main logic: load external blacklist, merge, check blacklist, then archive if needed / Hauptlogik: externe Blacklist laden, zusammenführen, prüfen, und archivieren
    (async function main() {
        externalBlacklist = await loadExternalBlacklist();
        combinedBlacklist = mergeBlacklists(localBlacklist, externalBlacklist);

        if (isBlacklisted(location.href)) {
            console.log('[IA Saver] URL is blacklisted, skipping archiving: / URL auf Blacklist, Archivierung übersprungen:', location.href);
            showBadge('', 'gray', 'Archiving skipped (Blacklist) ⛔ / Archivierung übersprungen (Blacklist) ⛔', { faIconClass: 'fas fa-ban' });
            return;
        }

        console.log(`[IA Saver] Checking archiving necessity for: ${location.href}`);
        showBadge('', '#007bff', 'Checking archive status... 🔄 / Archivstatus prüfen... 🔄', { faIconClass: 'fas fa-spinner fa-spin' });

        GM_xmlhttpRequest({
            method: 'GET',
            url: location.href,
            anonymous: true,
            onload: function(response) {
                const finalUrl = response.finalUrl || location.href;
                checkArchivingNecessity(finalUrl);
            },
            onerror: function() {
                const errMsg = '[IA Saver] Failed to load URL without cookies / URL konnte ohne Cookies nicht geladen werden';
                console.error(errMsg);
                showBadge('', '#ff2e2e', errMsg + ' ❗', { faIconClass: 'fas fa-exclamation-triangle' });
            }
        });
    })();

    // Check if archiving is needed / Prüfen, ob Archivierung notwendig ist
    function checkArchivingNecessity(url) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: ARCHIVE_CHECK_URL + encodeURIComponent(url),
            onload: function(response) {
                try {
                    const data = JSON.parse(response.responseText);
                    if (!data.archived_snapshots || isEmpty(data.archived_snapshots)) {
                        console.log(`[IA Saver] Archiving needed: No archive found for ${url} / Archivierung notwendig: Kein Archiv gefunden für ${url}`);
                        archiveUrl(url, true);
                    } else {
                        const lastTimestamp = data.archived_snapshots.closest.timestamp;
                        const lastSaveTime = parseTimestamp(lastTimestamp);
                        if (Date.now() - lastSaveTime > FOUR_HOURS_MS) {
                            console.log(`[IA Saver] Archiving needed: Last archive is older than 4 hours for ${url} (archived at ${lastTimestamp}) / Archivierung notwendig: Letztes Archiv älter als 4 Stunden für ${url} (archiviert am ${lastTimestamp})`);
                            archiveUrl(url, false);
                        } else {
                            const logMsg = `[IA Saver] Archiving not necessary, last archived at ${new Date(lastSaveTime).toLocaleString()} (${lastTimestamp}) / Archivierung nicht notwendig, zuletzt archiviert am ${new Date(lastSaveTime).toLocaleString()} (${lastTimestamp})`;
                            console.log(logMsg);
                            showBadge('', 'darkorange', logMsg + ' 🕒', { faIconClass: 'fas fa-clock', link: `https://web.archive.org/web/${lastTimestamp}/${url}` });
                        }
                    }
                } catch (e) {
                    const errMsg = '[IA Saver] Error parsing archive availability response / Fehler beim Parsen der Archiv-Verfügbarkeitsantwort';
                    console.error(errMsg, e);
                    showBadge('', '#ff2e2e', errMsg + ' ❗', { faIconClass: 'fas fa-exclamation-triangle' });
                }
            },
            onerror: function() {
                const errMsg = '[IA Saver] Failed to query archive availability / Archiv-Verfügbarkeit konnte nicht abgefragt werden';
                console.error(errMsg);
                showBadge('', 'orange', errMsg + ' ⚠️', { faIconClass: 'fas fa-exclamation-circle' });
            }
        });
    }

    // Start archiving URL / Starte Archivierung der URL
    function archiveUrl(url, isFirst) {
        console.log(`[IA Saver] Starting archiving for ${url}... / Starte Archivierung für ${url}...`);
        GM_xmlhttpRequest({
            method: 'GET',
            url: ARCHIVE_SAVE_URL + url,
            onload: function(response) {
                if (response.status === 200 || response.status === 201) {
                    const logMsg = `[IA Saver] ${isFirst ? 'First archiving' : 'Archived'} successfully! (https://web.archive.org/web/${url}) / Erfolgreich archiviert! (https://web.archive.org/web/${url})`;
                    console.log(logMsg);
                    showBadge('', 'green', logMsg + ' ✅', { faIconClass: 'fas fa-check', link: `https://web.archive.org/web/*/${url}` });
                } else {
                    const errMsg = `[IA Saver] Archiving error: ${response.status} - ${response.statusText} / Archivierungsfehler: ${response.status} - ${response.statusText}`;
                    console.error(errMsg);
                    showBadge('', '#ff2e2e', errMsg + ' ❗', { faIconClass: 'fas fa-exclamation-triangle' });
                }
            },
            onerror: function() {
                const errMsg = '[IA Saver] Archiving failed / Archivierung fehlgeschlagen';
                console.error(errMsg);
                showBadge('', '#ff2e2e', errMsg + ' ❗', { faIconClass: 'fas fa-exclamation-triangle' });
            }
        });
    }

    // Show status badge / Zeige Status-Badge
    function showBadge(text, bgColor, tooltip, options = {}) {
        if (!SHOW_BADGES) return;

        const existing = document.getElementById('ia-saver-badge');
        if (existing) existing.remove();

        const badge = document.createElement('div');
        badge.id = 'ia-saver-badge';
        badge.style.position = 'fixed';
        badge.style.bottom = '5px';
        badge.style.right = '5px';
        badge.style.background = bgColor;
        badge.style.color = '#fff';
        badge.style.padding = '4px';
        badge.style.fontSize = '16px';
        badge.style.fontFamily = 'Arial, sans-serif';
        badge.style.cursor = 'pointer';
        badge.style.userSelect = 'none';
        badge.style.zIndex = '999999999';
        badge.style.borderRadius = '50%';
        badge.style.display = 'flex';
        badge.style.alignItems = 'center';
        badge.style.justifyContent = 'center';
        badge.style.width = '24px';
        badge.style.height = '24px';
        badge.title = tooltip;

        if (options.faIconClass) {
            const icon = document.createElement('i');
            icon.className = options.faIconClass;
            icon.style.fontSize = '16px';
            badge.appendChild(icon);
        } else {
            const iconSpan = document.createElement('span');
            iconSpan.textContent = options.icon || '?';
            badge.appendChild(iconSpan);
        }

        badge.onclick = () => {
            const link = options.link || `https://web.archive.org/web/*/${location.href}`;
            window.open(link, '_blank');
        };

        document.documentElement.insertBefore(badge, document.documentElement.firstChild);
    }

    // Parse timestamp from archive.org response / Zeitstempel aus archive.org Antwort parsen
    function parseTimestamp(ts) {
        const year = ts.substr(0,4);
        const month = ts.substr(4,2);
        const day = ts.substr(6,2);
        const hour = ts.substr(8,2);
        const min = ts.substr(10,2);
        const sec = ts.substr(12,2);
        return Date.UTC(year, month - 1, day, hour, min, sec);
    }

    // Check if object is empty / Prüfe, ob Objekt leer ist
    function isEmpty(obj) {
        return !obj || Object.keys(obj).length === 0;
    }

})();
