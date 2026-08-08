// Prüfung des Aufmaß-Kerns (shared/aufmass.js).
//
// Ausführen:  node pruefung/aufmass.test.mjs
// Endet mit Code 1, wenn ein Fall abweicht – damit taugt es als Bau-Vorstufe.
//
// Jeder Fall prüft einen ERWARTETEN WERT. Die Beispiele aus dem V2-Entwurf
// (Kapitel 8.1) stehen hier vollständig als Testfälle: Wer an der Flächen-
// rechnung dreht, dreht an Geld – und soll es sofort merken.

import {
  REGELWERKE, regelwerkVon, zahlText,
  oeffnungsFlaeche, abzugFuerOeffnung, leibungsFlaeche,
  abrechnungsHoehe, raumAufmass, mengenAbweichung,
  TUER_BREITE_STD, TUER_HOEHE_STD,
} from '../shared/aufmass.js'

const faelle = []
const p = (bereich, name, ist, soll) => {
  const gleich = JSON.stringify(ist) === JSON.stringify(soll)
  faelle.push({ bereich, name, ist, soll, ok: gleich })
}

const VOB = REGELWERKE.vob18363
const VERTRAG = REGELWERKE.vertragAbzugAlle
const PAUSCHAL = REGELWERKE.pauschal

// ---------------------------------------------------------------- Regelwerke
p('Regelwerk', 'vob18363 vorhanden', regelwerkVon('vob18363')?.id, 'vob18363')
p('Regelwerk', 'unbekannte Kennung → null (nie raten)', regelwerkVon('gibtEsNicht'), null)
p('Regelwerk', 'leere Kennung → null', regelwerkVon(''), null)
p('Regelwerk', 'VOB-Schwelle 2,50 m²', VOB.uebermessenBisM2, 2.5)
p('Regelwerk', 'VOB rechnet Rohbaumaß', VOB.hoeheRohbau, true)
p('Regelwerk', 'VOB Leibungen gesondert', VOB.leibungenGesondert, true)
p('Regelwerk', 'Vertragsvariante zieht alles ab', VERTRAG.uebermessenBisM2, 0)
p('Regelwerk', 'Pauschal: kein Aufmaß', PAUSCHAL.aufmass, false)

// ---------------------------------------------------------------- Zahltext
p('Zahltext', '18,2 → "18,20"', zahlText(18.2), '18,20')
p('Zahltext', '2,62 → "2,62"', zahlText(2.62), '2,62')
p('Zahltext', '4,905 behält drei Stellen', zahlText(4.905), '4,905')
p('Zahltext', '0 → "0,00"', zahlText(0), '0,00')

// ---------------------------------------------------------------- Öffnungen
const TUER = { art: 'tuer', breite: 0.885, hoehe: 2.01 }
const FENSTER = { art: 'fenster', breite: 1.2, hoehe: 1.3 }

p('Öffnung', 'Standardtür 0,885×2,01 = 1,779 m²', oeffnungsFlaeche(TUER), 1.779)
p('Öffnung', 'Standardfenster 1,20×1,30 = 1,56 m²', oeffnungsFlaeche(FENSTER), 1.56)
p('Öffnung', 'Tür ohne Maße nimmt Standard', oeffnungsFlaeche({ art: 'tuer' }), 1.779)
p('Öffnung', 'Standardmaße stimmen', TUER_BREITE_STD * TUER_HOEHE_STD > 1.7, true)

// Die Kernregel: unter 2,50 m² wird übermessen, darüber abgezogen.
p('Abzug', 'Tür 1,78 m² wird ÜBERMESSEN (Abzug 0)', abzugFuerOeffnung(TUER, VOB).abzug, 0)
p('Abzug', 'Tür 1,78 m² ist als übermessen markiert', abzugFuerOeffnung(TUER, VOB).uebermessen, true)
p('Abzug', 'Fenster 1,56 m² wird übermessen', abzugFuerOeffnung(FENSTER, VOB).abzug, 0)
p('Abzug', 'Öffnung 2,40 m² (2,00×1,20) wird übermessen',
  abzugFuerOeffnung({ art: 'fenster', breite: 2.0, hoehe: 1.2 }, VOB).abzug, 0)
p('Abzug', 'Öffnung 2,60 m² (2,00×1,30) wird ABGEZOGEN',
  abzugFuerOeffnung({ art: 'fenster', breite: 2.0, hoehe: 1.3 }, VOB).abzug, 2.6)
p('Abzug', 'genau 2,50 m² wird noch übermessen (bis-Grenze)',
  abzugFuerOeffnung({ art: 'fenster', breite: 2.5, hoehe: 1.0 }, VOB).abzug, 0)
p('Abzug', 'große Öffnung × Anzahl 2',
  abzugFuerOeffnung({ art: 'fenster', breite: 2.0, hoehe: 1.5, anzahl: 2 }, VOB).abzug, 6)
p('Abzug', 'Vertragsvariante zieht auch die Tür ab',
  abzugFuerOeffnung(TUER, VERTRAG).abzug, 1.779)
p('Abzug', 'Vertragsvariante: nichts ist übermessen',
  abzugFuerOeffnung(TUER, VERTRAG).uebermessen, false)
p('Abzug', 'ohne Regelwerk kein Abzug, keine Markierung',
  abzugFuerOeffnung(TUER, null), { abzug: 0, uebermessen: false })

// ---------------------------------------------------------------- Leibungen
p('Leibung', 'Türleibung (2×2,01+0,885)×0,15 = 0,736 m²',
  leibungsFlaeche({ ...TUER, leibungstiefe: 0.15 }).flaeche, 0.736)
p('Leibung', 'Tür-Laufmeter 4,905 (drei Seiten, unten Boden)',
  leibungsFlaeche({ ...TUER, leibungstiefe: 0.15 }).laufmeter, 4.905)
p('Leibung', 'Fensterleibung 2×(1,20+1,30)×0,20 = 1,00 m²',
  leibungsFlaeche({ ...FENSTER, leibungstiefe: 0.2 }).flaeche, 1)
p('Leibung', 'Fenster-Laufmeter 5,00 (vier Seiten)',
  leibungsFlaeche({ ...FENSTER, leibungstiefe: 0.2 }).laufmeter, 5)
p('Leibung', 'Anzahl 2 verdoppelt die Fläche',
  leibungsFlaeche({ ...FENSTER, leibungstiefe: 0.2, anzahl: 2 }).flaeche, 2)
p('Leibung', 'nicht beschichtet → 0',
  leibungsFlaeche({ ...TUER, leibungBeschichtet: false }).flaeche, 0)
p('Leibung', 'Standardtiefe Tür 0,15', leibungsFlaeche(TUER).tiefe, 0.15)
p('Leibung', 'Standardtiefe Fenster 0,20', leibungsFlaeche(FENSTER).tiefe, 0.2)

// ---------------------------------------------------------------- Höhe
p('Höhe', 'VOB: licht 2,50 + Aufbau 0,12 = 2,62',
  abrechnungsHoehe({ hoeheLicht: 2.5, aufbauBoden: 0.12 }, VOB).hoehe, 2.62)
p('Höhe', 'VOB ohne Aufbau-Angabe → aufbauFehlt',
  abrechnungsHoehe({ hoeheLicht: 2.5 }, VOB).aufbauFehlt, true)
p('Höhe', 'Aufbau 0 ist eine bewusste Angabe (Bestandsboden), fehlt NICHT',
  abrechnungsHoehe({ hoeheLicht: 2.5, aufbauBoden: 0 }, VOB).aufbauFehlt, false)
p('Höhe', 'Aufbau 0 → Höhe bleibt licht',
  abrechnungsHoehe({ hoeheLicht: 2.5, aufbauBoden: 0 }, VOB).hoehe, 2.5)
p('Höhe', 'Vertragsvariante: lichte Höhe, Aufbau wird ignoriert',
  abrechnungsHoehe({ hoeheLicht: 2.5, aufbauBoden: 0.12 }, VERTRAG).hoehe, 2.5)
p('Höhe', 'Altfeld hoehe wird gelesen, wenn hoeheLicht fehlt',
  abrechnungsHoehe({ hoehe: 2.5, aufbauBoden: 0.12 }, VOB).hoehe, 2.62)

// ---------------------------------------------------------------- Der Beispielraum aus Kapitel 8.1
//
// 4,00 × 5,00 m · Umfang 18,00 gemessen · licht 2,50 · Aufbau 0,12
// 1 Tür 0,885×2,01 · 2 Fenster 1,20×1,30
const BEISPIELRAUM = {
  nummer: '1.03', name: 'Büro',
  breite: 4, laenge: 5, grundflaeche: 20,
  umfang: 18, umfangGemessen: true,
  hoeheLicht: 2.5, aufbauBoden: 0.12,
  oeffnungen: [
    { art: 'tuer', breite: 0.885, hoehe: 2.01, leibungstiefe: 0.15 },
    { art: 'fenster', breite: 1.2, hoehe: 1.3, anzahl: 2, leibungstiefe: 0.2 },
  ],
}
const A = raumAufmass(BEISPIELRAUM, VOB)

p('Beispielraum', 'Wand 18,00 × 2,62 = 47,16 m² (Öffnungen übermessen)', A.summen.wand, 47.16)
p('Beispielraum', 'kein Abzug (alle Öffnungen unter 2,50 m²)', A.summen.abzuege, 0)
p('Beispielraum', 'Leibungen 0,736 + 2,00 = 2,736 m²', A.summen.leibungen, 2.736)
p('Beispielraum', 'WAND + LEIBUNGEN = 49,90 m² (statt 39,90 in V1)',
  Math.round(A.summen.wandUndLeibungen * 100) / 100, 49.9)
p('Beispielraum', 'Decke 20,00 m²', A.summen.decke, 20)
p('Beispielraum', 'nichts geschätzt (Umfang gemessen, Aufbau erfasst)', A.geschaetzt, false)
p('Beispielraum', 'Wand-Ansatz als Formeltext',
  A.zeilen.find((z) => z.art === 'wand').ansatz, '18,00 × 2,62')
p('Beispielraum', 'Türleibungs-Ansatz "4,905 × 0,15"',
  A.zeilen.find((z) => z.bauteil.includes('tuerleibung')).ansatz, '4,905 × 0,15')
p('Beispielraum', 'Fensterleibung Faktor 2',
  A.zeilen.find((z) => z.bauteil.includes('fensterleibung')).faktor, 2)
p('Beispielraum', 'Übermessungs-Hinweis fürs Blatt vorhanden',
  A.hinweise.some((h) => h.includes('Übermessen')), true)

// Gegenprobe: dieselben Maße nach der Vertragsvariante (V1-Verhalten)
const B = raumAufmass(BEISPIELRAUM, VERTRAG)
p('Vertragsvariante', 'lichte Höhe: 18,00 × 2,50 = 45,00 brutto',
  B.zeilen.find((z) => z.art === 'wand').menge, 45)
p('Vertragsvariante', 'Abzüge Tür + 2 Fenster = 4,899 m²', B.summen.abzuege, 4.899)
p('Vertragsvariante', 'Wand netto 40,101 m²', B.summen.wand, 40.101)
p('Vertragsvariante', 'keine Leibungen', B.summen.leibungen, 0)
p('Vertragsvariante', 'Umschalten ändert das Ergebnis (49,90 ≠ 40,10)',
  A.summen.wandUndLeibungen !== B.summen.wandUndLeibungen, true)

// Pauschal: kein Aufmaß
const C = raumAufmass(BEISPIELRAUM, PAUSCHAL)
p('Pauschal', 'keine Zeilen', C.zeilen.length, 0)
p('Pauschal', 'Hinweis, dass kein Aufmaß entsteht',
  C.hinweise.some((h) => h.includes('kein Aufmaß')), true)

// ---------------------------------------------------------------- Schätz-Sperre
const FLUR = { nummer: '1.01', name: 'Flur', grundflaeche: 24, hoeheLicht: 2.5, aufbauBoden: 0.12 }
const F = raumAufmass(FLUR, VOB)
p('Schätzung', 'nur Fläche bekannt → Umfang 4·√24 = 19,596',
  F.zeilen.find((z) => z.art === 'wand').ansatz.startsWith('19,596'), true)
p('Schätzung', 'Wandzeile ist GESCHÄTZT (Sperre für die Rechnung)',
  F.zeilen.find((z) => z.art === 'wand').geschaetzt, true)
p('Schätzung', 'Gesamtergebnis geschätzt', F.geschaetzt, true)
p('Schätzung', 'Nachmess-Hinweis vorhanden',
  F.hinweise.some((h) => h.includes('nachmessen')), true)
p('Schätzung', 'Decke bleibt UNgeschätzt (steht im Plan)',
  F.zeilen.find((z) => z.art === 'decke').geschaetzt, false)

const OHNE_AUFBAU = { ...BEISPIELRAUM, aufbauBoden: undefined }
const G = raumAufmass(OHNE_AUFBAU, VOB)
p('Schätzung', 'fehlender Bodenaufbau → Wandzeile geschätzt',
  G.zeilen.find((z) => z.art === 'wand').geschaetzt, true)
p('Schätzung', 'Hinweis auf fehlenden Bodenaufbau',
  G.hinweise.some((h) => h.includes('Bodenaufbau')), true)

const GEMESSEN_FALSCH = { ...BEISPIELRAUM, umfangGemessen: false }
p('Schätzung', 'umfangGemessen:false sperrt trotz vorhandener Zahl',
  raumAufmass(GEMESSEN_FALSCH, VOB).geschaetzt, true)

// ---------------------------------------------------------------- Große Öffnung: Abzug + trotzdem Leibung
const HALLE = {
  nummer: 'H1', name: 'Halle',
  breite: 6, laenge: 10, grundflaeche: 60,
  umfang: 32, umfangGemessen: true,
  hoeheLicht: 3.5, aufbauBoden: 0.15,
  oeffnungen: [{ art: 'fenster', breite: 3.0, hoehe: 2.0, leibungstiefe: 0.25 }],
}
const H = raumAufmass(HALLE, VOB)
p('Große Öffnung', '6,00 m² wird abgezogen', H.summen.abzuege, 6)
p('Große Öffnung', 'Abzugzeile mit Faktor −1',
  H.zeilen.find((z) => z.art === 'abzug').faktor, -1)
p('Große Öffnung', 'Abzugzeile trägt die Menge NEGATIV (Blattsumme = Σ Zeilen)',
  H.zeilen.find((z) => z.art === 'abzug').menge, -6)
p('Große Öffnung', 'Σ Wand-/Abzugzeilen = Wand netto',
  Math.round(H.zeilen.filter((z) => z.art === 'wand' || z.art === 'abzug')
    .reduce((s, z) => s + z.menge, 0) * 1000) / 1000, 110.8)
p('Große Öffnung', 'Leibung wird TROTZDEM gesondert gerechnet (5.2.4)',
  H.summen.leibungen, 2.5)
p('Große Öffnung', 'Wand 32×3,65 − 6,00 = 110,80', H.summen.wand, 110.8)

// ---------------------------------------------------------------- Nische (5.2.4: Rückfläche + Leibung)
const NISCHE = {
  nummer: '2.01', name: 'Flur', breite: 3, laenge: 6, grundflaeche: 18,
  umfang: 18, umfangGemessen: true, hoeheLicht: 2.5, aufbauBoden: 0.12,
  oeffnungen: [{ art: 'nische', breite: 1.0, hoehe: 2.0, leibungstiefe: 0.3 }],
}
const N = raumAufmass(NISCHE, VOB)
p('Nische', '2,00 m² unter der Schwelle → übermessen, kein Abzug', N.summen.abzuege, 0)
p('Nische', 'Rückfläche 1,00 × 2,00 als eigene Zeile',
  N.zeilen.find((z) => z.bauteil.includes('nischenrückfläche')).menge, 2)
p('Nische', 'Leibung 2×(1+2)×0,30 = 1,80 zusätzlich',
  N.zeilen.find((z) => z.bauteil.includes('nischeleibung')).menge, 1.8)
p('Nische', 'Leibungssumme = Rückfläche + Leibung', N.summen.leibungen, 3.8)

// ---------------------------------------------------------------- § 2 Abs. 3
p('Mengen', '+7 % bleibt unter der Schwelle', mengenAbweichung(150, 160.5).ueberSchwelle, false)
p('Mengen', '+11,7 % liegt über der Schwelle', mengenAbweichung(1150, 1284).ueberSchwelle, true)
p('Mengen', 'Prozent stimmt (11,7)', mengenAbweichung(1150, 1284).prozent, 11.7)
p('Mengen', 'genau +10 % ist NICHT über der Schwelle', mengenAbweichung(100, 110).ueberSchwelle, false)
p('Mengen', 'Mindermenge −15 % ebenfalls über der Schwelle', mengenAbweichung(100, 85).ueberSchwelle, true)
p('Mengen', 'Richtung "weniger"', mengenAbweichung(100, 85).richtung, 'weniger')
p('Mengen', 'Hinweistext nennt § 2 Abs. 3', mengenAbweichung(1150, 1284).hinweis.includes('§ 2 Abs. 3'), true)
p('Mengen', 'ohne Vertragsmenge keine Aussage', mengenAbweichung(0, 50).ueberSchwelle, false)

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
