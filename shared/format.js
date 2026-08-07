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

// Deutsche Zahleneingabe lesen: "16,4", "1.150,50", "8.009", "12 €".
//
// WARUM DAS HIER STEHT UND NICHT ZWEIMAL
// Diese Regel lag bisher nur in admin/src/csv.js. Die Fahrten in shared/ kamen
// nicht daran und benutzten Number() – und Number("16,4") ist NaN, was still
// zu 0 wurde: Der Monteur tippte 16,4 km, angezeigt wurden "0 km · Kilometer
// fehlen". Zwei Parser laufen irgendwann auseinander, deshalb gibt es ab jetzt
// genau einen; csv.js reicht ihn nur noch weiter.
export function parseZahl(wert) {
  if (typeof wert === 'number') return Number.isFinite(wert) ? wert : 0
  let w = String(wert ?? '').trim().replace(/[€\s]/g, '')
  if (!w) return 0
  if (w.includes(',')) {
    // Komma ist das Dezimaltrennzeichen, Punkte sind Tausender
    w = w.replace(/\./g, '').replace(',', '.')
  } else if (/\.\d{3}(\D|$)/.test(w)) {
    // 8.009 ohne Komma = Tausenderpunkt, nicht 8,009
    w = w.replace(/\./g, '')
  }
  const n = Number(w)
  return Number.isFinite(n) ? n : 0
}
