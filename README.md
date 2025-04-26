# Internet Archive Saver

---

## English

Automatically saves every visited webpage to the [Internet Archive Wayback Machine](https://archive.org/) if it hasn't been archived in the last 4 hours. The script shows small, unobtrusive FontAwesome badges indicating the archiving status in real-time.

### Features

- Automatically checks if a page was archived recently and archives it if needed.
- Displays small circular FontAwesome icon badges with archiving status.
- Supports blacklist management by domain, URL prefix, or exact URL.
- Loads an external blacklist from GitHub and merges it with the local blacklist.
- Integrated GUI for easy blacklist editing with import/export functionality.
- Privacy-friendly: uses anonymous HTTP requests without cookies.
- Open source and customizable.
- Supports automatic updates from GitHub (via userscript manager).

### Installation

1. Install a userscript manager like [Tampermonkey](https://www.tampermonkey.net/) or [Greasemonkey](https://www.greasespot.net/).
2. Add the userscript from the raw GitHub URL: https://raw.githubusercontent.com/gbzret4d/internet-archive-saver/main/internet-archive-saver.user.js
3. Enable the script in your userscript manager. The script supports automatic updates when new versions are released on GitHub.


### Usage

- The script automatically checks and archives pages as you browse.
- Small badges appear at the bottom right showing status:
  - Spinner while checking
  - Green checkmark on successful archiving
  - Clock if recently archived
  - Red warning on errors
- To manage blacklist entries, open the userscript manager menu and select **Manage Blacklist**.
- The external blacklist is loaded and merged automatically.
- You can disable loading the external blacklist by setting `LOAD_EXTERNAL_BLACKLIST` to `false` in the script.


### Blacklist

Exclude sites or URLs from automatic archiving:

- **Domain**: excludes all pages on that domain and subdomains (e.g., `example.com`).
- **Prefix**: excludes URLs starting with a pattern (e.g., `https://example.com/path*`).
- **Exact**: excludes exact URLs only.

Blacklist can be imported/exported via GUI.


### Contributing

Feel free to open issues or submit pull requests!


### License

This project is licensed under the GNU General Public License version 3 (GPLv3).

---



## Deutsch

Speichert automatisch jede besuchte Webseite im [Internet Archive Wayback Machine](https://archive.org/), wenn sie nicht in den letzten 4 Stunden archiviert wurde. Das Skript zeigt kleine, unaufdringliche FontAwesome-Badges mit dem aktuellen Archivierungsstatus in Echtzeit an.


### Funktionen

- Prüft automatisch, ob eine Seite kürzlich archiviert wurde, und archiviert sie bei Bedarf.
- Zeigt kleine runde FontAwesome-Icon-Badges mit Statusinformationen an.
- Unterstützt Blacklist-Verwaltung nach Domain, URL-Präfix oder exakter URL.
- Lädt eine externe Blacklist von GitHub und fügt sie der lokalen Blacklist hinzu.
- Integrierte Benutzeroberfläche für einfache Blacklist-Bearbeitung mit Import-/Export-Funktion.
- Datenschutzfreundlich: Verwendet anonyme HTTP-Anfragen ohne Cookies.
- Open Source und anpassbar.
- Unterstützt automatische Updates über GitHub (durch Userscript-Manager).


### Installation

1. Installiere einen Userscript-Manager wie [Tampermonkey](https://www.tampermonkey.net/) oder [Greasemonkey](https://www.greasespot.net/).
2. Füge das Userscript über die rohe GitHub-URL hinzu: https://raw.githubusercontent.com/gbzret4d/internet-archive-saver/main/internet-archive-saver.user.js
3. Aktiviere das Skript im Userscript-Manager. Das Skript unterstützt automatische Updates bei neuen Releases auf GitHub.


### Verwendung

- Das Skript prüft und archiviert Seiten automatisch beim Surfen.
- Unten rechts erscheinen kleine Badges mit Statusanzeigen:
  - Spinner beim Prüfen
  - Grüner Haken bei erfolgreicher Archivierung
  - Uhr bei kürzlicher Archivierung
  - Rotes Warnsymbol bei Fehlern
- Um die Blacklist zu verwalten, öffne das Menü des Userscript-Managers und wähle **Manage Blacklist**.
- Die externe Blacklist wird automatisch geladen und zusammengeführt.
- Du kannst das Laden der externen Blacklist deaktivieren, indem du `LOAD_EXTERNAL_BLACKLIST` im Skript auf `false` setzt.


### Blacklist

Sperrt Seiten oder URLs von der automatischen Archivierung aus:

- **Domain**: Sperrt alle Seiten auf der Domain und deren Subdomains (z.B. `example.com`).
- **Präfix**: Sperrt URLs, die mit einem bestimmten Muster beginnen (z.B. `https://example.com/path*`).
- **Exakt**: Sperrt nur exakt angegebene URLs.

Blacklist kann über die Benutzeroberfläche importiert/exportiert werden.


### Mitwirken

Gerne kannst du Issues eröffnen oder Pull Requests einreichen!


### Lizenz

Dieses Projekt steht unter der GNU General Public License Version 3 (GPLv3).

---

*Erstellt und gepflegt von [gbzret4d](https://github.com/gbzret4d).*
