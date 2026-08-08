// Der Karten-Kern von V2 (Plan Kapitel 2, 3.1, 4.2): Aufgabe = Raum × Schritt.
//
// WAS HIER LIEGT UND WAS NICHT
// - Reine Bau-Funktionen ohne Nebenwirkungen: Aufgaben ERZEUGEN
//   (neueAufgabenFuerRaum), eine Sammelmeldung in Batch-Dokumente ÜBERSETZEN
//   (meldungBauen) und den Fortschritt RECHNEN (fortschritt).
// - GESCHRIEBEN wird woanders: store.meldeAufgaben nimmt das Ergebnis von
//   meldungBauen und führt es als EINEN writeBatch aus – alles oder nichts.
// - Kein React, kein Store-Import, kein Datum aus der Weltzeit: `datum`
//   liefert der Aufrufer über heuteISO(), `jetzt` ist injizierbar (Tests).
//
// DIE DREI SCHUTZREGELN (Plan 4.2, „der wichtigste Satz im Datenmodell“):
// 1. Deterministische Kennungen: auf-<raumId>-<schrittId>,
//    b-<raumId>-<schrittId>-<art>, am-<aufgabeId>. Kein Zufall – die zweite
//    Meldung desselben Schritts trifft ZWANGSLÄUFIG dieselbe Buchungs-Kennung
//    und scheitert an der Firestore-Regel `update: false` (bzw. an der
//    Nachbildung im lokalen Modus). Damit stirbt der ganze Batch, das
//    Increment kommt nie doppelt an.
// 2. Geld als Ganzzahl: wertCent wird beim Anlegen EINGEFROREN
//    (Math.round(menge × einheitspreisCent)) – eine spätere Preisänderung im
//    LV verändert vergebene Aufgaben nicht rückwirkend.
// 3. EIN aggregiertes Kennzahlen-Increment je Vorgang und Zieldokument:
//    sechs Räume à 46 m² sind EIN Increment von 276, nicht sechs.

import { parseZahl } from './format.js'
import { regelwerkVon, raumAufmass, zahlText } from './aufmass.js'

// ------------------------------------------------------------- Kennungen

export function aufgabenId(raumId, schrittId) {
  return `auf-${raumId}-${schrittId}`
}

// `art` gehört in die Kennung: Auftrag und Regie desselben Schritts sind
// ZWEI Arbeiten (Nachbesserung) – aber jede davon nur EINMAL meldbar.
export function buchungsId(raumId, schrittId, art) {
  return `b-${raumId}-${schrittId}-${art || 'auftrag'}`
}

export function aufmasszeilenId(aufgabeId) {
  return `am-${aufgabeId}`
}

// ------------------------------------------------------------- Zahlhelfer

// Mengen auf 3 Nachkommastellen – wie überall im Aufmaß.
function rundeMenge(n) {
  return Math.round((Number(n) || 0) * 1000) / 1000
}

// 'm²', 'm2', 'qm' – alles dieselbe Einheit. Nur sie zählt in die m²-Zahl.
export function istQuadratmeter(einheit) {
  const e = String(einheit || '').toLowerCase().replace('²', '2').trim()
  return e === 'm2' || e === 'qm'
}

// Einheitspreis als GANZZAHL in Cent. Nimmt einheitspreisCent, wenn schon
// vorhanden, sonst das Euro-Feld der LV-Position (einheitspreis bzw. ep).
function einheitspreisCentVon(position) {
  if (!position) return 0
  if (position.einheitspreisCent !== undefined) return Math.round(parseZahl(position.einheitspreisCent))
  const euro = position.einheitspreis !== undefined ? position.einheitspreis : position.ep
  return Math.round(parseZahl(euro) * 100)
}

const FERTIG_STATUS = new Set(['fertig', 'abgerechnet'])
function istFertig(status) {
  return FERTIG_STATUS.has(status)
}

// ------------------------------------------------------------- Menge je Bezug
//
// Der Arbeitsschritt sagt über `bezug`, welche Fläche des Raums die Menge
// liefert (Stammdaten in demoData.js). Reihenfolge der Wahrheit:
// 1. Ausdrückliche Vorgabe am Raum (raum.mengen[bezug]) – der Aufmaß-Bildschirm
//    oder ein Import kann je Bezug eine gemessene Menge hinterlegen.
// 2. Rechnung aus der Geometrie: decke/boden aus der Grundfläche,
//    wanddecke/leibung über raumAufmass nach dem Regelwerk der Baustelle.
// 3. Sonst 0 – bei Geld wird nicht geraten. 0 heißt: Aufmaß nachtragen.
export function mengeFuerBezug(raum, bezug, regelwerkOderId = null) {
  const vorgabe = raum?.mengen?.[bezug]
  if (vorgabe !== undefined && vorgabe !== null && vorgabe !== '') {
    return rundeMenge(parseZahl(vorgabe))
  }
  if (bezug === 'stueck') return 1
  const grund = rundeMenge(parseZahl(raum?.grundflaeche) || parseZahl(raum?.breite) * parseZahl(raum?.laenge))
  if (bezug === 'decke' || bezug === 'boden') return grund
  if (bezug === 'lfm') return rundeMenge(parseZahl(raum?.umfang))
  const rw = typeof regelwerkOderId === 'string' ? regelwerkVon(regelwerkOderId) : regelwerkOderId
  if (rw) {
    const a = raumAufmass(raum, rw)
    if (bezug === 'wanddecke') return rundeMenge(a.summen.wand + a.summen.decke)
    if (bezug === 'leibung') return a.summen.leibungen
  }
  return 0
}

export function einheitFuerBezug(bezug) {
  if (bezug === 'stueck') return 'Stk'
  if (bezug === 'lfm') return 'lfm'
  return 'm²'
}

// ------------------------------------------------------------- Aufgaben anlegen
//
// neueAufgabenFuerRaum(raum, schritte, position, extras) → Aufgaben-Dokumente
// für die Schnellanlage (Plan 3.2 „Aufgaben erteilen“).
//
// - Kennung deterministisch auf-<raumId>-<schrittId>: erneutes Verteilen
//   ERSETZT statt zu verdoppeln (Nachfolger der raumsoll-Regel rs-<pos>-<raum>).
// - wertCent = Math.round(menge × einheitspreisCent) – eingefroren, Ganzzahl.
// - mengeStand erbt raum.aufmassStand: eine geschätzte Raummenge bleibt bis
//   zum Nachmessen als geschätzt an der Aufgabe UND später an der Aufmaßzeile.
//
// extras: { regelwerk: 'vob18363'|Objekt (fuer wanddecke/leibung-Mengen),
//           art: 'auftrag'|'regie', anordnungId, jetzt }
export function neueAufgabenFuerRaum(raum, schritte, position = null, extras = {}) {
  if (!raum?.id) throw new Error('Aufgaben brauchen einen Raum mit Kennung (raum.id).')
  if (!raum?.projektId) throw new Error(`Raum ${raum.id} traegt keine projektId – Aufgabe nicht zuordenbar.`)
  const { regelwerk = null, art = 'auftrag', anordnungId = '', jetzt = Date.now() } = extras
  const einheitspreisCent = einheitspreisCentVon(position)
  const mengeStand = raum.aufmassStand || 'geschaetzt'
  const liste = []
  for (const schritt of Array.isArray(schritte) ? schritte : []) {
    if (!schritt?.id) throw new Error('Arbeitsschritt ohne Kennung (schritt.id).')
    const menge = mengeFuerBezug(raum, schritt.bezug, regelwerk)
    liste.push({
      id: aufgabenId(raum.id, schritt.id),
      projektId: raum.projektId,
      raumId: raum.id,
      raumNummer: raum.nummer || '',
      raumName: raum.name || '',
      bereich: raum.bereich || '',
      schrittId: schritt.id,
      schrittNameDe: schritt.nameDe || '',
      schrittNameAr: schritt.nameAr || '',
      schrittSort: parseZahl(schritt.sort),
      menge,
      einheit: position?.einheit || einheitFuerBezug(schritt.bezug),
      mengeStand,
      positionId: position?.id || '',
      oz: position?.oz || '',
      kurztext: position?.kurztext || schritt.nameDe || '',
      einheitspreisCent,
      wertCent: Math.round(menge * einheitspreisCent),
      // Schnappschuss der Rechenbasis: unter welcher Regel die Menge entstand.
      regelwerk: (typeof regelwerk === 'string' ? regelwerk : regelwerk?.id) || '',
      art,
      anordnungId,
      status: 'offen',
      anteil: 0,
      teamId: '',
      teamName: '',
      tage: [],
      einsatzId: '',
      fertigAm: null,
      fertigVon: '',
      fertigVonName: '',
      fertigFotoId: '',
      zurueckGrund: '',
      zurueckAm: null,
      zurueckVon: '',
      wartetGrund: '',
      wartetBis: '',
      aufmassZeileId: '',
      erstelltAm: jetzt,
      geaendertAm: jetzt,
    })
  }
  return liste
}

// ------------------------------------------------------------- Sammelmeldung
//
// meldungBauen(aufgaben, user, datum, optionen) → die Batch-Dokumente für
// store.meldeAufgaben (Plan 3.1 Bildschirm 2, „ein Vorgang, alles oder nichts“):
//
//   je Aufgabe:  1 Buchung (nur create)  +  1 Aufgaben-Update (status fertig)
//                +  1 Aufmaßzeile am-<aufgabeId> (geschaetzt vererbt)
//   je Vorgang:  EIN aggregiertes Kennzahlen-Increment
//
// Abgelehnt wird hier schon beim Bauen:
// - doppelte Aufgabe im selben Vorgang (doppelte Zielreferenz im Batch),
// - Aufgaben aus mehreren Projekten (eine Sammelmeldung gilt EINER Baustelle,
//   sonst wären es mehrere Increment-Ziele).
//
// Das Aufgaben-Update enthält NUR Felder, die die Firestore-Regel dem Monteur
// erlaubt (status, anteil, fertig*, geaendertAm) – ein zusätzliches Feld
// ließe den ganzen Batch an nurFelder() scheitern.
//
// optionen: { fotoId (der eine Beleg der Sammelmeldung),
//             alleAufgaben (kompletter Stand der betroffenen Räume – nur damit
//                           lässt sich raeumeFertig fortschreiben),
//             jetzt (injizierbar für Tests) }
export function meldungBauen(aufgaben, user, datum, optionen = {}) {
  const { fotoId = '', alleAufgaben = null, jetzt = Date.now() } = optionen
  if (!Array.isArray(aufgaben) || aufgaben.length === 0) {
    throw new Error('Keine Aufgaben zum Melden.')
  }
  const gesehen = new Set()
  for (const a of aufgaben) {
    if (gesehen.has(a.id)) throw new Error(`Aufgabe ${a.id} steht doppelt im Vorgang – abgelehnt.`)
    gesehen.add(a.id)
  }
  const projektIds = [...new Set(aufgaben.map((a) => a.projektId))]
  if (projektIds.length !== 1 || !projektIds[0]) {
    throw new Error('Eine Sammelmeldung gilt genau EINER Baustelle – bitte getrennt melden.')
  }
  const projektId = projektIds[0]
  const userId = user?.userId || user?.id || ''
  const userName = user?.name || ''

  const buchungen = []
  const updates = []
  const zeilen = []
  const deltas = { aufgabenFertig: 0, wertFertigCent: 0, m2Fertig: 0 }

  for (const a of aufgaben) {
    const art = a.art || 'auftrag'
    const menge = rundeMenge(parseZahl(a.menge))
    const mengeStand = a.mengeStand || 'geschaetzt'
    buchungen.push({
      id: buchungsId(a.raumId, a.schrittId, art),
      projektId,
      aufgabeId: a.id,
      raumId: a.raumId,
      schrittId: a.schrittId,
      art,
      menge,
      einheit: a.einheit || '',
      mengeStand,
      mitarbeiterId: userId,
      mitarbeiterName: userName,
      datum,
      erfasstAm: jetzt,
      storniert: false,
    })
    updates.push({
      id: a.id,
      patch: {
        status: 'fertig',
        anteil: 1,
        fertigAm: jetzt,
        fertigVon: userId,
        fertigVonName: userName,
        fertigFotoId: fotoId,
        geaendertAm: jetzt,
      },
    })
    zeilen.push({
      id: aufmasszeilenId(a.id),
      projektId,
      positionId: a.positionId || '',
      oz: a.oz || '',
      kurztext: a.kurztext || a.schrittNameDe || '',
      einheit: a.einheit || '',
      raumId: a.raumId,
      raumName: [a.raumNummer, a.raumName].filter(Boolean).join(' '),
      bauteil: [a.raumNummer, a.raumName].filter(Boolean).join(' ') || a.raumId,
      ansatz: zahlText(menge),
      faktor: 1,
      menge,
      art: 'haupt',
      regelwerk: a.regelwerk || '',
      // vererbt: eine geschätzte Aufgabenmenge bleibt als geschätzte Zeile
      // für die Rechnung GESPERRT, bis das Büro nachmisst/bestätigt.
      geschaetzt: mengeStand === 'geschaetzt',
      quelle: 'aufgabe',
      aufgabeId: a.id,
      erfasstAm: jetzt,
      erfasstVon: userId,
      storniert: false,
      abgerechnetIn: '',
    })
    deltas.aufgabenFertig += 1
    deltas.wertFertigCent += Math.round(parseZahl(a.wertCent))
    if (istQuadratmeter(a.einheit)) deltas.m2Fertig = rundeMenge(deltas.m2Fertig + menge)
    // Zustandszähler sauber gegenbuchen: was bisher lief/wartete/zurück war,
    // verlässt mit dieser Meldung den jeweiligen Zähler.
    if (a.status === 'laeuft') deltas.aufgabenLaeuft = (deltas.aufgabenLaeuft || 0) - 1
    if (a.status === 'wartet') deltas.aufgabenWartet = (deltas.aufgabenWartet || 0) - 1
    if (a.status === 'zurueck') deltas.aufgabenZurueck = (deltas.aufgabenZurueck || 0) - 1
  }

  // Räume, die mit dieser Meldung KOMPLETT werden – nur bestimmbar, wenn der
  // Aufrufer den vollen Aufgabenstand der betroffenen Räume mitgibt.
  if (Array.isArray(alleAufgaben)) {
    const gemeldet = new Set(aufgaben.map((a) => a.id))
    const betroffen = new Set(aufgaben.map((a) => a.raumId))
    let neuFertig = 0
    for (const raumId of betroffen) {
      const desRaums = alleAufgaben.filter((a) => a.raumId === raumId && a.projektId === projektId)
      if (!desRaums.length) continue
      const vorher = desRaums.every((a) => istFertig(a.status))
      const nachher = desRaums.every((a) => istFertig(a.status) || gemeldet.has(a.id))
      if (!vorher && nachher) neuFertig += 1
    }
    if (neuFertig > 0) deltas.raeumeFertig = neuFertig
  }

  return {
    buchungen,
    aufgaben: updates,
    aufmasszeilen: zeilen,
    kennzahlen: { projektId, deltas, felder: { letzteMeldungAm: jetzt } },
  }
}

// ------------------------------------------------------------- Fortschritt
//
// Die DREI benannten Zahlen (Plan 3.2) – nie vermischt:
//   leistung  Σ wertCent fertig / gesamt   (der Balken; Euro als Nenner)
//   flaeche   Σ m² fertig / gesamt         (nur m²-Aufgaben; Stk/lfm zählen nicht)
//   raeume    fertige Räume / alle         (fertig = ALLE Schritte des Raums)
// `wartet` und `zurueck` bleiben im NENNER – ein wartender Raum darf den
// Fortschritt nicht auf 100 % springen lassen (der teuerste Fehler von V1).
export function fortschritt(aufgaben) {
  let fertigCent = 0
  let gesamtCent = 0
  let fertigM2 = 0
  let gesamtM2 = 0
  const raumStand = new Map()
  for (const a of Array.isArray(aufgaben) ? aufgaben : []) {
    const wert = Math.round(parseZahl(a.wertCent))
    const m2 = istQuadratmeter(a.einheit) ? parseZahl(a.menge) : 0
    const fertig = istFertig(a.status)
    gesamtCent += wert
    gesamtM2 += m2
    if (fertig) {
      fertigCent += wert
      fertigM2 += m2
    }
    const stand = raumStand.get(a.raumId) || { alle: 0, fertig: 0 }
    stand.alle += 1
    if (fertig) stand.fertig += 1
    raumStand.set(a.raumId, stand)
  }
  let raeumeFertig = 0
  for (const stand of raumStand.values()) {
    if (stand.alle > 0 && stand.fertig === stand.alle) raeumeFertig += 1
  }
  const anteil = (fertig, gesamt) => (gesamt > 0 ? Math.round((fertig / gesamt) * 1000) / 1000 : 0)
  return {
    leistung: { fertigCent, gesamtCent, anteil: anteil(fertigCent, gesamtCent) },
    flaeche: {
      fertigM2: rundeMenge(fertigM2),
      gesamtM2: rundeMenge(gesamtM2),
      anteil: anteil(fertigM2, gesamtM2),
    },
    raeume: { fertig: raeumeFertig, gesamt: raumStand.size, anteil: anteil(raeumeFertig, raumStand.size) },
  }
}
