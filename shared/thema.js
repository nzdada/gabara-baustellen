import { useSyncExternalStore } from 'react'

// Hell/Dunkel für die Verwaltung.
//
// Drei Zustände, nicht zwei: 'system' folgt der Einstellung des Geräts (der
// sinnvolle Anfangswert – wer sein Handy abends auf dunkel stellt, will das
// hier auch), 'hell' und 'dunkel' überschreiben sie bewusst.
//
// Umgesetzt wird es über ein Attribut am <html>-Element; die Farbwerte selbst
// stehen in admin/src/index.css. Der Umschalter verändert also KEINE Klassen an
// Bauteilen – jede Ansicht zieht automatisch mit, auch künftige.

const SCHLUESSEL = 'gabara-thema'
const WERTE = ['system', 'hell', 'dunkel']
const horcher = new Set()

let wahl = lies()

function lies() {
  try {
    const roh = localStorage.getItem(SCHLUESSEL)
    return WERTE.includes(roh) ? roh : 'system'
  } catch (e) {
    return 'system'
  }
}

function geraetMagDunkel() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
}

// Was tatsächlich angezeigt wird – 'hell' oder 'dunkel'
export function aktivesThema() {
  return wahl === 'system' ? (geraetMagDunkel() ? 'dunkel' : 'hell') : wahl
}

export function getThema() {
  return wahl
}

export function setThema(neu) {
  if (!WERTE.includes(neu)) return
  wahl = neu
  try { localStorage.setItem(SCHLUESSEL, neu) } catch (e) { /* privater Modus */ }
  anwenden()
  horcher.forEach((cb) => cb())
}

// Reihum: hell -> dunkel -> System -> hell
export function naechstesThema() {
  const i = WERTE.indexOf(wahl)
  setThema(WERTE[(i + 1) % WERTE.length])
}

export function anwenden() {
  if (typeof document === 'undefined') return
  const aktiv = aktivesThema()
  document.documentElement.setAttribute('data-thema', aktiv)
  // Damit auch Bedienelemente des Browsers (Bildlaufleisten, Datumsauswahl,
  // Eingabefelder) mitziehen – sonst leuchtet der Kalender weiß im dunklen Bild.
  document.documentElement.style.colorScheme = aktiv === 'dunkel' ? 'dark' : 'light'
}

// Wechselt das Gerät die Einstellung, während 'system' gewählt ist, ziehen wir mit
if (typeof matchMedia === 'function') {
  try {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (wahl === 'system') { anwenden(); horcher.forEach((cb) => cb()) }
    })
  } catch (e) { /* ältere Browser */ }
}

export function useThema() {
  return useSyncExternalStore(
    (cb) => { horcher.add(cb); return () => horcher.delete(cb) },
    () => wahl,
    () => 'system'
  )
}
