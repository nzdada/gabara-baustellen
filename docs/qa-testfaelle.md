# QA-Testfälle (Module 1–11)

Testdaten: „Demo-Daten zurücksetzen" (Einstellungen) erzeugt alle Szenarien frisch.
Logins: `arzt@praxis-demo.de` / `empfang@praxis-demo.de` (Passwort bei Ibrahim).

## Test-Szenarien in den Demo-Daten

| Szenario | Daten | Testet |
|---|---|---|
| **Stammpatient** | Werner Altmann: 6 Behandlungen über 2 Jahre mit formatierten Berichten, Leistungen, Befunden (Zahn 36/46); genehmigter HKP „Krone 36", abgelehnter HKP „Bleaching"; Termin **morgen 08:30**; offene Anfrage mit gleicher Telefonnummer | Alte Berichte, Bericht-PDF, HKP-Tracker, Wiedererkennung, 24h-Gebühr per Absage-Link |
| **Neupatientin** | Nora Neumann: nur offene Anfrage, unbekannt | Neupatient-Anlage beim Bestätigen |
| **Angstpatientin** | Selma Karim: Notiz „ANGSTPATIENTIN!", Termin **heute 12:00**, Befund Zahn 26, Erstgespräch in Historie | Rote Risiko-Tags + Warnung im Cockpit |
| **Kind** | Lina Klein (8 J.): Termin **heute 15:00** „mit Martha" | Kind-Szenario, 24h-Gebühr-Test (Absage heute) |
| **Blacklist** | Peter Grimm: 2 kurzfristige Absagen mit je 50 € Ausfallhonorar (offen) | Auffällige Patienten, Buchungssperre, Gebühren-KPI |
| **Feedback** | 5★ (erledigt) + 2★ (neu) | Alarm-Badge, „Aktion erforderlich" |

## Testfälle

| Nr | Modul | Beschreibung | Soll-Verhalten |
|---|---|---|---|
| T01 | 1 | PZR-Wording | „Professionelle Zahnreinigung (PZR)" auf Webseite, Katalog, Bausteinen |
| T02 | 1 | Patientenliste | Aktiver Patient mit Teal-Hintergrund + weißer Schrift |
| T03 | 2 | Impressum/Datenschutz | Seiten erreichbar, Google Ireland + Frankfurt/EU + Apps-Script-Datenfluss genannt |
| T04 | 11 | Live-Toast | Online-Buchung → Toast mit Name/Behandlung/Zeit + Ton im Admin ohne Reload |
| T05 | 11 | Deep-Link | Toast-Klick → #/anfragen?id=… , Anfrage hervorgehoben, Dialog offen |
| T06 | 3 | Odontogramm | 32 Zähne klickbar; Befund speichern → teal; frühere Befunde grau |
| T07 | 3 | Risiko-Tags | Selma: ⚠️ Angstpatient rot + Notiz-Warnung; Neukunde/Senior automatisch |
| T08 | 4 | GOZ-Vorschlag | Check „Füllung" → Vorschlag „+ GOZ 2080" → Klick übernimmt in Warenkorb |
| T09 | 4 | Pipeline | „Behandlung abschließen" → violette Sektion „Bereit für Abrechnung" |
| T10 | 5 | HKP-Warnung | Werner + Krone (genehmigter Plan): keine Warnung; Implantat: Warnung |
| T11 | 5 | HKP-Status | Kette Erstellt→Eingereicht→Genehmigt(gültig bis)→Abgelehnt sichtbar |
| T12 | 6 | SEO | Title mit „Zahnarzt Augsburg", genau 1 h1, JSON-LD Dentist, Bilder WebP |
| T13 | 7 | 24h-Gebühr | Absage < 24h → Rückfrage → §615-Posten 50 €, Status prüfen, abgesagtAm |
| T14 | 7 | Blacklist | Grimm mit 2× kurzfristig gelistet; Sperren → GESPERRT-Badge |
| T15 | 7 | Sperr-Block | Anfrage des gesperrten Patienten → rote Warnung, Bestätigen deaktiviert |
| T16 | 7 | Dashboard | Chart 8 Wochen grün/gelb/rot + Tooltip; KPIs Ausfallquote/Gebühren |
| T17 | 8 | Feedback gültig | Link mit Token → Sterne+Tags+Text → gespeichert, Danke-Seite |
| T18 | 8 | Feedback-Schutz | Anlegen mit falschem Token → 403 (Firestore Rules) |
| T19 | 8 | Alarm | 1–2★ neu → roter Nav-Badge + „AKTION ERFORDERLICH" zuerst |
| T20 | 10 | Einstellungen | Werte ändern + speichern → nach Reload persistent (settings/global) |
| T21 | 9 | Wiedererkennung | Werner-Anfrage → „Vorhandener Patient" automatisch zugeordnet |
| T22 | – | Editor | Tippen sofort sichtbar (Puffer), „Groß bearbeiten" + Speichern & zurück |
| T23 | – | Absage-Link (GAS) | Mail-Knopf → Termin abgesagt, Slot frei, „Bereits abgesagt" bei 2. Klick |
