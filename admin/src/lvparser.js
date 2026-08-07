// Erkennung von LV-Positionen aus eingefügtem PDF-/GAEB-Text.
// Getrennt von der UI, damit die Heuristik nachvollziehbar und testbar bleibt.
//
// Aufbau einer typischen LV-Zeile aus einem PDF-Textexport:
//   4.2.3.7.1.1  Flächen vorbereiten und grundieren
//   Tiefengrundierung liefern und auftragen …            <- Langtext
//   2.582,421 m²            1,25            3.228,03     <- Menge/ME/EP/GP
//
// Regeln:
//  * OZ = Zeilenanfang aus Ziffern/Punkten, gefolgt von Leerzeichen UND Text.
//    Eine Mengenzeile („2.582,421 m²") wird NICHT als OZ gelesen, weil nach der
//    Zahl ein Komma statt eines Leerzeichens steht.
//  * Menge/Einheit/EP/GP werden aus der GESAMTEN Position (alle Zeilen) gezogen.
//  * Titel = Eintrag ohne Menge, unter dem weitere OZ hängen (4.2 ist Titel von 4.2.1).

import { parseZahl } from './csv.js'

const EINHEITEN = [
  'm²', 'm2', 'qm', 'm³', 'm3', 'cbm', 'lfdm', 'lfm', 'mtr', 'm',
  'Stck.', 'Stck', 'Stk.', 'Stk', 'Stück', 'St.', 'St',
  'Std.', 'Std', 'Stunden', 'Std/h', 'h',
  'psch', 'Psch', 'Psch.', 'pauschal', 'Pauschale', 'Pausch.',
  'kg', 'to', 't', 'ltr', 'Ltr', 'l', 'Sack', 'Eimer', 'Rolle', 'Dose',
  'Kartusche', 'Bogen', 'Satz', 'Paar', 'Set', 'Pkt', '%',
]

const NORM_EINHEIT = { m2: 'm²', qm: 'm²', m3: 'm³', cbm: 'm³', lfdm: 'lfm', mtr: 'm', St: 'Stck.', 'St.': 'Stck.', Stk: 'Stck.', 'Stk.': 'Stck.', Stück: 'Stck.', Stck: 'Stck.', Std: 'Std.', h: 'Std.', Stunden: 'Std.', psch: 'psch', Psch: 'psch', 'Psch.': 'psch', pauschal: 'psch', Pauschale: 'psch', 'Pausch.': 'psch', to: 't', ltr: 'l', Ltr: 'l' }

function esc(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Längste Einheiten zuerst, damit „m²" vor „m" greift
const EINHEIT_ALT = [...EINHEITEN].sort((a, b) => b.length - a.length).map(esc).join('|')
const ZAHL = '\\d[\\d.]*(?:,\\d+)?'

const MENGE_RE = new RegExp(`(${ZAHL})\\s*(${EINHEIT_ALT})(?![\\wäöüÄÖÜß])`)
// Nur eine Zahl+Einheit am ZEILENENDE (typische Mengenzeile) – höchste Trefferqualität
const MENGE_ENDE_RE = new RegExp(`(^|\\s)(${ZAHL})\\s*(${EINHEIT_ALT})(?![\\wäöüÄÖÜß])\\s*(.*)$`)
// OZ: Ziffern mit Punkten (auch „3.2.6.3..2"), danach Leerzeichen/Klammer und Text
const OZ_RE = /^\s*(\d{1,4}(?:\.{1,2}\d{1,4})*)[\s)]+(?=\S)(.*)$/
// Reine Einheiten-/Preiszeile (keine Position)
const NUR_ZAHLEN_RE = new RegExp(`^\\s*${ZAHL}(\\s*(${EINHEIT_ALT}))?[\\s\\d.,€]*$`)

function normEinheit(roh) {
  return NORM_EINHEIT[roh] || roh
}

// Menge/Einheit/EP/GP aus einer Zeile ziehen (leere Felder = nicht gefunden)
export function zahlenAusZeile(zeile) {
  const m = zeile.match(MENGE_ENDE_RE)
  if (!m) return null
  const menge = parseZahl(m[2])
  const einheit = normEinheit(m[3])
  // Nach Menge+Einheit folgen üblicherweise EP und GP (Dezimalkomma, 2 Stellen)
  const rest = (m[4] || '').match(/\d[\d.]*,\d{2}/g) || []
  return {
    menge,
    einheit,
    einheitspreis: rest.length ? parseZahl(rest[0]) : 0,
    gesamtpreis: rest.length > 1 ? parseZahl(rest[1]) : 0,
  }
}

// Sieht die Zeile aus wie eine Mengen-/Preiszeile (und nicht wie Fließtext)?
function istZahlenZeile(zeile) {
  return NUR_ZAHLEN_RE.test(zeile)
}

/**
 * Zerlegt eingefügten LV-Text in Positionen.
 * Liefert { eintraege, ignoriert } – `ignoriert` sind Zeilen, die zu keiner
 * Position gehören (meist Kopfzeilen des PDFs). Sie werden dem Benutzer
 * angezeigt, statt still zu verschwinden: sonst fehlen Positionen in der
 * Abrechnung, ohne dass es jemand merkt.
 */
export function analysiereLvText(text) {
  const eintraege = []
  const ignoriert = []
  let akt = null

  const abschliessen = () => {
    if (!akt) return
    akt.langtext = akt.langtextZeilen.join('\n').trim()
    delete akt.langtextZeilen
    eintraege.push(akt)
    akt = null
  }

  const flagsPruefen = (eintrag, zeile) => {
    if (/\(?\s*bedarfsposition|\(bedarfspos|\bBedarfsp/i.test(zeile)) eintrag.flags.bedarf = true
    if (/\bNEP\b|Nachtragsposition|nicht\s+eventual/i.test(zeile)) eintrag.flags.nep = true
    if (/\bAlternativ(position)?\b|\bEventualposition\b/i.test(zeile)) eintrag.flags.bedarf = true
  }

  // Zahlen der Zeile in den aktuellen Eintrag übernehmen (erste Fundstelle gewinnt)
  const zahlenUebernehmen = (eintrag, zeile) => {
    const z = zahlenAusZeile(zeile)
    if (!z || !z.menge) return false
    if (!eintrag.menge) {
      eintrag.menge = z.menge
      eintrag.einheit = z.einheit
    }
    if (!eintrag.einheitspreis && z.einheitspreis) eintrag.einheitspreis = z.einheitspreis
    // Einheitspreis aus Gesamtpreis ableiten, falls nur GP dasteht
    if (!eintrag.einheitspreis && z.gesamtpreis && eintrag.menge) {
      eintrag.einheitspreis = Math.round((z.gesamtpreis / eintrag.menge) * 100) / 100
    }
    return true
  }

  for (const roh of text.split(/\r?\n/)) {
    const zeile = roh.replace(/\s+$/, '')
    if (!zeile.trim()) continue

    // Reine Zahlenzeile gehört immer zur laufenden Position, nie zu einer neuen OZ
    if (akt && istZahlenZeile(zeile)) {
      zahlenUebernehmen(akt, zeile)
      flagsPruefen(akt, zeile)
      continue
    }

    const m = zeile.match(OZ_RE)
    const rest = m ? (m[2] || '').trim() : ''
    // Neue Position nur, wenn nach der OZ auch echter Text folgt
    const istNeueOz = Boolean(m) && rest.length >= 3 && /[A-Za-zÄÖÜäöüß]/.test(rest.slice(0, 2))

    if (istNeueOz) {
      abschliessen()
      akt = {
        oz: m[1],
        kurztext: rest.replace(MENGE_ENDE_RE, '').trim() || rest,
        langtextZeilen: [],
        menge: 0,
        einheit: '',
        einheitspreis: 0,
        flags: {},
      }
      zahlenUebernehmen(akt, rest)
      flagsPruefen(akt, zeile)
    } else if (akt) {
      flagsPruefen(akt, zeile)
      const hatteZahlen = zahlenUebernehmen(akt, zeile)
      // Zeilen, aus denen nur Zahlen kamen, nicht in den Langtext spiegeln
      if (!hatteZahlen || !istZahlenZeile(zeile)) akt.langtextZeilen.push(zeile.trim())
    } else {
      // Vor der ersten OZ: gehört zu keiner Position. Kurze Reste (Seitenzahlen,
      // Striche) sind Rauschen und bleiben unerwähnt.
      if (zeile.trim().length > 6) ignoriert.push(zeile.trim())
    }
  }
  abschliessen()

  return { eintraege: markiereTitel(eintraege), ignoriert }
}

// Titel = Eintrag ohne Menge, unter dem weitere OZ hängen (z. B. „4.2" über „4.2.1")
export function markiereTitel(eintraege) {
  const ozListe = eintraege.map((e) => e.oz)
  return eintraege.map((e) => {
    const hatKinder = ozListe.some((oz) => oz !== e.oz && oz.startsWith(e.oz + '.'))
    const typ = e.menge > 0 ? 'position' : hatKinder ? 'titel' : 'position'
    return {
      oz: e.oz,
      typ,
      kurztext: e.kurztext,
      langtext: e.langtext || '',
      mengeText: e.menge ? String(e.menge).replace('.', ',') : '',
      einheit: e.einheit || '',
      epText: e.einheitspreis ? e.einheitspreis.toFixed(2).replace('.', ',') : '',
      flags: e.flags || {},
    }
  })
}
