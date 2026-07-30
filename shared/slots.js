import { OEFFNUNGSZEITEN } from './praxis.js'

export const SLOT_MINUTEN = 30

export function toISO(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const t = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${t}`
}

export function heuteISO() {
  return toISO(new Date())
}

export function addTage(iso, tage) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + tage)
  return toISO(d)
}

export function wochentag(iso) {
  return new Date(iso + 'T12:00:00').getDay()
}

const TAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
const TAGE_LANG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

export function fmtDatum(iso, lang = false) {
  const d = new Date(iso + 'T12:00:00')
  const tag = lang ? TAGE_LANG[d.getDay()] : TAGE[d.getDay()]
  return `${tag}, ${d.getDate()}. ${MONATE[d.getMonth()]}`
}

export function fmtDatumVoll(iso) {
  const d = new Date(iso + 'T12:00:00')
  return `${TAGE_LANG[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

function zuMinuten(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function zuZeit(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

export { zuMinuten, zuZeit }

// Kanonische Form der Öffnungszeiten: {1..6: [{von,bis}, …]} – akzeptiert
// Firestore-Docs (String-Schlüssel, {von,bis}) und die statische Array-Form.
// roh = null liefert die statischen Standard-Zeiten aus praxis.js.
export function normalisiereFenster(roh) {
  const f = {}
  for (let t = 1; t <= 6; t++) {
    const liste = roh ? (roh[t] || roh[String(t)] || []) : (OEFFNUNGSZEITEN[t] || [])
    f[t] = liste.map((x) => (Array.isArray(x) ? { von: x[0], bis: x[1] } : { von: x.von, bis: x.bis }))
  }
  return f
}

// Öffnungszeiten normalisieren: akzeptiert die statische Form [["08:00","12:00"], …]
// UND die Firestore-Form [{von,bis}, …] aus den Einstellungen (settings/oeffnungszeiten)
export function fensterFuer(iso, zeiten) {
  const quelle = zeiten || OEFFNUNGSZEITEN
  const f = quelle[wochentag(iso)] || quelle[String(wochentag(iso))] || []
  return f.map((x) => (Array.isArray(x) ? x : [x.von, x.bis]))
}

// Alle möglichen Slot-Startzeiten eines Tages laut Öffnungszeiten
export function tagesSlots(iso, zeiten = null) {
  const slots = []
  for (const [von, bis] of fensterFuer(iso, zeiten)) {
    for (let m = zuMinuten(von); m + SLOT_MINUTEN <= zuMinuten(bis); m += SLOT_MINUTEN) {
      slots.push(zuZeit(m))
    }
  }
  return slots
}

// Freie Startzeiten für eine Behandlung mit Dauer `dauer` (Minuten),
// unter Berücksichtigung belegter Zeitfenster busy = [{datum, start, ende}]
export function freieSlots(iso, dauer, busy, zeiten = null) {
  const heute = heuteISO()
  if (iso < heute) return []
  const belegte = busy
    .filter((b) => b.datum === iso)
    .map((b) => [zuMinuten(b.start), zuMinuten(b.ende)])
  const frei = []
  const jetztMin = iso === heute ? new Date().getHours() * 60 + new Date().getMinutes() : -1
  for (const [von, bis] of fensterFuer(iso, zeiten)) {
    for (let m = zuMinuten(von); m + dauer <= zuMinuten(bis); m += SLOT_MINUTEN) {
      if (m <= jetztMin) continue
      const ende = m + dauer
      const kollidiert = belegte.some(([bs, be]) => m < be && ende > bs)
      if (!kollidiert) frei.push(zuZeit(m))
    }
  }
  return frei
}

// Die nächsten N buchbaren Tage (mit Öffnungszeiten), ab heute
export function buchbareTage(anzahl = 14, zeiten = null) {
  const tage = []
  let iso = addTage(heuteISO(), 0)
  let sicherheit = 0
  while (tage.length < anzahl && sicherheit < 60) {
    if (fensterFuer(iso, zeiten).length > 0) tage.push(iso)
    iso = addTage(iso, 1)
    sicherheit++
  }
  return tage
}

// Liegt ein Tag in einem Urlaubs-/Betriebsferien-Zeitraum? urlaub = [{von,bis}] (ISO-Daten)
export function imUrlaub(iso, urlaub) {
  return (urlaub || []).some((u) => u.von <= iso && iso <= u.bis)
}

export function endeZeit(start, dauer) {
  return zuZeit(zuMinuten(start) + dauer)
}
