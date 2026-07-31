// Projekt-Status: bewusst SCHLICHT – 6 Stufen + Archiv.
// Alte, feinere Stati (aus früheren Daten) werden über ALT_ZUORDNUNG abgebildet.

export const PROJEKT_STATUS = [
  { id: 'neu', label: 'Neu / Anfrage', farbe: '#64748b' },
  { id: 'angebot', label: 'Angebot', farbe: '#6366f1' },
  { id: 'beauftragt', label: 'Beauftragt', farbe: '#d946ef' },
  { id: 'inUmsetzung', label: 'In Arbeit', farbe: '#f97316' },
  { id: 'abrechnung', label: 'Abrechnung', farbe: '#10b981' },
  { id: 'abgeschlossen', label: 'Abgeschlossen', farbe: '#22c55e' },
  { id: 'archiviert', label: 'Archiv', farbe: '#94a3b8' },
]

// Alt-Stati (feinere Pipeline der ersten Version) -> neue schlichte Stufen
const ALT_ZUORDNUNG = {
  vorOrtTermin: 'neu',
  detailgespraech: 'angebot',
  auftragsvergabe: 'beauftragt',
  auftragsbestaetigung: 'beauftragt',
  umsetzungsbeginn: 'inUmsetzung',
  kundenrechnung: 'abrechnung',
  reklamation: 'inUmsetzung',
}

export function normalisiereStatus(id) {
  return ALT_ZUORDNUNG[id] || id
}

export const OFFENE_STATI = ['neu', 'angebot', 'beauftragt', 'inUmsetzung', 'abrechnung']

// Offen = weder abgeschlossen noch archiviert (versteht auch Alt-Stati)
export function istOffen(status) {
  return OFFENE_STATI.includes(normalisiereStatus(status))
}

// Stati, deren Einsätze Monteure auf dem Handy sehen sollen
export const AKTIVE_STATI = OFFENE_STATI

export function statusInfo(id) {
  const norm = normalisiereStatus(id)
  return PROJEKT_STATUS.find((s) => s.id === norm) || { id: norm, label: norm || '–', farbe: '#64748b' }
}

// "Überfällig": geplantes Ende liegt in der Vergangenheit, aber Projekt ist offen
export function istUeberfaellig(projekt, heuteIso) {
  if (!projekt?.endeDatum) return false
  if (!istOffen(projekt.status)) return false
  return projekt.endeDatum < heuteIso
}
