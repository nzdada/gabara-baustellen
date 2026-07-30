// Leichtes Text-Format für Behandlungs-Zusammenfassungen:
// **fett** und Zeilen mit "- " werden als Liste dargestellt. Kein HTML-Input!

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function inline(s) {
  return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

// Wandelt den Zusammenfassungs-Text in sicheres HTML um
export function textZuHtml(text) {
  if (!text) return ''
  const zeilen = text.split(/\r?\n/)
  const teile = []
  let liste = null
  for (const zeile of zeilen) {
    if (/^\s*-\s+/.test(zeile)) {
      if (!liste) liste = []
      liste.push(`<li>${inline(zeile.replace(/^\s*-\s+/, ''))}</li>`)
    } else {
      if (liste) {
        teile.push(`<ul>${liste.join('')}</ul>`)
        liste = null
      }
      if (zeile.trim()) teile.push(`<p>${inline(zeile)}</p>`)
    }
  }
  if (liste) teile.push(`<ul>${liste.join('')}</ul>`)
  return teile.join('')
}

export function hatFormatierung(text) {
  return /\*\*.+?\*\*/.test(text || '') || /^\s*-\s+/m.test(text || '')
}

// Summe einer Positionsliste [{preis, anzahl}]
export function summe(leistungen) {
  return (leistungen || []).reduce((s, l) => s + (Number(l.preis) || 0) * (Number(l.anzahl) || 1), 0)
}

export function euro(betrag) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(betrag || 0)
}
