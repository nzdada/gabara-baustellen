# Gabara Baustellen – Stand & Arbeitsteilung

Stand **01.08.2026**, Version V1.2. Lesen, bevor du etwas anfässt – besonders
den Abschnitt „Gemeinsam genutzte Dateien". Er entscheidet darüber, ob zwei
Agenten sich gegenseitig die Arbeit überschreiben.

---

## 1 Wo das Projekt steht

Beide Apps bauen fehlerfrei und sind **online** (Stand 01.08.2026):

- Webseite: https://gabara-system.web.app
- Verwaltung: https://gabara-system-admin.web.app
- Firebase-Projekt `gabara-system` (europe-west3), `FIREBASE_CONFIG.enabled = **true**`.
  Daten liegen in Firestore, nicht mehr im localStorage. Regeln in `firestore.rules`
  sind bereitgestellt. Der lokale Modus existiert weiter, ist aber nicht der Normalfall.

**FastBill** ist seit 01.08.2026 echt angebunden – online ausschliesslich ueber die
Apps-Script-Weiterleitung (`seed/gabara-fastbill-proxy.gs`), Adresse **mit**
`?secret=...` unter Einstellungen → FastBill. Der Aufruf nutzt bewusst
`Content-Type: text/plain`, damit keine CORS-Vorabanfrage entsteht; Apps Script
beantwortet kein OPTIONS. Diese Wahl nicht anfassen.

**Offen / bewusst vertagt:**

- Echte Bildschirmfotos fuer die Wissensdatenbank (Formulare mit Eingabe- und
  Pflichtfeldern, deutsch UND arabisch). Braucht eine sichtbare Browser-Leiste;
  die Formulare lassen sich ohne Anmeldung ueber eine `import.meta.env.DEV`-Route
  in `admin/src/App.jsx` darstellen. Vom Nutzer auf spaeter verschoben.
- Durchgehender Test (Kalender → LV → Regiebericht mit Fotos → Freigabe →
  Stundenliste → Abrechnung). Setzt einmal "Beispieldaten zuruecksetzen" voraus.

**Fertig und geprüft:**

| Bereich | Zustand |
|---|---|
| Kalender, Projekte, LV, Termine, Berichte, Abrechnung | V1, im Betrieb erprobt |
| PDF-Ausgaben (Regiebericht, Abnahme, Arbeitsauftrag, Stundenzettel) | fertig, alle deutsch |
| Zweisprachigkeit DE/AR (Verwaltung **und** Handy) | vollständig, ~756 Schlüssel |
| Monats-Stundenlisten (BG-Bau-tauglich) | fertig |
| Wissensdatenbank (9 Bereiche, 30 Artikel, de+ar) | fertig |
| Entwurfs-Sicherung gegen Datenverlust | fertig (Bericht, Spesen, Termin) |
| Firestore-Regeln nach Rolle | geschrieben, **noch nie deployt** |
| FastBill-Proxy abgesichert | Zugang im Body statt in der URL |
| Vorlagen-Reste (Zahnarzt) | entfernt, Prüfbefehl in SKILL.md Regel 5 |

**Blocker vor dem Go-Live** (keiner davon ist Code-Arbeit, alle brauchen einen
Menschen mit Zugangsdaten):

1. Firebase-Projekt anlegen, `firestore.rules` deployen und dabei **zum ersten Mal
   syntaktisch prüfen lassen**. Lokal ging das nicht: der Emulator braucht Java,
   das hier fehlt.
2. users-Dokument-ID = Auth-UID setzen. Vorher greift der Rollenschutz nicht –
   `darfVerwalten()` fällt bewusst auf „jeder Angemeldete" zurück.
3. `SECRET` in `seed/gabara-fastbill-proxy.gs` setzen (mind. 16 Zeichen) und die
   Web-App bereitstellen. Solange der Platzhalter drinsteht, verweigert der Proxy
   absichtlich den Dienst.
4. Handelsregister + HRB-Nummer fürs Impressum (`REGISTER` in
   `website/src/pages/Recht.jsx`) – kommt vom Auftraggeber.

---

## 2 Gemeinsam genutzte Dateien – hier kollidiert es

Diese Dateien fasst **fast jede** Aufgabe an. Wer hier ohne Rücksicht arbeitet,
überschreibt fremde Arbeit.

### `shared/texte.js` — höchstes Risiko

Jede Oberflächen-Änderung braucht neue Schlüssel. Regeln:

- **Nur anhängen, nie umsortieren.** Die Datei ist nach Bereichen gegliedert;
  neue Schlüssel kommen ans Ende des passenden Bereichs oder als neuer Block
  ganz unten mit Überschriftskommentar.
- **Nie eine bestehende Zeile umformatieren.** Ein Reformat der ganzen Datei
  macht jede parallele Änderung zum Konflikt.
- **Namensraum je Bereich** (`stunden.*`, `rw.*`, `bf.*`, `lvImp.*`). Wer einen
  neuen Bereich anfängt, nimmt ein neues Präfix – dann kann es nicht knallen.
- **Immer de UND ar.** Fehlt `ar`, rendert `t()` den Schlüsselnamen. Das fällt
  im Betrieb auf, ist aber peinlich.

### `admin/src/App.jsx` — drei Einfügestellen je neuer Seite

Import oben, Eintrag in `NAV`, `<Route>` unten. Drei einzeilige Einfügungen an
drei bekannten Stellen. Kollidiert nur, wenn zwei Agenten gleichzeitig eine neue
Seite anlegen – dann beide Einträge behalten, nicht einen wegwerfen.

### `shared/wissen.js` — Wissensdatenbank

Ein Bereich pro Thema. Wer eine Funktion ändert, hängt seinen Artikel in den
**passenden bestehenden** Bereich an, statt einen neuen anzulegen. Absatzformen
stehen im Kopf der Datei.

### `shared/ui.jsx` (`PFADE`) und `admin/src/stil.js`

Neue Icons und Stil-Konstanten nur anhängen. Bestehende Werte nicht ändern – sie
hängen an Dutzenden Stellen.

### `docs/aenderungsbericht-2026-08-01.md`

**Nur anhängen** (`cat >>`), als eigener Abschnitt mit Überschrift. Nie
umschreiben.

---

## 3 Arbeitspakete, die sich NICHT ins Gehege kommen

Jede Zeile ist ein Paket, das ein Agent allein übernehmen kann. Die
Dateispalte sagt, was er anfasst. Zwei Pakete aus derselben Zeilengruppe **nicht**
parallel vergeben.

| # | Paket | Eigene Dateien | Fasst gemeinsam an |
|---|---|---|---|
| A | Kalender-Chips (Projekt + Monteur-Farbpunkte) | `admin/src/pages/Kalender.jsx` | texte.js |
| B | Mehrtägige Einsätze („wiederholen bis") | `admin/src/components/NeuerTermin.jsx` | texte.js |
| C | Monteur: Stepper + „Fertig" für Ist-Mengen, Offline-Banner | `admin/src/pages/monteur/*` | texte.js |
| D | Foto-Kommentare in Bericht + PDF | `admin/src/components/BerichtForm.jsx`, `admin/src/drucken.js` | texte.js |
| E | EXIF-Aufnahmezeit vor der Kompression sichern | `admin/src/components/TerminBilder.jsx`, `admin/src/components/BerichtForm.jsx` | — |
| F | Vertragsnummer/-datum am Projekt + auf jedem Dokument | `admin/src/pages/ProjektDetail.jsx`, `admin/src/drucken.js` | texte.js |
| G | Freigabe: Zurückweisen mit Grund an den Monteur | `admin/src/pages/Berichte.jsx`, `admin/src/pages/ProjektDetail.jsx` | texte.js, firestore.rules |
| H | Anfrage → Kunde → Projekt in einem Zug | `admin/src/pages/Anfragen.jsx` | texte.js |
| I | Webseite: Foto-Upload in der Anfrage + WhatsApp-Knopf | `website/src/**` | firestore.rules |
| J | Diktier-Funktion für Beschreibungsfelder | neu anzulegen: `shared/diktat.js` + die betroffenen Formulare | texte.js |
| K | Sicherheitseinbehalt an FastBill übertragen | `shared/fastbill.js`, `admin/src/components/RechnungWizard.jsx` | — |

**Achtung bei D und F:** beide fassen `admin/src/drucken.js` an. Nicht
gleichzeitig vergeben, oder vorher absprechen, wer welche Druckfunktion anfasst.

**Achtung bei G und I:** beide ändern `firestore.rules`. Die Datei ist klein und
strukturiert – Konflikte sind lösbar, aber besser nacheinander.

---

## 4 Regeln, die keiner brechen darf

Die vollständige Liste steht in `SKILL.md`. Die vier, an denen am häufigsten
etwas kaputtgeht:

1. **Kein deutsches Literal ins JSX.** Alles über `t('bereich.schluessel')`.
   Ausnahme: §-Verweise (VOB/B, UStG) und alle PDF-Ausgaben bleiben deutsch –
   Empfänger sind Auftraggeber, Finanzamt und ggf. Gericht.
2. **`t` als Schleifenvariable verdeckt die Übersetzungsfunktion.** In mehreren
   Dateien heißt eine Variable `t` (`termine.map((t) => …)`). Beim Übersetzen
   umbenennen, sonst crasht die Seite zur Laufzeit – nicht beim Build.
   `Kalender.jsx` nutzt bewusst weiter ein eigenes `T`-Objekt mit `tr()`.
3. **Datum immer über `heuteISO()`.** Nie `new Date().toISOString().slice(0,10)` –
   das liefert UTC und nachts zwischen 00:00 und 02:00 den Vortag.
4. **Interne Feldnamen der Vorlage bleiben** (`patients`, `arzt`, `behandlung`,
   `ZahnLogo`, `patientId` in Google-Events). Daran hängen gespeicherte Daten und
   bereits angelegte Kalendereinträge. Sichtbarer Text darf davon nichts zeigen.

---

## 5 Vor dem Abgeben – jedes Mal

```bash
npm run build -w admin && npm run build -w website
```

Beide müssen fehlerfrei durchlaufen. Ein grüner Build heißt aber **nicht**, dass
es läuft: fehlende Übersetzungsschlüssel und `t`-Schattierungen fallen erst zur
Laufzeit auf. Deshalb zusätzlich:

**Keine Vorlagen-Reste:**

```bash
grep -rniE "zahn|dental|prophylax|PZR|wertachbr|مريض|Praxis" --include=*.jsx --include=*.js --include=*.html . | grep -v node_modules | grep -v /dist/
```

**Keine fehlenden Schlüssel** – `t()` gibt bei fehlendem Eintrag den
Schlüsselnamen zurück, genau damit man ihn sieht. In der laufenden Verwaltung
(Port 5420) über alle Routen in **beiden** Sprachen laufen. Dieser Schnipsel
erledigt das automatisch — er nutzt Top-Level-`await` und gehört deshalb in die
**DevTools-Konsole**; wer ihn per Werkzeug ausführt, wickelt ihn in
`(async () => { … })()`:

```js
const pruefe = () => { const r = new Set(), re = /^[a-z][a-zA-Z]*\.[a-zA-Z0-9]+$/
  document.querySelectorAll('body *').forEach(el => {
    el.childNodes.forEach(n => { if (n.nodeType === 3) { const s = n.textContent.trim(); if (re.test(s)) r.add(s) } })
    for (const a of ['placeholder','title','aria-label']) { const v = el.getAttribute?.(a); if (v && re.test(v.trim())) r.add(v.trim()) } })
  return [...r] }
const schlaf = ms => new Promise(r => setTimeout(r, ms))
const routen = ['#/','#/projekte','#/termine','#/berichte','#/kunden','#/abrechnung',
  '#/uebersicht','#/anfragen','#/dashboard','#/stunden','#/hilfe','#/import','#/einstellungen','#/monteur']
for (const sprache of ['DE','ع']) {
  [...document.querySelectorAll('button')].find(b => b.innerText.trim() === sprache)?.click()
  await schlaf(350)
  for (const r of routen) { location.hash = r; await schlaf(300)
    const f = pruefe(); if (f.length) console.warn(sprache, r, f)
    if (!document.body.innerText.trim()) console.error('LEERE SEITE', sprache, r) } }
console.log('Prüfung fertig')
```

Meldet die Konsole nichts außer „Prüfung fertig", ist es sauber. Eine leere Seite
bedeutet fast immer eine `t`-Schattierung (siehe Regel 2 oben).

**Dev-Server nie über Bash starten** – dafür gibt es die launch.json-Einträge
`gabara-website` (5410) und `gabara-admin` (5420).

---

## 6 Was gerade NICHT angefasst werden sollte

- **`shared/store.js`** – die Zwei-Modi-Datenhaltung ist erprobt und trägt alles.
  Änderungen dort treffen jede Seite gleichzeitig.
- **`shared/i18n.js`** – die Sprach-Infrastruktur steht. Neue Texte gehören in
  `texte.js`, nicht hierher.
- **`admin/src/index.css`** – die Farbwerte sind vom Auftraggeber abgenommen,
  das volle Layout ausdrücklich gewünscht. Kein Redesign ohne Auftrag.
- **Soft-Delete** wurde geprüft und verworfen: `where('deleted','!=',true)`
  liefert in Firestore keine Dokumente ohne das Feld – die App wäre leer
  gewesen. Nicht erneut vorschlagen, ohne den Migrationsweg mitzuliefern.

---

## 7 Nachtrag V2-Umbau (Stand 08.08.2026)

AP 0–AP 6 des V2-Plans (`~/.claude/plans/ich-will-einen-system-atomic-brook.md`)
sind committet. **AP 6 (Fotos offline-zuerst)** brachte:

- `shared/fotoablage.js` – IndexedDB-Warteschlange: EXIF-Zeit VOR dem
  Verkleinern, drei Größen (1600/900/400, `shared/bild.js dreiGroessen`),
  SHA-256, Status lokal→laedt→hochgeladen|fehler, persist()/estimate(),
  Verfallsregel (Vorher sofort, Rest 4 h/10 Bilder), Geräte-Lebenszeichen.
  **Der EINE Umschalter** auf Firebase Storage: Konstante `SPEICHER_ZIEL`
  ('vorschau' = Rückfallweg 400er-dataUrl in `photos`, Original bleibt in
  IndexedDB; 'storage' erst nach Blaze-Upgrade umstellen).
- Fototafel je Raum (`admin/src/pages/monteur/Fototafel.jsx`): vier Plätze
  Vorher/Nachher × Auftrag/Regie, Regie-Zeile nur bei Anordnung, Zähler
  `raum.fotoStand` (Firestore-Regel raeume/nurFelder um 'fotoStand'
  erweitert; lokaler `updateInkrement` kann jetzt Punktpfade).
- `FotoLeiste.jsx`: Offline-Banner, Balken „⬆ n warten“ + „jetzt versuchen“,
  Standalone-Gate (Kamera gesperrt außerhalb der installierten App;
  Dev-Lauf frei, Test-Schalter localStorage `gabara-gate-erzwingen`='ja').
  Dafür ist die Admin-App jetzt installierbar (`admin/public/manifest.webmanifest`).
- Heute/RegieMelden lösen Fotos über die Ablage aus (nie mehr `photos`-
  dataUrl direkt); BerichtForm sichert Unterschriften im Entwurf mit.
- Neue Prüfdatei `pruefung/fotoablage.test.mjs` (in `npm test` registriert).

**AP 7 (Büro-Leitstand)** brachte:

- `Uebersicht.jsx` neu als VIER Bänder (Plan 3.2): HEUTE (Kolonnen aus
  teams.js × Einsätze des Tages), WAS HAKT (max. 7 Zeilen, sonst grüner
  Balken), BAUSTELLEN (liest NUR `projekte/{id}/kennzahlen/live` je offener
  Baustelle – kein Aufgaben-Vollabo), WOCHENTAFEL (Mo–Fr × Kolonnen,
  Baustelle per Drag & Drop oder „+“ in eine Zelle → Zuweisen-Dialog).
- `shared/leitstand.js` – reiner Rechenkern: wochenTage/einsatzTage,
  parseRaumliste (Fehler je Zeile: Zeile/Feld/Originalwert, nie still 0),
  schnellanlageBauen, zuweisungBauen (deterministische Einsatz-Kennung:
  Doppelklick ersetzt), zurueckweisungBauen (zurueck + Aufmaß-STORNO +
  Buchung LÖSCHEN + Kennzahlen-Gegenbuchung), freigabeBauen, fotoAmpel.
- `store.schreibeVorgang({ sets, patches, loesche, kennzahlen })` in BEIDEN
  Modi – der allgemeine Ein-Batch-Vorgang des Leitstands (450er-Grenze).
- `naechsterSchritt.js`: neue `schritteLeitstand()` – Kolonne ohne Einsatz,
  Stundenzettel-Vorlagefrist (§ 15 Abs. 3), Mengen-MEHRung > 10 % über
  `mengenAbweichung` (§ 2 Abs. 3), Aufgaben ohne positionId (§ 2 Abs. 6,
  aus Kennzahlen-Zähler `aufgabenOhnePosition`), Geräte-Rückstand.
- Neue Seiten `/freigabe` (Freigeben / Zurückweisen mit Grund) und
  `/fotoampel` (je Raum Auftrag/Regie aus `raum.fotoStand`). `zurueck`
  landet ROT beim Monteur (Heute.jsx, ZEICHEN.zurueck ⟲) und ist nach
  Nachbesserung erneut meldbar, weil die Buchung gelöscht wurde.
- Demo: Kennzahlen-Startdokument für p-iga + ein Gerät mit Foto-Rückstand.
  Wiki-Bereich `leitstand` (5 Artikel de+ar). Neue Prüfdatei
  `pruefung/leitstand.test.mjs` (66 Fälle, in `npm test`).

**AP 8 (Aufmaß und Abrechnung)** brachte:

- `shared/abrechnung.js` – reiner AP-8-Kern: positionsUebersicht (Vertrag/
  Aufmaß/Abgerechnet + § 2-Abs.-3-Abweichung), alleBestaetigenBauen (NUR
  gemessene Zeilen unter 10 % – geschätzte und Über-Schwelle-Zeilen bleiben
  gesperrt), zeileNachmessenBauen (verlangt gemessenVon+gemessenAm),
  Rechnungslauf nach Plan 8.7 (rechnungslaufAnlegen/naechsteEtappe zu 400,
  idempotent, Rechnung ERST wenn offen == 0), steuerSchnappschuss (8.8:
  ustModus/Satz/Betrag/13b-Text werden in die Rechnung KOPIERT),
  einbehaltBauen (faelligAm = Abnahme + 48/60 Monate, addMonate deckelt auf
  Monatsletzten), stornoBauen (Marker leeren in Etappen, Rechnung storniert,
  Einbehalt entfällt, Kennzahl abgerechnetCent zurück), ankuendigungBauen
  (§ 2 Abs. 6: Vermerk je Aufgabe + Gegenbuchung aufgabenOhnePosition).
- Büro-Seite `/aufmass` (`admin/src/pages/Aufmass.jsx`): je Position
  aufklappbar bis zur Zeile mit Formeltext, Nachmessen-Dialog, „Alle
  bestätigen“ mit Hinweistext, Aufmaßblatt-PDF, rote § 2-Abs.-6-Box mit
  Ein-Klick-Ankündigung, Rechnungslauf-Modal (start-/fortsetzbar; die fertige
  Rechnung liegt mit art 'aufmass' unter /abrechnung und geht von dort an
  FastBill). Abrechnung.jsx: V2-Rechnungen haben STORNO statt Löschen.
- Monteur-Aufmaß `/monteur/aufmass` (`AufmassRaum.jsx`, Bildschirm 7): nur
  Vorarbeiter/Büro (Einstieg im HEUTE-Kopf), B×L-Rechner, hoeheLicht+
  aufbauBoden (Pflicht, sonst geschätzt), Öffnungen mit Leibungstiefe,
  Live-Rechnung nach Regelwerk, aufmassStand geschaetzt→gemessen (bestaetigt
  nur Büro). firestore.rules: Vorarbeiter darf die Aufmaß-Felder am Raum.
- `drucken.js`: druckeAufmassblatt (§ 14 Abs. 1, Regelwerk im Klartext,
  Ort/Ansatz/Faktor/Menge/Art, ⚠ geschätzt=gesperrt, Summe/Vertrag/
  Abweichung, gemeinsames Aufmaß § 14 Abs. 2) und
  druckeNachtragsankuendigung (§ 2 Abs. 6, Zugangsvermerk).
- Projekt: `abrechnungsregel` als Pflichtfeld (Warnung beim Umschalten mit
  Zahl gestellter Rechnungen) + `bodenaufbauStd` (ProjektDetail.jsx).
  Leitstand: Einbehalt-Zeile 3 Monate vor Fälligkeit (naechsterSchritt.js,
  Uebersicht.jsx lädt einbehalte). Demo: Regelwerk an allen Projekten + eine
  geschätzte Aufmaßzeile. Wiki: 5 Artikel de+ar (aufmass-ansicht,
  aufmassblatt, rechnungslauf, nachtrag-ankuendigung, aufmass-erfassen).
  Neue Prüfdatei `pruefung/abrechnung.test.mjs` (47 Fälle, in `npm test`).

**AP 9 (Stunden, Regie-Anerkennungsuhr, Abnahme)** brachte:

- `shared/fristen.js` – Werktags-Rechenkern: bayerische Feiertage (Ostern
  nach Butcher, inkl. Mariä Himmelfahrt; Friedensfest bewusst NICHT),
  Samstag zählt als Werktag. anerkanntAbIso (§ 15 Abs. 3: 6 Werktage nach
  EINGETRAGENEM Zugang, „gilt seit“ = erster Werktag danach – beide
  Plan-Beispiele exakt reproduziert: 12.08.→21.08., 15.08.→24.08.),
  abnahmeFristEnde/fiktiveAbnahmeAb (§ 12 Abs. 5: 12 Werktage).
- `shared/abnahme.js` – Abnahme-Kern: fotoPaar (frühestes Vorher, spätestes
  Nachher, nur Raumtafel-Rollen; Regie auch meldebeleg), fotoBeleg
  (EXIF/Gerät + Servereingang + Prüfsumme), teilabnahme (vollständig =
  beide Auftragsbilder + kein wartet; unvollständige NAMENTLICH mit Grund;
  bereits abgenommene nachrichtlich), abnahmePatches (raum.abnahmeAm je
  Raum), abnahmeSeiten (je Raum beide Bildpaare + Regiestunden-Summe).
- Stunden.jsx neu: Quelle Sammlung `stunden` (nicht mehr Regieberichte),
  Spalte Art + getrennte Summen Auftrag/Regie, bemerkungen befüllbar,
  CSV-Export je Monat (Lohnbüro), Bildschirm zeigt ALLE Kalendertage wie
  das PDF. BerichtForm schreibt Regie-Stundenzeilen beim Einreichen
  zusätzlich in `stunden` (deterministische Kennung, je Person+Tag
  zusammengefasst). stundenBlatt (drucken.js): Art-Spalte, Zwischensummen
  „Auftrag x · Regie y · gesamt“, Regieteil mit Satz/Betrag/Anordnungszeile
  (Auftragsteil bewusst ohne Satz).
- Berichte.jsx: neuer Reiter „Anordnungen“ mit Anerkennungsuhr – Vorlegen-
  Dialog (vorgelegtAm + zugangsnachweis, anerkanntAb wird EINGEFROREN,
  Warnhinweis „gerechnet ab EINGETRAGENEM Zugang“), Widerspruch → bestritten.
  Leitstand: zwei neue Zeilenarten (gilt als anerkannt; Abnahmefrist-Zähler/
  fiktive Abnahme über projekt.fertigAngezeigtAm – gesetzt per Abfrage nach
  „Abschlussbericht drucken“ in ProjektDetail).
- druckeAbnahme erweitert: Raumseiten (break-before:page) mit beiden
  Bildpaaren + Beweiszeilen (900er/Vorschau-Derivat, nie das 1600er),
  Teilabnahme-Deckblatt „Nicht Gegenstand dieser Abnahme“, Vertragsstrafen-
  Vorbehalt ZWEI Zustände (bei „nein“ der ausdrückliche Satz), „keine
  sonstigen Vorbehalte“ muss aktiv gewählt werden (BerichtForm-Gate),
  Mängelrüge mit ZUGANGSdatum. esc() auf jeder Nutzereingabe.
- Wiki: stunden/auftrag-regie-csv, berichte/anerkennungsuhr,
  berichte/teilabnahme (de+ar). Texte-Block „AP 9“ (stunden.*, ra.*, abn.*).
  Neue Prüfdatei `pruefung/fristen.test.mjs` (48 Fälle, in `npm test`).
