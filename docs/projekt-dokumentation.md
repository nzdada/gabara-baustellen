# Gabara Baustellen – Gesamtdokumentation

> Stand: 01.08.2026 · V1.1 (Lokal-Modus, FastBill echt angebunden)
> Firma: Gabara Service GmbH, Münchener Str. 21, 86551 Aichach · Maler & Lackierer
> FastBill-Konto (Test): nasirdada.98@gmail.com · Firebase (V2): dasselbe Konto

## 1. Bausteine

1. **Webseite** (`website/`, Port 5410): öffentliche Firmenseite (Inhalte von
   gabara-service.de) + Anfrageformular `/#/anfrage` → Collection `requests`
   → Toast/Badge im Admin.
2. **Verwaltung** (`admin/`, Port 5420, Login): **Kalender = Startseite** · Projekte
   (5-stufige Status-Pipeline) · Termine · Kunden (FastBill-Spiegel) · Berichte ·
   Abrechnung (FastBill) · Übersicht · Dashboard (Gewinn je Baustelle) · Import (CSV) ·
   Einstellungen (Stammdaten inkl. Teams und Qualifikationen).
3. **V2: Flutter-App `gabara_field`** (Fork von `C:\Users\dadah\mam_solar`) für Monteure –
   offline-first, Pflichtfotos, Unterschrift; sendet DATEN (keine PDFs) in dieselben Collections.

## 2. Datenmodell (Firestore/Lokal – `shared/store.js`)

| Collection | Inhalt | Besonderheit |
|---|---|---|
| `patients` | Kunden-Spiegel (UI "Kunden") | FastBill führend, `fastbillCustomerId` |
| `projekte` | Baustellen | Status-Pipeline `shared/projektstatus.js`, `nummer` P-JJJJ-NNN |
| `lvpositionen` | EIN Doc je LV-Position | `oz`-Hierarchie, `menge/istMenge/abgerechnetMenge`, Flags bedarf/nep |
| `appointments` | Termine/Einsätze (UI "Termine") | `projektId`, `kategorie`, `mitarbeiterIds[]`, `erledigt` |
| `berichte` | Regie/Reklamation/Abnahme | Status entwurf→eingereicht→freigegeben→abgerechnet; Unterschrift als Daten-URL |
| `photos` | Fotos als Daten-URL (<1 MB) | `phase` vorher/nachher/beleg, Bezug `berichtId`/`projektId` |
| `spesen` | Hotel/Fahrt/Sonstig | Km-Rechner (OSRM), Status eingereicht→erstattet |
| `rechnungen` | Spiegel der FastBill-Rechnung | `fastbillInvoiceId/-Nummer`, `dokumentUrl`, Status vorbereitet→uebertragen→gestellt→bezahlt |
| `katalog` | Artikel-Spiegel | FastBill führend, `fastbillArticleId` |
| `users` | Mitarbeiter/Logins | `rolle` admin/mitarbeiter · `team` (Farbcodierung Kalender, `shared/teams.js`) · `farbe` · `qualifikation` facharbeiter/helfer (bestimmt den Regie-Stundensatz) |
| `bausteine` | Textbausteine (§13b usw.) | fließen in Rechnungs-Introtext/Druck |
| `apilog` | FastBill-Aufruf-Protokoll | sichtbar in Einstellungen → FastBill |
| `requests` | Webseiten-Anfragen | anonym nur create (firestore.rules) |
| `settings` | global/pausen/oeffnungszeiten/nummernkreis/integrationen | integrationen = FastBill-Zugang |

## 3. Kern-Prozesse

**Startseite der Verwaltung ist der Kalender (`/`).** Darunter das Baustellen-Panel mit
Fortschritt je Projekt und den Direkt-Aktionen *Aufgabe · Bericht · Abrechnung · LV*
(springt per `?bereich=…` direkt in den passenden Projektbereich). Die klassische
Kachel-Übersicht liegt unter `/uebersicht`.

**A Anfrage → Projekt:** Webseite `/#/anfrage` → requests → Admin (Anfragen) → Kunde
anlegen → Projekt anlegen. **Status-Pipeline: 5 Stufen** (`shared/projektstatus.js`)
Offen → Beauftragt → In Arbeit → Abrechnung → Abgeschlossen. Alt-Stati früherer Versionen
werden über `ALT_ZUORDNUNG` gemappt. Status ist direkt aus der Projekt-Tabelle änderbar,
Löschen dort ebenfalls (mit Anzeige aller mitgelöschten Datensätze + Tipp-Bestätigung).
*Hinweis Lokal-Modus:* Webseite (Port 5410) und Verwaltung (5420) haben getrennte
Browser-Speicher – die Webseiten-Anfrage erscheint erst im Firebase-Modus (V2) live im
Admin. Der Admin-Demo-Seed enthält eine Beispiel-Anfrage, um den Posteingang zu zeigen.

**B LV:** Projekt → Leistungsverzeichnis → "LV importieren" (CSV mit Mapping ODER
Text aus dem LV-PDF einfügen). Parsing in `admin/src/lvparser.js`: OZ nur am Zeilenanfang
mit folgendem Text (Mengenzeilen wie „2.582,421 m²" werden NICHT als OZ gelesen),
Menge/ME/EP auch aus der Preiszeile darunter, Bedarf/NEP-Flags, Titel-Erkennung über die
OZ-Hierarchie. Beide Wege enden in derselben editierbaren Vorschau; Übernahme in EINEM
Schreibvorgang (`store.addMany`), optional mit Ersetzen der vorhandenen Positionen.

**C Ausführung:** Kalender (Wochenraster) mit **Team-Legende** darüber; Terminkarten
tragen die Team-Farbe, den ausgeschriebenen Team-Namen und groß den Monteur.
Überlappende Termine werden nebeneinander gerendert (Spalten-Layout in `Kalender.jsx`).
Der Termin-Dialog kennt **keine Zeitfenster-Prüfung** – Von/Bis frei wählbar, Datepicker,
Kundensuche, LV-Aufgaben zum Ankreuzen (`positionsIds`), Projekt-Neuanlage im Dialog.
Ist-Mengen je Position im LV-Editor (V2: durch Monteure per Flutter-App).

**D Berichte:** Berichte → +Regiebericht/+Reklamation/+Abnahme: Pflichtfoto-Gate
(≥1 Vorher + ≥1 Nachher), Abnahme nur mit Kundenunterschrift + Name. Einreichen →
Büro prüft → Freigeben → PDF-Druck (`drucken.js`). Im Projekt öffnen Entwürfe direkt
den Editor, eingereichte/freigegebene die Detailansicht.
*Stundenlohnzettel:* Name = natives Select aus dem Mitarbeiterstamm (mobiltauglich, kein
Overlay), Von/Bis/Std. sind bidirektional gekoppelt, der **Stundensatz kommt aus der
Qualifikation** des Mitarbeiters (kein Satz-Dropdown mehr).

**PDF-Layout** (`drucken.js`, gilt für Regiebericht/Reklamation, Abnahme, Arbeitsauftrag): Kopf mit Logo + Firmendaten + Dokumentnummer + Erstellungszeitpunkt ·
2-Spalten-Block Auftraggeber | Projekt/Baustelle · §-15-Abs.-3-VOB/B-Hinweis ·
Textfeld „Ausgeführte Arbeiten" · Tabellen Arbeitszeiten und Material mit hervorgehobener
Netto-Summe · getrennte Foto-Sektionen Vorher/Nachher (Grid + Zeitstempel/Erfasser) ·
VOB/B-Einwendungsfrist · zwei Unterschriftenfelder nebeneinander mit Klarnamen und Datum.
Gedruckt wird erst, wenn alle Bilder geladen sind; blockierte Pop-ups melden sich.

**E Abrechnung (FastBill):** Abrechnung → "+ Rechnung erstellen": LV-Restmengen
(ist − abgerechnet) + freigegebene Regieberichte + Spesen → Vorschau (§13b netto oder
19 % USt je Kunde, Sicherheitseinbehalt) → "an FastBill übertragen" (Kunde wird bei
Bedarf per customer.create angelegt) → in FastBill: Abschließen (Nummer), Versand,
E-Rechnung, Mahnwesen. Buttons: Status abgleichen / PDF (FastBill).
**Es gibt bewusst KEINEN Rechnungs-Eigendruck** – das Rechnungs-PDF kommt ausschliesslich
aus FastBill und wird ueber `rechnung.dokumentUrl` verlinkt (Entscheidung des Auftraggebers).

**F Dashboard:** je Baustelle LV-Auftragswert, Geleistet (Ist), Abgerechnet, Regie-Erlös,
− Material (EK), − Lohn intern (erledigte Einsätze × Stundensätze), − Spesen = **Ergebnis**.

## 4. FastBill-Integration (`shared/fastbill.js`)

- Auth: HTTP Basic (Konto-E-Mail + API-Key). Quelle: settings/integrationen ODER
  `admin/.env.local` (gitignored). Rate-Limit Solo: ~50 Calls/h → Sync nur auf Knopfdruck.
- CORS: Dev = Vite-Proxy `/fastbill-api` → my.fastbill.com; Produktion = GAS-Proxy
  (`seed/gabara-fastbill-proxy.gs`, Zugang als `?auth=`-Parameter, da GAS keine
  Authorization-Header durchreicht).
- Services: customer.get/create/update · article.get/create/update ·
  invoice.create/complete/sendbyemail/get. Jeder Aufruf loggt nach `apilog`
  (ok/fehler/simuliert). Ohne Zugang: alles "simuliert".
- **Echt getestet am 31.07.2026:** Verbindungstest ok; Testrechnung
  "Abschlagsrechnung IGA" (3.210 € netto, §13b, 10 % Einbehalt → 2.889 €) liegt als
  Entwurf im FastBill-Konto inkl. DOCUMENT_URL.

## 5. V2-Checkliste (nach V1-Freigabe)

1. Firebase-Projekt (nasirdada.98@gmail.com, Spark, europe-west3): Firestore + Auth
   (E-Mail/Passwort) + 2 Hosting-Sites (`gabara-baustellen`, `gabara-baustellen-admin`).
2. `shared/firebase-config.js` füllen, `enabled: true`; `firestore.rules` deployen
   (`npx --yes firebase-tools deploy --only hosting,firestore:rules --project <id>`).
3. users anlegen (Logins je Mitarbeiter), Rollen-Feinschnitt der Rules.
4. GAS-FastBill-Proxy bereitstellen, Proxy-URL in Einstellungen.
5. Google-Kalender optional: Client-ID in `firebase-config.js` (GOOGLE_KALENDER),
   Code liegt in `shared/googleCalendar.js` (Feld `googleEventId` existiert).
6. Flutter `gabara_field`: mam_solar forken, Maler-Protokolle
   (regiebericht/abnahme/reklamation/spesen), PDF+Drive raus, firebase_auth +
   cloud_firestore, Screens "Meine Einsätze" + "Arbeitsauftrag/LV", APK an Monteure.

## 6. Wichtige Regeln

- Fotos/Unterschriften als komprimierte Daten-URLs (<1 MB/Dokument, kein Storage → Spark reicht).
- Debounce 600 ms + blur-Flush bei allen Live-Feldern (LV-Inline-Edit).
- `subscribeWhere` statt Vollabo für photos/lvpositionen.
- API-Key NIE ins Repo; `.env.local` ist gitignored.
- UI nur Deutsch; Icons als SVG (keine Emojis).
