// Teams / Kolonnen: ein Team ist die Gruppe von Mitarbeitern mit demselben
// Feld `team` (Einstellungen -> Mitarbeiter). Mitarbeiter ohne Team-Eintrag
// bilden ihr eigenes Ein-Mann-Team (Name = Mitarbeitername) – so funktioniert
// die Farbcodierung im Kalender auch ohne gepflegte Team-Zuordnung.

export const TEAM_FARBEN = [
  { id: 'rot', label: 'Rot', wert: '#8b1a1a' },
  { id: 'orange', label: 'Orange', wert: '#f97316' },
  { id: 'amber', label: 'Bernstein', wert: '#d97706' },
  { id: 'gruen', label: 'Grün', wert: '#16a34a' },
  { id: 'smaragd', label: 'Smaragd', wert: '#10b981' },
  { id: 'tuerkis', label: 'Türkis', wert: '#0d9488' },
  { id: 'himmel', label: 'Himmelblau', wert: '#0ea5e9' },
  { id: 'blau', label: 'Blau', wert: '#2563eb' },
  { id: 'indigo', label: 'Indigo', wert: '#6366f1' },
  { id: 'violett', label: 'Violett', wert: '#7c3aed' },
  { id: 'pink', label: 'Pink', wert: '#db2777' },
  { id: 'schiefer', label: 'Schiefer', wert: '#475569' },
]

export const STANDARD_FARBE = '#64748b'

// Team-Name eines Mitarbeiters (Fallback: sein eigener Name)
export function teamName(user) {
  return (user?.team || '').trim() || user?.name || 'Ohne Team'
}

// Alle Teams aus den Mitarbeitern ableiten:
// [{ name, farbe, mitglieder: [user, …] }] – Reihenfolge = erstes Auftreten
export function teamsAus(users) {
  const map = new Map()
  for (const u of users) {
    if (u.rolle !== 'mitarbeiter' || u.aktiv === false) continue
    const name = teamName(u)
    if (!map.has(name)) map.set(name, { name, farbe: u.farbe || STANDARD_FARBE, mitglieder: [] })
    map.get(name).mitglieder.push(u)
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'))
}

// Team + Farbe eines Termins: bestimmt durch den ERSTEN zugewiesenen Mitarbeiter.
// Ohne Zuweisung: neutrale Farbe, damit die Karte trotzdem lesbar bleibt.
export function teamFuerTermin(termin, users) {
  const ids = termin?.mitarbeiterIds || []
  const erster = ids.map((id) => users.find((u) => u.id === id)).find(Boolean)
  if (!erster) {
    return { name: termin?.arzt || 'Nicht zugewiesen', farbe: STANDARD_FARBE, mitglieder: [], zugewiesen: false, explizit: false }
  }
  const mitglieder = ids.map((id) => users.find((u) => u.id === id)).filter(Boolean)
  return {
    name: teamName(erster),
    farbe: erster.farbe || STANDARD_FARBE,
    mitglieder,
    zugewiesen: true,
    // explizit = im Mitarbeiterstamm ist wirklich ein Team gepflegt.
    // Sonst ist der "Team-Name" nur der Mitarbeitername – dann nicht doppelt anzeigen.
    explizit: Boolean((erster.team || '').trim()),
  }
}

// Namen der zugewiesenen Monteure als Text ("Ahmad Monteur, Samir Monteur")
export function monteurNamen(termin, users) {
  const namen = (termin?.mitarbeiterIds || [])
    .map((id) => users.find((u) => u.id === id)?.name)
    .filter(Boolean)
  if (namen.length) return namen.join(', ')
  return termin?.arzt || ''
}

// Helle/dunkle Schrift auf einer Hintergrundfarbe (WCAG-nahe Luminanz-Heuristik)
export function textAuf(farbe) {
  const hex = (farbe || STANDARD_FARBE).replace('#', '')
  if (hex.length !== 6) return '#ffffff'
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const luminanz = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminanz > 0.62 ? '#0f172a' : '#ffffff'
}
