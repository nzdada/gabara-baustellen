// Werktags-Fristen nach VOB/B (AP 9, Plan Kapitel 6.3 und 7.5) – reine
// Rechenfunktionen ohne React und ohne Store, unter node testbar.
//
// WARUM ES DIESE DATEI GIBT
// Die Software macht hier eine RECHTSAUSSAGE: "gilt als anerkannt" (§ 15
// Abs. 3 VOB/B) und "gilt als abgenommen" (§ 12 Abs. 5 VOB/B). Rechnet sie
// die Werktage falsch, wiegt sich der Betrieb in Sicherheit, wo keine ist.
// Deshalb gilt hier:
//  - Werktag = Montag bis SAMSTAG (der Samstag zählt nach ständiger
//    Rechtsprechung als Werktag), NICHT der Sonntag.
//  - BAYERISCHE Feiertage zählen nicht als Werktag – die Baustellen und der
//    Auftraggeber sitzen in Bayern. Mariä Himmelfahrt (15.08.) gilt in
//    überwiegend katholischen Gemeinden (Augsburg: ja) und ist enthalten;
//    ein zu viel gerechneter Feiertag verschiebt die eigene Rechtsbehauptung
//    nur nach HINTEN (konservativ), ein fehlender nach vorn (riskant).
//    Das Augsburger Friedensfest (08.08., nur Stadtgebiet) bleibt bewusst
//    draußen – es würde die Behauptung ebenfalls nur verzögern, gilt aber
//    für auswärtige Auftraggeber nicht.
//
// Datum immer als ISO-Text 'JJJJ-MM-TT' und immer über T12:00:00 gerechnet –
// nie über toISOString() (Weltzeit, nachts der Vortag; STAND.md Regel 3).

// § 15 Abs. 3 VOB/B: Rückgabefrist des Auftraggebers nach ZUGANG des
// Stundenlohnzettels. Nicht zurückgegebene Zettel gelten als anerkannt.
export const ANERKENNUNG_WERKTAGE = 6

// § 12 Abs. 5 VOB/B: Frist zur Abnahme nach Zugang der Fertigstellungs-
// anzeige. Danach gilt die Abnahme als erfolgt (fiktive Abnahme).
export const ABNAHME_WERKTAGE = 12

function datumVon(iso) {
  return new Date(`${iso}T12:00:00`)
}

function isoVon(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Ostersonntag nach Meeus/Jones/Butcher – gültig für den gregorianischen
// Kalender, keine Bereichsgrenzen im relevanten Zeitraum.
export function osterSonntag(jahr) {
  const a = jahr % 19
  const b = Math.floor(jahr / 100)
  const c = jahr % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const monat = Math.floor((h + l - 7 * m + 114) / 31)
  const tag = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(jahr, monat - 1, tag, 12)
}

const feiertagsSpeicher = new Map()

// Gesetzliche Feiertage in Bayern als Menge von ISO-Daten (je Jahr gepuffert).
export function feiertageBayern(jahr) {
  if (feiertagsSpeicher.has(jahr)) return feiertagsSpeicher.get(jahr)
  const ostern = osterSonntag(jahr)
  const versetzt = (tage) => {
    const d = new Date(ostern)
    d.setDate(d.getDate() + tage)
    return isoVon(d)
  }
  const menge = new Set([
    `${jahr}-01-01`,   // Neujahr
    `${jahr}-01-06`,   // Heilige Drei Könige
    versetzt(-2),      // Karfreitag
    versetzt(1),       // Ostermontag
    `${jahr}-05-01`,   // Tag der Arbeit
    versetzt(39),      // Christi Himmelfahrt
    versetzt(50),      // Pfingstmontag
    versetzt(60),      // Fronleichnam
    `${jahr}-08-15`,   // Mariä Himmelfahrt (kath. Gemeinden, Augsburg: ja)
    `${jahr}-10-03`,   // Tag der Deutschen Einheit
    `${jahr}-11-01`,   // Allerheiligen
    `${jahr}-12-25`,   // 1. Weihnachtstag
    `${jahr}-12-26`,   // 2. Weihnachtstag
  ])
  feiertagsSpeicher.set(jahr, menge)
  return menge
}

// Werktag im Sinne der VOB/B: Montag bis Samstag, kein Sonntag, kein
// bayerischer Feiertag. Der SAMSTAG ZÄHLT – das ist die häufigste
// Fehlerquelle beim Nachrechnen von Hand.
export function istWerktagBayern(iso) {
  const d = datumVon(iso)
  if (Number.isNaN(d.getTime())) return false
  if (d.getDay() === 0) return false                       // Sonntag
  return !feiertageBayern(d.getFullYear()).has(iso)
}

// Der n-te Werktag NACH `iso` (iso selbst zählt nicht mit).
export function addWerktage(iso, n) {
  const d = datumVon(iso)
  if (Number.isNaN(d.getTime()) || n <= 0) return iso
  let rest = n
  while (rest > 0) {
    d.setDate(d.getDate() + 1)
    if (istWerktagBayern(isoVon(d))) rest -= 1
  }
  return isoVon(d)
}

// Wie viele Werktage liegen zwischen `vonIso` (ausschließlich) und
// `bisIso` (einschließlich)? Für den Zähler "noch n Werktage".
export function werktageZwischen(vonIso, bisIso) {
  if (!vonIso || !bisIso || bisIso <= vonIso) return 0
  const d = datumVon(vonIso)
  const ende = datumVon(bisIso)
  let zahl = 0
  while (d < ende) {
    d.setDate(d.getDate() + 1)
    if (istWerktagBayern(isoVon(d))) zahl += 1
  }
  return zahl
}

// ------------------------------------------------------- Anerkennungsuhr
//
// § 15 Abs. 3 VOB/B: Der Auftraggeber hat 6 Werktage nach ZUGANG, um den
// Stundenlohnzettel zurückzugeben. "Gilt als anerkannt" zeigt das System ab
// dem ERSTEN WERKTAG NACH Ablauf dieser Frist – nicht schon am Fristende
// selbst (dort darf der Auftraggeber noch zurückgeben) und nicht an einem
// Sonn-/Feiertag (die Zahl auf dem Papier muss einem Kalendercheck
// standhalten). Beispiel aus dem Plan: Zugang Sa 15.08.2026 (Feiertag)
// -> Frist bis Sa 22.08. -> gilt als anerkannt seit Mo 24.08.2026.

export function anerkanntAbIso(vorgelegtAm) {
  if (!vorgelegtAm) return ''
  return addWerktage(vorgelegtAm, ANERKENNUNG_WERKTAGE + 1)
}

// Der Zustand einer Regieanordnung für Leitstand und Berichte-Seite.
// WICHTIG (Warnhinweis der Oberfläche): gerechnet wird ab dem EINGETRAGENEN
// Zugang – der Zugang selbst ist nachzuweisen (Feld `zugangsnachweis`).
export function anerkennungsStand(anordnung, heuteIso) {
  if (!anordnung) return { stand: 'offen', anerkanntAb: '' }
  if (anordnung.widersprochenAm || anordnung.status === 'bestritten') {
    return { stand: 'bestritten', anerkanntAb: '' }
  }
  if (!anordnung.vorgelegtAm) return { stand: 'offen', anerkanntAb: '' }
  const anerkanntAb = anordnung.anerkanntAb || anerkanntAbIso(anordnung.vorgelegtAm)
  if (heuteIso && heuteIso >= anerkanntAb) return { stand: 'anerkannt', anerkanntAb }
  return { stand: 'laeuft', anerkanntAb }
}

// ------------------------------------------------------- Fiktive Abnahme
//
// § 12 Abs. 5 VOB/B: Wird nach der Fertigstellungsanzeige binnen 12
// Werktagen keine Abnahme verlangt bzw. durchgeführt, gilt sie als erfolgt.
// Gleiche Anzeige-Konvention wie oben: Fristende = 12. Werktag, "gilt als
// erfolgt" ab dem ersten Werktag danach.

export function abnahmeFristEnde(fertigAngezeigtAm) {
  if (!fertigAngezeigtAm) return ''
  return addWerktage(fertigAngezeigtAm, ABNAHME_WERKTAGE)
}

export function fiktiveAbnahmeAb(fertigAngezeigtAm) {
  if (!fertigAngezeigtAm) return ''
  return addWerktage(fertigAngezeigtAm, ABNAHME_WERKTAGE + 1)
}
