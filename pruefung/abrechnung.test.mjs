// Prüfung des Abrechnungs-Kerns (shared/abrechnung.js) – AP 8.
//
// Ausführen:  node pruefung/abrechnung.test.mjs
// Endet mit Code 1, wenn ein Fall abweicht.
//
// Die Fälle sichern die Plan-Zusagen aus Kapitel 8:
// - "Alle bestätigen" erfasst NUR gemessene Zeilen unter 10 % Abweichung (8.3).
// - Geschätzte Zeilen bleiben einzeln und verlangen gemessenVon/gemessenAm.
// - Rechnungslauf: Etappen zu 400, Wiederaufnahme überspringt Markiertes,
//   Rechnung ERST wenn offen == 0 (8.7).
// - Steuer-Schnappschuss wird KOPIERT (8.8), Einbehalt mit Fälligkeit (8.9),
//   Storno bucht zurück statt zu löschen.

import {
  positionsUebersicht, alleBestaetigenBauen, zeileNachmessenBauen,
  zeilenFuerRechnung, rechnungslaufAnlegen, naechsteEtappe, rechnungAusLauf,
  steuerSchnappschuss, einbehaltBauen, stornoBauen, addMonate,
  aufgabenOhneAnkuendigung, ankuendigungBauen, ETAPPEN_GROESSE,
} from '../shared/abrechnung.js'

const faelle = []
const p = (bereich, name, ist, soll) => {
  const gleich = JSON.stringify(ist) === JSON.stringify(soll)
  faelle.push({ bereich, name, ist, soll, ok: gleich })
}
const wirft = (fn) => {
  try { fn(); return null } catch (e) { return e.message }
}

// ---------------------------------------------------------------- Baukasten
const JETZT = new Date('2026-08-08T10:00:00').getTime()

function zeile(id, felder = {}) {
  return {
    id, projektId: 'p-t', positionId: 'pos-1', oz: '1.1', kurztext: 'Grundieren',
    einheit: 'm²', raumId: 'r-1', raumName: '1.01 Flur', bauteil: '1.01 Flur',
    ansatz: '46', faktor: 1, menge: 46, art: 'haupt', regelwerk: 'vob18363',
    geschaetzt: false, quelle: 'aufgabe', aufgabeId: 'a-1',
    erfasstAm: JETZT, erfasstVon: 'u-1', storniert: false, abgerechnetIn: '',
    ...felder,
  }
}

const POSITIONEN = [
  { id: 'pos-1', projektId: 'p-t', typ: 'position', oz: '1.1', kurztext: 'Grundieren', einheit: 'm²', menge: 100, einheitspreis: 2.05 },
  { id: 'pos-2', projektId: 'p-t', typ: 'position', oz: '2.1', kurztext: 'Anstrich', einheit: 'm²', menge: 100, einheitspreis: 1.95 },
]

// ---------------------------------------------------------------- Übersicht
{
  const zeilen = [
    zeile('z-1', { menge: 60 }),
    zeile('z-2', { menge: 55, abgerechnetIn: 'r-alt' }),
    zeile('z-3', { menge: 10, storniert: true }),           // zählt NIRGENDS
    zeile('z-4', { positionId: 'pos-2', menge: 90, geschaetzt: true }),
    zeile('z-5', { positionId: '', oz: '', kurztext: 'Leibung', menge: 3 }),
  ]
  const u = positionsUebersicht({ zeilen, positionen: POSITIONEN })
  const pos1 = u.find((g) => g.positionId === 'pos-1')
  const pos2 = u.find((g) => g.positionId === 'pos-2')
  const ohne = u.find((g) => g.positionId === '')
  p('Übersicht', 'Aufmaß summiert ohne stornierte', pos1.aufmass, 115)
  p('Übersicht', 'Abgerechnet nur markierte', pos1.abgerechnet, 55)
  p('Übersicht', 'Abweichung +15 % erkannt (§ 2 Abs. 3)', pos1.abweichung.ueberSchwelle, true)
  p('Übersicht', 'unter 10 % keine Schwelle', pos2.abweichung.ueberSchwelle, false)
  p('Übersicht', 'geschätzte gezählt', pos2.geschaetztAnzahl, 1)
  p('Übersicht', 'ohne Position eigene Gruppe', ohne.aufmass, 3)

  // ------------------------------------------------------------ Bestätigen
  const b = alleBestaetigenBauen({ zeilen, positionen: POSITIONEN, userId: 'u-b', jetzt: JETZT })
  // z-1 wäre bestätigbar, liegt aber in pos-1 mit +15 % → ausgenommen.
  // z-4 geschätzt → gesperrt. z-5 (ohne Position, keine Vertragsmenge) → ok.
  p('Bestätigen', 'nur Zeilen unter der Schwelle', b.patches.map((x) => x.id), ['z-5'])
  p('Bestätigen', 'geschätzte übersprungen', b.uebersprungenGeschaetzt, 1)
  p('Bestätigen', 'über Schwelle ausgenommen', b.uebersprungenAbweichung, 1)
  p('Bestätigen', 'Patch trägt Wer und Wann', b.patches[0].patch.bestaetigtVon, 'u-b')
}

// ---------------------------------------------------------------- Nachmessen
p('Nachmessen', 'ohne gemessenVon abgelehnt',
  wirft(() => zeileNachmessenBauen(zeile('z-g', { geschaetzt: true }), { menge: 40, gemessenAm: '2026-08-08' })) !== null, true)
p('Nachmessen', 'ohne gemessenAm abgelehnt',
  wirft(() => zeileNachmessenBauen(zeile('z-g', { geschaetzt: true }), { menge: 40, gemessenVon: 'Walid' })) !== null, true)
p('Nachmessen', 'abgerechnete Zeile abgelehnt',
  wirft(() => zeileNachmessenBauen(zeile('z-g', { abgerechnetIn: 'r-1' }), { menge: 40, gemessenVon: 'W', gemessenAm: '2026-08-08' })) !== null, true)
{
  const patch = zeileNachmessenBauen(zeile('z-g', { geschaetzt: true, menge: 36.68 }), {
    menge: '47,16', ansatz: '18,00 × 2,62', gemessenVon: 'Walid', gemessenAm: '2026-08-08', userId: 'u-b', jetzt: JETZT,
  })
  p('Nachmessen', 'Komma-Menge über parseZahl', patch.patch.menge, 47.16)
  p('Nachmessen', 'Sperre fällt', patch.patch.geschaetzt, false)
  p('Nachmessen', 'gleich bestätigt', patch.patch.bestaetigtAm, JETZT)
}

// ---------------------------------------------------------------- Rechnungslauf
{
  // 950 bestätigte Zeilen → 3 Etappen (400 + 400 + 150), Rechnung erst am Ende.
  const viele = Array.from({ length: 950 }, (x, i) => zeile(`m-${i}`, { menge: 1, bestaetigtAm: JETZT }))
  const { frei, gesperrt } = zeilenFuerRechnung([
    ...viele,
    zeile('gesch', { geschaetzt: true }),
    zeile('unbest', {}),
    zeile('ohnepos', { positionId: '', bestaetigtAm: JETZT }),
  ])
  p('Lauf', 'nur bestätigte mit Position sind frei', frei.length, 950)
  p('Lauf', 'gesperrt gezählt', [gesperrt.geschaetzt, gesperrt.unbestaetigt, gesperrt.ohnePosition], [1, 1, 1])

  const lauf = rechnungslaufAnlegen({ projektId: 'p-t', zeilen: frei, laufId: 'lauf-1', rechnungId: 'r-neu', jetzt: JETZT })
  p('Lauf', 'startet mit allen offen', lauf.offen.length, 950)

  let stand = [...viele]
  const e1 = naechsteEtappe(lauf, stand, { jetzt: JETZT })
  p('Lauf', 'Etappe 1 höchstens 400', e1.patches.length, ETAPPEN_GROESSE)
  p('Lauf', 'nach Etappe 1 nicht fertig', e1.fertig, false)

  // Etappe 1 „geschrieben“ – dann ABBRUCH und Wiederaufnahme auf dem echten Stand:
  const markiert1 = new Set(e1.patches.map((x) => x.id))
  stand = stand.map((z) => (markiert1.has(z.id) ? { ...z, abgerechnetIn: 'r-neu' } : z))
  const e2 = naechsteEtappe(lauf, stand, { jetzt: JETZT })
  p('Lauf', 'Wiederaufnahme überspringt Markiertes', e2.patches.some((x) => markiert1.has(x.id)), false)
  const markiert2 = new Set(e2.patches.map((x) => x.id))
  stand = stand.map((z) => (markiert2.has(z.id) ? { ...z, abgerechnetIn: 'r-neu' } : z))
  const e3 = naechsteEtappe(lauf, stand, { jetzt: JETZT })
  p('Lauf', 'Etappe 3 = Rest', e3.patches.length, 150)
  p('Lauf', 'danach offen == 0', e3.fertig, true)

  const markiert3 = new Set(e3.patches.map((x) => x.id))
  stand = stand.map((z) => (markiert3.has(z.id) ? { ...z, abgerechnetIn: 'r-neu' } : z))
  const { rechnung, kennzahlen } = rechnungAusLauf({
    lauf, zeilen: stand, positionen: POSITIONEN, projekt: { id: 'p-t', name: 'Test', abrechnungsregel: 'vob18363' },
    kunde: { id: 'k-1', ustModus: '13b', typ: 'gu' }, einbehaltProzent: 10, jetzt: JETZT,
  })
  p('Rechnung', '950 × 1 m² × 2,05 €', rechnung.netto, 1947.5)
  p('Rechnung', '13b: keine USt', [rechnung.ustModus, rechnung.ustBetrag, rechnung.brutto], ['13b', 0, 1947.5])
  p('Rechnung', '13b-Text kopiert, nie nachgeschlagen', rechnung.rechtstext13b.includes('§ 13b'), true)
  p('Rechnung', 'Einbehalt 10 %', rechnung.einbehaltBetrag, 194.75)
  p('Rechnung', 'Zahlbetrag', rechnung.zahlbetrag, 1752.75)
  p('Rechnung', 'Kennzahl in CENT als Ganzzahl', kennzahlen.deltas.abgerechnetCent, 194750)

  const einbehalt = einbehaltBauen({ rechnung, kunde: { typ: 'gu' }, jetzt: JETZT })
  p('Einbehalt', 'GU: fällig nach 48 Monaten', einbehalt.faelligAm, '2030-08-08')
  const einbehaltPrivat = einbehaltBauen({ rechnung, kunde: { typ: 'privat' }, abnahmeAm: '2026-01-31', jetzt: JETZT })
  p('Einbehalt', 'privat: 60 Monate ab Abnahme, Monatsende gedeckelt', einbehaltPrivat.faelligAm, '2031-01-31')
  p('Einbehalt', 'ohne Prozent kein Dokument',
    einbehaltBauen({ rechnung: { ...rechnung, einbehaltProzent: 0, einbehaltBetrag: 0 } }), null)

  // ------------------------------------------------------------ Storno
  const st = stornoBauen({ rechnung, zeilen: stand, userId: 'u-b', jetzt: JETZT })
  p('Storno', 'alle markierten in Etappen', st.etappen.reduce((s, e) => s + e.length, 0), 950)
  p('Storno', 'Etappen unter der Batch-Grenze', st.etappen.every((e) => e.length <= ETAPPEN_GROESSE), true)
  p('Storno', 'Marker wird GELEERT, nicht gelöscht', st.etappen[0][0].patch.abgerechnetIn, '')
  // Spiegelbildliche Reihenfolge: Rechnung ZUERST auf storniert – ein Abbruch
  // zwischen den Schritten darf nie doppelt abrechenbare Zeilen hinterlassen.
  p('Storno', 'Rechnung wird ZUERST storniert (sperrt Wieder-Fakturierung), nie entfernt',
    st.start.patches[0].patch.status, 'storniert')
  p('Storno', 'Start setzt den Storno auf UNABGESCHLOSSEN (Fortsetzen-Erkennung)',
    st.start.patches[0].patch.stornoAbgeschlossenAm, 0)
  p('Storno', 'Abschluss-Vermerk erst am Ende', st.abschluss.patches[0].patch.stornoAbgeschlossenAm, JETZT)
  p('Storno', 'Kennzahl zurückgezogen', st.abschluss.kennzahlen.deltas.abgerechnetCent, -194750)
}

// ---------------------------------------------------------------- Steuer
p('Steuer', 'ust19: 19 % gerechnet', steuerSchnappschuss({ kunde: { ustModus: 'ust19' }, netto: 100 }).ustBetrag, 19)
p('Steuer', 'ust19: kein 13b-Text', steuerSchnappschuss({ kunde: { ustModus: 'ust19' }, netto: 100 }).rechtstext13b, '')
// Bei Geld wird nicht geraten: ohne Kunden/ustModus KEINE stille 13b-Vorgabe
// (gegenüber einem Privatkunden wäre das falsch ausgewiesene Steuer).
p('Steuer', 'ohne Kunde wird VERWEIGERT', wirft(() => steuerSchnappschuss({ netto: 100 })) !== null, true)
p('Steuer', 'Kunde ohne ustModus wird VERWEIGERT',
  wirft(() => steuerSchnappschuss({ kunde: { id: 'k-x' }, netto: 100 })) !== null, true)

// ---------------------------------------------------------------- Monate
p('Datum', '31.01. + 1 Monat deckelt auf Monatsletzten', addMonate('2026-01-31', 1), '2026-02-28')
p('Datum', 'Schaltjahr', addMonate('2028-01-31', 1), '2028-02-29')

// ---------------------------------------------------------------- § 2 Abs. 6
{
  const aufgaben = [
    { id: 'a-1', projektId: 'p-t', positionId: '', status: 'offen', raumNummer: '1.01', schrittNameDe: 'Leibung' },
    { id: 'a-2', projektId: 'p-t', positionId: 'pos-1', status: 'offen' },
    { id: 'a-3', projektId: 'p-t', positionId: '', status: 'offen', nachtragAngekuendigtAm: JETZT },
  ]
  p('§2(6)', 'nur ohne Position und ohne Vermerk', aufgabenOhneAnkuendigung(aufgaben).map((a) => a.id), ['a-1'])
  const v = ankuendigungBauen(aufgaben, { projektId: 'p-t', userId: 'u-b', jetzt: JETZT })
  p('§2(6)', 'Vermerk je Aufgabe', v.patches[0].patch.nachtragAngekuendigtAm, JETZT)
  p('§2(6)', 'Zähler-Gegenbuchung', v.kennzahlen.deltas.aufgabenOhnePosition, -1)
  p('§2(6)', 'nichts anzukündigen wirft',
    wirft(() => ankuendigungBauen([{ id: 'x', projektId: 'p-t', positionId: 'pos-1', status: 'offen' }], { projektId: 'p-t' })) !== null, true)
}

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
