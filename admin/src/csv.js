// Gemeinsame CSV-/Zahlen-Helfer für Import (Kunden, Artikel, LV-Positionen).
// parseCSV/normDatum stammen aus der bewährten Import-Seite der Vorlage.

// Einfacher, robuster CSV-Parser (Trennzeichen ; , oder Tab, Anführungszeichen erlaubt)
export function parseCSV(text) {
  const erste = text.split(/\r?\n/).find((z) => z.trim()) || ''
  const kandidaten = [';', ',', '\t']
  const trenner = kandidaten.reduce((best, t) =>
    erste.split(t).length > erste.split(best).length ? t : best
  )
  const zeilen = []
  let feld = ''
  let zeile = []
  let inQuote = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuote) {
      if (c === '"' && text[i + 1] === '"') { feld += '"'; i++ }
      else if (c === '"') inQuote = false
      else feld += c
    } else if (c === '"') inQuote = true
    else if (c === trenner) { zeile.push(feld); feld = '' }
    else if (c === '\n' || (c === '\r' && text[i + 1] === '\n')) {
      if (c === '\r') i++
      zeile.push(feld); feld = ''
      if (zeile.some((f) => f.trim())) zeilen.push(zeile)
      zeile = []
    } else feld += c
  }
  if (feld || zeile.length) { zeile.push(feld); if (zeile.some((f) => f.trim())) zeilen.push(zeile) }
  return zeilen
}

// Datum aus Altsystemen normalisieren: 03.05.1970 / 1970-05-03 / 3.5.70
export function normDatum(wert) {
  const w = (wert || '').trim()
  if (!w) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(w)) return w
  const m = w.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/)
  if (m) {
    let jahr = Number(m[3])
    if (jahr < 100) jahr += jahr > 26 ? 1900 : 2000
    return `${jahr}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`
  }
  return w
}

// Deutsches Zahlenformat -> Number: "2.582,421" -> 2582.421 · "3,90" -> 3.9 · "1150" -> 1150
// Liefert 0 bei leerem/unlesbarem Wert.
// Eine einzige Zahlenregel für die ganze Anwendung – sie liegt in
// shared/format.js, damit auch shared/ sie benutzen kann. Hier nur
// weitergereicht, damit die bestehenden Aufrufe unverändert weiterlaufen.
// Importieren UND weiterreichen: Ein reines `export … from` erzeugt KEINE
// lokale Bindung – parseZahlPruef weiter unten ruft parseZahl auf und liefe
// sonst in ein "parseZahl is not defined".
import { parseZahl } from '@shared/format.js'
export { parseZahl }

/**
 * Wie parseZahl, meldet aber zusätzlich, OB der Wert lesbar war.
 * Wichtig für den LV-Import: „ca. 20" oder „n.a." würden sonst still als 0
 * übernommen – und eine 0-Menge fällt in einer 200-Zeilen-Tabelle niemandem
 * auf, bis am Monatsende Geld in der Rechnung fehlt.
 *
 * -> { wert, leer, ok }   leer = nichts eingetragen (kein Fehler)
 */
export function parseZahlPruef(wert) {
  const roh = String(wert ?? '').trim()
  if (!roh) return { wert: 0, leer: true, ok: true }
  // Lesbar ist nur, was ausschließlich aus Ziffern, Trennzeichen, Vorzeichen,
  // Währungssymbol und Leerraum besteht – "ca. 20" oder "20-25" also nicht.
  const ok = /^[-+]?[\d.,\s€]+$/.test(roh) && /\d/.test(roh)
  return { wert: parseZahl(roh), leer: false, ok }
}
