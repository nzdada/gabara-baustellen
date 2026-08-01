// Projekt-Status: 5 feste Stufen (Vorgabe Gabara, Stand 08/2026).
// Alte/feinere Stati aus früheren Daten werden über ALT_ZUORDNUNG abgebildet,
// damit bestehende Projekte nach dem Update nicht "statuslos" dastehen.

export const PROJEKT_STATUS = [
  { id: 'offen', label: 'Offen', farbe: '#64748b' },
  { id: 'beauftragt', label: 'Beauftragt', farbe: '#6366f1' },
  { id: 'inArbeit', label: 'In Arbeit', farbe: '#f97316' },
  { id: 'abrechnung', label: 'Abrechnung', farbe: '#0ea5e9' },
  { id: 'abgeschlossen', label: 'Abgeschlossen', farbe: '#22c55e' },
]

// Alt-Stati (frühere Pipelines) -> neue 5 Stufen
const ALT_ZUORDNUNG = {
  neu: 'offen',
  angebot: 'offen',
  vorOrtTermin: 'offen',
  detailgespraech: 'offen',
  auftragsvergabe: 'beauftragt',
  auftragsbestaetigung: 'beauftragt',
  umsetzungsbeginn: 'inArbeit',
  inUmsetzung: 'inArbeit',
  reklamation: 'inArbeit',
  kundenrechnung: 'abrechnung',
  archiviert: 'abgeschlossen',
}

export function normalisiereStatus(id) {
  return ALT_ZUORDNUNG[id] || id || 'offen'
}

export const OFFENE_STATI = ['offen', 'beauftragt', 'inArbeit', 'abrechnung']

// Offen = alles außer abgeschlossen (versteht auch Alt-Stati)
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
