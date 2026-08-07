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
