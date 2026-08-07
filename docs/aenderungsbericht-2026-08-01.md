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

### 11 · Impressum vervollständigt
Angaben von gabara-service.de übernommen: Geschäftsführer **Salman Haj Hussein**,
USt-IdNr. **DE351189636**, Steuernummer **10312700595**, zweite E-Mail, Hinweis zur
Verbraucherstreitbeilegung. **Handelsregister und HRB-Nummer fehlen weiterhin** – sie
stehen auch auf der Live-Seite nicht. Für eine GmbH sind sie nach § 5 Abs. 1 Nr. 4 DDG
Pflicht. Sobald sie vorliegen, genügt ein Eintrag in `REGISTER` in `website/src/pages/Recht.jsx`;
der Block erscheint dann automatisch.

### 12 · Berichtsnummern sind jetzt fälschungssicher fortlaufend
Der Zähler wird über `store.naechsteNummer()` gezogen – im Firebase-Modus in einer
**Transaktion** (`runTransaction`), die Firestore bei Konflikt automatisch wiederholt.
Zwei gleichzeitig einreichende Monteure bekommen damit garantiert verschiedene Nummern;
vorher waren Doppelnummern möglich, was beim Stundennachweis nach § 15 Abs. 3 VOB/B den
Beweiswert kostet.

### 13 · Rechnungsstellung war irreführend
Der Assistent zeigte in Schritt 2 nur Positionen, zu denen ein Monteur bereits eine
Ist-Menge gemeldet hatte. Ohne Meldung stand das Büro vor einer leeren Liste, obwohl es
abrechnen durfte. Jetzt:
- **Alle noch offenen LV-Positionen** stehen zur Auswahl, mit drei Spalten: *Monteur*
  (gemeldet, noch nicht fakturiert), *Rest lt. LV* (vertraglich offen) und *Abrechnen*.
- Vorbelegt ist die Monteur-Meldung; ohne Meldung steht 0 und das Büro trägt selbst ein.
- Schaltfläche „Alles offene übernehmen (Soll)".
- Liegt die eingetragene Menge über der Meldung, wird die Zeile **gelb** markiert.
- Der Weiter-Knopf blockiert nicht mehr bei leerer Auswahl – im nächsten Schritt lassen
  sich freie Positionen ergänzen, eine Rechnung ist also immer möglich.

### 14 · Dashboard mit Diagrammen
Vier Diagramme plus eine Leitzahl, aufgebaut nach der Datenvisualisierungs-Methodik
(Form vor Farbe, Legende ab zwei Serien, Flächenabstand statt Rahmen, Tabellen-Ansicht
als barrierefreies Gegenstück). Die Farben sind mit dem Prüfskript gegen die weiße
Kartenfläche validiert – kategorial vier Slots und eine ordinale Markenrampe, alle
Prüfungen bestanden.

| Diagramm | Form | Aussage |
|---|---|---|
| Ergebnis über alle Baustellen | Leitzahl | Gewinn und Marge auf einen Blick |
| Fortschritt je Baustelle | gestapelter Balken, ordinale Rampe | abgerechnet / geleistet / noch offen, plus Regie-Zusatz |
| Ergebnis je Baustelle | divergierender Balken | Gewinn rechts, Verlust links der Nulllinie |
| Wohin geht der Umsatz | Teil-zum-Ganzen | Lohn, Material, Spesen, Ergebnis |
| Einsatzstunden je Team | Balken, eine Serie | Auslastung der letzten 30 Tage |
| **Abgerechnet nach Quelle** | Teil-zum-Ganzen, gesamt + je Baustelle | **macht sichtbar, wie viel Umsatz aus Regieberichten stammt** |

### 15 · Reste der Zahnarzt-Vorlage entfernt
Die App stammt aus einer Zahnarzt-Vorlage; an mehreren Stellen war das noch sichtbar:
- **Anfragen:** „Patient", „Praxis ist im Urlaub", „Ablehnen & Patient informieren" →
  durchgehend Kunden-/Betriebs-Sprache. Die Felder *Geburtsdatum* und *Versicherung*
  sind jetzt *Firma*, *Straße* und *PLZ/Ort* – also das, was für eine Rechnung zählt.
- **Import:** importierte „Patienten" mit Krankenkasse → jetzt Kunden mit Firma und
  Anschrift, inklusive automatischer USt-Vorgabe (Firma → §13b, privat → 19 %).
- **Gelöscht** (nirgends mehr eingebunden): `LeistungenListe.jsx` (GOZ-Ziffern,
  Zahnreinigung, Heil- und Kostenplan), `SummaryEditor.jsx`, `absage.js`
  (Ausfallhonorar § 615 BGB) sowie die Helfer `patientTags`/`alter`/`fmtGeburtstag`
  und die Einstellungs-Altlasten `katalogModus: 'GOZ'` und `ausfallGebuehr`.

Dabei fielen zwei echte Fehler auf:
1. **„Invalid Date, Uhr"** im Absage-Dialog – Gabara-Anfragen haben nie einen
   Wunschtermin, das Datum wurde trotzdem formatiert. Jetzt wird es nur angezeigt,
   wenn es existiert; stattdessen steht der Eingangszeitpunkt da.
2. **Bestätigen einer Anfrage brach ab**: `termin.stornoToken` wurde außerhalb seines
   Blocks gelesen – und genau dieser Block läuft bei Gabara-Anfragen nie. Der Kunde
   wurde angelegt, die Oberfläche meldete trotzdem einen Fehler.

### 16 · Info-Zeichen an komplexen Feldern
Neue Komponente `admin/src/components/InfoHinweis.jsx`: kleines Fragezeichen-Symbol neben
der Beschriftung, das bei Mauszeiger, Antippen oder Tastaturfokus eine Erklärung von ein
bis zwei Sätzen zeigt – **wohin der Wert fließt und was für die Abrechnung zählt**.
Die Texte liegen zentral in `admin/src/hinweise.js`.

Bewusst **nur in der Büro-Verwaltung**, nicht in der Monteur-Handy-Ansicht. Für
Komponenten, die in beiden Welten laufen, gibt es die Option `nurDesktop`.

Ausgestattet: LV-Editor (Menge, EP, Ist, %), LV-Import (EP-Zuordnung, Typ-Spalte,
Ersetzen-Haken), Rechnungs-Assistent (Monteur, Rest lt. LV, Abrechnen, Titel,
Leistungszeitraum, Sicherheitseinbehalt, freie Position), Projekte (Nummer, Gewerk,
Ende-Datum, Volumen), Termin-Dialog (Kategorie, Aufgaben, Mitarbeiter), Einstellungen
(Anschrift, USt-Standard, Zahlungsziel, Team, Qualifikation, interner Satz, Regie-Sätze,
km-Satz, EK-Preis).

### 17 · Eingabefelder aus dem Feld-Audit
Ein Prüfdurchlauf über alle Formulare ergab 25 Punkte; umgesetzt sind die
abrechnungskritischen:

| Fund | Behebung |
|---|---|
| Neukunde aus Anfrage ohne `typ`/`ustModus` → Privatkunde hätte Rechnung ohne 19 % USt bekommen | Vorgaben werden mitgeschrieben (Firma → §13b, privat → 19 %) |
| Ist-Menge auf dem Handy ohne Obergrenze – ein Tippfehler (250 statt 25) hebt die abrechenbare Menge | Warnung „Mehr als beauftragt (x m²) – bitte prüfen", Feld wird gelb |
| Vorbelegte 0 im Ist-Feld musste erst gelöscht werden → Werte wie „025" | Inhalt wird beim Antippen markiert |
| Büro ändert die Ist-Menge, die Zeile behauptet weiter „gemeldet von Monteur X" | Herkunft wird auf „Büro" mit heutigem Datum gesetzt |
| Deutsche Kommazahlen („2.582,421") wurden im LV-Editor stumm zu 0 | `parseZahl` statt `Number` |
| „Vorhandene LV-Positionen löschen" ohne Warnung – Abrechnungsstand wäre weg | Rote Warnung mit Anzahl der bereits abgerechneten Positionen |
| Ende-Datum vor Start-Datum möglich → falsche Überfällig-Markierung | `min` am Feld und Prüfung beim Speichern |
| Projektnummer doppelt vergebbar | Prüfung beim Speichern |
| Einsatz ohne Mitarbeiter wurde still angelegt und tauchte bei niemandem auf | Rückfrage vor dem Anlegen |
| Feld „Monteur" im Bericht wirkte wie „wer hat gearbeitet" | Umbenannt in „Bericht erstellt von" mit Hinweis auf die Arbeitszeit-Sektion |

---

## Teil 3 – Offene Punkte vor der Inbetriebnahme

| Priorität | Punkt | Warum |
|---|---|---|
| **Pflicht** | **Handelsregister + HRB-Nummer** ins Impressum (`REGISTER` in `website/src/pages/Recht.jsx`) | Geschäftsführer, USt-IdNr. und Steuernummer sind eingetragen; die Registerangaben fehlen auch auf gabara-service.de. Für eine GmbH nach § 5 Abs. 1 Nr. 4 DDG Pflicht. |
| **Pflicht** | `firestore.rules` deployen | Ohne die neue `slots`-Regel scheitert jede Terminanlage online. |
| **Pflicht** | users-Dokument-ID = Auth-UID | Erst dann greifen Rollenschutz und Schutz des FastBill-Keys. |
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

---

# Nachtrag: Zweisprachigkeit & Sicherheit

## 1. Deutsch / Arabisch in beiden Ansichten

Verwaltung und Handy-Ansicht laufen jetzt zweisprachig. Umschalter DE / ع in der
Kopfzeile, bei Arabisch schaltet die Seite auf `dir="rtl"`.

- Zentrales Wörterbuch `shared/texte.js` – rund 700 Einträge, ein Schlüssel je Text.
- Fehlt ein Schlüssel, erscheint der Schlüsselname statt einer leeren Fläche. Eine
  Lücke fällt damit sofort auf, statt sich zu verstecken.
- Datum, Monats- und Wochentagsnamen kommen aus `Intl` (`datumLok`, `lokale()`) –
  im Arabischen also arabische Monatsnamen, kein zweites Wörterbuch nötig.
- Übersetzt: alle Seiten (Kalender, Projekte, Projekt-Detail, Termine, Berichte,
  Kunden, Abrechnung, Übersicht, Anfragen, Dashboard, Import, Einstellungen,
  Login, Monteur-Ansicht) und alle Dialoge (Termin anlegen, Termin-Details,
  Bericht erfassen, Spesen, Rechnungs-Assistent, LV-Import, LV-Editor,
  Datumswahl, Unterschriftsfeld, Modal-Rahmen).

**Bewusst deutsch geblieben** (Absprache mit dem Auftraggeber):

- die juristischen Passagen im Regiebericht (§ 15 Abs. 3 VOB/B, § 11 VOB/B,
  § 12 VOB/B) – ein übersetzter Paragraphenverweis hat vor Gericht keinen Wert,
- der § 13b-Satz auf der Rechnung,
- sämtliche PDF-Ausgaben (Regiebericht, Abnahmeprotokoll, Arbeitsauftrag):
  Empfänger sind deutsche Auftraggeber, Finanzamt und ggf. Gericht.

Geprüft: beide Sprachen über alle 13 Routen und alle Dialoge, kein unübersetzter
Schlüssel, keine leere Seite, keine Konsolenfehler.

## 2. Info-Blase wurde abgeschnitten

Die Erklär-Blase am ⓘ-Zeichen war absolut im Elternelement positioniert und wurde
vom nächsten Container mit `overflow` beschnitten – in Tabellen (z. B. Rechnungs-
Assistent Schritt 2) blieb nur ein Streifen sichtbar. Sie hängt jetzt per Portal
direkt am `<body>`, liegt fix im Fenster, klemmt sich am Fensterrand ab und zieht
beim Scrollen mit. Zusätzlich: Escape schließt.

## 3. Sicherheit

### FastBill-Proxy (`seed/gabara-fastbill-proxy.gs`)

Der Proxy hatte bereits eine Secret-Prüfung. Das eigentliche Leck lag woanders:
**der FastBill-Zugang wanderte als `?auth=` in der URL**. URLs stehen im
Browser-Verlauf, in Referrern und in den Server-Logs von Google – der API-Key
hat dort nichts verloren.

- Zugang und Secret gehen jetzt im POST-Body mit, die URL bleibt sauber.
- Der alte Weg über Query-Parameter wird noch angenommen, damit eine laufende
  Installation beim Update nicht ausfällt.
- Solange `SECRET` auf dem Platzhalter steht (oder kürzer als 16 Zeichen ist),
  antwortet der Proxy gar nicht mehr – ein voreingestelltes Secret ist dasselbe
  wie kein Secret.
- Secret-Vergleich mit fester Laufzeit, damit die Antwortzeit nicht verrät,
  wie viele Zeichen eines geratenen Secrets gestimmt haben.
- Fehlermeldungen ohne interne Details.

### Firestore-Regeln (`firestore.rules`)

Vorher galt für fast alle Sammlungen `allow read, write: if angemeldet()` – jeder
Monteur durfte alles ändern, auch Rechnungen und Preise. Jetzt nach Rolle getrennt:

| Sammlung | Lesen | Schreiben |
|---|---|---|
| patients, projekte, katalog, bausteine, rechnungen | Team | nur Büro |
| apilog | nur Büro | nur Büro |
| appointments | Team | Büro; Monteur nur `erledigt`/`erledigtAm` an SEINEN Einsätzen |
| lvpositionen | Team | Büro; Monteur nur `istMenge`/`istVon`/`istAm` |
| berichte, spesen | Team | eigene, solange nicht freigegeben |
| photos | Team | anlegen alle; löschen Büro oder eigener Upload (`vonId`) |

Freigegebene und abgerechnete Berichte sind gesperrt – auch fürs Büro. Wer
korrigieren will, muss erst die Freigabe zurücknehmen; das ist ein sichtbarer
Schritt und erhält den Beweiswert des Stundennachweises.

Alle Feldzugriffe laufen über `.get(feld, vorgabe)`: ein fehlendes Feld lässt eine
Firestore-Regel sonst mit einem Fehler abbrechen – und ein Regelfehler sperrt alles.

Der Rollenschutz greift erst, wenn die users-Dokumente die Auth-UID als ID tragen;
bis dahin fällt `darfVerwalten()` auf das bisherige Verhalten zurück. Der Betrieb
bricht durch das Update also nicht.

**Nicht umgesetzt und bewusst so:** Monteure sehen weiterhin alle Baustellen. Eine
Einschränkung bräuchte eine Zuweisungsliste am Projekt – die gibt es heute nur am
Termin. Vermerkt für den Go-Live.

**Offen:** Die Regeln sind strukturell geprüft (Klammern, Syntaxform), aber noch
nicht vom Firestore-Regelprüfer. Dafür braucht es entweder Java (Emulator) oder
das angelegte Firebase-Projekt. Vor dem Deploy einmal `firebase deploy --only
firestore:rules` gegen das echte Projekt laufen lassen.

## 4. Kein Datenverlust mehr beim Ausfüllen

Neu: `shared/entwurf.js` + `admin/src/components/EntwurfHinweis.jsx`.

Ein Monteur tippt auf der Baustelle zehn Minuten an einem Regiebericht – Akku leer,
Browser räumt den Tab ab, versehentlicher Zurück-Wisch, und alles ist weg. Das
passiert jetzt nicht mehr:

- Der Formularzustand wandert alle 500 ms in den `localStorage`, zusätzlich beim
  Verlassen der Seite (`pagehide`, `visibilitychange`).
- Beim nächsten Öffnen wird **gefragt** („Wiederherstellen" / „Verwerfen"), nicht
  automatisch übernommen – ein alter Entwurf darf keine frische Eingabe löschen.
- Solange die Frage offen ist, wird nichts geschrieben.
- Nach erfolgreichem Speichern wird der Entwurf gelöscht – erst nach der
  Bestätigung des Stores, nicht davor.
- Entwürfe verfallen nach 14 Tagen und verschwinden beim Zurücksetzen der Demo-Daten.

Eingebaut in: Bericht erfassen, Spesen, Termin anlegen.
Geprüft: Text eingeben → Seite neu laden → Leiste erscheint → Wiederherstellen
bringt den Text zurück; Verwerfen löscht den Eintrag.

## 5. LV-Import meldet, was er nicht lesen konnte

Vorher wurden unlesbare Werte still zu 0 und unerkannte Zeilen verschwanden
kommentarlos. Bei 200 Positionen fällt eine 0-Menge niemandem auf – bis am
Monatsende Geld in der Rechnung fehlt.

- Neu `parseZahlPruef()` in `admin/src/csv.js`: meldet, ob ein Wert überhaupt
  lesbar war. „ca. 20", „n.a.", „20-25" gelten als unlesbar, „12 €" und „2.582,421"
  als in Ordnung.
- `analysiereLvText()` liefert jetzt `{ eintraege, ignoriert }` – `ignoriert` sind
  Textzeilen vor der ersten Position (meist PDF-Kopfzeilen).
- Der Import-Dialog zeigt vor der Übernahme eine rote Leiste: unlesbare Werte mit
  Zeilennummer und Originaltext, übersprungene Zeilen, nicht zugeordnete Textzeilen.

## Geänderte Dateien (Nachtrag)

**Neu:** `shared/texte.js` · `shared/entwurf.js` ·
`admin/src/components/EntwurfHinweis.jsx`

**Geändert:** `shared/i18n.js` · `shared/fastbill.js` · `shared/store.js` ·
`shared/unterschrift.jsx` · `firestore.rules` · `seed/gabara-fastbill-proxy.gs` ·
`admin/src/csv.js` · `admin/src/lvparser.js` · `admin/src/main.jsx` ·
`admin/src/components/InfoHinweis.jsx` · alle Seiten und Dialoge der Verwaltung

Build beider Apps fehlerfrei.

---

# Nachtrag 2: Stundenlisten & Testdurchlauf

## 6. Monats-Stundenlisten je Mitarbeiter

Neue Seite `admin/src/pages/Stunden.jsx` (Navigation „Stundenlisten") plus
`druckeStundenliste()` in `admin/src/drucken.js`.

- Monatsauswahl über die letzten 12 Monate, wahlweise **ganzer Monat** oder
  **Monat bis heute** (nur im laufenden Monat wählbar).
- Datenquelle sind die Stundenzeilen der Regieberichte. Standardmäßig zählen nur
  **freigegebene** Berichte – ein Blatt fürs Lohnbüro oder die BG soll nur
  geprüfte Stunden enthalten. Der Haken lässt sich lösen.
- Die Seite rechnet nichts neu, sie fasst nur zusammen: was gemeldet und
  freigegeben wurde, steht auch auf dem Blatt.
- **Pause** = Anwesenheit (Von–Bis) minus gemeldete Arbeitszeit, so wie ein
  Stundenzettel gelesen wird.
- **Plausibilitätsprüfung:** Meldet eine Zeile mehr Stunden, als zwischen Beginn
  und Ende liegen, wird sie gelb markiert und im Kopf mit „n × prüfen" gezählt.
  Genau daran scheitert ein Stundenzettel bei der BG – das darf nicht untergehen.

PDF-Aufbau nach der Blanko-Vorlage von bautagebuch.org, auf Monat umgebaut:
Kopfdaten (Mitarbeiter/in · Firma · Abrechnungszeitraum · erfasste Arbeitstage) →
Arbeitszeiten-Tabelle mit einer Zeile je Kalendertag (Tage ohne Einsatz bleiben
blass stehen, wie auf Papier) → Gesamtstunden → Summe & Bemerkungen →
zwei Unterschriftszeilen (Mitarbeiter/in · Arbeitgeber/Bauleitung).

Das PDF ist bewusst deutsch – Empfänger sind Auftraggeber, Lohnbüro und
Berufsgenossenschaft.

## 7. Testdurchlauf mit echten Daten

`seed/generate_test_zip.py` erzeugt das Test-Paket (`gabara_test_suite.zip`).
Gegenüber der Vorlage geändert: Pfade relativ zum Projekt statt zum
Arbeitsverzeichnis, Zeitlimit beim Download, und der Foto-Platzhalter ist jetzt
ein **gültiges** JPEG – der Rumpf-Header der Vorlage wäre kein lesbares Bild
gewesen, der Upload-Test also wertlos.

| Test | Inhalt | Ergebnis |
|---|---|---|
| TS-01a | LV-Import `lv_test_wandarbeiten.csv` | **bestanden.** Spalten automatisch erkannt, Umlaute erhalten, Punkt-Dezimalzahlen (120.50) richtig umgesetzt, Summe **10.940,10 €** = Gesamtpreis-Spalte der Quelle |
| TS-01b | LV-Import `lv_test_defekt.csv` | **bestanden.** Meldung nennt Zeile und Originalwert: „Zeile 2 · Menge: ‚Zwei'", „Zeile 3 · Menge: ‚ERR_PRICE'" statt stiller 0 |
| TS-02 | 3 Fotos, 2000 px | **bestanden.** 565 KB → 89 KB · 232 KB → 86 KB · 256 KB → 71 KB, alle weit unter dem 1-MB-Limit, `vonId` mitgeschrieben |
| TS-03 | Ist-Mengen aus dem Monteur-JSON (80 m² auf 01.01/01.02) | **bestanden.** Mit Herkunft und Datum gespeichert |
| TS-04a | Rechnungs-Assistent | **bestanden.** 80 × 18,50 = 1.480,00 € · 80 × 4,20 = 336,00 € · netto **1.816,00 €** · 19 % USt 345,04 € · brutto 2.161,04 € – deckt sich Position für Position mit `test_daten_fastbill_payload.json` |
| TS-04b | Proxy-Aufruf des Clients | **bestanden.** URL sauber (`…/exec`, kein `secret=`, kein `auth=`), Secret/Zugang/Nutzlast im Body |
| TS-04c | Proxy-Logik (17 Prüfungen als Node-Test) | **bestanden.** Richtiges Secret leitet weiter, falsches nicht, Platzhalter-Secret verweigert den Dienst, fehlender Zugang wird abgelehnt, kaputter Body stürzt nicht ab, Alt-Weg über Query bleibt kompatibel, `?ping=1` verrät nichts |
| TS-05 | Entwurfs-Sicherung | **bestanden.** Text → Seite neu laden → Leiste erscheint → Wiederherstellen bringt den Text zurück, Verwerfen löscht den Eintrag |

Abschluss-Durchlauf: 14 Routen × 2 Sprachen, kein unübersetzter Schlüssel, keine
leere Seite, beide Builds fehlerfrei.

**Nebenbefund:** Im Feld „Proxy-URL" der Demo-Daten stand `admin/.env.local` –
kein gültiger Wert. Schaden entstand keiner: `shared/fastbill.js` verwirft alles,
was nicht mit `https://` oder `/` beginnt, und fällt auf den Dev-Proxy zurück;
die Oberfläche zeigt dafür bereits eine rote Warnung. Wert entfernt.

## Geänderte Dateien (Nachtrag 2)

**Neu:** `admin/src/pages/Stunden.jsx` · `seed/generate_test_zip.py`

**Geändert:** `admin/src/drucken.js` (druckeStundenliste + Stundenzettel-Stil) ·
`admin/src/App.jsx` (Route/Navigation) · `admin/src/hinweise.js` ·
`shared/texte.js` · `.gitignore`

---

# Nachtrag 3: Prüfung auf Vorlagen-Reste

Das Projekt ist eine Kopie der Zahnarzt-/Wertachbrücke-Vorlage. Vollständiger
Durchlauf über Quellcode, öffentliche Dateien, Doku und laufende Oberfläche.

## Gefunden und behoben

**1. Zahnarzt-Präsentation war öffentlich** — `website/public/praesentation.html`,
16 KB, „Praxis an der Wertachbrücke · Augsburg" samt Preisliste (75 €/Monat).
Alles unter `website/public/` landet im Build: die Seite wäre nach dem Deploy
unter `gabara-service.de/praesentation.html` für jeden erreichbar gewesen.
Gelöscht (in Git versioniert, Commit `9529f5b`, jederzeit zurückholbar).
Der Pfad liefert jetzt die normale Gabara-Startseite.

**2. Arabische Texte sagten „Patient"** — In `admin/src/pages/Anfragen.jsx`
standen in den arabischen Übersetzungen zehnmal **مريض** (Patient) statt عميل
(Kunde): „ربط المريض" (Patient zuordnen), „رفض وإبلاغ المريض" (Absagen & Patient
informieren). Deutsch war korrekt, Arabisch nicht — und Arabisch ist live.
Korrigiert, ebenso die englischen Reste („anxious patient, referral, allergy"
als Platzhalter für ein Baustellen-Notizfeld).

**3. Kalender-Einträge trugen Praxis-Wording** — `shared/googleCalendar.js`
schrieb `description: 'Details in der Praxis-Verwaltung (geschützt).'` in jedes
Google-Event; der Kürzel-Fallback lautete `'Patient'`. Beides steht im Kalender
des Kunden, sobald die Google-Anbindung läuft. Jetzt „Gabara-Verwaltung" und
`'Kunde'`; der Titel nutzt `termin.titel` mit `behandlung` als Rückfall.

**4. Mail-Modul** — `sendePatientenMail` → `sendeKundenMail` (ein Aufrufer).
Der Kopfkommentar verwies auf `seed/erinnerung.gs` — diese Datei existiert nicht
im Repo. Vermerkt statt stillschweigend stehen zu lassen; versendet wird ohnehin
nichts, solange `MAIL_DIENST.url` leer ist.

**5. `package-lock.json`** trug noch `"name": "zahnarzt-praxis"`. Auf
`gabara-baustellen` gesetzt.

## Bewusst so geblieben

Interne Bezeichner der Vorlage: die Sammlung `patients`, die Felder `arzt` und
`behandlung`, `patientId`/`patientEmail` in Google-Events, der Export-Name
`ZahnLogo` (zeigt die Gabara-Farbrolle) und die CSS-Marke `praxis-*`.

Daran hängen gespeicherte Daten und bereits angelegte Kalender-Einträge – ein
Umbenennen wäre eine Datenmigration mit echtem Risiko und ohne sichtbaren
Gewinn. Das ist Regel 5 im Projekt-Skill und bleibt so.

`zahnrad` ist kein Rest, sondern das deutsche Wort für das Einstellungs-Symbol.

## Gegenprobe

- Quellcode-Scan auf `zahn|dental|karies|prophylax|GOZ|BEMA|implantat|bleaching|
  behandler|wertachbr|PZR|مريض`: **keine Treffer** außerhalb der genannten Interna.
- Oberfläche: 14 Routen × 2 Sprachen, Verwaltung und Handy — **kein Treffer**.
- Webseite: alle 5 Seiten — **kein Treffer**.
- Beide Builds fehlerfrei.

Der Prüfbefehl steht jetzt als Regel 5 im Skill `/gabara`, damit er bei künftigen
Änderungen nicht verloren geht.

---

# Nachtrag 4: Wissensdatenbank

Neuer Menüpunkt **Wissen** in der Verwaltung: erklärt zweisprachig, wie das
System funktioniert – von der Baustelle bis zur Rechnung.

- **Inhalte:** `shared/wissen.js` – 9 Bereiche, 30 Artikel, jeder Text in
  Deutsch UND Arabisch (120 zu 120 Textblöcke, keine Lücke).
- **Darstellung:** `admin/src/pages/Hilfe.jsx` – Bereiche als Karten, Artikel
  zum Aufklappen, Suche, Sprunglinks in die jeweilige Seite.

Bewusst getrennt von `shared/texte.js`: dort liegen kurze Oberflächen-Bausteine
mit festen Schlüsseln. Ein Artikel hat Struktur – Absätze, nummerierte Schritte,
Hinweise, Warnungen – und die ginge in einer flachen Schlüsselliste verloren.

## Bereiche

Erste Schritte · Kalender & Termine · Baustellen & Leistungsverzeichnis ·
Berichte & Nachweise · Stundenlisten · Abrechnung & FastBill · Handy-Ansicht für
Monteure · Stammdaten & Einstellungen · Daten & Sicherheit

Die Artikel beantworten die Fragen, die im Betrieb wirklich aufkommen – und
sagen auch, wo es hakt: dass Stundenlohnarbeiten VOR Beginn angezeigt werden
müssen (§ 15 Abs. 3 VOB/B), dass ein freigegebener Bericht bewusst gesperrt ist,
dass der Haken „Vorhandene Positionen löschen" die Ist-Mengen mitnimmt, und dass
der Sicherheitseinbehalt derzeit NICHT an FastBill übertragen wird und dort von
Hand nachgetragen werden muss.

## Suche

Die Suche läuft über **beide Sprachen gleichzeitig**: „Sicherheitseinbehalt"
findet die Treffer auch in der arabischen Ansicht, „الضمان" auch in der
deutschen. Bei aktiver Suche klappen die Treffer automatisch auf.

## Geprüft

- 15 Routen × 2 Sprachen: kein unübersetzter Schlüssel, keine leere Seite,
  keine Vorlagen-Reste.
- RTL: Suchsymbol steht rechts, der zugeklappte Pfeil spiegelt (`rotate: 180deg`),
  der aufgeklappte zeigt weiter nach unten.
- Suche mit deutschem und arabischem Begriff: je 2 von 30 Artikeln.
- Beide Builds fehlerfrei.

Regel 8 im Skill `/gabara` hält fest, dass die Wissensdatenbank bei
Funktionsänderungen mitgezogen wird – sonst erklärt die Hilfe bald etwas, das es
nicht mehr gibt.

**Neu:** `shared/wissen.js` · `admin/src/pages/Hilfe.jsx`
**Geändert:** `admin/src/App.jsx` · `shared/texte.js` · `.claude/skills/gabara/SKILL.md`

---

# Nachtrag 5: Übergabe-Bericht für parallele Arbeit

Neu: `.claude/skills/gabara/STAND.md`, verlinkt ganz oben in `SKILL.md`. Damit
lädt jeder Agent, der `/gabara` benutzt, zuerst den aktuellen Stand.

Der Bericht ist auf **gleichzeitiges Arbeiten mehrerer Agenten** ausgelegt. Er
beantwortet drei Fragen, die sonst jeder für sich neu herausfinden muss:

**1. Wo steht das Projekt?** Was fertig ist, und die vier Go-Live-Blocker – von
denen keiner Code-Arbeit ist: Firebase anlegen und die Regeln erstmals prüfen
lassen (lokal ging das nicht, der Emulator braucht Java), UIDs setzen,
Proxy-`SECRET` setzen, Handelsregister-Daten vom Auftraggeber.

**2. Wo kollidiert es?** Die fünf Dateien, die fast jede Aufgabe anfasst, mit
Regeln dafür:

| Datei | Regel |
|---|---|
| `shared/texte.js` | nur anhängen, nie umsortieren, eigenes Präfix je Bereich |
| `admin/src/App.jsx` | drei bekannte Einfügestellen je neuer Seite |
| `shared/wissen.js` | Artikel in bestehende Bereiche, keine neuen anlegen |
| `shared/ui.jsx`, `admin/src/stil.js` | nur anhängen, Bestehendes nie ändern |
| `docs/aenderungsbericht-…` | nur `cat >>`, nie umschreiben |

**3. Was kann parallel laufen?** Elf Arbeitspakete (A–K) aus dem offenen Backlog,
jedes mit seiner Dateiliste. Zwei Warnungen sind ausdrücklich vermerkt: D und F
fassen beide `drucken.js` an, G und I beide `firestore.rules` – diese Paare nicht
gleichzeitig vergeben.

Dazu die vier Regeln, an denen erfahrungsgemäß etwas kaputtgeht (`t`-Schattierung,
`heuteISO()`, kein deutsches Literal im JSX, interne Feldnamen bleiben), und eine
Abgabe-Prüfung mit fertigem Konsolen-Schnipsel: er läuft 14 Routen × 2 Sprachen
durch und meldet fehlende Übersetzungsschlüssel und leere Seiten. Geprüft:
28 Durchläufe, keine Funde.

Abschnitt 6 sagt, was NICHT angefasst werden soll – `store.js`, `i18n.js`,
`index.css` – und warum Soft-Delete geprüft und verworfen wurde, damit es nicht
alle drei Monate neu vorgeschlagen wird.

**Neu:** `.claude/skills/gabara/STAND.md`
**Geändert:** `.claude/skills/gabara/SKILL.md` (Verweis + Beschreibung)

---

# Nachtrag 6: Wissensdatenbank mit Zeichnungen und Anwendungsfällen

Die Wissensdatenbank hat jetzt zwei Ansichten, umschaltbar oben auf der Seite:

**Anwendungsfälle** (Voreinstellung) – sechs Situationen aus dem Alltag, jede mit
Auslöser, Klickweg und den Stolpersteinen: neuer Auftrag, Woche planen,
Zusatzarbeiten belegen, Monatsende/Stunden, Abschlagsrechnung, Reklamation und
Abnahme. Wer die Hilfe öffnet, steckt meist mitten in einer Aufgabe – deshalb
steht diese Ansicht vorn.

**Nachschlagen** – die bisherigen 30 Artikel in 9 Bereichen.

## Zeichnungen statt Bildschirmfotos

Sieben eingebettete SVG-Zeichnungen (`admin/src/components/WissenBild.jsx`):
Ablauf einer Baustelle · Rollen Büro/Monteur · Soll-Ist-Abgerechnet ·
Pflichtangaben eines Berichts · Freigabe-Zustände · Rechnungsquellen ·
Aufbau des Stundenzettels.

Bewusst keine Screenshots: die veralten mit jeder Oberflächenänderung, wiegen als
Base64 hunderte Kilobyte und lassen sich nicht übersetzen. Die Zeichnungen
erklären den Ablauf statt das Aussehen, bleiben bei jeder Auflösung scharf,
ziehen ihre Farben aus den Design-Marken und tragen ihre Beschriftung in beiden
Sprachen.

Alle Abläufe laufen **von oben nach unten**, nicht seitlich. Oben bleibt oben –
damit stimmt jede Zeichnung im Deutschen wie im Arabischen, ohne Spiegelung und
ohne gedrehte Schrift.

## Klickwege gegen den Quelltext geprüft

Die Schritte stammen nicht aus dem Gedächtnis. Sechs Agenten haben je einen
Bereich des Codes gelesen und den Klickweg mit Belegstellen zurückgemeldet,
sechs weitere haben jeden Schritt gegen den Code zu widerlegen versucht. Fünf von
sechs Fällen kamen mit Korrekturen zurück – 19 Beanstandungen insgesamt.

**Zwei davon waren keine Doku-Fehler, sondern echte Bugs:**

1. **Der Termin-Titel bekam einen Übersetzungsschlüssel.** Seit der
   Zweisprachigkeit trägt `KATEGORIEN` nur noch Schlüssel. Der automatische
   Titelvorschlag griff aber weiter auf den zweiten Eintrag als Text zu und
   schrieb `kat.umsetzung – EFH Huber` in den Titel – und damit **in die
   Datenbank**, nicht nur in die Anzeige. Behoben über `katName()`, mit
   Warnkommentar an der Stelle.

2. **Die Plausibilitätswarnung fehlte auf dem Ausdruck.** Ein Tag mit mehr
   gemeldeten Stunden als Anwesenheit war am Bildschirm gelb markiert, auf dem
   gedruckten Stundenzettel stand die überhöhte Zahl unbeanstandet. Wer sofort
   druckte, schickte den Fehler ungeprüft an Lohnbüro und Berufsgenossenschaft.
   Jetzt trägt die Zeile auch im PDF ein „!" und darunter steht ein Warnkasten.

**Zwei weitere Schwächen gleich mit behoben:**

- „Alle drucken" öffnete je Mitarbeiter ein eigenes Fenster. Browser lassen pro
  Klick nur eines durch – ab dem zweiten kam nur die Popup-Blocker-Meldung. Jetzt
  entsteht **ein** Dokument mit einer Seite je Person (`druckeStundenlistenSammel`).
  Geprüft: ein Fenster, zwei Seiten, Seitenumbruch gesetzt.
- Der Import-Hinweis „3 Positionen ohne Menge" nannte keine Nummern. Bei 200
  Zeilen findet man sie damit nicht wieder – jetzt stehen die Positionsnummern
  dabei (ab neun nur noch angezählt).

## Geprüft

- 190 Textpaare in `shared/wissen.js`, 803 in `shared/texte.js` – **jeder**
  deutsche Text hat einen arabischen Zwilling, keiner leer, keiner unübersetzt.
- Beide Ansichten in beiden Sprachen: kein roher Schlüssel, alle sieben
  Zeichnungen zeichnen, keine Schrift ragt aus der Zeichenfläche.
- Suche greift über beide Sprachen gleichzeitig: „Vertragsstrafe" findet in der
  arabischen Ansicht „شكوى واستلام", „الضمان المحتجز" findet zwei Fälle.

**Neu:** `admin/src/components/WissenBild.jsx`
**Geändert:** `shared/wissen.js` · `admin/src/pages/Hilfe.jsx` · `shared/texte.js` ·
`admin/src/components/NeuerTermin.jsx` · `admin/src/components/LvImport.jsx` ·
`admin/src/drucken.js` · `admin/src/pages/Stunden.jsx`
