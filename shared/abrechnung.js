// Abrechnung nach Aufmaß – der AP-8-Kern (Plan Kapitel 8.3, 8.5–8.9).
//
// WAS HIER LIEGT
// - positionsUebersicht: je LV-Position Vertrag / Aufmaß / Abgerechnet +
//   Abweichung nach § 2 Abs. 3 VOB/B (Büro-Ansicht "Aufmaß", aufklappbar
//   bis zur einzelnen Zeile mit Formeltext).
// - alleBestaetigenBauen: der Sammelknopf. Er erfasst AUSSCHLIESSLICH Zeilen
//   mit geschaetzt=false, und Zeilen einer Position mit über 10 % Abweichung
//   sind ausgenommen – genau sie lösen die § 2-Abs.-3-Diskussion aus
//   (Plan 8.3, Einwand #19).
// - zeileNachmessenBauen: geschätzte Zeilen bleiben IMMER einzeln und
//   verlangen gemessenVon und gemessenAm – erst dann fällt die Sperre.
// - Rechnungslauf (Plan 8.7): wiederaufnehmbar statt atomar. Erst der Lauf,
//   dann Etappen zu 400, und ERST wenn offen == 0 entsteht die Rechnung.
//   abgerechnetIn als Einzelwert macht Doppelfakturierung STRUKTURELL
//   unmöglich; eine bereits markierte Zeile wird übersprungen, nie doppelt.
// - steuerSchnappschuss (Plan 8.8): alles, was auf dem Papier stand, wird
//   beim Erzeugen KOPIERT, nie nachgeschlagen – ustModus, Satz, Betrag,
//   § 13b-Text, Anschrift, Regelwerk.
// - einbehaltBauen (Plan 8.9): Sicherheitseinbehalt mit Fälligkeitsdatum
//   (Abnahme + 48 Monate VOB / 60 Monate BGB) – nie wieder ein Einbehalt,
//   der in der Schublade verjährt.
// - stornoBauen: Storno statt Löschen. Bucht abgerechnetIn zurück, setzt die
//   Rechnung auf storniert, lässt den Einbehalt entfallen und zieht die
//   Kennzahl zurück – in Etappen, wiederholbar, idempotent.
//
// GRUNDREGELN: reine Funktionen, kein React, kein Store. Geld in Cent als
// Ganzzahl, Mengen über parseZahl (nie Number("16,4")), `jetzt` injizierbar.

import { parseZahl } from './format.js'
import { mengenAbweichung, zahlText } from './aufmass.js'

// § 13b-Text als letzte Rückfallebene – die Textbausteine (bs-13b) gehen vor.
export const RECHTSTEXT_13B = 'Der Rechnungsbetrag versteht sich netto. Steuerschuldnerschaft des Leistungsempfängers gemäß § 13b UStG.'

// Firestore fasst 500 Schreibvorgänge je Batch; mit Lauf-Patch und Luft
// bleiben wir bewusst bei 400 (Plan 8.7).
export const ETAPPEN_GROESSE = 400

function rundeMenge(n) {
  return Math.round((parseZahl(n) || 0) * 1000) / 1000
}

function rund2(n) {
  return Math.round((parseZahl(n) || 0) * 100) / 100
}

function einheitspreisVon(position) {
  if (!position) return 0
  if (position.einheitspreisCent !== undefined) return Math.round(parseZahl(position.einheitspreisCent)) / 100
  return parseZahl(position.einheitspreis !== undefined ? position.einheitspreis : position.ep)
}

// ISO-Datum aus einem Zeitstempel – lokal, nie über toISOString() (UTC-Falle).
export function isoVonZeit(ms) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Monate auf ein ISO-Datum addieren (T12:00 gegen Zeitzonen-Kippen).
// 31.01. + 1 Monat läuft bei setMonth auf den 02./03.03. über – für eine
// Fälligkeit wäre das ZU SPÄT wachgeworden. Deshalb: auf den Monatsletzten
// deckeln (31.01. + 1 → 28./29.02.).
export function addMonate(iso, monate) {
  const d = new Date(`${iso}T12:00:00`)
  const tag = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + Math.round(parseZahl(monate)))
  const letzter = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(tag, letzter))
  return isoVonZeit(d.getTime())
}

// ------------------------------------------------------------- Übersicht
//
// Je LV-Position: Vertrag / Aufmaß / Abgerechnet + Abweichung (§ 2 Abs. 3).
// Stornierte Zeilen zählen NIRGENDS mit; Zeilen ohne positionId landen in der
// eigenen Gruppe '' – sie sind der § 2-Abs.-6-Fall (zusätzliche Leistung).
export function positionsUebersicht({ zeilen = [], positionen = [] } = {}) {
  const gruppen = new Map()
  for (const z of zeilen) {
    if (z.storniert) continue
    const key = z.positionId || ''
    if (!gruppen.has(key)) gruppen.set(key, [])
    gruppen.get(key).push(z)
  }
  const raus = []
  for (const [positionId, liste] of gruppen) {
    const position = positionen.find((p) => p.id === positionId) || null
    const vertrag = rundeMenge(position?.menge)
    const aufmass = rundeMenge(liste.reduce((s, z) => s + parseZahl(z.menge), 0))
    const abgerechnet = rundeMenge(liste.filter((z) => z.abgerechnetIn).reduce((s, z) => s + parseZahl(z.menge), 0))
    raus.push({
      positionId,
      oz: position?.oz || liste[0]?.oz || '',
      kurztext: position?.kurztext || liste[0]?.kurztext || '',
      einheit: position?.einheit || liste[0]?.einheit || '',
      einheitspreis: einheitspreisVon(position),
      vertrag,
      aufmass,
      abgerechnet,
      geschaetztAnzahl: liste.filter((z) => z.geschaetzt).length,
      zeilen: liste.slice().sort((a, b) => String(a.bauteil || '').localeCompare(String(b.bauteil || ''), 'de', { numeric: true })),
      abweichung: mengenAbweichung(vertrag, aufmass),
    })
  }
  return raus.sort((a, b) => String(a.oz).localeCompare(String(b.oz), 'de', { numeric: true }))
}

// ------------------------------------------------------------- Bestätigen
//
// "Alle bestätigen" – die geschlossene Umgehung (Plan 8.3):
// - NUR Zeilen mit geschaetzt=false (die Sperre bleibt am Einzelfall),
// - Zeilen einer Position mit über 10 % Abweichung sind AUSGENOMMEN,
// - bereits bestätigte, stornierte und abgerechnete werden übersprungen.
export function alleBestaetigenBauen({ zeilen = [], positionen = [], userId = '', jetzt = Date.now() } = {}) {
  const uebersicht = positionsUebersicht({ zeilen, positionen })
  const ueberSchwelle = new Set(uebersicht.filter((u) => u.abweichung.ueberSchwelle).map((u) => u.positionId))
  const patches = []
  let uebersprungenGeschaetzt = 0
  let uebersprungenAbweichung = 0
  for (const z of zeilen) {
    if (z.storniert || z.abgerechnetIn || z.bestaetigtAm) continue
    if (z.geschaetzt) { uebersprungenGeschaetzt += 1; continue }
    if (ueberSchwelle.has(z.positionId || '')) { uebersprungenAbweichung += 1; continue }
    patches.push({
      coll: 'aufmasszeilen',
      id: z.id,
      patch: { bestaetigtAm: jetzt, bestaetigtVon: userId },
    })
  }
  return { patches, bestaetigt: patches.length, uebersprungenGeschaetzt, uebersprungenAbweichung }
}

// Eine geschätzte Zeile nachmessen: verlangt gemessenVon UND gemessenAm –
// erst der dokumentierte Messvorgang hebt die Rechnungssperre auf.
export function zeileNachmessenBauen(zeile, { menge, ansatz = '', gemessenVon = '', gemessenAm = '', userId = '', jetzt = Date.now() } = {}) {
  if (!zeile?.id) throw new Error('Keine Aufmaßzeile übergeben.')
  if (zeile.abgerechnetIn) throw new Error('Zeile ist bereits abgerechnet – Änderung nur über Storno der Rechnung.')
  if (zeile.storniert) throw new Error('Zeile ist storniert.')
  if (!String(gemessenVon).trim() || !gemessenAm) {
    throw new Error('Nachmessen verlangt, WER gemessen hat und WANN (gemessenVon, gemessenAm).')
  }
  const neueMenge = rundeMenge(menge !== undefined && menge !== '' ? menge : zeile.menge)
  if (!(neueMenge > 0)) throw new Error('Gemessene Menge muss über 0 liegen.')
  return {
    coll: 'aufmasszeilen',
    id: zeile.id,
    patch: {
      menge: neueMenge,
      ansatz: String(ansatz).trim() || zahlText(neueMenge),
      geschaetzt: false,
      gemessenVon: String(gemessenVon).trim(),
      gemessenAm,
      bestaetigtAm: jetzt,
      bestaetigtVon: userId,
    },
  }
}

// ------------------------------------------------------------- Rechnungslauf
//
// Reihenfolge nach Plan 8.7 – erst der Lauf, dann Etappen, DANN die Rechnung:
//   1. rechnungslaeufe/{id} mit status 'laeuft' und allen Zeilen-IDs
//   2. Etappen zu je 400: abgerechnetIn = rechnungId (Übersprungen wird, was
//      den Marker schon trägt – Wiederaufnahme ist damit idempotent)
//   3. erst wenn offen == 0: Rechnung + Einbehalt + Kennzahl in EINEM Vorgang

// Abrechenbar ist nur, was bestätigt, gemessen, unstorniert, unfakturiert
// UND einer LV-Position zugeordnet ist (ohne Position kein Preis – das ist
// der § 2-Abs.-6-Fall und läuft über die Nachtragsankündigung).
export function zeilenFuerRechnung(zeilen = []) {
  const frei = []
  const gesperrt = { geschaetzt: 0, unbestaetigt: 0, ohnePosition: 0 }
  for (const z of zeilen) {
    if (z.storniert || z.abgerechnetIn) continue
    if (z.geschaetzt) { gesperrt.geschaetzt += 1; continue }
    if (!z.bestaetigtAm) { gesperrt.unbestaetigt += 1; continue }
    if (!z.positionId) { gesperrt.ohnePosition += 1; continue }
    frei.push(z)
  }
  return { frei, gesperrt }
}

export function rechnungslaufAnlegen({ projektId, zeilen = [], laufId, rechnungId, jetzt = Date.now() } = {}) {
  if (!projektId) throw new Error('Rechnungslauf braucht eine Baustelle (projektId).')
  if (!zeilen.length) throw new Error('Keine abrechenbaren Aufmaßzeilen – nichts zu fakturieren.')
  const ids = zeilen.map((z) => z.id)
  return {
    id: laufId || `lauf-${projektId}-${jetzt}`,
    projektId,
    status: 'laeuft',
    rechnungId: rechnungId || `r-${projektId}-${jetzt}`,
    zeilenIds: ids,
    erledigt: [],
    offen: ids,
    gestartetAm: jetzt,
    beendetAm: 0,
  }
}

// Die nächste Etappe eines (neuen ODER wiederaufgenommenen) Laufs.
// `zeilenIst` ist der AKTUELLE Stand der Zeilen – wer den Marker schon trägt,
// gilt als erledigt und wird übersprungen (Plan 8.7: "jede Etappe idempotent").
export function naechsteEtappe(lauf, zeilenIst = [], { grenze = ETAPPEN_GROESSE, jetzt = Date.now() } = {}) {
  const jeId = new Map(zeilenIst.map((z) => [z.id, z]))
  const offen = lauf.zeilenIds.filter((id) => {
    const z = jeId.get(id)
    return z && !z.storniert && !z.abgerechnetIn
  })
  const jetzige = offen.slice(0, Math.max(1, grenze))
  const offenDanach = offen.slice(jetzige.length)
  const patches = jetzige.map((id) => ({
    coll: 'aufmasszeilen',
    id,
    patch: { abgerechnetIn: lauf.rechnungId, abgerechnetAm: jetzt },
  }))
  const erledigtDanach = lauf.zeilenIds.filter((id) => !offenDanach.includes(id))
  return {
    patches,
    laufPatch: { erledigt: erledigtDanach, offen: offenDanach },
    offenDanach,
    fertig: offenDanach.length === 0,
  }
}

// ------------------------------------------------------------- Steuer (8.8)

export function steuerSchnappschuss({ kunde = null, netto = 0, text13b = '', ustSatzProzent = 19 } = {}) {
  const ist13b = (kunde?.ustModus || '13b') === '13b'
  const satz = ist13b ? 0 : parseZahl(ustSatzProzent)
  const ustBetrag = rund2(parseZahl(netto) * (satz / 100))
  return {
    ustModus: ist13b ? '13b' : 'ust19',
    ustSatz: satz,
    ustBetrag,
    brutto: rund2(parseZahl(netto) + ustBetrag),
    rechtstext13b: ist13b ? (String(text13b).trim() || RECHTSTEXT_13B) : '',
  }
}

// ------------------------------------------------------------- Rechnung
//
// Entsteht ERST, wenn der Lauf offen == 0 meldet. Alles, was je auf dem
// Papier stehen wird, ist hier KOPIERT: Steuer, Anschrift, Regelwerk, Preise.
export function rechnungAusLauf({
  lauf, zeilen = [], positionen = [], projekt = null, kunde = null,
  titel = '', einbehaltProzent = 0, text13b = '', regelwerk = null, jetzt = Date.now(),
} = {}) {
  if (!lauf?.rechnungId) throw new Error('Kein Rechnungslauf übergeben.')
  const markierte = zeilen.filter((z) => z.abgerechnetIn === lauf.rechnungId && !z.storniert)
  if (!markierte.length) throw new Error('Keine markierten Aufmaßzeilen zu diesem Lauf – Rechnung nicht möglich.')
  const jePosition = new Map()
  for (const z of markierte) {
    const key = z.positionId
    if (!jePosition.has(key)) jePosition.set(key, [])
    jePosition.get(key).push(z)
  }
  const rechnungsPositionen = []
  for (const [positionId, liste] of jePosition) {
    const position = positionen.find((p) => p.id === positionId) || null
    const menge = rundeMenge(liste.reduce((s, z) => s + parseZahl(z.menge), 0))
    const ep = einheitspreisVon(position)
    rechnungsPositionen.push({
      quelle: 'aufmass',
      quelleId: positionId,
      oz: position?.oz || liste[0]?.oz || '',
      text: position?.kurztext || liste[0]?.kurztext || '',
      menge,
      einheit: position?.einheit || liste[0]?.einheit || '',
      ep,
      gesamt: rund2(menge * ep),
      zeilenAnzahl: liste.length,
    })
  }
  rechnungsPositionen.sort((a, b) => String(a.oz).localeCompare(String(b.oz), 'de', { numeric: true }))
  const netto = rund2(rechnungsPositionen.reduce((s, p) => s + p.gesamt, 0))
  const steuer = steuerSchnappschuss({ kunde, netto, text13b })
  const prozent = parseZahl(einbehaltProzent)
  const einbehaltBetrag = rund2(steuer.brutto * (prozent / 100))
  const rechnung = {
    id: lauf.rechnungId,
    art: 'aufmass',
    rechnungslaufId: lauf.id,
    projektId: lauf.projektId,
    kundeId: kunde?.id || projekt?.kundeId || '',
    titel: titel || `Abrechnung nach Aufmaß – ${projekt?.name || lauf.projektId}`,
    positionen: rechnungsPositionen,
    zeilenAnzahl: markierte.length,
    netto,
    // Steuer-Schnappschuss (Plan 8.8): NIE wieder live aus kunde.ustModus.
    ustModus: steuer.ustModus,
    ustSatz: steuer.ustSatz,
    ustBetrag: steuer.ustBetrag,
    brutto: steuer.brutto,
    rechtstext13b: steuer.rechtstext13b,
    // Schnappschüsse fürs Papier: Anschrift und Abrechnungsregel.
    kundeName: kunde?.firma || [kunde?.vorname, kunde?.nachname].filter(Boolean).join(' ') || '',
    kundeAnschrift: [kunde?.strasse, kunde?.plzOrt].filter(Boolean).join(', '),
    regelwerkId: regelwerk?.id || projekt?.abrechnungsregel || '',
    regelwerkName: regelwerk?.name || '',
    einbehaltProzent: prozent,
    einbehaltBetrag,
    zahlbetrag: rund2(steuer.brutto - einbehaltBetrag),
    fastbillInvoiceId: '',
    fastbillNummer: '',
    dokumentUrl: '',
    status: 'vorbereitet',
    createdAt: jetzt,
    uebertragenAm: 0,
  }
  return {
    rechnung,
    kennzahlen: {
      projektId: lauf.projektId,
      deltas: { abgerechnetCent: Math.round(netto * 100) },
      felder: {},
    },
  }
}

// ------------------------------------------------------------- Einbehalt (8.9)
//
// Fällig nach Gewährleistung: VOB (GU) 4 Jahre = 48 Monate, BGB (privat)
// 5 Jahre = 60 Monate – gerechnet ab Abnahme, ersatzweise ab Rechnungstag.
export function einbehaltBauen({ rechnung, kunde = null, abnahmeAm = '', jetzt = Date.now() } = {}) {
  if (!rechnung?.id) throw new Error('Einbehalt braucht eine Rechnung.')
  if (!(parseZahl(rechnung.einbehaltProzent) > 0) || !(parseZahl(rechnung.einbehaltBetrag) > 0)) return null
  const monate = (kunde?.typ || 'gu') === 'gu' ? 48 : 60
  const basis = abnahmeAm || isoVonZeit(jetzt)
  return {
    id: `eb-${rechnung.id}`,
    rechnungId: rechnung.id,
    projektId: rechnung.projektId,
    kundeId: rechnung.kundeId || '',
    prozent: parseZahl(rechnung.einbehaltProzent),
    betrag: parseZahl(rechnung.einbehaltBetrag),
    entstandenAm: jetzt,
    basisDatum: basis,
    monate,
    faelligAm: addMonate(basis, monate),
    abgeloestAm: '',
    abgeloestArt: '',
    status: 'offen',
  }
}

// ------------------------------------------------------------- Storno
//
// Storno statt Löschen (Plan 8.7/8.9): abgerechnetIn wird GELEERT (die Zeile
// wird wieder abrechenbar), die Rechnung bleibt als 'storniert' stehen, der
// Einbehalt entfällt, die Kennzahl wird zurückgezogen. In Etappen – und
// idempotent: ein abgebrochener Storno lässt sich einfach wiederholen, weil
// nur Zeilen MIT Marker angefasst werden.
export function stornoBauen({ rechnung, zeilen = [], grund = '', userId = '', jetzt = Date.now() } = {}) {
  if (!rechnung?.id) throw new Error('Keine Rechnung zum Stornieren.')
  const markierte = zeilen.filter((z) => z.abgerechnetIn === rechnung.id)
  const zeilenPatches = markierte.map((z) => ({
    coll: 'aufmasszeilen',
    id: z.id,
    patch: { abgerechnetIn: '', abgerechnetAm: 0 },
  }))
  const etappen = []
  for (let i = 0; i < zeilenPatches.length; i += ETAPPEN_GROESSE) {
    etappen.push(zeilenPatches.slice(i, i + ETAPPEN_GROESSE))
  }
  return {
    etappen,
    abschluss: {
      patches: [{
        coll: 'rechnungen',
        id: rechnung.id,
        patch: { status: 'storniert', storniertAm: jetzt, storniertVon: userId, stornoGrund: String(grund).trim() },
      }],
      einbehaltPatch: {
        coll: 'einbehalte',
        id: `eb-${rechnung.id}`,
        patch: { status: 'entfallen', abgeloestAm: '', abgeloestArt: 'storno' },
      },
      kennzahlen: {
        projektId: rechnung.projektId,
        deltas: { abgerechnetCent: -Math.round(parseZahl(rechnung.netto) * 100) },
        felder: {},
      },
    },
  }
}

// ------------------------------------------------------------- § 2 Abs. 6
//
// Aufgaben ohne LV-Position, deren Nachtrag noch NICHT angekündigt ist –
// Grundlage der roten Leitstand-Zeile und des Ein-Klick-Dokuments.
export function aufgabenOhneAnkuendigung(aufgaben = []) {
  return aufgaben.filter((a) => !a.positionId && !a.nachtragAngekuendigtAm
    && a.status !== 'abgerechnet')
}

// Die Ankündigung als EIN Vorgang: Vermerk an jeder betroffenen Aufgabe plus
// die Gegenbuchung des Kennzahlen-Zählers, von dem die rote Zeile lebt.
export function ankuendigungBauen(aufgaben = [], { projektId, userId = '', jetzt = Date.now() } = {}) {
  const betroffen = aufgabenOhneAnkuendigung(aufgaben).filter((a) => !projektId || a.projektId === projektId)
  if (!betroffen.length) throw new Error('Keine Aufgabe ohne LV-Position – nichts anzukündigen.')
  const pid = projektId || betroffen[0].projektId
  return {
    patches: betroffen.map((a) => ({
      coll: 'aufgaben',
      id: a.id,
      patch: { nachtragAngekuendigtAm: jetzt, nachtragAngekuendigtVon: userId, geaendertAm: jetzt },
    })),
    kennzahlen: {
      projektId: pid,
      deltas: { aufgabenOhnePosition: -betroffen.length },
      felder: {},
    },
    betroffen,
  }
}
