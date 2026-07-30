// Projekt-Status-Pipeline (Baustellen-Lebenslauf), Reihenfolge = Anzeige.
// Vorbild: typische Handwerker-Software-Pipeline (Erstkontakt -> Abrechnung).

export const PROJEKT_STATUS = [
  { id: 'neu', label: 'Neu – Erstkontakt', farbe: '#64748b' },
  { id: 'vorOrtTermin', label: 'Vor-Ort-Termin', farbe: '#0ea5e9' },
  { id: 'angebot', label: 'Angebotserstellung', farbe: '#6366f1' },
  { id: 'detailgespraech', label: 'Detailgespräch', farbe: '#8b5cf6' },
  { id: 'auftragsvergabe', label: 'Auftragsvergabe', farbe: '#d946ef' },
  { id: 'auftragsbestaetigung', label: 'Auftragsbestätigung', farbe: '#ec4899' },
  { id: 'umsetzungsbeginn', label: 'Umsetzungsbeginn', farbe: '#f59e0b' },
  { id: 'inUmsetzung', label: 'In Umsetzung', farbe: '#f97316' },
  { id: 'kundenrechnung', label: 'Kundenrechnung', farbe: '#10b981' },
  { id: 'reklamation', label: 'Reklamation', farbe: '#ef4444' },
  { id: 'abgeschlossen', label: 'Abgeschlossen', farbe: '#22c55e' },
  { id: 'archiviert', label: 'Archiviert', farbe: '#94a3b8' },
]

// Stati, bei denen die Baustelle als "offen" gilt (Pipeline-Filter "Alle Offenen")
export const OFFENE_STATI = PROJEKT_STATUS
  .map((s) => s.id)
  .filter((id) => id !== 'abgeschlossen' && id !== 'archiviert')

// Stati, deren Einsätze Monteure auf dem Handy noch sehen sollen
export const AKTIVE_STATI = OFFENE_STATI

export function statusInfo(id) {
  return PROJEKT_STATUS.find((s) => s.id === id) || { id, label: id, farbe: '#64748b' }
}

// "Überfällig": geplantes Ende liegt in der Vergangenheit, aber Projekt ist offen
export function istUeberfaellig(projekt, heuteIso) {
  if (!projekt?.endeDatum) return false
  if (!OFFENE_STATI.includes(projekt.status)) return false
  return projekt.endeDatum < heuteIso
}
