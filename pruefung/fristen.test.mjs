// Prüfung der Werktags-Fristen (shared/fristen.js), des Abnahme-Kerns
// (shared/abnahme.js) und der neuen Leitstand-Zeilen (AP 9).
//
// Ausführen:  node pruefung/fristen.test.mjs
// Endet mit Code 1, wenn ein Fall abweicht – damit taugt es als Bau-Vorstufe.
//
// Die Fälle sichern die Rechtsaussagen des Plans (Kapitel 6.3 und 7):
// - Samstag zählt als Werktag, Sonntag und bayerische Feiertage nicht.
// - Beide Plan-Beispiele der Anerkennungsuhr werden EXAKT reproduziert:
//   Zugang 12.08.2026 -> anerkannt seit 21.08.2026 (15.08. ist Feiertag),
//   Zugang 15.08.2026 -> anerkannt seit 24.08.2026 (Plan 7.2 wörtlich).
// - Teilabnahme: vollständige Räume rein, unvollständige namentlich raus.

import {
  feiertageBayern, istWerktagBayern, addWerktage, werktageZwischen,
  anerkanntAbIso, anerkennungsStand, abnahmeFristEnde, fiktiveAbnahmeAb,
  osterSonntag,
} from '../shared/fristen.js'
import {
  fotoPaar, bildQuelle, fotoBeleg, teilabnahme, abnahmePatches, abnahmeSeiten, grundText,
} from '../shared/abnahme.js'
import { schritteLeitstand, OFFEN, HINWEIS } from '../shared/naechsterSchritt.js'

const faelle = []
const p = (bereich, name, ist, soll) => {
  const gleich = JSON.stringify(ist) === JSON.stringify(soll)
  faelle.push({ bereich, name, ist, soll, ok: gleich })
}

// ---------------------------------------------------------------- Feiertage
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
p('Feiertage', 'Ostersonntag 2026 = 05.04.', iso(osterSonntag(2026)), '2026-04-05')
p('Feiertage', 'Karfreitag 2026', feiertageBayern(2026).has('2026-04-03'), true)
p('Feiertage', 'Ostermontag 2026', feiertageBayern(2026).has('2026-04-06'), true)
p('Feiertage', 'Christi Himmelfahrt 2026 (14.05.)', feiertageBayern(2026).has('2026-05-14'), true)
p('Feiertage', 'Pfingstmontag 2026 (25.05.)', feiertageBayern(2026).has('2026-05-25'), true)
p('Feiertage', 'Fronleichnam 2026 (04.06.)', feiertageBayern(2026).has('2026-06-04'), true)
p('Feiertage', 'Mariä Himmelfahrt ist bayerischer Feiertag', feiertageBayern(2026).has('2026-08-15'), true)
p('Feiertage', 'Augsburger Friedensfest (08.08.) bewusst NICHT', feiertageBayern(2026).has('2026-08-08'), false)

// ---------------------------------------------------------------- Werktage
p('Werktag', 'Samstag ZÄHLT als Werktag', istWerktagBayern('2026-08-22'), true)
p('Werktag', 'Sonntag zählt nicht', istWerktagBayern('2026-08-16'), false)
p('Werktag', 'Feiertags-Samstag zählt nicht (15.08.2026)', istWerktagBayern('2026-08-15'), false)
p('Werktag', 'normaler Montag zählt', istWerktagBayern('2026-08-17'), true)
p('Werktag', '6 Werktage ab Mi 12.08. = Do 20.08. (Sa 15.08. Feiertag, So raus)',
  addWerktage('2026-08-12', 6), '2026-08-20')
p('Werktag', 'werktageZwischen Fr 21.08. -> Mo 24.08. = 2 (Sa zählt, So nicht)',
  werktageZwischen('2026-08-21', '2026-08-24'), 2)
p('Werktag', 'werktageZwischen rückwärts = 0', werktageZwischen('2026-08-24', '2026-08-21'), 0)

// ---------------------------------------------------------------- Anerkennungsuhr
// Plan Kapitel 6.3: "Regie 12.08. gilt seit 21.08. als anerkannt"
p('Uhr', 'Plan-Beispiel 1: Zugang 12.08.2026 -> anerkannt seit 21.08.2026',
  anerkanntAbIso('2026-08-12'), '2026-08-21')
// Plan Kapitel 7.2: "Vorgelegt 15.08.2026 · anerkannt seit 24.08.2026"
p('Uhr', 'Plan-Beispiel 2: Zugang 15.08.2026 -> anerkannt seit 24.08.2026',
  anerkanntAbIso('2026-08-15'), '2026-08-24')
p('Uhr', 'ohne Zugang kein Datum', anerkanntAbIso(''), '')
p('Uhr', 'nicht vorgelegt -> offen',
  anerkennungsStand({ }, '2026-08-20').stand, 'offen')
p('Uhr', 'vorgelegt, Frist läuft',
  anerkennungsStand({ vorgelegtAm: '2026-08-12' }, '2026-08-20').stand, 'laeuft')
p('Uhr', 'vorgelegt, Frist um -> anerkannt',
  anerkennungsStand({ vorgelegtAm: '2026-08-12' }, '2026-08-21').stand, 'anerkannt')
p('Uhr', 'Widerspruch stoppt die Uhr',
  anerkennungsStand({ vorgelegtAm: '2026-08-12', widersprochenAm: '2026-08-18' }, '2026-08-25').stand, 'bestritten')
p('Uhr', 'eingefrorenes anerkanntAb gewinnt gegen Neuberechnung',
  anerkennungsStand({ vorgelegtAm: '2026-08-12', anerkanntAb: '2026-08-22' }, '2026-08-21').stand, 'laeuft')

// ---------------------------------------------------------------- Fiktive Abnahme
p('Abnahme', 'Fristende = 12 Werktage nach Anzeige (12.08. -> 27.08.)',
  abnahmeFristEnde('2026-08-12'), '2026-08-27')
p('Abnahme', 'gilt als erfolgt ab dem Werktag danach (28.08.)',
  fiktiveAbnahmeAb('2026-08-12'), '2026-08-28')

// ---------------------------------------------------------------- Teilabnahme
const raeume = [
  { id: 'r1', nummer: '1.01', name: 'Büro', fotoStand: { auftragVorher: 1, auftragNachher: 1 } },
  { id: 'r2', nummer: '1.02', name: 'Flur', fotoStand: { auftragVorher: 0, auftragNachher: 1 } },
  { id: 'r3', nummer: '1.03', name: 'Lager', fotoStand: { auftragVorher: 1, auftragNachher: 1 }, zustand: 'wartet', wartetGrund: 'zugestellt' },
  { id: 'r4', nummer: '1.04', name: 'Alt', fotoStand: { auftragVorher: 1, auftragNachher: 1 }, abnahmeAm: '2026-07-01' },
  { id: 'r5', nummer: '1.05', name: 'Aus', aktiv: false },
]
const auft = teilabnahme(raeume, [])
p('Teilabnahme', 'nur der vollständige Raum wird abgenommen', auft.abzunehmen.map((r) => r.id), ['r1'])
p('Teilabnahme', 'unvollständige namentlich mit Grund',
  auft.ausgenommen.map((a) => `${a.raum.id}:${a.gruende.join('+')}`),
  ['r2:vorherFehlt', 'r3:wartet:zugestellt'])
p('Teilabnahme', 'früher abgenommene bleiben nachrichtlich', auft.bereitsAbgenommen.map((r) => r.id), ['r4'])
p('Teilabnahme', 'inaktive Räume tauchen nirgends auf',
  [...auft.abzunehmen, ...auft.ausgenommen.map((a) => a.raum), ...auft.bereitsAbgenommen].some((r) => r.id === 'r5'), false)
p('Teilabnahme', 'wartende Aufgabe macht den Raum unvollständig',
  teilabnahme([{ id: 'x', fotoStand: { auftragVorher: 1, auftragNachher: 1 } }],
    [{ raumId: 'x', status: 'wartet', wartetGrund: 'estrichNass' }]).ausgenommen[0].gruende, ['wartet:estrichNass'])
p('Teilabnahme', 'Patches setzen abnahmeAm/Von/BerichtId je Raum',
  abnahmePatches(auft, { berichtId: 'AB-1', datum: '2026-08-19', von: 'Büro' }),
  [{ coll: 'raeume', id: 'r1', patch: { abnahmeAm: '2026-08-19', abnahmeVon: 'Büro', abnahmeBerichtId: 'AB-1' } }])
p('Teilabnahme', 'Grundtexte deutsch fürs Deckblatt', grundText('wartet:estrichNass'), 'wartet: Estrich nass')

// ---------------------------------------------------------------- Raumseiten
const fotos = [
  { id: 'f1', raumId: 'r1', kontext: 'auftrag', phase: 'vorher', rolle: 'fototafel', aufgenommenAm: 100, sha256: 'a3f19c4eabcdef', hochgeladenAm: 500, aufgenommenAmQuelle: 'exif' },
  { id: 'f2', raumId: 'r1', kontext: 'auftrag', phase: 'vorher', rolle: 'fototafel', aufgenommenAm: 200 },
  { id: 'f3', raumId: 'r1', kontext: 'auftrag', phase: 'nachher', rolle: 'fototafel', aufgenommenAm: 300 },
  { id: 'f4', raumId: 'r1', kontext: 'auftrag', phase: 'nachher', rolle: 'fototafel', aufgenommenAm: 400, aufgenommenAmQuelle: 'geraet' },
  { id: 'f5', raumId: 'r1', kontext: 'auftrag', phase: 'nachher', rolle: 'meldebeleg', aufgenommenAm: 999 },
  { id: 'f6', raumId: 'r1', kontext: 'regie', phase: 'vorher', rolle: 'meldebeleg', anordnungId: 'an1', aufgenommenAm: 150 },
]
const paar = fotoPaar(fotos, { raumId: 'r1', kontext: 'auftrag' })
p('Seiten', 'frühestes Vorher gewinnt', paar.vorher.id, 'f1')
p('Seiten', 'spätestes Nachher gewinnt', paar.nachher.id, 'f4')
p('Seiten', 'fremde Rollen (meldebeleg) bleiben draußen', paar.nachher.id === 'f5', false)
p('Seiten', 'Vorschau-Dokument pv-<id> liefert das Bild',
  bildQuelle({ id: 'f1' }, [{ id: 'pv-f1', dataUrl: 'data:x' }]), 'data:x')
p('Seiten', 'Beweiszeile: Quelle EXIF + kurze Prüfsumme',
  (() => { const b = fotoBeleg(fotos[0]); return `${b.quelle}|${b.pruefsumme}|${b.hochgeladenAm}` })(),
  'EXIF|a3f19c4e|500')
const seiten = abnahmeSeiten({
  raeume: [raeume[0]],
  aufgaben: [
    { raumId: 'r1', schrittNameDe: 'Grundieren', schrittSort: 4, menge: 46.2, einheit: 'm²', oz: '4.2.1', status: 'fertig', art: 'auftrag' },
    { raumId: 'r1', schrittNameDe: '1. Anstrich', schrittSort: 5, menge: 46.2, einheit: 'm²', oz: '4.2.2', status: 'offen', art: 'auftrag' },
  ],
  fotos,
  photos: [{ id: 'pv-f1', dataUrl: 'data:v' }, { id: 'pv-f4', dataUrl: 'data:n' }],
  anordnungen: [{ id: 'an1', titel: 'Altanstrich entfernen', angeordnetDurch: 'Hr. Weber', angeordnetAm: '2026-08-12', anzeigeArt: 'muendlich', vorgelegtAm: '2026-08-15', raumIds: [] }],
  stunden: [
    { anordnungId: 'an1', stundenGesamt: 4, storniert: false },
    { anordnungId: 'an1', stundenGesamt: 2.5 },
    { anordnungId: 'an1', stundenGesamt: 9, storniert: true },
  ],
})
p('Seiten', 'eine Seite je abzunehmendem Raum', seiten.seiten.length, 1)
p('Seiten', 'Auftragszeilen sortiert nach Schrittfolge',
  seiten.seiten[0].auftrag.zeilen.map((z) => z.schritt), ['Grundieren', '1. Anstrich'])
p('Seiten', 'Ausgeführt nennt nur fertige Schritte', seiten.seiten[0].auftrag.ausgefuehrt, 'Grundieren')
p('Seiten', 'Regieteil über anordnungId des Regiefotos gefunden',
  seiten.seiten[0].regie?.titel, 'Altanstrich entfernen')
p('Seiten', 'Regiestunden ohne Stornos summiert', seiten.seiten[0].regie?.stunden, 6.5)
p('Seiten', 'Anerkennungsdatum auf der Raumseite (Plan 7.2: 24.08.)',
  seiten.seiten[0].regie?.anerkanntAb, '2026-08-24')

// ---------------------------------------------------------------- Leitstand-Zeilen
const jetzt = new Date('2026-08-21T12:00:00').getTime()
const zeilen = schritteLeitstand({
  regieanordnungen: [
    { id: 'a1', projektId: 'p1', titel: 'Altanstrich', vorgelegtAm: '2026-08-12' },      // anerkannt seit 21.08.
    { id: 'a2', projektId: 'p1', titel: 'Spachteln', vorgelegtAm: '2026-08-18' },        // Frist läuft
    { id: 'a3', projektId: 'p1', titel: 'Bestritten', vorgelegtAm: '2026-08-12', widersprochenAm: '2026-08-14' },
  ],
  projekte: [
    { id: 'p1', name: 'Schule', status: 'inArbeit' },
    { id: 'p2', name: 'IGA', status: 'inArbeit', fertigAngezeigtAm: '2026-08-12' },      // Frist bis 27.08.
    { id: 'p3', name: 'Kita', status: 'inArbeit', fertigAngezeigtAm: '2026-07-01' },     // längst fiktiv abgenommen
  ],
  jetzt,
})
p('Leitstand', 'anerkannt-Zeile für a1, nicht für a2/a3',
  zeilen.filter((z) => z.id.startsWith('regie-anerkannt-')).map((z) => z.id), ['regie-anerkannt-a1'])
p('Leitstand', 'anerkannt-Zeile nennt das Datum',
  zeilen.find((z) => z.id === 'regie-anerkannt-a1').text.de.includes('21.08') ||
  zeilen.find((z) => z.id === 'regie-anerkannt-a1').text.de.includes('2026-08-21'), true)
p('Leitstand', 'Abnahmefrist-Zähler für p2 (OFFEN)',
  zeilen.find((z) => z.id === 'abnahme-frist-p2')?.stufe, OFFEN)
p('Leitstand', 'Zähler nennt Restwerktage bis 27.08. (5)',
  zeilen.find((z) => z.id === 'abnahme-frist-p2')?.text.de.includes('5 Werktag'), true)
p('Leitstand', 'fiktive Abnahme für p3 (HINWEIS)',
  zeilen.find((z) => z.id === 'abnahme-fiktiv-p3')?.stufe, HINWEIS)

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
