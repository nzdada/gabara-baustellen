// Automatischer Km-Rechner für Fahrtkosten: "Von" -> "Bis".
// Kostenlos und ohne API-Key: Nominatim (Geocoding) + OSRM (Route).
// WICHTIG (Fair-Use): nur klick-getriggert aufrufen, nie bei jedem Tastendruck.
// Bei Fehlern/offline wirft berechneRoute – der Aufrufer bietet dann das
// manuelle Km-Feld an.

async function geocode(adresse) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=de&q=${encodeURIComponent(adresse)}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Adresssuche fehlgeschlagen (${res.status})`)
  const treffer = await res.json()
  if (!treffer.length) throw new Error(`Adresse nicht gefunden: „${adresse}"`)
  return { lat: Number(treffer[0].lat), lon: Number(treffer[0].lon), name: treffer[0].display_name }
}

// Liefert { km, dauerMin, vonName, bisName }
export async function berechneRoute(von, bis) {
  if (!von?.trim() || !bis?.trim()) throw new Error('Bitte Start- und Zielort angeben.')
  const start = await geocode(von)
  // Nominatim-Fair-Use: kurze Pause zwischen den beiden Anfragen
  await new Promise((r) => setTimeout(r, 1100))
  const ziel = await geocode(bis)
  const url = `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${ziel.lon},${ziel.lat}?overview=false`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Routenberechnung fehlgeschlagen (${res.status})`)
  const daten = await res.json()
  const route = daten.routes?.[0]
  if (!route) throw new Error('Keine Route gefunden.')
  return {
    km: Math.round(route.distance / 100) / 10,
    dauerMin: Math.round(route.duration / 60),
    vonName: start.name,
    bisName: ziel.name,
  }
}
