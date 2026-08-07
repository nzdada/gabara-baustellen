// Türen eines Raums.
//
// WOZU ÜBERHAUPT
// Ein Raum ohne Türen ist in der 3D-Ansicht ein geschlossener Kasten – man
// sieht nicht hinein, und der Grundriss sieht nicht aus wie der Bauplan. Mit
// Öffnungen wird aus vier Wänden ein begehbarer Raum.
//
// WOHER DIE DATEN KOMMEN
// Zwei Quellen, und sie sind unterschiedlich verlässlich:
//  - 'plan'      – aus dem Türsymbol im Bauplan gelesen (Bogen mit Türblatt).
//                  Das ist gemessen, nicht geraten.
//  - 'hand'      – im Büro eingetragen.
// Was nicht gefunden wurde, wird NICHT erfunden. Ein Raum ohne erkannte Tür
// bleibt ohne Tür, bis jemand eine einträgt – eine ausgedachte Tür an der
// falschen Wand ist schlimmer als gar keine.

export const TUER_HOEHE = 2.01        // Standard-Türhöhe im Innenausbau (m)
export const TUER_BREITE = 0.885      // gängiges Baurichtmaß (m)

// Die vier Wände heißen überall gleich – hier wie in raumflaeche.js.
export const WAENDE = ['wandN', 'wandO', 'wandS', 'wandW']

export function tuerenVon(raum) {
  const t = Array.isArray(raum?.tueren) ? raum.tueren : []
  return t.filter((x) => x && WAENDE.includes(x.wand))
}

// Zählt Türen – auch dann, wenn das Feld noch die alte Zahl statt einer Liste
// enthält. Vor den Plan-Türen war `tueren` eine schlichte Anzahl; Bestandsdaten
// müssen weiterlaufen, ohne dass jemand etwas nachpflegt.
export function tuerAnzahl(raum) {
  if (Array.isArray(raum?.tueren)) return raum.tueren.length
  return Number(raum?.tueren) || 0
}

export function neueTuer({ wand = 'wandS', position = 0.5, breite = TUER_BREITE, hoehe = TUER_HOEHE, herkunft = 'hand' } = {}) {
  return {
    id: `tu-${Math.random().toString(36).slice(2, 9)}`,
    wand,
    position: Math.max(0, Math.min(1, Number(position) || 0.5)),
    breite: Math.max(0.5, Number(breite) || TUER_BREITE),
    hoehe: Math.max(1.6, Number(hoehe) || TUER_HOEHE),
    herkunft,
  }
}

// Eine im Plan gefundene Tür einem Raum zuordnen.
//
// Gegeben: Türmittelpunkt in Metern und das Raumrechteck. Gesucht: an welcher
// Wand sie sitzt und wo auf dieser Wand. Entschieden wird über den kleinsten
// Abstand zu den vier Wandlinien – eine Tür liegt IN der Wand, ihr Symbol ragt
// aber in den Raum hinein, deshalb zählt der Abstand zur Linie, nicht zur Ecke.
export function tuerZuWand({ mx, my, breite }, raum, { toleranz = 0.9 } = {}) {
  const x = Number(raum.x) || 0
  const y = Number(raum.y) || 0
  const b = Number(raum.breite) || 0
  const l = Number(raum.laenge) || 0
  if (b <= 0 || l <= 0) return null
  // Nur Türen berücksichtigen, deren Mittelpunkt am Raum liegt
  if (mx < x - toleranz || mx > x + b + toleranz || my < y - toleranz || my > y + l + toleranz) return null

  const abstaende = [
    { wand: 'wandN', d: Math.abs(my - y), pos: (mx - x) / b },
    { wand: 'wandS', d: Math.abs(my - (y + l)), pos: (mx - x) / b },
    { wand: 'wandW', d: Math.abs(mx - x), pos: (my - y) / l },
    { wand: 'wandO', d: Math.abs(mx - (x + b)), pos: (my - y) / l },
  ].sort((a, c) => a.d - c.d)

  const beste = abstaende[0]
  if (beste.d > toleranz) return null
  if (beste.pos < -0.05 || beste.pos > 1.05) return null
  return neueTuer({
    wand: beste.wand,
    position: Math.max(0.08, Math.min(0.92, beste.pos)),
    breite,
    herkunft: 'plan',
  })
}
