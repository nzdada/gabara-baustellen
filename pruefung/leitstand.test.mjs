// Prüfung des Leitstand-Kerns (shared/leitstand.js), der Stockungserkennung
// (shared/naechsterSchritt.js schritteLeitstand) und des allgemeinen
// Schreibvorgangs im lokalen Store-Modus (shared/store.js schreibeVorgang).
//
// Ausführen:  node pruefung/leitstand.test.mjs
// Endet mit Code 1, wenn ein Fall abweicht – damit taugt es als Bau-Vorstufe.
//
// Die Fälle sichern die AP-7-Zusagen aus dem Plan (Kapitel 3.2):
// - Schnellanlage meldet JEDE fehlerhafte Zeile mit Zeile, Feld und
//   Originalwert – nie still 0.
// - Zuweisung = 1 Einsatz + n Aufgaben-Patches, deterministische Kennung.
// - Zurückweisung = zurueck + Storno + Buchung WEG + Kennzahlen-Gegenbuchung.
// - EIN aggregiertes Kennzahlen-Increment je Vorgang.

import {
  wochenTage, einsatzTage, einsatzKennung, parseRaumliste, raumDokument,
  schnellanlageBauen, zuweisungBauen, zurueckweisungBauen, freigabeBauen,
  fotoAmpel,
} from '../shared/leitstand.js'
import { schritteLeitstand, DRINGEND, OFFEN } from '../shared/naechsterSchritt.js'
import { ZEICHEN, zeichenFuer } from '../shared/monteurtag.js'

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

// ---------------------------------------------------------------- Wochenachse
p('Woche', 'Mittwoch -> Montag derselben Woche', wochenTage('2026-08-12')[0], '2026-08-10')
p('Woche', 'fünf Werktage', wochenTage('2026-08-12').length, 5)
p('Woche', 'Freitag ist der letzte', wochenTage('2026-08-12')[4], '2026-08-14')
p('Woche', 'Samstag zeigt die KOMMENDE Woche', wochenTage('2026-08-15')[0], '2026-08-17')
p('Woche', 'Sonntag zeigt die KOMMENDE Woche', wochenTage('2026-08-16')[0], '2026-08-17')
p('Woche', 'Einsatz Do über 3 Werktage: Do, Fr, Mo (kein Wochenende)',
  einsatzTage('2026-08-13', 3), ['2026-08-13', '2026-08-14', '2026-08-17'])
p('Woche', 'Dauer 1 bleibt der eine Tag', einsatzTage('2026-08-10', 1), ['2026-08-10'])
p('Woche', 'Einsatz-Kennung deterministisch',
  einsatzKennung('AC 1', '2026-08-10', 'p-x'), 'e-AC_1-2026-08-10-p-x')

// ---------------------------------------------------------------- Schnellanlage
const PARSE = parseRaumliste('1.01 Flur 24\n1.02 Büro Groß 38,5 m²\n\nkaputt\n1.03 Bad abc\n1.01 Doppelt 9', {
  vorhandeneNummern: [],
})
p('Parse', 'zwei brauchbare Zeilen', PARSE.zeilen.length, 2)
p('Parse', 'Zeile 1 vollständig', PARSE.zeilen[0], { zeile: 1, nummer: '1.01', name: 'Flur', menge: 24 })
p('Parse', 'deutsches Komma + m²-Anhängsel', PARSE.zeilen[1].menge, 38.5)
p('Parse', 'mehrteiliger Name bleibt zusammen', PARSE.zeilen[1].name, 'Büro Groß')
p('Parse', 'DREI Fehler, keiner still verschluckt', PARSE.fehler.length, 3)
p('Parse', 'unlesbare Zeile: Zeile + Feld + Originalwert',
  PARSE.fehler[0], { zeile: 4, feld: 'zeile', wert: 'kaputt' })
p('Parse', 'Menge keine Zahl: Originalwert gemeldet',
  PARSE.fehler[1], { zeile: 5, feld: 'menge', wert: 'abc' })
p('Parse', 'doppelte Nummer gemeldet', PARSE.fehler[2], { zeile: 6, feld: 'nummer', wert: '1.01' })
p('Parse', 'vorhandene Nummern zählen als Duplikat',
  parseRaumliste('1.01 Flur 24', { vorhandeneNummern: ['1.01'] }).fehler[0].feld, 'nummer')

const PROJEKT = { id: 'p-lt', name: 'Testbau' }
const SCHRITT_GR = { id: 'as-gr', nameDe: 'Grundieren', nameAr: 'التأسيس', sort: 4, bezug: 'wanddecke' }
const SCHRITT_A1 = { id: 'as-a1', nameDe: '1. Anstrich', nameAr: 'الطلاء الأول', sort: 5, bezug: 'wanddecke' }
const POSITION = { id: 'lv-1', oz: '1.1', kurztext: 'Grundierung', einheit: 'm²', einheitspreis: 1.65 }

const ANLAGE = schnellanlageBauen({
  projekt: PROJEKT,
  zeilen: parseRaumliste('1.01 Flur 24\n1.02 Büro 38').zeilen,
  schritte: [SCHRITT_GR, SCHRITT_A1],
  positionenJeSchritt: { 'as-gr': POSITION },
  bereich: '1. OG',
  jetzt: 1000,
})
p('Anlage', '2 Räume, 4 Aufgaben', [ANLAGE.raeume.length, ANLAGE.aufgaben.length], [2, 4])
p('Anlage', 'Raum als geschätzt gesperrt', ANLAGE.raeume[0].aufmassStand, 'geschaetzt')
p('Anlage', 'Menge als ausdrückliche Vorgabe am Raum', ANLAGE.raeume[0].mengen.wanddecke, 24)
p('Anlage', 'wertCent eingefroren (24 × 165)',
  ANLAGE.aufgaben.find((a) => a.raumNummer === '1.01' && a.schrittId === 'as-gr').wertCent, 3960)
p('Anlage', 'EIN aggregiertes Increment: m2Gesamt über alle Aufgaben',
  ANLAGE.kennzahlen.deltas.m2Gesamt, 124)
p('Anlage', 'Aufgaben ohne Position gezählt (§ 2 Abs. 6)',
  ANLAGE.kennzahlen.deltas.aufgabenOhnePosition, 2)
p('Anlage', 'raeumeOhneVorher startet mit allen Räumen', ANLAGE.kennzahlen.deltas.raeumeOhneVorher, 2)
p('Anlage', 'ohne Baustelle abgelehnt',
  wirft(() => schnellanlageBauen({ zeilen: [{ nummer: '1', menge: 1 }], schritte: [SCHRITT_GR] })) !== null, true)
p('Anlage', 'ohne Schritt abgelehnt',
  wirft(() => schnellanlageBauen({ projekt: PROJEKT, zeilen: [{ nummer: '1', menge: 1 }], schritte: [] })) !== null, true)

// ---------------------------------------------------------------- Zuweisung
const KANDIDATEN = ANLAGE.aufgaben.map((a) => ({ ...a }))
KANDIDATEN[3].status = 'fertig' // eine ist schon fertig – darf NICHT zugewiesen werden
const ZUW = zuweisungBauen({
  projekt: PROJEKT,
  teamId: 'AC 1',
  teamName: 'AC 1',
  farbe: '#f97316',
  mitarbeiterIds: ['u1', 'u2'],
  tage: ['2026-08-10', '2026-08-11'],
  kandidaten: KANDIDATEN,
  jetzt: 2000,
})
p('Zuweisung', 'EIN Einsatz + 3 Patches (fertige bleiben draußen)',
  [ZUW.einsatz.id, ZUW.patches.length], ['e-AC_1-2026-08-10-p-lt', 3])
p('Zuweisung', 'offene Aufgabe wird zugewiesen', ZUW.patches[0].patch.status, 'zugewiesen')
p('Zuweisung', 'Patch trägt Team, Tage und Einsatz',
  [ZUW.patches[0].patch.teamId, ZUW.patches[0].patch.tage, ZUW.patches[0].patch.einsatzId],
  ['AC 1', ['2026-08-10', '2026-08-11'], 'e-AC_1-2026-08-10-p-lt'])
p('Zuweisung', 'Zusammenfassung: Anzahl + m² + Cent',
  ZUW.zusammenfassung, { anzahl: 3, m2: 86, wertCent: 10230 })
p('Zuweisung', 'ohne Tag abgelehnt',
  wirft(() => zuweisungBauen({ projekt: PROJEKT, teamId: 'AC 1', tage: [] })) !== null, true)

// ---------------------------------------------------------------- Zurückweisung
const FERTIG = {
  ...ANLAGE.aufgaben[0],
  status: 'fertig',
  wertCent: 3960,
  menge: 24,
  einheit: 'm²',
}
const RAUM_STAND = [FERTIG, { ...ANLAGE.aufgaben[1], raumId: FERTIG.raumId, status: 'fertig' }]
const RW = zurueckweisungBauen(FERTIG, RAUM_STAND, { grund: 'Decke fleckig', userId: 'buero', jetzt: 3000 })
p('Rückweg', 'Aufgabe -> zurueck mit Grund',
  [RW.patches[0].patch.status, RW.patches[0].patch.zurueckGrund], ['zurueck', 'Decke fleckig'])
p('Rückweg', 'Aufmaßzeile STORNIERT, nie gelöscht',
  [RW.patches[1].coll, RW.patches[1].patch.storniert], ['aufmasszeilen', true])
p('Rückweg', 'Buchung wird GELÖSCHT (Nachbesserung erneut meldbar)',
  RW.loesche[0], { coll: 'buchungen', id: `b-${FERTIG.raumId}-as-gr-auftrag` })
p('Rückweg', 'Kennzahlen-Gegenbuchung inkl. raeumeFertig',
  RW.kennzahlen.deltas,
  { aufgabenFertig: -1, aufgabenZurueck: 1, wertFertigCent: -3960, m2Fertig: -24, raeumeFertig: -1 })
p('Rückweg', 'ohne Grund abgelehnt',
  wirft(() => zurueckweisungBauen(FERTIG, [], { grund: '  ' })) !== null, true)
p('Rückweg', 'nur fertige Aufgaben zurückweisbar',
  wirft(() => zurueckweisungBauen({ ...FERTIG, status: 'offen' }, [], { grund: 'x' })) !== null, true)
p('Rückweg', 'Freigabe setzt nur den Vermerk',
  Object.keys(freigabeBauen(FERTIG, { userId: 'b', jetzt: 4000 }).patches[0].patch).sort(),
  ['freigegebenAm', 'freigegebenVon', 'geaendertAm'])
p('Rückweg', 'Freigabe nur für fertige',
  wirft(() => freigabeBauen({ ...FERTIG, status: 'offen' })) !== null, true)

// Das rote Zeichen beim Monteur: zurueck schlägt Kamera und offen.
p('Rückweg', 'ZEICHEN.zurueck existiert', typeof ZEICHEN.zurueck, 'string')
p('Rückweg', 'zeichenFuer: zurueck schlägt den Raumabschluss',
  zeichenFuer({ id: 'a1', projektId: 'p', raumId: 'r', status: 'zurueck' }, []), 'zurueck')

// ---------------------------------------------------------------- Fotoampel
p('Ampel', 'beide da -> ok', fotoAmpel({ auftragVorher: 1, auftragNachher: 2 }, 'auftrag'), 'ok')
p('Ampel', 'nur Vorher -> nachherFehlt', fotoAmpel({ auftragVorher: 1, auftragNachher: 0 }, 'auftrag'), 'nachherFehlt')
p('Ampel', 'nur Nachher -> vorherFehlt (der schlimmste Fall)',
  fotoAmpel({ auftragVorher: 0, auftragNachher: 1 }, 'auftrag'), 'vorherFehlt')
p('Ampel', 'nichts -> leer', fotoAmpel({}, 'auftrag'), 'leer')
p('Ampel', 'Regie liest die Regie-Zähler', fotoAmpel({ regieVorher: 1, regieNachher: 1 }, 'regie'), 'ok')

// ---------------------------------------------------------------- Stockungserkennung
const TEAMS = [
  { name: 'AC 1', farbe: '#f97316', mitglieder: [{ id: 'u1' }, { id: 'u2' }] },
  { name: 'AC 2', farbe: '#0ea5e9', mitglieder: [{ id: 'u3' }] },
]
const JETZT = Date.parse('2026-08-12T12:00:00')
const HAKT = schritteLeitstand({
  teams: TEAMS,
  einsaetzeHeute: [{ id: 'e1', teamId: 'AC 1', teamName: 'AC 1', mitarbeiterIds: ['u1'], status: 'geplant' }],
  regieanordnungen: [
    { id: 'ra1', projektId: 'p-lt', titel: 'Leibungen', status: 'ausgefuehrt', ausgefuehrtAm: JETZT - 4 * 86400000 },
    { id: 'ra2', projektId: 'p-lt', titel: 'Schon vorgelegt', status: 'vorgelegt', vorgelegtAm: JETZT },
  ],
  lvpositionen: [
    { id: 'lv1', projektId: 'p-lt', typ: 'position', oz: '4.2.3', menge: 1150, istMenge: 1284, einheit: 'm²' },
    { id: 'lv2', projektId: 'p-lt', typ: 'position', oz: '4.2.4', menge: 1000, istMenge: 500, einheit: 'm²' },
  ],
  projekte: [{ id: 'p-lt', name: 'Testbau', status: 'inArbeit' }],
  geraete: [{ id: 'u1', letzterKontaktAm: JETZT - 3 * 86400000, wartendeFotos: 18 }],
  kennzahlen: [{ id: 'p-lt', aufgabenOhnePosition: 2, raeumeOhneVorher: 6 }],
  users: [{ id: 'u1', name: 'Ahmad' }],
  jetzt: JETZT,
})
const ids = HAKT.map((h) => h.id)
p('Hakt', 'Kolonne ohne Einsatz erkannt (AC 2, nicht AC 1)',
  [ids.includes('kolonne-frei-AC 2'), ids.includes('kolonne-frei-AC 1')], [true, false])
p('Hakt', 'Stundenzettel-Vorlagefrist: 4 Tage -> DRINGEND',
  HAKT.find((h) => h.id === 'regie-vorlage-ra1')?.stufe, DRINGEND)
p('Hakt', 'vorgelegte Anordnung erscheint NICHT', ids.includes('regie-vorlage-ra2'), false)
p('Hakt', 'Mehrmenge +11,7 % über der 10-%-Schwelle gemeldet',
  ids.includes('abweichung-lv1'), true)
p('Hakt', 'Mindermenge mitten in der Arbeit ist KEIN Fund', ids.includes('abweichung-lv2'), false)
p('Hakt', 'Aufgaben ohne LV-Position (§ 2 Abs. 6)', ids.includes('ohne-position-p-lt'), true)
p('Hakt', 'Räume ohne Vorher-Foto -> Fotoampel',
  HAKT.find((h) => h.id === 'ohne-vorher-p-lt')?.ziel, '/fotoampel?projekt=p-lt')
p('Hakt', 'Geräte-Rückstand mit Namen aus users',
  HAKT.find((h) => h.id === 'geraet-u1')?.text.de.startsWith('Ahmad'), true)
p('Hakt', 'DRINGEND steht vor OFFEN',
  HAKT.every((h, i) => i === 0 || HAKT[i - 1].stufe <= h.stufe), true)
p('Hakt', 'jede Zeile zweisprachig',
  HAKT.every((h) => h.text?.de && h.text?.ar && (!h.detail || (h.detail.de && h.detail.ar))), true)

// ---------------------------------------------------------------- Store: schreibeVorgang
const store = erzeugeLokalenStoreFuerTest()
await store.resetDemo({ mitDemodaten: false })

await store.schreibeVorgang({
  sets: [
    ...ANLAGE.raeume.map((d) => ({ coll: 'raeume', daten: d })),
    ...ANLAGE.aufgaben.map((d) => ({ coll: 'aufgaben', daten: d })),
  ],
  kennzahlen: ANLAGE.kennzahlen,
})
p('Store', 'Schnellanlage: Räume + Aufgaben in EINEM Vorgang',
  [(await store.list('raeume')).length, (await store.list('aufgaben')).length], [2, 4])
p('Store', 'Kennzahlen-Increment angekommen',
  (await store.ladeKennzahlen('p-lt'))?.aufgabenGesamt, 4)

// Zuweisung: Einsatz + Patches – und ein zweiter Zug ERSETZT statt verdoppelt.
await store.schreibeVorgang({
  sets: [{ coll: 'einsaetze', daten: ZUW.einsatz }],
  patches: ZUW.patches,
})
await store.schreibeVorgang({
  sets: [{ coll: 'einsaetze', daten: { ...ZUW.einsatz, hinweis: 'zweiter Klick' } }],
  patches: ZUW.patches,
})
p('Store', 'Doppelklick auf ZUWEISEN verdoppelt nichts',
  (await store.list('einsaetze')).length, 1)
p('Store', 'Aufgabe trägt die Zuweisung',
  (await store.get('aufgaben', ZUW.patches[0].id))?.status, 'zugewiesen')

// Zurückweisung: Buchung verschwindet, Kennzahlen gegengebucht.
await store.add('buchungen', { id: `b-${FERTIG.raumId}-as-gr-auftrag`, projektId: 'p-lt' })
await store.update('aufgaben', FERTIG.id, { status: 'fertig' })
await store.schreibeVorgang(RW)
p('Store', 'Zurückweisung: Aufgabe rot beim Monteur',
  (await store.get('aufgaben', FERTIG.id))?.status, 'zurueck')
p('Store', 'Zurückweisung: Buchung ist weg',
  await store.get('buchungen', `b-${FERTIG.raumId}-as-gr-auftrag`), null)
p('Store', 'Zurückweisung: Kennzahlen gegengebucht',
  (await store.ladeKennzahlen('p-lt'))?.aufgabenZurueck, 1)

p('Store', 'leerer Vorgang schreibt nichts',
  (await store.schreibeVorgang({})).bestaetigt, false)
p('Store', 'über 450 Schreibvorgänge werden abgelehnt (Batch-Grenze)',
  (await wirftAsync(() => store.schreibeVorgang({
    sets: Array.from({ length: 451 }, (x, i) => ({ coll: 'raeume', daten: { id: `masse-${i}` } })),
  }))) !== null, true)
p('Store', 'unbekannte Sammlung wird abgelehnt',
  (await wirftAsync(() => store.schreibeVorgang({
    sets: [{ coll: 'gibtEsNicht', daten: { id: 'x' } }],
  }))) !== null, true)

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
