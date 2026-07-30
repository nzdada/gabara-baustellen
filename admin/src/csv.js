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
export function parseZahl(wert) {
  if (typeof wert === 'number') return wert
  let w = String(wert || '').trim().replace(/[€\s]/g, '')
  if (!w) return 0
  if (w.includes(',')) {
    w = w.replace(/\./g, '').replace(',', '.')
  } else if (/\.\d{3}(\D|$)/.test(w)) {
    // 8.009 ohne Komma = Tausenderpunkt
    w = w.replace(/\./g, '')
  }
  const n = Number(w)
  return Number.isFinite(n) ? n : 0
}
