// Prüfung des Karten-Kerns (shared/aufgaben.js) und der Sammelmeldung im
// lokalen Store-Modus (shared/store.js meldeAufgaben).
//
// Ausführen:  node pruefung/aufgaben.test.mjs
// Endet mit Code 1, wenn ein Fall abweicht – damit taugt es als Bau-Vorstufe.
//
// Die Geld-Fälle hier sichern die drei Schutzregeln des Datenmodells:
// deterministische Kennungen, wertCent als eingefrorene Ganzzahl und EIN
// aggregiertes Kennzahlen-Increment je Vorgang. Wer daran dreht, dreht an
// der Doppelbuchungs-Sperre (Plan 4.2, ~8.700 €/Jahr Schaden ohne sie).

import {
  aufgabenId, buchungsId, aufmasszeilenId, istQuadratmeter,
  mengeFuerBezug, einheitFuerBezug, neueAufgabenFuerRaum,
  meldungBauen, fortschritt,
} from '../shared/aufgaben.js'

// ---- Browser-Attrappen, BEVOR der Store lädt (lokaler Modus im Node) ----
const ablage = new Map()
globalThis.localStorage = {
  getItem: (k) => (ablage.has(k) ? ablage.get(k) : null),
  setItem: (k, v) => { ablage.set(k, String(v)) },
  removeItem: (k) => { ablage.delete(k) },
  clear: () => ablage.clear(),
  key: (i) => [...ablage.keys()][i] ?? null,
  get length() { return ablage.size },
}
globalThis.alert = () => {}
// Ein offener BroadcastChannel hielte den Node-Prozess am Leben – weg damit,
// der Store prüft per typeof und kommt ohne aus.
globalThis.BroadcastChannel = undefined

const { erzeugeLokalenStoreFuerTest } = await import('../shared/store.js')

const faelle = []
const p = (bereich, name, ist, soll) => {
  const gleich = JSON.stringify(ist) === JSON.stringify(soll)
  faelle.push({ bereich, name, ist, soll, ok: gleich })
}
const wirft = (fn) => {
  try { fn(); return null } catch (e) { return e.message }
}
const wirftAsync = async (fn) => {
  try { await fn(); return null } catch (e) { return e.message }
}

// ---------------------------------------------------------------- Kennungen
p('Kennung', 'aufgabenId deterministisch', aufgabenId('r-flur', 'as-grundieren'), 'auf-r-flur-as-grundieren')
p('Kennung', 'buchungsId mit Art', buchungsId('r-flur', 'as-grundieren', 'auftrag'), 'b-r-flur-as-grundieren-auftrag')
p('Kennung', 'buchungsId Regie ist eine ANDERE Kennung', buchungsId('r-flur', 'as-grundieren', 'regie'), 'b-r-flur-as-grundieren-regie')
p('Kennung', 'buchungsId ohne Art fällt auf auftrag', buchungsId('r-flur', 'as-grundieren'), 'b-r-flur-as-grundieren-auftrag')
p('Kennung', 'aufmasszeilenId', aufmasszeilenId('auf-r-flur-as-grundieren'), 'am-auf-r-flur-as-grundieren')

// ---------------------------------------------------------------- Aufgaben anlegen
const RAUM = {
  id: 'r-103', projektId: 'p-test', nummer: '1.03', name: 'Büro', bereich: '1. OG',
  breite: 4, laenge: 5, grundflaeche: 20,
  umfang: 18, umfangGemessen: true, hoeheLicht: 2.5, aufbauBoden: 0.12,
  oeffnungen: [
    { art: 'tuer', breite: 0.885, hoehe: 2.01, leibungstiefe: 0.15 },
    { art: 'fenster', breite: 1.2, hoehe: 1.3, anzahl: 2, leibungstiefe: 0.2 },
  ],
  aufmassStand: 'gemessen',
}
const SCHRITTE = [
  { id: 'as-grundieren', nameDe: 'Grundieren', nameAr: 'التأسيس', sort: 4, bezug: 'wanddecke' },
  { id: 'as-anstrich1', nameDe: '1. Anstrich', nameAr: 'الطلاء الأول', sort: 5, bezug: 'wanddecke' },
]
const POSITION = { id: 'pos-21', oz: '2.1', kurztext: '1. Wand- und Deckenbeschichtung', einheit: 'm²', einheitspreis: 2.05 }

const angelegt = neueAufgabenFuerRaum(RAUM, SCHRITTE, POSITION, { regelwerk: 'vob18363', jetzt: 1000 })
const nochmal = neueAufgabenFuerRaum(RAUM, SCHRITTE, POSITION, { regelwerk: 'vob18363', jetzt: 2000 })

p('Anlegen', 'Kennungen deterministisch auf-<raum>-<schritt>',
  angelegt.map((a) => a.id), ['auf-r-103-as-grundieren', 'auf-r-103-as-anstrich1'])
p('Anlegen', 'zweiter Aufruf liefert DIESELBEN Kennungen (ersetzt statt verdoppelt)',
  nochmal.map((a) => a.id), angelegt.map((a) => a.id))
p('Anlegen', 'wanddecke mit VOB: Wand 47,16 + Decke 20,00 = 67,16 m²', angelegt[0].menge, 67.16)
p('Anlegen', 'einheitspreis 2,05 € wird zu 205 Cent', angelegt[0].einheitspreisCent, 205)
p('Anlegen', 'wertCent eingefroren: round(67,16 × 205) = 13768', angelegt[0].wertCent, 13768)
p('Anlegen', 'wertCent ist GANZZAHL', Number.isInteger(angelegt[0].wertCent), true)
p('Anlegen', 'mengeStand vom Raum geerbt (gemessen)', angelegt[0].mengeStand, 'gemessen')
p('Anlegen', 'ohne aufmassStand gilt geschaetzt',
  neueAufgabenFuerRaum({ ...RAUM, aufmassStand: undefined }, SCHRITTE, POSITION, { regelwerk: 'vob18363' })[0].mengeStand,
  'geschaetzt')
p('Anlegen', 'status offen, anteil 0, keine Tage',
  [angelegt[0].status, angelegt[0].anteil, angelegt[0].tage], ['offen', 0, []])
p('Anlegen', 'Regelwerk-Schnappschuss an der Aufgabe', angelegt[0].regelwerk, 'vob18363')
p('Anlegen', 'einheitspreisCent direkt (Ganzzahl) wird übernommen',
  neueAufgabenFuerRaum(RAUM, [SCHRITTE[0]], { id: 'pos-x', einheitspreisCent: 165, einheit: 'm²' })[0].einheitspreisCent, 165)
p('Anlegen', 'Raum ohne Kennung wird abgelehnt',
  wirft(() => neueAufgabenFuerRaum({ projektId: 'p' }, SCHRITTE)) !== null, true)
p('Anlegen', 'Raum ohne projektId wird abgelehnt',
  wirft(() => neueAufgabenFuerRaum({ id: 'r' }, SCHRITTE)) !== null, true)

// Menge je Bezug
p('Bezug', 'decke = Grundfläche', mengeFuerBezug(RAUM, 'decke'), 20)
p('Bezug', 'stueck = 1', mengeFuerBezug(RAUM, 'stueck'), 1)
p('Bezug', 'lfm = Umfang', mengeFuerBezug(RAUM, 'lfm'), 18)
p('Bezug', 'wanddecke OHNE Regelwerk = 0 (nie raten)', mengeFuerBezug(RAUM, 'wanddecke'), 0)
p('Bezug', 'ausdrückliche Vorgabe am Raum gewinnt',
  mengeFuerBezug({ ...RAUM, mengen: { wanddecke: '49,9' } }, 'wanddecke'), 49.9)
p('Bezug', 'Einheit je Bezug', [einheitFuerBezug('stueck'), einheitFuerBezug('lfm'), einheitFuerBezug('wanddecke')], ['Stk', 'lfm', 'm²'])
p('Bezug', 'm²-Erkennung: m², m2, qm ja – Stk nein',
  [istQuadratmeter('m²'), istQuadratmeter('m2'), istQuadratmeter('qm'), istQuadratmeter('Stk')],
  [true, true, true, false])

// ---------------------------------------------------------------- Sammelmeldung
const aufgabe = (raumId, schrittId, extra = {}) => ({
  id: aufgabenId(raumId, schrittId), projektId: 'p-test', raumId, schrittId,
  raumNummer: '1.01', raumName: 'Flur', schrittNameDe: 'Grundieren',
  menge: 46, einheit: 'm²', mengeStand: 'gemessen', positionId: 'pos-1', oz: '1.1',
  kurztext: 'Grundieren', einheitspreisCent: 165, wertCent: 7590,
  art: 'auftrag', status: 'zugewiesen', regelwerk: 'vob18363', ...extra,
})
const MONTEUR = { userId: 'u-ahmad', name: 'Ahmad' }
const VIER = [
  aufgabe('r1', 's1'),
  aufgabe('r2', 's1', { menge: 38, wertCent: 6270 }),
  aufgabe('r3', 's1', { menge: 52, wertCent: 8580, status: 'laeuft' }),
  aufgabe('r4', 's1', { menge: 24, wertCent: 3960 }),
]
const M = meldungBauen(VIER, MONTEUR, '2026-08-08', { fotoId: 'foto-1', jetzt: 5000 })

p('Meldung', 'je Aufgabe 1 Buchung + 1 Update + 1 Aufmaßzeile',
  [M.buchungen.length, M.aufgaben.length, M.aufmasszeilen.length], [4, 4, 4])
p('Meldung', 'Buchungs-Kennung deterministisch', M.buchungen[0].id, 'b-r1-s1-auftrag')
p('Meldung', 'Buchung trägt Melder, Datum, Menge',
  [M.buchungen[0].mitarbeiterId, M.buchungen[0].datum, M.buchungen[0].menge], ['u-ahmad', '2026-08-08', 46])
p('Meldung', 'Update setzt fertig + Fertig-Felder',
  [M.aufgaben[0].patch.status, M.aufgaben[0].patch.fertigVon, M.aufgaben[0].patch.fertigVonName,
    M.aufgaben[0].patch.fertigFotoId, M.aufgaben[0].patch.fertigAm],
  ['fertig', 'u-ahmad', 'Ahmad', 'foto-1', 5000])
// Die Firestore-Regel erlaubt dem Monteur NUR diese Felder – ein einziges
// zusätzliches Feld ließe den ganzen Batch scheitern.
const ERLAUBT = new Set(['status', 'anteil', 'fertigAm', 'fertigVon', 'fertigVonName', 'fertigFotoId', 'wartetGrund', 'wartetBis', 'geaendertAm'])
p('Meldung', 'Update-Patch enthält nur Monteur-erlaubte Felder (firestore.rules)',
  M.aufgaben.every((u) => Object.keys(u.patch).every((feld) => ERLAUBT.has(feld))), true)
p('Meldung', 'Aufmaßzeile am-<aufgabeId>', M.aufmasszeilen[0].id, 'am-auf-r1-s1')
p('Meldung', 'Zeile: quelle aufgabe, abgerechnetIn leer, kein Storno',
  [M.aufmasszeilen[0].quelle, M.aufmasszeilen[0].abgerechnetIn, M.aufmasszeilen[0].storniert],
  ['aufgabe', '', false])
p('Meldung', 'gemessen → Zeile NICHT geschätzt', M.aufmasszeilen[0].geschaetzt, false)
p('Meldung', 'geschaetzt wird auf die Zeile VERERBT',
  meldungBauen([aufgabe('r9', 's1', { mengeStand: 'geschaetzt' })], MONTEUR, '2026-08-08').aufmasszeilen[0].geschaetzt, true)
p('Meldung', 'EIN Kennzahlen-Objekt, nicht vier', Array.isArray(M.kennzahlen), false)
p('Meldung', 'Increment aggregiert: 4 Aufgaben, 160 m²',
  [M.kennzahlen.deltas.aufgabenFertig, M.kennzahlen.deltas.m2Fertig], [4, 160])
p('Meldung', 'wertFertigCent = Summe 26.400', M.kennzahlen.deltas.wertFertigCent, 26400)
p('Meldung', 'wertFertigCent ist GANZZAHL', Number.isInteger(M.kennzahlen.deltas.wertFertigCent), true)
p('Meldung', 'laufende Aufgabe verlässt den laeuft-Zähler', M.kennzahlen.deltas.aufgabenLaeuft, -1)
p('Meldung', 'Stück-Aufgabe zählt NICHT in die m²-Zahl',
  meldungBauen([aufgabe('r8', 's7', { einheit: 'Stk', menge: 1 })], MONTEUR, '2026-08-08').kennzahlen.deltas.m2Fertig, 0)
p('Meldung', 'Ziel-Projekt am Increment', M.kennzahlen.projektId, 'p-test')
p('Meldung', 'gemischte Projekte werden abgelehnt',
  wirft(() => meldungBauen([aufgabe('r1', 's2'), aufgabe('r2', 's2', { projektId: 'p-anders' })], MONTEUR, '2026-08-08')) !== null, true)
p('Meldung', 'doppelte Zielreferenz im Vorgang wird abgelehnt',
  wirft(() => meldungBauen([aufgabe('r1', 's1'), aufgabe('r1', 's1')], MONTEUR, '2026-08-08')) !== null, true)
p('Meldung', 'leerer Vorgang wird abgelehnt',
  wirft(() => meldungBauen([], MONTEUR, '2026-08-08')) !== null, true)

// raeumeFertig nur mit vollem Raum-Stand bestimmbar
const ALLE_R1 = [
  aufgabe('r1', 's1'), aufgabe('r1', 's2', { status: 'fertig' }),
  aufgabe('r2', 's1'), aufgabe('r2', 's2'),
]
const MR = meldungBauen([ALLE_R1[0]], MONTEUR, '2026-08-08', { alleAufgaben: ALLE_R1 })
p('Meldung', 'Raum wird mit letzter Aufgabe komplett → raeumeFertig +1', MR.kennzahlen.deltas.raeumeFertig, 1)
const MR2 = meldungBauen([ALLE_R1[2]], MONTEUR, '2026-08-08', { alleAufgaben: ALLE_R1 })
p('Meldung', 'Raum bleibt unvollständig → KEIN raeumeFertig-Delta', MR2.kennzahlen.deltas.raeumeFertig, undefined)

// ---------------------------------------------------------------- Fortschritt
const STAND = [
  aufgabe('r1', 's1', { status: 'fertig' }),
  aufgabe('r1', 's2', { status: 'fertig', menge: 46, wertCent: 7590 }),
  aufgabe('r2', 's1', { status: 'laeuft', menge: 38, wertCent: 6270 }),
  aufgabe('r2', 's2', { status: 'offen', menge: 38, wertCent: 6270 }),
  aufgabe('r3', 's7', { status: 'fertig', einheit: 'Stk', menge: 1, wertCent: 500 }),
]
const F = fortschritt(STAND)
p('Fortschritt', 'DREI benannte Zahlen', Object.keys(F), ['leistung', 'flaeche', 'raeume'])
p('Fortschritt', 'Leistung €: fertig 15.680 von 28.220 Cent · offen/laufend bleibt im Nenner',
  [F.leistung.fertigCent, F.leistung.gesamtCent], [15680, 28220])
p('Fortschritt', 'Leistungs-Anteil 0,556', F.leistung.anteil, 0.556)
p('Fortschritt', 'Fläche zählt NUR m²: 92 von 168', [F.flaeche.fertigM2, F.flaeche.gesamtM2], [92, 168])
p('Fortschritt', 'Räume: r1 (alle Schritte) und r3 fertig, r2 nicht', [F.raeume.fertig, F.raeume.gesamt], [2, 3])
p('Fortschritt', 'abgerechnet zählt weiter als fertig',
  fortschritt([aufgabe('r1', 's1', { status: 'abgerechnet' })]).raeume.fertig, 1)
p('Fortschritt', 'laufend zählt NICHT als fertig (Beweisfoto fehlt)',
  fortschritt([aufgabe('r1', 's1', { status: 'laeuft' })]).raeume.fertig, 0)
p('Fortschritt', 'leere Liste → Nullen, keine Division durch 0',
  fortschritt([]), {
    leistung: { fertigCent: 0, gesamtCent: 0, anteil: 0 },
    flaeche: { fertigM2: 0, gesamtM2: 0, anteil: 0 },
    raeume: { fertig: 0, gesamt: 0, anteil: 0 },
  })

// ---------------------------------------------------------------- Lokaler Store: alles-oder-nichts
const store = erzeugeLokalenStoreFuerTest()
const START = [aufgabe('r1', 's1'), aufgabe('r2', 's1', { menge: 38, wertCent: 6270 })]
await store.addMany('aufgaben', START)

const VORGANG = meldungBauen(START, MONTEUR, '2026-08-08', { fotoId: 'foto-9', jetzt: 6000 })
const ergebnis = await store.meldeAufgaben(VORGANG)
p('Store', 'Meldung bestätigt', ergebnis.bestaetigt, true)
p('Store', 'Buchungen geschrieben, uebertragenAm gesetzt',
  (await store.list('buchungen')).filter((b) => b.id.startsWith('b-r')).every((b) => b.uebertragenAm > 0), true)
p('Store', 'Aufgabe steht auf fertig', (await store.get('aufgaben', 'auf-r1-s1')).status, 'fertig')
p('Store', 'Aufmaßzeile liegt vor', (await store.get('aufmasszeilen', 'am-auf-r1-s1'))?.quelle, 'aufgabe')
const kz1 = await store.ladeKennzahlen('p-test')
p('Store', 'Kennzahlen EINMAL aggregiert: 84 m², 13.860 Cent, 2 fertig',
  [kz1.m2Fertig, kz1.wertFertigCent, kz1.aufgabenFertig], [84, 13860, 2])
p('Store', 'wertFertigCent bleibt GANZZAHL', Number.isInteger(kz1.wertFertigCent), true)

// Doppelmeldung: derselbe Vorgang noch einmal (zweites Gerät im Funkloch)
const doppelt = meldungBauen(START, MONTEUR, '2026-08-08', { jetzt: 7000 })
const fehler = await wirftAsync(() => store.meldeAufgaben(doppelt))
p('Store', 'Doppelmeldung wird abgelehnt (Bereits gemeldet)', fehler?.startsWith('Bereits gemeldet'), true)
const kz2 = await store.ladeKennzahlen('p-test')
p('Store', 'Ablehnung KOMPLETT: Kennzahlen unverändert (kein halbes Increment)',
  [kz2.m2Fertig, kz2.wertFertigCent, kz2.aufgabenFertig], [84, 13860, 2])
p('Store', 'Ablehnung KOMPLETT: keine zusätzliche Buchung',
  (await store.list('buchungen')).filter((b) => b.id.startsWith('b-r')).length, 2)
// Auch eine TEILWEISE Überschneidung (1 neue + 1 schon gemeldete) muss ganz scheitern
const NEU = aufgabe('r5', 's1', { menge: 10, wertCent: 1650 })
await store.addMany('aufgaben', [NEU])
const gemischt = meldungBauen([NEU, START[0]], MONTEUR, '2026-08-08', { jetzt: 8000 })
p('Store', 'teilweise Überschneidung scheitert ebenfalls komplett',
  (await wirftAsync(() => store.meldeAufgaben(gemischt))) !== null, true)
p('Store', 'auch die NEUE Buchung wurde dabei nicht geschrieben',
  (await store.list('buchungen')).some((b) => b.id === 'b-r5-s1-auftrag'), false)

let abo = null
const abmelden = store.subscribeKennzahlen('p-test', (docKz) => { abo = docKz })
p('Store', 'subscribeKennzahlen liefert das live-Dokument', abo?.m2Fertig, 84)
abmelden()

// ---------------------------------------------------------------- Ausgabe
const kaputt = faelle.filter((f) => !f.ok)
for (const f of faelle) {
  if (!f.ok) {
    console.log(`FEHLT  [${f.bereich}] ${f.name}`)
    console.log(`       ist:  ${JSON.stringify(f.ist)}`)
    console.log(`       soll: ${JSON.stringify(f.soll)}`)
  }
}
console.log(`\n${faelle.length - kaputt.length} von ${faelle.length} Fällen bestanden.`)
if (kaputt.length) {
  console.log(`${kaputt.length} FEHLGESCHLAGEN – nicht ausliefern.`)
  process.exit(1)
}
