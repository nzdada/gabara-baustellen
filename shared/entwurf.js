import { useCallback, useEffect, useRef, useState } from 'react'

// Entwurfs-Sicherung für lange Formulare.
//
// Warum: Ein Monteur tippt auf der Baustelle zehn Minuten an einem Regiebericht.
// Handy-Akku leer, Browser räumt den Tab ab, versehentlicher Zurück-Wisch – und
// alles ist weg. Das darf nicht passieren. Der Formularzustand wandert deshalb
// gebremst in den localStorage und überlebt jeden Neustart.
//
// Bewusst NICHT im Store (Firestore/BroadcastChannel): ein halbfertiger Bericht
// ist noch kein Datensatz. Er gehört auf DIESES Gerät, nicht ins Team.
//
// Ablauf:
//   1. Formular öffnet -> liegt ein Entwurf vor, wird GEFRAGT (nicht automatisch
//      übernommen – sonst überschreibt ein alter Entwurf eine frische Eingabe).
//   2. Solange die Frage offen ist, wird NICHT geschrieben.
//   3. Nach Wiederherstellen/Verwerfen läuft die Sicherung alle 500 ms.
//   4. Nach erfolgreichem Speichern: loeschen() – sonst taucht der Entwurf
//      beim nächsten Öffnen wieder auf.

const PRAEFIX = 'gabara-entwurf:'
const BREMSE_MS = 500
const HALTBARKEIT_MS = 14 * 24 * 60 * 60 * 1000 // 14 Tage

function schluesselVon(name) {
  return `${PRAEFIX}${name}`
}

export function entwurfLesen(name) {
  try {
    const roh = localStorage.getItem(schluesselVon(name))
    if (!roh) return null
    const eintrag = JSON.parse(roh)
    if (!eintrag || typeof eintrag !== 'object') return null
    // Altlasten nicht anbieten – ein zwei Wochen alter Entwurf stiftet nur Verwirrung
    if (!eintrag.zeit || Date.now() - eintrag.zeit > HALTBARKEIT_MS) {
      entwurfLoeschen(name)
      return null
    }
    return eintrag
  } catch (e) {
    return null
  }
}

export function entwurfSchreiben(name, daten) {
  try {
    localStorage.setItem(schluesselVon(name), JSON.stringify({ zeit: Date.now(), daten }))
    return true
  } catch (e) {
    // Speicher voll oder privater Modus: Formular läuft normal weiter
    return false
  }
}

export function entwurfLoeschen(name) {
  try { localStorage.removeItem(schluesselVon(name)) } catch (e) { /* egal */ }
}

// Alle Entwürfe entfernen (z. B. beim Zurücksetzen der Demo-Daten)
export function alleEntwuerfeLoeschen() {
  try {
    const weg = Object.keys(localStorage).filter((k) => k.startsWith(PRAEFIX))
    for (const k of weg) localStorage.removeItem(k)
  } catch (e) { /* egal */ }
}

/**
 * @param name    eindeutiger Name des Formulars, z. B. `bericht:regie:neu`
 * @param daten   der aktuelle Formularzustand (muss JSON-fähig sein)
 * @param aktiv   false schaltet die Sicherung ab (z. B. gesperrte Berichte)
 * @returns { gefunden, wiederherstellen, verwerfen, loeschen }
 *          gefunden = { zeit, daten } oder null
 */
export function useEntwurf(name, daten, aktiv = true) {
  // Nur EINMAL beim Öffnen nachsehen – ein späterer Fund wäre der eigene Eintrag
  const [gefunden, setGefunden] = useState(() => (aktiv ? entwurfLesen(name) : null))
  const [entschieden, setEntschieden] = useState(() => !(aktiv && entwurfLesen(name)))
  const timer = useRef(null)

  useEffect(() => {
    if (!aktiv || !entschieden) return undefined
    clearTimeout(timer.current)
    timer.current = setTimeout(() => entwurfSchreiben(name, daten), BREMSE_MS)
    return () => clearTimeout(timer.current)
  }, [name, daten, aktiv, entschieden])

  // Beim Verlassen der Seite die letzte Änderung noch mitnehmen
  useEffect(() => {
    if (!aktiv || !entschieden) return undefined
    const sichern = () => entwurfSchreiben(name, daten)
    window.addEventListener('pagehide', sichern)
    document.addEventListener('visibilitychange', sichern)
    return () => {
      window.removeEventListener('pagehide', sichern)
      document.removeEventListener('visibilitychange', sichern)
    }
  }, [name, daten, aktiv, entschieden])

  const wiederherstellen = useCallback(() => {
    const eintrag = gefunden
    setGefunden(null)
    setEntschieden(true)
    return eintrag?.daten ?? null
  }, [gefunden])

  const verwerfen = useCallback(() => {
    entwurfLoeschen(name)
    setGefunden(null)
    setEntschieden(true)
  }, [name])

  const loeschen = useCallback(() => {
    clearTimeout(timer.current)
    entwurfLoeschen(name)
    setGefunden(null)
  }, [name])

  return { gefunden, wiederherstellen, verwerfen, loeschen }
}
