# Chormanager – Projektübersicht für Claude Code

## Was ist das?
Eine Progressive Web App (PWA) für die Verwaltung eines Chors.
Gebaut als einzelne `index.html` mit Vanilla JS, Supabase als Backend.
Gehostet auf GitHub Pages: https://mgbi-alt.github.io/chor-manager/

## Tech Stack
- **Frontend:** Vanilla HTML/CSS/JS (keine Frameworks), aufgeteilt in `index.html` + separate JS/CSS-Dateien
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Hosting:** GitHub Pages
- **Push:** Supabase Edge Function `send-push` + Web Push API
- **Service Worker:** `sw.js` für PWA + Push-Empfang

## Dateistruktur
| Datei | Inhalt |
|-------|--------|
| `index.html` | Nur HTML-Struktur + Link/Script-Referenzen (394 Zeilen) |
| `css/main.css` | Gesamtes CSS (245 Zeilen) |
| `js/config.js` | Globals, Utils, NRW-Feiertage, Auth |
| `js/app.js` | App-Start, Push-Notifications, Unread, Dashboard, Ankündigungen |
| `js/songs.js` | Liederverwaltung, CSV-Import/Export |
| `js/events.js` | Veranstaltungen, Autocomplete, Excel-Export/Import |
| `js/calendar.js` | Kalender, Touch-Swipe |
| `js/stats.js` | Analytics/Statistiken |
| `js/media.js` | Mediathek |
| `js/assistant.js` | KI-Assistent |
| `js/song_assistant.js` | Lied-Assistent |
| `js/settings.js` | Admin-Bereich, DB-Cleanup, Merge, Backup, PDF-Reassign, Activity-Log, INIT |
| `sw.js` | Service Worker |

## Supabase Konfiguration
```javascript
const SB_URL = 'https://nzgmznxwtvmjatbhbmcp.supabase.co';
const SB_KEY = 'sb_publishable_rTWG_fw_Us_yA4ZayeR9sw_glQ-rrP-';
```

## Datenbank-Tabellen
| Tabelle | Inhalt |
|---------|--------|
| `songs` | Liederdatenbank (liedanfang, title, komponist, besetzung, thema, quelle, quelle_nr, in_repertoire, status, ...) |
| `song_files` | Angehängte Dateien pro Lied (chorsatz, klaviersatz, orchestersatz, sibelius) |
| `song_performance_stats` | Wann wurde ein Lied zuletzt gesungen (last_performed, total_performances) |
| `events` | Veranstaltungen (title, datum, uhrzeit, ort, chor, status, verschoben_auf) |
| `event_songs` | Welche Lieder bei welcher Veranstaltung |
| `event_program` | Programmpunkte einer Veranstaltung |
| `event_tasks` | Aufgaben zu Veranstaltungen |
| `calendar_events` | Wiederkehrende Termine/Chorproben (status, verschoben_auf) |
| `profiles` | Nutzerprofile (name, role: admin/member, active) |
| `announcements` | Infos/Mitteilungen (title, body, expires_at, priority: immer 'urgent') |
| `announcement_reads` | Wer hat welche Mitteilung gelesen |
| `attendance` | Anwesenheit bei Veranstaltungen |
| `media` + `media_albums` | Mediathek |
| `cal_categories` | Kalender-Kategorien mit Farben |
| `push_subscriptions` | Web Push Subscriptions |
| `activity_log` | Protokoll aller Änderungen (action, entity, entity_title, changes, user_name, created_at) |

## Storage Buckets
- `choir-media` — alle Dateien (Song-PDFs unter `{song_id}/chorsatz.pdf` etc.)

## App-Struktur (Navigation)
Die App hat eine Bottom-Navigation mit folgenden Tabs:
1. **Start** (Dashboard) — Begrüßung, Zähler, Infos/Ankündigungen, Nächste Termine, Bevorstehende Veranstaltungen
2. **Lieder** — Repertoire + Datenbank, Filter, Suche
3. **Veranst.** — Veranstaltungsliste, Programm, Aufgaben
4. **Kalender** — Monats-/Wochenansicht, Mini-Kalender
5. **Stats** — Statistiken, Auftrittshistorie
6. **Medien** — Mediathek, Alben
7. **Admin** (nur für Admins) — Mitglieder / Infos / Quellen / Einstellungen

## Wichtige Funktionen

### Lieder (songs.js)
- Repertoire und Datenbank getrennt (in_repertoire: true/false)
- Filter nach Besetzung, Thema (aus DB generiert, dedupliziert)
- Liedkarte zeigt: Titel | PDF-Icons (📄🎹🎻🎼) klickbar | letztes Singen | Besetzung
- Song-Detail Modal mit allen Feldern
- Song bearbeiten/erstellen/löschen (nur Admin)
- CSV-Import/Export
- Label-Bereinigung (normalizeLabel, dedupeLabels — Title Case, Kleinwörter klein)
- Merge-Duplikate Tool (Levenshtein-Ähnlichkeit ≥85%)
- Großes PDF einlesen (KI-gestützt via claude-proxy Edge Function)
- PDF-Zuordnung korrigieren (Tool mit Preview + Galerie)

### Veranstaltungen
- Veranstaltungen mit Programm (Lieder + Platzhalter, drag & drop sortierbar)
- Status: normal / verschoben / abgesagt / kein_chor
- Bei "verschoben": Datum "verschoben auf" speichern
- Dashboard zeigt Status-Hinweise in Rot

### Kalender
- Monats- und Wochenansicht
- NRW-Feiertage eingebaut
- Chorproben-Serie aus calendar_events
- Status (kein_chor, verschoben) auf Dashboard sichtbar

### Admin-Bereich (renderSettings)
Tabs: **Mitglieder | Infos | Quellen | Einstellungen**

**Mitglieder:** Nutzer verwalten, aktivieren/deaktivieren, Rolle setzen

**Infos:** Ankündigungen erstellen/bearbeiten/löschen, erscheinen auf Dashboard solange aktiv oder bis Ablaufdatum

**Quellen (Quellenübersicht):**
- Quelle auswählen (z.B. Chorbuch)
- Zeigt alle Lieder nach Nummer sortiert
- Fehlende Nummern als rote Chips (Ranges zusammengefasst)
- PDF-Symbol zeigt ob PDF angehängt

**Einstellungen:**
- Labels bereinigen & vereinheitlichen (runDbCleanup)
- Duplikate finden & zusammenführen (openMergeTool)
- PDF-Zuordnung korrigieren (openPdfReassign) — mit 2-Phasen-Review + Galerie
- Backup erstellen (DB als JSON, Seite als HTML, Dateiliste)
- Aktivitätsprotokoll (📋) — alle Änderungen mit User + Zeitstempel

### Push-Benachrichtigungen
- Service Worker (`sw.js`) empfängt Pushes
- Badge API setzt roten Punkt auf App-Icon
- Badge wird geleert wenn Dashboard geöffnet wird
- Push wird bei neuer Info gesendet

## CSS-Variablen (Design)
```css
--bg        /* Hintergrund dunkel */
--card      /* Karten-Hintergrund */
--border    /* Rahmen */
--text      /* Haupttext */
--text2     /* Sekundärtext */
--text3     /* Tertiärtext/Placeholder */
--accent    /* Gold/Amber (#c9a84c) */
--accent2   /* Heller Akzent */
--success   /* Grün */
--err       /* Rot */
--r         /* Border-Radius klein */
--r2        /* Border-Radius groß */
```

## Wichtige globale Variablen
```javascript
SB              // Supabase Client
currentUser     // Eingeloggter User
currentProfile  // Profil (name, role, active)
cachedSongs     // Alle Songs im Speicher
cachedEvents    // Alle Events
isAdmin         // Boolean
editSongId      // ID des gerade bearbeiteten Songs (null = neu)
editEvId        // ID der gerade bearbeiteten Veranstaltung
_songFileMap    // Map: song_id → [{type, url}]
_songPerfMap    // Map: song_id → {last_performed, total_performances}
```

## Wichtige Hilfsfunktionen
```javascript
esc(str)           // HTML escapen
fD(date)           // Datum formatieren (deutsch)
fT(time)           // Zeit formatieren
T(msg, type)       // Toast-Nachricht ('ok'|'err'|'warn')
openModal(id)      // Modal öffnen
closeModal(id)     // Modal schließen
showPage(name)     // Tab wechseln
logActivity(action, entity, entityId, title, changes)  // Aktivität protokollieren
normalizeLabel(v)  // Title Case mit Kleinwörtern
```

## Bekannte Eigenheiten
- `song_files` Typen: `chorsatz`, `klaviersatz`, `chor_klavier`, `orchestersatz`, `sibelius`
- `quelle_nr` ist als TEXT gespeichert → numerisch sortieren mit `parseInt`
- Supabase gibt Batch-Inserts nicht in Einfügereihenfolge zurück → by `liedanfang` matchen
- `calendar_events` und `events` sind zwei verschiedene Tabellen (Chorproben vs. Auftritte)
- `renderSettings(tab)` rendert den Admin-Bereich mit Tab-Auswahl
- PDF-Zuordnungsstand wird in `localStorage` ('pdf_reassign_state_v1') gespeichert

## Offene Punkte / Ideen
- Aufgesplittete Version (js/ + css/) für NAS-Hosting liegt als `chormanager2.zip` vor
- Supabase-Migrationsskripte: `migration.sql`, `migration_activity_log.sql`
- Service Worker noch nicht vollständig mit Supabase Edge Function `send-push` integriert (badgeCount fehlt im Payload)
- `calendar_events` Bearbeitungsformular hat noch kein Status-Feld (verschoben/kein_chor)
