// Prüfung des Monteur-Tags (shared/monteurtag.js) – die Logik hinter dem
// HEUTE-Bildschirm, dem Zustand `wartet` und der Stunden-Kolonnenzeile.
//
// Ausführen:  node pruefung/monteurtag.test.mjs
// Endet mit Code 1, wenn ein Fall abweicht – damit taugt es als Bau-Vorstufe.

import {
  einsatzFuerTag, aufgabenZumEinsatz, istLetzterOffenerSchritt, zeichenFuer,
  vorherFehlt, tagesgruppen, summeM2, laeuftBauen, wartetBauen, weiterBauen,
  stundenId, minutenVon, zeitText, stundenAus, taetigkeitAusAufgaben,
  stundenZeile, isoVonMs,
} from '../shared/monteurtag.js'

const faelle = []
const p = (bereich, name, ist, soll) => {
  const gleich = JSON.stringify(ist) === JSON.stringify(soll)
  faelle.push({ bereich, name, ist, soll, ok: gleich })
}

// Fester Tag, feste Uhrzeit (10:12 lokal) – kein Test hängt an der Wanduhr.
const TAG = '2026-08-12'
const MS = new Date(`${TAG}T10:12:00`).getTime()

// ---------------------------------------------------------------- Einsatz des Tages
const AHMAD = { userId: 'u-ahmad', name: 'Ahmad', rolle: 'mitarbeiter' }
const EINSAETZE = [
  { id: 'e1', projektId: 'p1', teamId: 'ac1', mitarbeiterIds: ['u-ahmad'], tage: [TAG, '2026-08-13'], von: '07:00', status: 'geplant' },
  { id: 'e2', projektId: 'p2', teamId: 'ac2', mitarbeiterIds: ['u-samir'], tage: [TAG], von: '06:30', status: 'geplant' },
  { id: 'e3', projektId: 'p3', teamId: 'ac1', mitarbeiterIds: ['u-ahmad'], tage: ['2026-08-14'], von: '07:00', status: 'geplant' },
  { id: 'e4', projektId: 'p4', teamId: 'ac3', mitarbeiterIds: ['u-ahmad'], tage: [TAG], von: '07:00', status: 'abgesagt' },
]
p('Einsatz', 'eigener Einsatz des Tages gewinnt', einsatzFuerTag(EINSAETZE, AHMAD, TAG)?.id, 'e1')
p('Einsatz', 'fremder Tag zählt nicht', einsatzFuerTag(EINSAETZE, AHMAD, '2026-08-20'), null)
p('Einsatz', 'abgesagt zählt nie', einsatzFuerTag([EINSAETZE[3]], AHMAD, TAG), null)
p('Einsatz', 'Büro-Vorschau sieht den frühesten fremden', einsatzFuerTag(EINSAETZE, { userId: 'u-buero' }, TAG, { alleSehen: true })?.id, 'e2')
p('Einsatz', 'Monteur sieht fremde NICHT', einsatzFuerTag([EINSAETZE[1]], AHMAD, TAG), null)

// ---------------------------------------------------------------- Aufgaben zum Einsatz
const auf = (id, raumId, schrittId, felder = {}) => ({
  id, projektId: 'p1', raumId, raumNummer: felder.raumNummer || raumId, raumName: '',
  schrittId, schrittNameDe: felder.nameDe || schrittId, schrittNameAr: felder.nameAr || '', schrittSort: felder.sort || 1,
  menge: 46, einheit: 'm²', status: 'zugewiesen', teamId: 'ac1', tage: [TAG], einsatzId: 'e1',
  fertigAm: null, ...felder,
})
const A = [
  auf('a1', 'r1', 's1', { sort: 1, nameDe: 'Grundieren', nameAr: 'التأسيس', raumNummer: '1.01' }),
  auf('a2', 'r1', 's2', { sort: 2, nameDe: '2. Anstrich', raumNummer: '1.01' }),
  auf('a3', 'r2', 's1', { sort: 1, nameDe: 'Grundieren', status: 'laeuft', raumNummer: '1.02' }),
  auf('a4', 'r3', 's1', { sort: 1, nameDe: 'Grundieren', status: 'fertig', fertigAm: MS, raumNummer: '1.03' }),
  auf('a5', 'r4', 's1', { sort: 1, nameDe: 'Grundieren', status: 'wartet', wartetGrund: 'zugestellt', raumNummer: '1.04' }),
  // r5: Grundieren fertig (gestern), 2. Anstrich offen -> letzter Schritt = Kamera
  auf('a6', 'r5', 's1', { sort: 1, nameDe: 'Grundieren', status: 'fertig', fertigAm: MS - 86400000, raumNummer: '1.05' }),
  auf('a7', 'r5', 's2', { sort: 2, nameDe: '2. Anstrich', raumNummer: '1.05' }),
  // gehört NICHT zum Einsatz (anderes Team, kein einsatzId)
  auf('a8', 'r9', 's1', { teamId: 'ac2', einsatzId: '' }),
]
const EINSATZ = EINSAETZE[0]
p('Zuordnung', 'einsatzId ODER teamId+tage', aufgabenZumEinsatz(A, EINSATZ, TAG).map((x) => x.id),
  ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'])
p('Zuordnung', 'ohne Einsatz leer', aufgabenZumEinsatz(A, null, TAG), [])

// ---------------------------------------------------------------- Zeichen
p('Zeichen', 'offen -> ☐', zeichenFuer(A[0], A), 'offen')
p('Zeichen', 'läuft (nicht letzter Schritt) -> ▸', zeichenFuer({ ...A[0], status: 'laeuft' }, A), 'laeuft')
p('Zeichen', 'fertig -> ✓', zeichenFuer(A[3], A), 'fertig')
p('Zeichen', 'wartet -> ⏸', zeichenFuer(A[4], A), 'wartet')
p('Zeichen', 'letzter offener Schritt -> 📷', zeichenFuer(A[6], A), 'kamera')
p('Zeichen', 'nicht letzter (r1 hat noch s2) -> kein 📷', istLetzterOffenerSchritt(A[0], A), false)
p('Zeichen', 'einziger Schritt des Raums ist auch der letzte', istLetzterOffenerSchritt(A[2], A), true)

const RAEUME = [
  { id: 'r1', fotoStand: { auftragVorher: 0 } },
  { id: 'r2', fotoStand: { auftragVorher: 2 } },
]
p('Zeichen', '⚠ Vorher fehlt bei 0 Bildern', vorherFehlt(A[0], RAEUME), true)
p('Zeichen', 'kein ⚠ bei vorhandenem Vorher', vorherFehlt(A[2], RAEUME), false)
p('Zeichen', 'kein ⚠ ohne fotoStand (Altdaten)', vorherFehlt(A[4], RAEUME), false)

// ---------------------------------------------------------------- Tagesgruppen
const gruppen = tagesgruppen(aufgabenZumEinsatz(A, EINSATZ, TAG), A, RAEUME, TAG)
p('Gruppen', 'zwei Schritte, nach sort', gruppen.map((g) => g.nameDe), ['Grundieren', '2. Anstrich'])
p('Gruppen', 'Grundieren: 3 offene (fertig zählt nicht als offen)', gruppen[0].offen, 3)
p('Gruppen', 'heute fertig bleibt sichtbar', gruppen[0].zeilen.some((z) => z.aufgabe.id === 'a4'), true)
p('Gruppen', 'GESTERN fertig verschwindet', gruppen[0].zeilen.some((z) => z.aufgabe.id === 'a6'), false)
p('Gruppen', 'Zeilen nach Raumnummer', gruppen[0].zeilen.map((z) => z.aufgabe.id), ['a1', 'a3', 'a4', 'a5'])
p('Gruppen', 'Kamera-Zeile im 2. Anstrich', gruppen[1].zeilen.find((z) => z.aufgabe.id === 'a7')?.zeichen, 'kamera')
p('Gruppen', 'isoVonMs rechnet lokal', isoVonMs(MS), TAG)

p('Summe', 'm² nur aus m²-Aufgaben', summeM2([A[0], { ...A[1], einheit: 'Stk', menge: 3 }]), 46)

// ---------------------------------------------------------------- Zustandsschaltungen
const anfang = laeuftBauen(A[0], { jetzt: 111 })
p('Läuft', '1 Patch, status laeuft', anfang.aufgaben, [{ id: 'a1', patch: { status: 'laeuft', geaendertAm: 111 } }])
p('Läuft', 'EIN Increment +1 laeuft', anfang.kennzahlen.deltas, { aufgabenLaeuft: 1 })
p('Läuft', 'Teilanteil in Zehnteln begrenzt', laeuftBauen(A[0], { anteil: 0.97, jetzt: 1 }).aufgaben[0].patch.anteil, 0.9)
p('Läuft', 'aus wartet: Gegenbuchung', laeuftBauen(A[4], { jetzt: 1 }).kennzahlen.deltas, { aufgabenWartet: -1, aufgabenLaeuft: 1 })
p('Läuft', 'fertig lässt sich nicht anfangen', laeuftBauen(A[3], { jetzt: 1 }), null)

const r1Aufgaben = A.filter((x) => x.raumId === 'r1')
const w = wartetBauen(r1Aufgaben, { grund: 'zugestellt', bis: '2026-08-18', jetzt: 222 })
p('Wartet', 'beide offenen Schritte des Raums', w.aufgaben.map((u) => u.id), ['a1', 'a2'])
p('Wartet', 'Grund + Wiedervorlage im Patch', w.aufgaben[0].patch,
  { status: 'wartet', wartetGrund: 'zugestellt', wartetBis: '2026-08-18', geaendertAm: 222 })
p('Wartet', 'EIN aggregiertes Increment (+2)', w.kennzahlen.deltas, { aufgabenWartet: 2 })
p('Wartet', 'ohne Grund keine Schaltung', wartetBauen(r1Aufgaben, { jetzt: 1 }), null)
const weiter = weiterBauen([{ ...A[4] }], { jetzt: 333 })
p('Wartet', 'weiter -> zugewiesen (Zuweisung existiert)', weiter.aufgaben[0].patch.status, 'zugewiesen')
p('Wartet', 'weiter räumt Grund und Zähler', weiter.kennzahlen.deltas, { aufgabenWartet: -1 })
p('Wartet', 'weiter ohne Zuweisung -> offen',
  weiterBauen([{ ...A[4], einsatzId: '', teamId: '' }], { jetzt: 1 }).aufgaben[0].patch.status, 'offen')

// ---------------------------------------------------------------- Stunden
p('Stunden', 'deterministische Kennung', stundenId('u-ahmad', TAG, 'p1', 'auftrag'), `std-u-ahmad-${TAG}-p1-auftrag`)
p('Stunden', 'Minuten aus Uhrzeit', minutenVon('07:30'), 450)
p('Stunden', 'Uhrzeit aus Minuten', zeitText(450), '07:30')
p('Stunden', '07:00–16:00, 30 Min Pause = 8,5 h', stundenAus('07:00', '16:00', 30), 8.5)
p('Stunden', 'negative Zeit wird 0', stundenAus('16:00', '07:00', 30), 0)
p('Stunden', 'krumme Minuten runden auf 2 Stellen', stundenAus('07:00', '15:20', 0), 8.33)

const taetigkeit = taetigkeitAusAufgaben(A, TAG)
p('Stunden', 'Tätigkeit nach § 15 Abs. 3 aus heutigen Schritten',
  taetigkeit, 'Grundieren: Räume 1.02, 1.03')
p('Stunden', 'ohne heutige Meldungen leer', taetigkeitAusAufgaben([A[0]], TAG), '')

const zeile = stundenZeile({
  mitglied: { id: 'u-ahmad', name: 'Ahmad', qualifikation: 'facharbeiter', stundensatzIntern: 28 },
  datum: TAG, projektId: 'p1', einsatzId: 'e1', teamId: 'ac1',
  von: '07:00', bis: '16:00', pauseMin: 30, art: 'auftrag',
  taetigkeit, geaendertVon: 'Walid', jetzt: 444,
})
p('Stunden', 'Zeile: Kennung + set()-tauglich', zeile.id, `std-u-ahmad-${TAG}-p1-auftrag`)
p('Stunden', 'satzCent als GANZZAHL-Schnappschuss', zeile.satzCent, 2800)
p('Stunden', 'stundenGesamt gerechnet', zeile.stundenGesamt, 8.5)
p('Stunden', 'zuletzt geändert sichtbar', [zeile.zuletztGeaendertVon, zeile.zuletztGeaendertAm], ['Walid', 444])
p('Stunden', 'Status startet als erfasst', zeile.status, 'erfasst')

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
