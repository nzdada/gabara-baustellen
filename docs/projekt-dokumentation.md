# Praxis an der Wertachbrücke – Demo-System: Gesamtdokumentation & Prozesse

> Stand: 09.07.2026 · Demo-/Testphase (Kunde hat noch nicht beauftragt, alles mit kostenlosen Mitteln)
> Webseite: https://praxis-an-der-wertachbru-1d36d.web.app
> Verwaltung: https://praxis-wertachbruecke-admin.web.app
> Präsentation: https://praxis-an-der-wertachbru-1d36d.web.app/praesentation.html

---

## 1. Projektübersicht

Demo-System für die Zahnarztpraxis **„Praxis an der Wertachbrücke"** (Ingeborg Steidle & Kollegen,
Schöpplerstraße 4, 86154 Augsburg, Inhaber Jonas Strötz). Ziel: den Zahnarzt als Kunden gewinnen,
indem ein komplettes, live funktionierendes System vorgeführt wird.

Das System besteht aus drei Teilen:

| Teil | Zweck | Nutzer |
|---|---|---|
| **Öffentliche Webseite** | Praxis-Auftritt + Online-Terminbuchung in 3 Schritten, dreisprachig (DE/EN/AR) | Patienten |
| **Praxis-Verwaltung (Admin)** | Kalender, Anfragen, Patientenakte, Abrechnung, Dashboard, Einstellungen | Empfang + Arzt (Login) |
| **Arzt-Cockpit (Tablet)** | Live-Behandlungsansicht: Zusammenfassung, Zahnschema, Fotos, Leistungen | Arzt während der Behandlung |

**Technik (alles kostenlos / Spark-Tarif):**
- Frontend: Vite + React 18 + Tailwind v4, npm-Workspaces (`website/`, `admin/`, gemeinsames `shared/`)
- Datenhaltung: **Firebase Firestore** (Region europe-west3 Frankfurt, EU/DSGVO), Firebase Auth (E-Mail/Passwort), Firebase Hosting (2 Seiten)
- E-Mail-Versand: **Google Apps Script** als Web-App (kein Cloud-Functions-Abo nötig), Datei `seed/erinnerung.gs`
- Alle Google-/Firebase-Konten über **nasiradada.98@gmail.com** (bewusst getrennt von den Firmenkonten)
- Team-Logins Verwaltung: `arzt@praxis-demo.de` und `empfang@praxis-demo.de`

---

## 2. Datenmodell (Firestore-Collections)

| Collection | Inhalt | Zugriff ohne Login |
|---|---|---|
| `requests` | Terminanfragen von der Webseite (Name, Telefon, E-Mail, Anliegen, Wunschtermin, Sprache, Status `neu/bestaetigt/abgelehnt`, `ablehnGrund`, `mailStatus`) | nur ANLEGEN |
| `slots` | Belegte Zeitfenster – **nur Datum/Uhrzeit/Status, keinerlei Patientendaten** | lesen + als „angefragt" anlegen |
| `patients` | Patientenakte: Vor-/Nachname, Geburtsdatum, Telefon, E-Mail, Versicherung (+ Zusatzversicherung), Notizen, Tags (Angst/Schmerz), `gesperrt` (Blacklist) | kein Zugriff |
| `appointments` | Termine: Patient, Datum/Start/Ende, Behandlung, Status `bestaetigt/abgeschlossen/abgesagt`, Zusammenfassung (`summary`), Befunde (Zahnschema), Leistungen (GOZ-Warenkorb), `rechnung` (`pruefen/gestellt/bezahlt`), `stornoToken`, `feedbackToken`, `erinnerung`, `ausfallgebuehr`, `intern` (Praxis-Blocker) | kein Zugriff |
| `photos` | Behandlungsfotos/Scans (komprimierte Daten-URLs) | kein Zugriff |
| `katalog` | GOZ-/BEMA-Leistungskatalog (Nr., Bezeichnung, Preis) | kein Zugriff |
| `bausteine` | Textbausteine für die Zusammenfassung (+ verknüpfte Katalog-Positionen) | kein Zugriff |
| `plaene` | Heil- und Kostenpläne (HKP): Status `entwurf/eingereicht/genehmigt/abgelehnt`, `gueltigBis` | kein Zugriff |
| `feedback` | Patienten-Feedback (Sterne, Tags, Text) | anlegen NUR mit gültigem `feedbackToken` |
| `settings` | `global` (Fristen, Gebühren, Praxisdaten, IBAN) · `pausen` (Wochenplan) · `oeffnungszeiten` (Fenster + Telefon-Tage + Urlaub) | nur `pausen` + `oeffnungszeiten` lesbar (reine Uhrzeiten) |

**Sicherheitsprinzip:** Die anonyme Webseite kann niemals Patientendaten lesen. Sie sieht nur
belegte Zeitfenster (Datum/Uhrzeit), Pausen und Öffnungszeiten. Alles andere erfordert Login.

---

## 3. Prozess A: Online-Terminbuchung (Patient auf der Webseite)

```
Patient                    Webseite (anonym)                Firestore
  |                            |                                |
  | 1. Anliegen wählen         |                                |
  |--------------------------->|                                |
  |                            | lädt live: slots, pausen,      |
  |                            | oeffnungszeiten (nur Zeiten)   |
  | 2. Tag + Uhrzeit wählen    |                                |
  |--------------------------->| berechnet freie Slots          |
  | 3. Kontaktdaten eingeben   |                                |
  |--------------------------->| validiert (Name/Tel/E-Mail     |
  |                            | Pflicht, E-Mail-Format)        |
  |                            | prüft Slot ERNEUT (noch frei?) |
  |                            |------ requests: NEU ---------->|
  |                            |------ slots: "angefragt" ----->|
  |   Bestätigungsseite        |                                |
  |<---------------------------|                                |
```

**Schritt für Schritt:**
1. **Anliegen** – 10 Behandlungen zur Auswahl (Kontrolle, PZR, Bleaching …) + „eigenes Anliegen" als
   Freitext + „Schmerzen" (führt bewusst NICHT zur Online-Buchung, sondern zeigt die Telefonnummer).
   Bei **PZR** wird später ein deutlicher Hinweis auf die 50-€-Ausfallgebühr (<24 h) angezeigt.
2. **Termin** – Es erscheinen nur Tage/Zeiten, die wirklich frei sind:
   - Basis: **konfigurierte Öffnungszeiten** (`settings/oeffnungszeiten`, in der Verwaltung pflegbar)
   - minus belegte Slots (bestätigte Termine + offene Anfragen + interne Praxis-Blocker)
   - minus wiederkehrende **Pausen** aus dem Wochenplan (z. B. Mittagspause Mittwoch)
   - minus **Urlaub/Betriebsferien** (von–bis; die Seite zeigt dann ein Urlaubs-Banner)
   - Die Liste erscheint erst, wenn die Öffnungszeiten geladen sind (kein falscher Vorab-Stand).
3. **Ihre Daten** – Name, Telefon, **E-Mail (Pflicht** – für Bestätigung und Erinnerung), optionale
   Nachricht. Die gewählte Sprache (DE/EN/AR) wird mitgespeichert, damit alle Mails in der
   Patientensprache ankommen.

**Gespeichert wird beim Absenden:**
- `requests`: die komplette Anfrage mit Status `neu` (nur für eingeloggtes Team lesbar)
- `slots`: das Zeitfenster als `angefragt` (nur Datum/Uhrzeit – so sehen andere Patienten den Slot sofort als belegt, ohne dass Daten öffentlich werden)

Der Termin gilt erst nach Bestätigung durch die Praxis („Ihr Termin gilt nach unserer Bestätigung").

---

## 4. Prozess B: Anfrage bestätigen (Team in der Verwaltung)

Neue Anfragen erscheinen live: als **Toast-Benachrichtigung** (mit Ton + Klick öffnet die Anfrage),
in der **Anfragen-Seite** und als Block **unter dem Kalender**.

```
Team klickt "Bestätigen"
  |
  v
Dialog "Anfrage bestätigen"
  |-- Patient zuordnen:
  |     a) VORHANDENER Patient (automatischer Vorschlag über Telefonnummer/Name)
  |     b) NEUPATIENT anlegen
  |-- Patientendaten prüfen & ergänzen (bearbeitbar!):
  |     Vorname, Nachname, Telefon, E-Mail, Geburtsdatum, Versicherung, Notiz
  |     -> neue Infos aus dem Telefonat landen direkt in der Akte
  |-- Warnung, falls Patient GESPERRT ist (Blacklist wegen kurzfristiger Absagen)
  |
  v  "Termin bestätigen & anlegen"
  1. patients:      anlegen ODER aktualisieren (mit den bearbeiteten Daten)
  2. appointments:  neuer Termin, Status "bestaetigt"
                    + stornoToken (zufällig, für den Absage-Link)
                    + feedbackToken (für die spätere Bewertung)
                    + Sprache des Patienten
  3. slots:         Zeitfenster wird als "belegt" geschrieben
  4. requests:      Status -> "bestaetigt", terminId verknüpft
  5. (optional)     Google-Kalender-Event, falls verbunden
  6. Mail:          Bestätigungs-Mail im HINTERGRUND (Dialog schließt sofort,
                    Mail-Status wird an der Anfrage nachgetragen:
                    ✉ gesendet / ✉ fehlgeschlagen / keine E-Mail)
```

**Die Bestätigungs-Mail** (HTML im Praxis-Design, in der Patientensprache) enthält:
Termindaten-Karte, Hinweis auf die automatische Erinnerung, **Absage-Knopf** (Link mit `stornoToken`)
und die Storno-Regel (bis 24 h kostenfrei, danach 50 € – Werte in den Einstellungen pflegbar).

---

## 5. Prozess C: Anfrage ablehnen (mit Grund)

```
Team klickt "Ablehnen"  ->  Dialog mit Grund-Auswahl:
   📞 Telefonnummer stimmt nicht – Patient soll uns anrufen und den Termin bestätigen
   📅 Termin ist bereits ausgebucht
   🏖 Praxis ist im Urlaub
   ✉  Ohne Grund (Standardtext)
        |
        v  "Ablehnen & Patient informieren"
  1. requests: Status -> "abgelehnt", ablehnGrund gespeichert
  2. Mail:     Absage-Mail in der Patientensprache; der gewählte Grund wird
               als hervorgehobener Kasten in die Mail eingebaut
               + Knopf "Neuen Termin buchen" (Link zur Buchungsseite)
```

---

## 6. Prozess D: Das Mail-System (Google Apps Script)

Eine einzige Apps-Script-Web-App (`seed/erinnerung.gs`) übernimmt den GESAMTEN Mail-Verkehr.
Sie läuft unter dem Praxis-Google-Konto und liest/schreibt Firestore über die REST-API.
Alle Mails sind HTML im Praxis-Design (Teal), dreisprachig DE/EN/AR.

**Sofort-Mails (von der Verwaltung ausgelöst, `doPost` mit Secret):**
| Typ | Auslöser | Inhalt |
|---|---|---|
| `bestaetigung` | Anfrage bestätigt | Termindaten + Absage-Link + Storno-Regel |
| `absage` | Anfrage abgelehnt | optional mit Grund-Kasten + „Neu buchen"-Knopf |
| `gebuehr` | kurzfristige Absage (<24 h) | Ausfallgebühr-Mitteilung (§ 615 BGB, 50 €) |

**Zeitgesteuerte Mails (Trigger im Apps Script):**
| Funktion | Rhythmus | Was passiert |
|---|---|---|
| `sendeErinnerungen` | täglich ~17 Uhr | findet alle MORGIGEN bestätigten Termine mit E-Mail, sendet Erinnerung, markiert `erinnerung: gesendet` |
| `sendeFeedbackAnfragen` | stündlich | findet abgeschlossene Behandlungen (nach Wartezeit), sendet Bewertungs-Mail mit persönlichem Feedback-Link |

**Absage-Link (Patient klickt in der Mail, `doGet`):**
```
Klick auf "Termin absagen"
  |-- Token wird gegen appointments.stornoToken geprüft (falsch -> "Link ungültig")
  |-- Termin: Status -> "abgesagt" + Zeitstempel abgesagtAm
  |-- Slot wird GELÖSCHT -> Zeit sofort wieder online buchbar
  |-- Zeitprüfung: Absage weniger als 24 h vor dem Termin?
  |       JA -> ausfallgebuehr "ausstehend", Leistungsposition
  |             "Ausfallhonorar gem. § 615 BGB" (50 €) am Termin,
  |             Rechnung -> "pruefen", automatische Gebühren-Mail
  |       NEIN -> kostenfreie Absage
  |-- Patient sieht eine Bestätigungsseite im Webseiten-Design
```

Abgesagte Termine bleiben im Kalender sichtbar (rot, durchgestrichen).

---

## 7. Prozess E: Behandlungstag (Arzt-Cockpit)

```
Patient kommt -> Arzt öffnet Cockpit (Tablet)
  |-- Patient + Risiko-Tags (⚠️ Angstpatient, 🆕 Neu, 👵 Senior, ⏱️ Schmerzen)
  |-- Historie der letzten Behandlungen
  |-- ZAHNSCHEMA (Odontogramm, FDI): Klick auf Zahn -> Befund erfassen
  |-- FOTOS: Tablet-Kamera oder Scan hochladen (am Termin gespeichert)
  |-- ZUSAMMENFASSUNG: formatierbar (fett, Listen, Überschriften),
  |     5 pflegbare Textbausteine, Groß-Editor im Vollbild,
  |     speichert live (600 ms Puffer) -> Empfang sieht alles sofort
  |-- LEISTUNGEN: Abrechnungs-Warenkorb aus dem GOZ-Katalog,
  |     Vorschläge passend zu gewählten Textbausteinen,
  |     WARNUNG bei Positionen ≥ 500 € ohne genehmigten HKP
  |
  v  "Behandlung abschließen"
  appointments: Status -> "abgeschlossen", rechnung -> "pruefen"
  -> Termin erscheint in Abrechnung unter "Bereit für Abrechnung"
  -> Feedback-Mail geht später automatisch raus
```

**Abrechnungs-Pipeline:** `pruefen` → `gestellt` → `bezahlt` (Rechnungs-PDF mit Praxisdaten/IBAN
aus den Einstellungen; Zusatzversicherung des Patienten wird berücksichtigt).
**Dashboard:** behandelte Patienten, Umsatz, Ausfallquote, Wochen-Chart
(grün = abgeschlossen, gelb = rechtzeitig abgesagt, rot = kurzfristig), auffällige Patienten
mit ≥ 2 kurzfristigen Absagen → Knopf „Online-Buchung sperren" (Blacklist).

---

## 8. Prozess F: Feedback

```
Behandlung abgeschlossen -> (Wartezeit aus Einstellungen) -> Feedback-Mail
  -> Patient klickt Link (mit feedbackToken)
  -> Bewertungsseite: 5 Emoji-Sterne + Schnell-Tags + Freitext (mobil, 3 Sprachen)
  -> feedback-Collection (anonym NUR mit gültigem Token erlaubt)
  -> Verwaltung: Nav-Punkt "Feedback" mit Alarm-Badge bei 1-2 Sternen,
     rote Markierung "Aktion erforderlich", Durchschnitt im Dashboard
```

---

## 9. Einstellungen (alles ohne Programmierung pflegbar)

| Bereich | Was | Wirkung |
|---|---|---|
| **Öffnungszeiten** | Zeitfenster je Wochentag Mo–Sa (mehrere pro Tag möglich, überlappende werden zusammengefasst) | steuert LIVE: Online-Buchung, interne Terminvergabe, Kalender-Raster/-Beschriftung, Öffnungszeiten-Tabelle der Webseite |
| **Telefon-Tage** | Checkbox „☎ telefonisch erreichbar" an Tagen ohne Zeitfenster | Webseite/Kalender zeigen „nur telefonisch erreichbar" statt „geschlossen" |
| **Urlaub & Betriebsferien** | Zeiträume von–bis | Online-Buchung + interne Patiententermine gesperrt, Urlaubs-Banner auf der Buchungsseite, 🏖-Markierung im Kalender |
| **Wochenplan Pausen** | wiederkehrende Pausen/Abwesenheiten je Wochentag (z. B. Mittagspause) | online nicht buchbar, im Kalender schraffiert (☕) |
| **Globale Einstellungen** | Storno-Frist (24 h), Ausfallgebühr (50 €), Feedback-Verzögerung, Standardsprache, Währung, GOZ/BEMA, Praxisdaten, Bank/IBAN | Mails, Gebühren-Logik, Rechnungs-PDF |
| **Demo-Reset** | ein Klick | setzt alle Daten auf den Vorführ-Stand (Szenario-Patienten) zurück |

**Interne Praxis-Termine:** Im Kalender auf eine freie Zeit klicken → „🔒 Praxis-Termin (blockieren)"
mit frei wählbarer Von-Bis-Zeit (Besprechung, Labor …) – blockt die Online-Buchung, ist
bearbeit- und löschbar. Patiententermine per Klick werden gegen die Öffnungszeiten validiert.

---

## 10. Datenschutz-Konzept (Kurzfassung)

- Hosting + Datenbank: Google Ireland Ltd., Server **Frankfurt (EU)**, AV-Vertrag über Google
- Öffentliche Seite: **keine Cookies, kein Tracking**, Sprache nur lokal gespeichert
- Anonyme Zugriffe können NUR: Anfrage anlegen, belegte Zeitfenster (reine Uhrzeiten) lesen,
  Pausen/Öffnungszeiten lesen, Feedback mit gültigem Token abgeben
- Google Maps als **Zwei-Klick-Lösung**: Karte lädt erst nach Einwilligungs-Klick
- Absage-/Feedback-Links tragen zufällige Tokens, die nur den eigenen Termin betreffen
- Impressum + Datenschutzerklärung als eigene Seiten; Hinweis: vor Echtbetrieb anwaltlich prüfen

---

## 11. Chronik der Arbeit (was wurde wann gebaut)

1. **Grundgerüst & Kernsystem** – Workspaces, shared-Module, Webseite mit echten Praxis-Inhalten,
   3-Schritte-Buchung, Verwaltung (Kalender, Anfragen, Patienten, CSV-Import), Arzt-Cockpit,
   Demo-Daten, Erinnerungs-Skript, Datenschutz-Konzept, Demo-Drehbuch, HTML-Präsentation
2. **Mehrsprachigkeit** – DE/EN/AR inkl. Rechts-nach-links-Layout, Sprachwahl-Knopf mit Flaggen
3. **Abrechnung & Arztfunktionen** – GOZ-Katalog, Rechnungs-PDF, Arzt-Dashboard mit Bericht-PDF
   (inkl. Fotos), HKP je Patient, formatierbare Zusammenfassung mit Textbausteinen
4. **Firebase live** – Projekt `praxis-an-der-wertachbru-1d36d`, Firestore + Auth + 2 Hosting-Seiten,
   Sicherheitsregeln, Ende-zu-Ende verifiziert (Buchung → Anfrage → Bestätigung → Cockpit, geräteübergreifend)
5. **Mail-System** – HTML-Mails im Praxis-Design, 3 Sprachen, Absage-Link mit echter Stornierung,
   24-h-Regel mit automatischer 50-€-Gebühren-Mail
6. **Ausbau in 8 Arbeitspaketen (11 Module)** – UI-Politur, Toast-Benachrichtigungen, Impressum/
   Datenschutz, Odontogramm + Risiko-Tags, Abrechnungs-Pipeline + HKP-Tracker mit Warnung, SEO
   (WebP, JSON-LD, Sitemap), Analytik-Dashboard + Blacklist + Gebühren-Automatik, Feedback-System,
   globale Einstellungen, QA mit Test-Szenarien (23/23 bestanden)
7. **Termin-Extras** – Klick-ins-Raster legt Termin an, interne Praxis-Blocker mit Von-Bis,
   Wochenplan für Pausen
8. **Konfigurierbare Öffnungszeiten** – je Wochentag pflegbar, wirkt live auf Buchung/Kalender/Webseite
9. **Code-Review mit 17 bestätigten Findings – alle behoben** – u. a. Samstags-Spalte + dynamisches
   Zeitraster im Kalender, Validierung beim Klick-Anlegen, Buchung wartet auf geladene Einstellungen
   und prüft den Slot beim Absenden erneut, Doppelklick-Race beim Speichern behoben, zentrale
   Normalisierung + Wochentagsnamen, weniger Datenbank-Listener
10. **Karte + PZR-Hinweis** – Google Maps (Zwei-Klick), 50-€-Warnbox bei PZR-Buchung
11. **Anfragen-Ausbau + Urlaub** – Patientendaten im Bestätigen-Dialog bearbeitbar, Ablehnen mit
    Grund (in der Absage-Mail sichtbar), Urlaubszeiträume in den Einstellungen

---

## 12. Offene Punkte

- **Apps-Script-Update einspielen** (script.google.com → gleiche Bereitstellung → neue Version):
  bringt Gebühren-/Feedback-Mails, neue HTML-Vorlagen und den Ablehnungsgrund in der Absage-Mail.
  Zweiten Trigger `sendeFeedbackAnfragen` (stündlich) anlegen.
- Google-Kalender-Anbindung optional (OAuth-Client anlegen; bis dahin Demo-Modus)
- Live-Test durch Ibrahim → Feedback/Bugs in der nächsten Sitzung
- Bei Beauftragung: eigene Domain (praxis-an-der-wertachbruecke.de) auf Firebase Hosting,
  SMS-Erinnerungen, ggf. Cloud Functions statt Apps Script

---

## 13. Für die Visualisierung (NotebookLM / Gemini)

Empfohlene Diagramme aus diesem Dokument:
1. **Buchungs-Fluss** (Abschnitt 3): Patient → Webseite → requests/slots
2. **Bestätigungs-Fluss** (Abschnitt 4): Dialog → 6 Speicher-/Mail-Schritte
3. **Mail-Landkarte** (Abschnitt 6): 3 Sofort-Mails + 2 zeitgesteuerte + Absage-Link-Logik
4. **Datenmodell** (Abschnitt 2): 10 Collections und wer worauf zugreifen darf
5. **Termin-Lebenszyklus**: Anfrage → bestätigt → (abgesagt | abgeschlossen → Abrechnung → Feedback)
