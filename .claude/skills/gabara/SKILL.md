---
name: gabara
description: Technik & Betrieb der Gabara-Baustellen-Plattform (C:\Users\dadah\gabara-baustellen) – Webseite + Verwaltung, wo Kalender/Projekte/LV/Berichte/Abrechnung liegen, Start- und Build-Kommandos, PDF-Layout, FastBill-Anbindung, Go-Live-Checkliste Firebase. Nutzen bei jeder Änderung an der Gabara-Web-App ("Kalender anpassen", "LV-Import", "Bericht/PDF ändern", "Deploy", "/gabara").
---

# Gabara Baustellen – Webseite + Verwaltung

Baustellen-Abwicklung der **Gabara Service GmbH** (Maler & Lackierer, Münchener Str. 21,
86551 Aichach, +49 176 25700609, Info@gabara-service.de). Kopie der erprobten
Wertachbrücke-/Zahnarzt-Vorlage – **Architektur nicht umbauen, nur weiterentwickeln.**

Pflichtlektüre vor Änderungen: `docs/projekt-dokumentation.md` (Datenmodell, Prozesse,
Go-Live-Checkliste). Repo: `C:\Users\dadah\gabara-baustellen` (git, Branch `master`, **kein Remote**).

## Start & Build

```bash
npm run dev:admin --prefix C:\Users\dadah\gabara-baustellen
```

| App | Ordner | Port | Zweck |
|---|---|---|---|
| Webseite | `website/` | 5410 | Öffentliche Seite + Anfrageformular `/#/anfrage` |
| Verwaltung | `admin/` | 5420 | Kalender, Projekte, LV, Berichte, Abrechnung |

`npm run build` baut beide. In BOXEN gibt es launch.json-Einträge `gabara-website` / `gabara-admin`
(preview_start nutzen, nie einen Dev-Server über Bash starten).

Demo-Logins (nur Lokal-Modus): `buero@gabara-demo.de` / `monteur@gabara-demo.de`, Passwort `demo2026`.

## Wo liegt was

| Thema | Datei |
|---|---|
| Datenhaltung (2 Modi lokal/Firebase, EINE API) | `shared/store.js` |
| Projekt-Status (5 Stufen + Alt-Mapping) | `shared/projektstatus.js` |
| Teams, Team-Farben, Farbpalette | `shared/teams.js` |
| Firmendaten, Leistungen, Arbeitszeiten | `shared/praxis.js` |
| Globale Einstellungen + Defaults | `shared/einstellungen.js` |
| Anmeldung/Rollen | `shared/auth.js` |
| FastBill-API | `shared/fastbill.js` |
| Kalender (Wochenraster, Teams, Baustellen-Panel) | `admin/src/pages/Kalender.jsx` |
| Termin-Dialog (Von/Bis, Aufgaben, Projekt-Neuanlage) | `admin/src/components/NeuerTermin.jsx` |
| Monats-Datepicker (Admin + Monteur) | `admin/src/components/DatumWahl.jsx` |
| Bericht erfassen (Stundenlohnzettel) | `admin/src/components/BerichtForm.jsx` |
| LV-Import-UI | `admin/src/components/LvImport.jsx` |
| **LV-Text-Parser (Heuristik)** | `admin/src/lvparser.js` |
| **Alle PDFs** | `admin/src/drucken.js` |
| Rechnungs-Assistent | `admin/src/components/RechnungWizard.jsx` |
| Monteur-Handy-Ansicht | `admin/src/pages/monteur/` |
| Sicherheitsregeln Firestore | `firestore.rules` |

## Feste Regeln dieses Projekts

1. **Keine Blockaden im Planungs-UI.** Termine dürfen sich überschneiden, Zeiten sind frei
   wählbar. Es gibt bewusst KEINE „freie Uhrzeiten"-Prüfung mehr.
2. **PDFs entstehen nur im Web-Admin** (`drucken.js`), nie auf dem Handy. Layout-Reihenfolge:
   Kopf (Logo/Firma/Nr./Zeitstempel) → 2-Spalten Auftraggeber|Projekt → §-15-Hinweis →
   Arbeiten → Tabellen mit Netto-Summe → Vorher/Nachher-Fotos getrennt → VOB/B-Frist →
   zwei Unterschriftenfelder.
3. **FastBill ist führend** für Kunden, Artikel, Rechnungen. Nummern, E-Rechnung, Versand und
   Mahnwesen laufen dort – die App hält nur einen Spiegel. Rate-Limit ~50 Calls/Stunde,
   deshalb Sync nur auf Knopfdruck.
   **Kein Rechnungs-Eigendruck** (Entscheidung des Auftraggebers, 01.08.2026): Das
   Rechnungs-PDF kommt ausschließlich aus FastBill und wird über `rechnung.dokumentUrl`
   verlinkt. `drucken.js` erzeugt nur Berichte, Protokolle und Arbeitsaufträge –
   dort **keine** Rechnungsvorlage wieder einbauen.
4. **Datum immer lokal** über `heuteISO()` aus `shared/slots.js` – niemals
   `new Date().toISOString().slice(0,10)` (liefert UTC und nachts das Vortagsdatum).
5. **Interne Feldnamen der Vorlage bleiben** (`patients` = Kunden, `appointments` = Termine,
   `arzt` = erster Monteur, `ZahnLogo` = Gabara-Logo). Keine Massen-Renames.
6. **Eingaben debouncen** (600 ms + Flush bei Blur), nie jeden Tastendruck in den Store.
7. **Massen-Schreibvorgänge** über `store.addMany` / `removeMany`, nicht in einer Schleife
   einzeln – im Lokal-Modus wird sonst je Zeile die ganze DB serialisiert.
8. **Mitarbeiter-Stammdaten** steuern zwei Dinge: `team` + `farbe` = Kalenderfarbe/Legende,
   `qualifikation` (facharbeiter/helfer) = Stundensatz im Regiebericht.

## Go-Live-Checkliste (Firebase)

Reihenfolge einhalten – Punkte 1–3 sind Voraussetzung, 4–5 sind Pflicht vor Veröffentlichung:

1. Firebase-Projekt anlegen (Konto nasirdada.98@gmail.com, Spark, **europe-west3**),
   Werte in `shared/firebase-config.js` eintragen, `enabled: true`.
2. **`firestore.rules` deployen** – ohne die Regeln schlägt jede Terminanlage fehl
   (die `slots`-Collection wäre sonst gesperrt).
3. **users-Dokument-ID = Firebase-Auth-UID setzen.** Erst dann greifen die Rollenregeln:
   nur das Büro darf Mitarbeiter ändern und den FastBill-API-Key lesen. Solange die UIDs
   fehlen, laufen die Regeln im Übergangsmodus (jeder Angemeldete darf alles).
4. **Impressum vervollständigen** (`website/src/pages/Recht.jsx`): Geschäftsführer,
   Handelsregister/HRB, USt-IdNr. – für eine GmbH gesetzlich vorgeschrieben (§ 5 TMG).
   Steht aktuell als Platzhalter drin.
5. FastBill-Proxy bereitstellen (`seed/gabara-fastbill-proxy.gs` als GAS-Web-App),
   URL in Einstellungen → FastBill → Proxy-URL. Im Dev übernimmt das der Vite-Proxy;
   das Feld muss lokal **leer** bleiben.
6. Zwei Hosting-Sites (Webseite + Admin), danach `npm run build` und
   `npx --yes firebase-tools deploy --only hosting,firestore:rules --project <id>`.

## Bekannte Grenzen

- **Lokal-Modus:** Webseite (5410) und Verwaltung (5420) haben getrennte Browser-Speicher –
  eine Webseiten-Anfrage erscheint erst im Firebase-Modus im Admin.
- **Berichtsnummern** werden ohne Transaktion vergeben. Bei zwei gleichzeitigen Erfassungen
  im Mehrbenutzerbetrieb sind Doppelnummern möglich → beim Go-Live auf `runTransaction` umstellen.
- **Verwaiste Entwürfe:** Ein Foto im Bericht legt sofort einen Entwurf an. Bricht der Monteur
  danach ab, bleibt ein leerer Entwurf stehen.
- **Vollabos:** Mehrere Seiten abonnieren komplette Collections (`projekte`, `patients`, `users`).
  Bei stark wachsendem Datenbestand auf `useWhere` / `listWhere` umstellen.
- **V2 offen:** Flutter-App `gabara_field` für Monteure (Fork von `C:\Users\dadah\mam_solar`);
  sendet nur Daten in dieselben Collections, PDFs bleiben im Web.

## Häufige Aufgaben

- **Farbe/Team eines Monteurs ändern:** Einstellungen → Mitarbeiter (wirkt sofort im Kalender).
- **Stundensätze ändern:** Einstellungen → Sätze (Facharbeiter/Helfer/km).
- **LV einlesen:** Projekt → Leistungsverzeichnis → LV importieren. CSV mit Spalten-Mapping
  oder PDF-Text einfügen; beide enden in derselben Vorschau, dort korrigieren, dann übernehmen.
  Parsing-Regeln stehen im Kopf von `admin/src/lvparser.js`.
- **PDF-Layout ändern:** nur `admin/src/drucken.js` (`STIL` = Druck-CSS, dann die
  `drucke*`-Funktionen). Bilder werden abgewartet, bevor der Druckdialog aufgeht.
- **Neuen Projekt-Status:** `shared/projektstatus.js` – Liste erweitern UND `ALT_ZUORDNUNG`
  pflegen, sonst verlieren Bestandsprojekte ihren Status.
