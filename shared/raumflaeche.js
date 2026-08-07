// Flächen eines Raums.
//
// Der Maler braucht drei Zahlen, und nur EINE davon steht im Bauplan:
//
//   Bodenfläche  – steht im Plan als "A=16,14qm". Gilt zugleich für die DECKE.
//   Umfang       – steht NICHT im Plan. Nur über die Raumform zu bekommen.
//   Wandfläche   – Umfang × Höhe, abzüglich Türen und Fenster.
//
// Deshalb hier: Bodenfläche ist gesetzt, Umfang wird gemessen (Grundriss) oder
// überschlagen, und jede überschlagene Zahl trägt ein Kennzeichen mit. Eine
// geschätzte Menge darf nicht ungeprüft in eine Rechnung an einen
// Generalunternehmer.

// Standardwerte, wenn nichts erfasst ist
export const STANDARD_HOEHE = 2.5          // m, üblicher Innenausbau
export const TUER_BREITE_STD = 0.885
export const TUER_HOEHE_STD = 2.01
export const ABZUG_TUER = 1.9              // m² je Tür (0,9 × 2,1 gerundet)
export const ABZUG_FENSTER = 1.6           // m² je Fenster

function runde(n, stellen = 2) {
  const f = 10 ** stellen
  return Math.round((Number(n) || 0) * f) / f
}

// Fläche eines Rechtecks
export function flaecheAus(breite, laenge) {
  return runde((Number(breite) || 0) * (Number(laenge) || 0))
}

// Umfang eines Rechtecks
export function umfangAus(breite, laenge) {
  return runde(2 * ((Number(breite) || 0) + (Number(laenge) || 0)))
}

// Umfang überschlagen, wenn nur die Fläche bekannt ist (z. B. aus dem Bauplan).
//
// Angenommen wird ein Quadrat: U = 4 × √A. Das ist die KLEINSTMÖGLICHE
// Umfangslänge für eine gegebene Fläche – bei einem langen Flur liegt der
// echte Umfang deutlich darüber, die Wandfläche wird also UNTERSCHÄTZT.
// Genau deshalb liefert die Funktion `geschaetzt: true` mit.
export function umfangUeberschlag(flaeche) {
  const a = Number(flaeche) || 0
  if (a <= 0) return { umfang: 0, geschaetzt: true }
  return { umfang: runde(4 * Math.sqrt(a)), geschaetzt: true }
}

// Wandfläche eines Raums.
// Liefert immer mit, WORAUS gerechnet wurde – die Oberfläche kennzeichnet das.
export function wandflaeche(raum, { hoehe = STANDARD_HOEHE } = {}) {
  // Einzige Quelle: die vier Wände aus einzelflaechen(). Diese Funktion summiert
  // sie nur noch – damit können die beiden Zahlen nicht mehr auseinanderlaufen.
  const h = Number(raum?.hoehe) || Number(hoehe) || STANDARD_HOEHE
  const alle = einzelflaechen(raum, { hoehe })
  const waende = alle.filter((f) => f.id.startsWith('wand'))
  const wand = waende.reduce((s, f) => s + f.groesse, 0)

  let umfang = Number(raum?.umfang) || 0
  let geschaetzt = false
  if (!umfang && raum?.breite && raum?.laenge) umfang = umfangAus(raum.breite, raum.laenge)
  if (!umfang) {
    const u = umfangUeberschlag(raum?.flaeche)
    umfang = u.umfang
    geschaetzt = u.geschaetzt
  }
  const brutto = umfang * h
  return {
    wand: runde(wand),
    umfang: runde(umfang),
    hoehe: runde(h),
    abzug: alle.abzug ?? runde(Math.max(0, brutto - wand)),
    geschaetzt: geschaetzt || waende.some((f) => f.geschaetzt),
  }
}

// Alle Bezugsflächen eines Raums auf einen Blick.
// 'decke' und 'boden' sind identisch mit der Grundfläche – das ist keine
// Vereinfachung, sondern beim Innenausbau die übliche Rechnung.
export function flaechenVon(raum, opts = {}) {
  const grund = runde(Number(raum?.flaeche) || flaecheAus(raum?.breite, raum?.laenge))
  const w = wandflaeche({ ...raum, flaeche: grund }, opts)
  return {
    boden: grund,
    decke: grund,
    wand: w.wand,
    umfang: w.umfang,
    hoehe: w.hoehe,
    geschaetzt: w.geschaetzt,
  }
}

// Bezugsarten für die Verteilung einer LV-Position auf die Räume
export const BEZUG = [
  { id: 'decke', schluessel: 'raum.bezugDecke' },
  { id: 'boden', schluessel: 'raum.bezugBoden' },
  { id: 'wand', schluessel: 'raum.bezugWand' },
  { id: 'wanddecke', schluessel: 'raum.bezugWandDecke' },
  { id: 'stueck', schluessel: 'raum.bezugStueck' },
]

// Sollmenge eines Raums für eine gegebene Bezugsart
export function mengeFuerBezug(raum, bezug, opts = {}) {
  const f = flaechenVon(raum, opts)
  switch (bezug) {
    case 'boden': return { menge: f.boden, geschaetzt: false }
    case 'decke': return { menge: f.decke, geschaetzt: false }
    case 'wand': return { menge: f.wand, geschaetzt: f.geschaetzt }
    case 'wanddecke': return { menge: runde(f.wand + f.decke), geschaetzt: f.geschaetzt }
    default: return { menge: 0, geschaetzt: false }   // 'stueck' -> von Hand
  }
}

// Summe über alle Räume – für den Abgleich mit der LV-Menge.
// Weicht sie ab, ist das ein HINWEIS und kein Fehler: ein Bauplan zeigt ein
// Geschoss, das Leistungsverzeichnis umfasst oft mehrere.
export function summeFuerBezug(raeume, bezug, opts = {}) {
  let summe = 0
  let geschaetzt = false
  for (const r of raeume || []) {
    if (r.aktiv === false) continue
    const m = mengeFuerBezug(r, bezug, opts)
    summe += m.menge
    if (m.geschaetzt) geschaetzt = true
  }
  return { menge: runde(summe), geschaetzt }
}

// ---------------------------------------------------------------- Einzelflächen
//
// Ein Maler wird nicht "mit dem Raum" fertig, sondern mit einer Fläche darin:
// erst die Decke, dann drei Wände, die vierte nach dem Möbelrücken. Der
// Fortschritt muss das abbilden können – sonst steht ein Raum wochenlang auf
// "offen", obwohl fünf von sechs Flächen fertig sind.
//
// Die vier Wände heißen nach der Himmelsrichtung im Grundriss (oben = Nord),
// weil das auf der Baustelle eindeutig ist: "die Nordwand" versteht jeder,
// "Wand 3" niemand.

export const FLAECHEN_ARTEN = [
  { id: 'decke', schluessel: 'raum.decke' },
  { id: 'wandN', schluessel: 'raum.wandN' },
  { id: 'wandO', schluessel: 'raum.wandO' },
  { id: 'wandS', schluessel: 'raum.wandS' },
  { id: 'wandW', schluessel: 'raum.wandW' },
  { id: 'boden', schluessel: 'raum.boden' },
]

export const STATUS = ['offen', 'arbeit', 'fertig']

// Alle Einzelflächen eines Raums mit Größe und Zustand.
// Nord/Süd laufen über die BREITE, Ost/West über die LÄNGE – deshalb sind sie
// unterschiedlich groß, und genau das macht den Fortschritt aussagekräftig.
export function einzelflaechen(raum, { hoehe = STANDARD_HOEHE } = {}) {
  // Negative oder unsinnige Maße abfangen. Über die Oberfläche sind sie nicht
  // erreichbar, über einen Import oder einen direkten Schreibvorgang schon –
  // und eine negative Breite drehte den Fortschritt ins Gegenteil.
  const b = Math.max(0, Number(raum?.breite) || 0)
  const l = Math.max(0, Number(raum?.laenge) || 0)
  const h = Number(raum?.hoehe) || Number(hoehe) || STANDARD_HOEHE
  const grund = Number(raum?.flaeche) || flaecheAus(b, l)
  const zustand = raum?.status || {}

  // Ohne Maße (z. B. Raum aus dem Bauplan, nur Fläche bekannt) werden die
  // Wände über den überschlagenen Umfang gleichmäßig aufgeteilt. Das ist eine
  // Schätzung und wird als solche gekennzeichnet.
  const geschaetzt = !b || !l
  const seiteB = b || Math.sqrt(grund)
  const seiteL = l || Math.sqrt(grund)

  // EINE Wandrechnung, nicht zwei.
  //
  // Vorher rechnete diese Funktion die vier Wände roh aus Breite × Höhe – ohne
  // den gespeicherten Umfang und ohne Abzug für Türen und Fenster. wandflaeche()
  // rechnete daneben mit Umfang × Höhe minus Öffnungen. Beide Zahlen standen
  // im selben Raumfenster nebeneinander: der Monteur meldete 45 m², das
  // Leistungsverzeichnis kannte 40,7 m². Am Ende ist das ein Abrechnungsstreit.
  //
  // Jetzt gilt eine Rechnung, und alles andere summiert sie nur noch auf.
  let wandN = seiteB * h
  let wandS = seiteB * h
  let wandO = seiteL * h
  let wandW = seiteL * h

  // Ist ein Umfang hinterlegt, GILT ER – er wurde gemessen, Breite und Länge
  // sind bei einem nicht rechteckigen Raum nur eine Näherung. Die vier Wände
  // werden dann im selben Verhältnis gestreckt oder gestaucht.
  //
  // Ohne Toleranzschwelle: Eine Schwelle hätte zur Folge, dass die Wände auf
  // dem einen Umfang rechnen und der ausgewiesene Abzug auf dem anderen –
  // genau die Art von zwei Wahrheiten, die dieser Umbau beseitigen soll.
  const umfangRoh = Number(raum?.umfang) || 0
  const umfangAusMassen = 2 * (seiteB + seiteL)
  if (umfangRoh > 0 && umfangAusMassen > 0) {
    const f = umfangRoh / umfangAusMassen
    wandN *= f; wandS *= f; wandO *= f; wandW *= f
  }

  // Türen von IHRER Wand abziehen – seit dem Plan-Import ist bekannt, an
  // welcher Wand eine Tür sitzt. Nur wo das fehlt (Altbestand mit bloßer
  // Anzahl), wird gleichmäßig verteilt.
  const abzug = { wandN: 0, wandO: 0, wandS: 0, wandW: 0 }
  const tuerListe = Array.isArray(raum?.tueren) ? raum.tueren : []
  for (const tu of tuerListe) {
    if (!(tu?.wand in abzug)) continue
    abzug[tu.wand] += Math.max(0, (Number(tu.breite) || TUER_BREITE_STD) * (Number(tu.hoehe) || TUER_HOEHE_STD))
  }
  const ohneWand = Array.isArray(raum?.tueren) ? 0 : (Number(raum?.tueren) || 0)
  const gleichmaessig = (ohneWand * ABZUG_TUER + (Number(raum?.fenster) || 0) * ABZUG_FENSTER) / 4
  for (const k of Object.keys(abzug)) abzug[k] += gleichmaessig

  const abzugSumme = abzug.wandN + abzug.wandO + abzug.wandS + abzug.wandW
  const groessen = {
    decke: grund,
    boden: grund,
    wandN: runde(Math.max(0, wandN - abzug.wandN)),
    wandS: runde(Math.max(0, wandS - abzug.wandS)),
    wandO: runde(Math.max(0, wandO - abzug.wandO)),
    wandW: runde(Math.max(0, wandW - abzug.wandW)),
  }
  const liste = FLAECHEN_ARTEN.map((a) => ({
    id: a.id,
    schluessel: a.schluessel,
    groesse: groessen[a.id],
    status: STATUS.includes(zustand[a.id]) ? zustand[a.id] : 'offen',
    geschaetzt: a.id.startsWith('wand') && geschaetzt,
  }))
  // Der Abzug haengt an der Liste, damit wandflaeche ihn nicht zurueckrechnen
  // muss – zurueckgerechnet schleppt er die Rundung jeder einzelnen Wand mit.
  liste.abzug = runde(abzugSumme)
  return liste
}

// Fortschritt eines Raums: nach FLÄCHE gewichtet, nicht nach Anzahl.
// Eine 20-m²-Decke wiegt schwerer als eine 5-m²-Wand – sonst zeigte der Balken
// 50 %, obwohl erst ein Sechstel der Arbeit erledigt ist.
// 'boden' zählt nur mit, wenn dort etwas zu tun ist (Bodenarbeiten sind beim
// Maler die Ausnahme) – deshalb schaltbar über `mitBoden`.
export function fortschrittRaum(raum, { hoehe = STANDARD_HOEHE, mitBoden = false } = {}) {
  const alle = einzelflaechen(raum, { hoehe }).filter((f) => mitBoden || f.id !== 'boden')
  const gesamt = alle.reduce((s, f) => s + f.groesse, 0)
  // Gleiche Form wie im Normalfall – ein abweichendes Feld ('offen' statt
  // 'inArbeit') zwingt jeden Aufrufer zu einer Sonderbehandlung, an die
  // irgendwann jemand nicht denkt.
  if (gesamt <= 0) return { prozent: 0, fertig: 0, inArbeit: 0, gesamt: 0, alleFertig: false }
  const fertig = alle.filter((f) => f.status === 'fertig').reduce((s, f) => s + f.groesse, 0)
  const arbeit = alle.filter((f) => f.status === 'arbeit').reduce((s, f) => s + f.groesse, 0)
  return {
    prozent: Math.round((fertig / gesamt) * 100),
    fertig: runde(fertig),
    inArbeit: runde(arbeit),
    gesamt: runde(gesamt),
    alleFertig: alle.every((f) => f.status === 'fertig'),
  }
}

// Fortschritt über alle Räume einer Baustelle – für die Projektübersicht.
export function fortschrittGesamt(raeume, opts = {}) {
  let fertig = 0
  let gesamt = 0
  for (const r of raeume || []) {
    if (r.aktiv === false) continue
    const f = fortschrittRaum(r, opts)
    fertig += f.fertig
    gesamt += f.gesamt
  }
  return { prozent: gesamt > 0 ? Math.round((fertig / gesamt) * 100) : 0, fertig: runde(fertig), gesamt: runde(gesamt) }
}
