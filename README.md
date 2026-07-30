# Praxis an der Wertachbrücke – Webseite + Praxis-Verwaltung (Demo)

Digitales Termin- und Verwaltungssystem für die Zahnarztpraxis an der Wertachbrücke
(Ingeborg Steidle & Kollegen, Augsburg). Drei Bausteine, alle im Browser (Chrome), alles kostenlos:

1. **website/** – öffentliche Praxis-Webseite mit intuitiver 3-Schritte-Terminbuchung
2. **admin/** – getrennte Praxis-Verwaltung: Terminkalender, Anfragen, Patienten, CSV-Import, Erinnerungen
3. **Arzt-Cockpit** – Tablet-Ansicht in der Verwaltung (`#/cockpit`): heutige Termine + Behandlungs-Zusammenfassung **live**

Dazu: `seed/erinnerung.gs` (automatische Termin-Erinnerung per E-Mail, 1 Tag vorher),
`docs/` (Datenschutz-Konzept, Demo-Drehbuch, Präsentation).

## Lokal starten (Demo-Modus, ohne Firebase)

```bash
npm install
npm run dev:website   # http://localhost:5210  (Webseite)
npm run dev:admin     # http://localhost:5220  (Verwaltung)
```

- Demo-Logins Verwaltung: `empfang@praxis-demo.de` / `demo2026` und `arzt@praxis-demo.de` / `demo2026`
- Im Demo-Modus liegen die Daten im Browser (localStorage). Live-Updates funktionieren
  **zwischen Tabs desselben Browsers** (z. B. Kalender + Cockpit nebeneinander).
- **Einschränkung Demo-Modus:** Webseite (Port 5210) und Verwaltung (Port 5220) sind getrennte
  Browser-Speicher – eine Buchung auf der Webseite erscheint lokal *nicht* automatisch in der
  Verwaltung. Für den vollen Fluss über Geräte hinweg → Firebase aktivieren (unten).

## Online schalten mit Firebase (einmalig ~20 Minuten)

> Konto für alles: **nasiradada.98@gmail.com** (bewusst getrennt von den Firmen-Konten).

1. **Projekt anlegen:** https://console.firebase.google.com → „Projekt hinzufügen" →
   Name `praxis-wertachbruecke-demo` (Google Analytics: nicht nötig).
2. **Firestore:** Build → Firestore Database → „Datenbank erstellen" →
   Region **europe-west3 (Frankfurt)** → Produktionsmodus.
3. **Authentication:** Build → Authentication → Anmeldemethode **E-Mail/Passwort** aktivieren →
   unter „Users" die Team-Zugänge anlegen (z. B. empfang@praxis-demo.de mit sicherem Passwort).
4. **Web-App registrieren:** Projektübersicht → Web (`</>`) → App-Name egal →
   die angezeigten Config-Werte in **`shared/firebase-config.js`** eintragen und `enabled: true` setzen.
5. **CLI & Deploy** (PowerShell im Projektordner):
   ```bash
   npm install -g firebase-tools
   firebase login                        # im Browser mit nasiradada.98@gmail.com bestätigen
   firebase use --add                    # Projekt praxis-wertachbruecke-demo wählen, Alias default
   firebase hosting:sites:create praxis-wertachbruecke-admin   # zweite Site für die Verwaltung
   npm run build
   firebase deploy                       # Regeln + beide Hosting-Sites
   ```
6. Danach in der Verwaltung → Einstellungen → **„Demo-Daten zurücksetzen"** klicken
   (füllt Firestore mit den fiktiven Demo-Patienten/-Terminen).

Ergebnis: zwei Adressen, von überall im Chrome erreichbar — **bereits deployed (Stand 08.07.2026)**:
- Webseite: `https://praxis-an-der-wertachbru-1d36d.web.app`
- Verwaltung: `https://praxis-wertachbruecke-admin.web.app` (nur mit Login)
- Präsentation: `https://praxis-an-der-wertachbru-1d36d.web.app/praesentation.html`

Projekt: `praxis-an-der-wertachbru-1d36d` · Firestore: europe-west3 (Frankfurt) ·
Team-Logins in Firebase Authentication (empfang@praxis-demo.de, arzt@praxis-demo.de).
Neues Deployment nach Änderungen: `npm run build && npx firebase-tools deploy`

## Google Kalender anbinden (optional)

1. https://console.cloud.google.com (gleiches Konto, Projekt der Firebase-App) →
   „APIs & Dienste" → **Google Calendar API aktivieren**.
2. „Anmeldedaten" → OAuth-Client-ID (Webanwendung) → autorisierte JavaScript-Quellen:
   `http://localhost:5220` und `https://praxis-wertachbruecke-admin.web.app`.
3. Client-ID in `shared/firebase-config.js` unter `GOOGLE_KALENDER.clientId` eintragen.
4. In der Verwaltung → Kalender → „Google Kalender verbinden".

Datenschutz: Ins Google-Event schreibt das System nur Behandlung + Kürzel („PZR – S. R."),
die vollen Daten bleiben in Firestore. Details: `docs/datenschutz-konzept.md`.

## Termin-Erinnerungen (1 Tag vorher, kostenlos)

`seed/erinnerung.gs` in https://script.google.com einfügen (gleiches Konto),
täglichen Trigger 17–18 Uhr auf `sendeErinnerungen` setzen. Anleitung steht im Skript-Kopf.

## Struktur

```
website/   Vite + React + Tailwind – öffentliche Seite (keinerlei Patientendaten-Zugriff)
admin/     Vite + React + Tailwind – Verwaltung + Arzt-Cockpit (Login-Pflicht)
shared/    Gemeinsame Module: Praxisdaten, Slot-Logik, Datenhaltung (lokal/Firebase), Auth, Google Kalender
seed/      erinnerung.gs (Apps Script), patienten-beispiel.csv (für den Import-Test)
docs/      datenschutz-konzept.md · demo-drehbuch.md · praesentation.html
```

Die Datenhaltung (`shared/store.js`) hat zwei Modi mit identischer API:
**lokal** (Browser, für Entwicklung/Notfall-Demo) und **firebase** (Firestore Frankfurt,
Live-Sync über alle Geräte). Umschalten = `enabled: true` in `shared/firebase-config.js`.
