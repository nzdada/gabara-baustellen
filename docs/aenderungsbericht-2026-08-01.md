# Änderungsbericht V1.1 – Gabara Baustellen

> Stand 01.08.2026 · Grundlage: Anforderungsliste des Auftraggebers (9 Punkte)
> + anschließendes Produktions-Review. Build beider Apps grün, im Browser verifiziert.

---

## Teil 1 – Kritische Bugfixes

### 1.1 App-Absturz beim Öffnen von Berichten (gemeldet)

**Symptom:** Klick auf eine Berichtskarte in der Projekt-Detailansicht riss die Seite ab
(weißer Bildschirm), besonders auffällig bei Entwürfen.

**Ursache:** `admin/src/pages/ProjektDetail.jsx` war als `function ProjektDetail()` ohne
Parameter deklariert, verwendete beim Rendern des Detail-Modals aber die Variable `user`.
`App.jsx` übergab die Prop zwar, die Komponente nahm sie nie entgegen → `ReferenceError:
user is not defined`. Betroffen war **jede** Berichtskarte, nicht nur Entwürfe.

**Behebung:** Prop entgegengenommen. Zusätzlich öffnen Entwürfe jetzt direkt den Editor,
eingereichte/freigegebene Berichte die Detailansicht; PDF-Druck ist an beiden Stellen erreichbar.

### 1.2 Go-Live-Blocker: fehlende Firestore-Regel für `slots`

**Symptom (wäre erst online aufgetreten):** Jedes Anlegen, Ändern, Kopieren oder Absagen
eines Termins hätte im Firebase-Modus mit `PERMISSION_DENIED` geendet – der Termin wäre
angelegt worden, die Oberfläche hätte aber „Termin konnte nicht angelegt werden" gemeldet.

**Ursache:** Sechs Stellen schreiben Belegtzeiten in die Collection `slots`. In
`firestore.rules` gab es dafür keine Regel, die Catch-all-Regel verbietet alles Übrige.

**Behebung:** Regel für `slots` ergänzt (öffentlich lesbar – enthält nur Datum/Uhrzeit,
keine Kundendaten; Schreiben nur angemeldet). Zusätzlich sind Slot-Schreibvorgänge in
`shared/store.js` jetzt **nicht mehr fatal**: Sie sind eine Nebensache und dürfen die
eigentliche Terminanlage nie scheitern lassen.

### 1.3 Rechte-Eskalation und lesbarer API-Key

**Befund:** Die Regeln erlaubten jedem angemeldeten Nutzer Schreibzugriff auf `users` –
ein Monteur hätte sich selbst die Rolle `admin` geben können. `settings/integrationen`
mit dem **FastBill-API-Key** war ebenfalls für jeden Angemeldeten lesbar.

**Behebung:** Rollenprüfung in den Regeln ergänzt (`istBuero()`). `users` ist für alle
lesbar, aber nur vom Büro schreibbar; `settings/integrationen` nur vom Büro lesbar.
Damit der Betrieb nicht bricht, bevor die Voraussetzung erfüllt ist, greift ein
dokumentierter Übergangsmodus.

> **Voraussetzung für die Wirksamkeit:** Das `users`-Dokument eines Mitarbeiters muss als
> Dokument-ID die Firebase-Auth-UID tragen. `shared/auth.js` sucht das Profil jetzt zuerst
> über die UID und fällt auf die E-Mail zurück. Punkt 3 der Go-Live-Checkliste.

### 1.4 Zeitzonen-Fehler beim Tagesdatum

**Befund:** An sieben Stellen wurde „heute" über `new Date().toISOString().slice(0,10)`
gebildet. Das ist **UTC** – in Deutschland liefert es zwischen 00:00 und 02:00 Uhr
(Sommerzeit) das Datum des Vortages. Betroffen: Berichtsdatum, Spesendatum, Ist-Mengen-
Zeitstempel, Leistungszeitraum der Rechnung, „Termine heute", Demo-Seed.

**Behebung:** Durchgängig auf `heuteISO()` aus `shared/slots.js` umgestellt (lokale
Datumskomponenten). Als Projektregel in der Skill festgehalten.

### 1.5 Weitere behobene Fehler

| Fund | Wirkung | Datei |
|---|---|---|
| Toast-Fehlalarm | Rückkehr aus der Monteur-Ansicht meldete alte Berichte als „neu" inkl. Signalton – die Live-Abos starten leer, danach galt alles als frisch | `App.jsx` |
| Abgesagter Termin blockierte weiter | Beim Absagen wurde der Slot als *belegt* geschrieben statt gelöscht | `TerminModal.jsx` |
| Foto-Vollabo | Die Berichte-Seite abonnierte dauerhaft **alle** Fotos (je bis ~1 MB), nur um beim Druck die passenden zu filtern | `Berichte.jsx`, `store.js` |
| Foto-Vollabo im Termin | Alle Fotos statt nur die des Termins | `TerminBilder.jsx` |
| LV-Import quadratisch | Jede Zeile ein eigener Schreibvorgang; im Lokal-Modus wurde dabei je Zeile die komplette Datenbank serialisiert | `LvImport.jsx`, `store.js` |
| Blockierte Pop-ups | `window.open` ohne Prüfung → PDF-Druck stürzte kommentarlos ab | `drucken.js` |
| React-State mutiert | `berichte.sort()` sortierte das State-Array direkt | `MonteurBaustelle.jsx` |
| Rechnung ohne Kunde | `syncKunde(undefined)` beim FastBill-Transfer | `RechnungWizard.jsx` |
| Anfrage ohne Namen | `anfrage.name.trim()` ohne Absicherung | `Anfragen.jsx` |
| Zahlen als Text | Zahlungsziel/Sicherheitseinbehalt landeten als String in den Einstellungen | `Einstellungen.jsx` |
| Anfrage-Regel zu streng | `nachricht.size()` ohne Existenzprüfung hätte eine Anfrage ohne Nachricht abgelehnt | `firestore.rules` |
| Toter Link „+ Neu" | `?neu=1` wurde nicht ausgewertet | `Projekte.jsx` |

---

## Teil 2 – Umgesetzte Anforderungen

### 1 · Kalender als Startseite, Baustellen statt Terminanfragen
Der Kalender liegt auf `/`, die Kachel-Übersicht auf `/uebersicht`. Unter dem Kalender
steht jetzt ein **Baustellen-Panel**: je Projekt Status, Kunde, Anschrift, nächster Einsatz,
Anzahl offener Einsätze, Berichte zur Freigabe und ein Fortschrittsbalken (Ist/Soll aus dem LV).
Direkt-Aktionen je Zeile: **Aufgabe** (öffnet den Termin-Dialog mit vorbelegter Baustelle,
Kunde und Titel), **Bericht**, **Abrechnung**, **LV** – die drei letzten springen über
`?bereich=…` direkt in den passenden Projektbereich.

### 2 · Team-Legende, Team-Farben, Überlappung
Über dem Kalender liegt eine Legende aller Teams mit Farbe und Mitgliederzahl; ein Klick
filtert den Kalender auf ein Team. Terminkarten tragen die Team-Farbe (Schriftfarbe wird
automatisch nach Helligkeit gewählt), oben klein den ausgeschriebenen Team-Namen, darunter
groß und fett den Monteur.

Überlappende Termine werden **nebeneinander** gerendert: Termine eines Tages werden in
Cluster zusammenhängender Überschneidungen zerlegt, je Cluster werden Spalten vergeben
(`spaltenLayout` in `Kalender.jsx`). Verifiziert: zwei gleichzeitige Termine belegen je 50 %.

> Teams gab es in der App noch nicht. Mitarbeiter haben dafür ein neues Feld `team`;
> ohne Eintrag fällt die Farbe auf den Mitarbeiter zurück – Bestandsdaten funktionieren weiter.

### 3 · LIVE-Badge entfernt
Das Badge mit dem pulsierenden Punkt in „Bilder & Scans" ist raus.

### 4 · Termin-Dialog neu
- **Keine Zeitfenster-Prüfung mehr.** Die Abschnitte „Freie Uhrzeiten" und „Dauer" sind
  entfallen, ebenso die Blockade beim Anlegen. Überschneidungen sind ausdrücklich erlaubt.
- **Von/Bis** als native Zeitfelder (5-Minuten-Schritte) plus Dauer-Schnellwahl
  (1/2/4/8/10 Std.); die errechnete Dauer wird angezeigt.
- **Datum** über natives Datumsfeld, Schnellwahl (Heute/Morgen/+7 Tage) und einen
  aufklappbaren **Monatskalender** mit Punkten an belegten Tagen.
- **Kundenauswahl** als Suchfeld mit sofort sichtbarer Liste (Firma, Name, Telefon, Ort).
- **Aufgaben:** Bei gewählter Baustelle erscheinen deren LV-Positionen zum Ankreuzen; die
  Auswahl wird am Termin gespeichert (`positionsIds`) und landet im Arbeitsauftrag-PDF.
- **Neues Projekt** direkt im Dialog anlegbar (alle Projektdaten, Farbpalette), danach
  automatisch übernommen.

### 5 · Status-Pipeline, Tabelle, Farbauswahl
Fünf feste Stufen: **Offen → Beauftragt → In Arbeit → Abrechnung → Abgeschlossen**.
Alt-Stati früherer Versionen werden gemappt, Bestandsprojekte behalten also einen
sinnvollen Status. In der Projekt-Tabelle ist der Status per Dropdown direkt änderbar;
je Zeile gibt es einen Löschen-Button mit Sicherheitsabfrage, die **auflistet, welche
Daten mitgelöscht werden** (LV, Berichte, Fotos, Termine, Spesen, Rechnungen) und eine
Tipp-Bestätigung verlangt. Der RGB-Picker ist durch eine Palette aus 12 Farbkacheln ersetzt.

### 6 · Kritische Bugfixes
Siehe 1.1. Die Namensauswahl im Regiebericht ist von einer überlagernden Vorschlagsliste
auf ein **natives Select** umgestellt – auf dem Handy öffnet der System-Auswahldialog,
nichts verdeckt mehr das Feld.

### 7 · Monteur-Ansicht, Zeitkopplung, Stundensatz
- **Kalender-Ansicht** im Tab „Heute" (Umschalter Liste/Kalender): Monatsraster mit Punkten
  an Einsatztagen, darunter die Einsätze des gewählten Tages. Einsatzkarten tragen die
  Team-Farbe als Balken.
- **Von/Bis/Std. bidirektional gekoppelt.** Verifiziert: *Bis* 12:30 → *Std.* 5,5;
  *Std.* 8,25 → *Bis* 15:15.
- **Kein Satz-Dropdown mehr.** Der Stundensatz ergibt sich aus der Qualifikation des
  Mitarbeiters (neues Stammdatenfeld, Facharbeiter/Helfer) und den Sätzen aus den
  Einstellungen. Angezeigt wird eine Klartextzeile
  („Helfer/Azubi · 31,00 €/Std. = 279,00 €"). Für Fremdnamen bleibt eine
  Qualifikations-Auswahl, sonst wäre der Satz nicht bestimmbar.

### 8 · LV-Import überarbeitet
Das Parsing liegt jetzt getrennt und dokumentiert in `admin/src/lvparser.js`:

| Vorher | Jetzt |
|---|---|
| Mengenzeile „2.582,421 m²" wurde als Position mit OZ „2.582" gelesen | OZ nur am Zeilenanfang mit folgendem Text; Zahlenzeilen gehören zur laufenden Position |
| Einheitspreis wurde gar nicht erkannt | Menge, Einheit, EP und Gesamtpreis aus der Preiszeile; EP wird notfalls aus GP ÷ Menge abgeleitet |
| 6 Einheiten bekannt | ~40 Einheiten inkl. Normalisierung (m2→m², Stk→Stck., h→Std.) |
| Titel-Erkennung riet | Titel = Eintrag ohne Menge, unter dem weitere OZ hängen |
| Nur `(Bedarfspos` und `NEP` | zusätzlich Alternativ-/Eventualposition, Nachtragsposition |
| CSV importierte blind | CSV geht durch dieselbe editierbare Vorschau wie der PDF-Weg |
| Je Zeile ein Schreibvorgang | Ein einziger Schreibvorgang, optional mit Ersetzen der alten Positionen |

Neu außerdem: Spalte „Typ" im CSV-Mapping, Hinweis auf Positionen ohne Menge/Preis,
laufende LV-Summe der Vorschau.

Geprüft an einem echten LV-Ausschnitt (S36, GAEB-Stil mit `..`-Notation): 11 Einträge,
Titel und Positionen korrekt getrennt, Mengen/Einheiten/EP vollständig, Bedarf/NEP markiert.

### 9 · PDF-Export neu aufgebaut
`admin/src/drucken.js` wurde vollständig neu geschrieben – A4, Druck-CSS mit
Seitenumbruch-Schutz, Reihenfolge exakt nach Vorgabe:

1. **Kopf:** Gabara-Logo (Inline-SVG), Firmendaten, Dokumentart, `Nr. RB-2026-001`, Erstellungszeitpunkt
2. **Zwei Spalten:** Auftraggeber (Adresse, Ansprechpartner, Telefon, E-Mail) | Projekt
   (Nummer, Baustellenadresse, Berichtsdatum, Monteur, Gewerk)
3. **Rechtlicher Hinweis** § 15 Abs. 3 VOB/B zur Anordnung der Stundenlohnarbeiten
4. **Ausgeführte Arbeiten** als abgesetztes Textfeld
5. **Tabellen** Arbeitszeiten (`Name | Datum | Qualifikation | Von–Bis | Std. | Satz | Betrag`)
   und Material (`Material | Menge | Einheit | EP | Betrag`), je mit hervorgehobener
   Netto-Summe, darunter die Gesamtsumme netto
6. **Fotos getrennt:** Vorher-Bilder und Nachher-Bilder als eigene Grids mit
   Zeitstempel und Erfasser je Bild
7. **Fuß:** VOB/B-Einwendungsfrist (6 Werktage), zwei Unterschriftenfelder nebeneinander
   (Kunde/Auftraggeber vs. Monteur/Auftragnehmer) mit Klartext-Namen, Funktion/Firma und Datum

Gilt für Regiebericht, Reklamation, Abnahmeprotokoll, **Arbeitsauftrag** (neu, aus dem
Termin-Dialog druckbar, mit Aufgabenliste und Abhak-Spalte).
Gedruckt wird erst, wenn alle Bilder geladen sind.

### 10 · Rechnungs-Eigendruck entfernt (Nachtrag Auftraggeber)
Der Button „Eigendruck" in der Abrechnung ist entfallen. Das Rechnungs-PDF entsteht
ausschließlich in FastBill und wird über `rechnung.dokumentUrl` verlinkt. Ist noch kein
Dokument vorhanden, steht dort der Hinweis „PDF folgt aus FastBill" (erst übertragen,
abschließen, Status abgleichen). Die Vorlage `druckeRechnung` wurde aus `drucken.js`
gelöscht, damit kein toter Code zurückbleibt; die nur dafür gedachten Felder
**Bank/IBAN** in den Einstellungen sind ebenfalls entfernt – Zahlungsangaben stehen in FastBill.

---

## Teil 3 – Offene Punkte vor der Inbetriebnahme

| Priorität | Punkt | Warum |
|---|---|---|
| **Pflicht** | Impressum vervollständigen (`website/src/pages/Recht.jsx`) | Geschäftsführer, Handelsregister/HRB und USt-IdNr. stehen als Platzhalter drin – für eine GmbH gesetzlich vorgeschrieben (§ 5 TMG). Die Angaben kenne ich nicht. |
| **Pflicht** | `firestore.rules` deployen | Ohne die neue `slots`-Regel scheitert jede Terminanlage online. |
| **Pflicht** | users-Dokument-ID = Auth-UID | Erst dann greifen Rollenschutz und Schutz des FastBill-Keys. |
| Hoch | Berichtsnummern per `runTransaction` | Sonst im Mehrbenutzerbetrieb Doppelnummern möglich (Beweiswert!). |
| Mittel | Verwaiste Bericht-Entwürfe aufräumen | Ein Foto legt sofort einen Entwurf an; Abbruch hinterlässt eine Leiche. |
| Niedrig | Vollabos auf `useWhere`/`listWhere` umstellen | `projekte`, `patients`, `users` werden komplett abonniert – bei wachsendem Bestand Kosten/Ladezeit. |

---

## Geänderte Dateien

**Neu:** `shared/teams.js` · `admin/src/lvparser.js` · `admin/src/components/DatumWahl.jsx` ·
`.claude/skills/gabara/SKILL.md` · dieser Bericht

**Geändert:** `firestore.rules` · `shared/store.js` · `shared/auth.js` ·
`shared/projektstatus.js` · `shared/demoData.js` · `admin/src/App.jsx` · `admin/src/drucken.js` ·
`admin/src/pages/` (Kalender, Projekte, ProjektDetail, Berichte, Einstellungen, Uebersicht,
Dashboard, Anfragen, monteur/MonteurApp, monteur/MonteurBaustelle) ·
`admin/src/components/` (NeuerTermin, BerichtForm, LvImport, TerminModal, TerminBilder,
RechnungWizard, SpesenForm, Modal) · `docs/projekt-dokumentation.md`

Rund 2 200 hinzugefügte, 960 entfernte Zeilen. Build beider Apps fehlerfrei, keine
Konsolenfehler im Betrieb.
