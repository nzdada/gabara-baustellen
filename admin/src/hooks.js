import { useEffect, useState } from 'react'
import { getStore } from '@shared/store.js'
import { EINSTELLUNGEN_DEFAULTS } from '@shared/einstellungen.js'

// Globale Einstellungen (settings/global) mit Default-Fallback, live
export function useEinstellungen() {
  const rows = useCollection('settings')
  return { ...EINSTELLUNGEN_DEFAULTS, ...(rows.find((r) => r.id === 'global') || {}) }
}

// Live-Abo auf eine Sammlung (patients | appointments | requests)
export function useCollection(name) {
  const [rows, setRows] = useState([])
  useEffect(() => {
    let unsub = () => {}
    let aktiv = true
    getStore().then((store) => {
      if (aktiv) unsub = store.subscribe(name, setRows)
    })
    return () => {
      aktiv = false
      unsub()
    }
  }, [name])
  return rows
}

// Gefiltertes Live-Abo (z. B. LV-Positionen EINES Projekts) – nutzt store.subscribeWhere,
// damit im Firebase-Modus nur die passenden Dokumente geladen werden (keine Vollabos!).
export function useWhere(name, feld, wert) {
  const [rows, setRows] = useState([])
  useEffect(() => {
    if (wert === undefined || wert === null || wert === '') { setRows([]); return () => {} }
    let unsub = () => {}
    let aktiv = true
    getStore().then((store) => {
      if (aktiv) unsub = store.subscribeWhere(name, feld, wert, setRows)
    })
    return () => {
      aktiv = false
      unsub()
    }
  }, [name, feld, wert])
  return rows
}

// Live-Abo auf ein Listen-Feld (array-contains): einsaetze, deren tage[]
// den heutigen Tag enthalten. Lädt im Firebase-Modus NUR die Treffer.
export function useContains(name, feld, wert) {
  const [rows, setRows] = useState([])
  useEffect(() => {
    if (wert === undefined || wert === null || wert === '') { setRows([]); return () => {} }
    let unsub = () => {}
    let aktiv = true
    getStore().then((store) => {
      if (aktiv) unsub = store.subscribeContains(name, feld, wert, setRows)
    })
    return () => {
      aktiv = false
      unsub()
    }
  }, [name, feld, wert])
  return rows
}

// Kennzahlen-Unterdokumente MEHRERER Projekte (projekte/{id}/kennzahlen/live)
// als Liste [{ id: projektId, ... }] – der Leitstand liest je Baustelle EIN
// kleines Dokument statt aller Aufgaben (Plan 3.2, Kaltstart < 100 Dokumente).
export function useKennzahlenListe(projektIds) {
  const [docs, setDocs] = useState([])
  const schluessel = (projektIds || []).join('|')
  useEffect(() => {
    if (!schluessel) { setDocs([]); return () => {} }
    const ids = schluessel.split('|')
    const stand = new Map()
    let aktiv = true
    const unsubs = []
    getStore().then((store) => {
      if (!aktiv) return
      for (const id of ids) {
        unsubs.push(store.subscribeKennzahlen(id, (doc) => {
          if (doc) stand.set(id, doc)
          else stand.delete(id)
          setDocs([...stand.values()])
        }))
      }
    })
    return () => {
      aktiv = false
      unsubs.forEach((u) => u())
    }
  }, [schluessel])
  return docs
}

// Einsätze MEHRERER Tage (Wochentafel): je Tag eine array-contains-Abfrage,
// zusammengeführt nach Kennung. Lädt im Firebase-Modus nur die Woche –
// KEIN Vollabo auf die einsaetze-Sammlung.
export function useEinsaetzeTage(tage) {
  const [rows, setRows] = useState([])
  const schluessel = (tage || []).join('|')
  useEffect(() => {
    if (!schluessel) { setRows([]); return () => {} }
    const liste = schluessel.split('|')
    const jeTag = new Map()
    let aktiv = true
    const unsubs = []
    const zusammen = () => {
      const map = new Map()
      for (const rows2 of jeTag.values()) for (const r of rows2) map.set(r.id, r)
      setRows([...map.values()])
    }
    getStore().then((store) => {
      if (!aktiv) return
      for (const tag of liste) {
        unsubs.push(store.subscribeContains('einsaetze', 'tage', tag, (r) => {
          jeTag.set(tag, r)
          zusammen()
        }))
      }
    })
    return () => {
      aktiv = false
      unsubs.forEach((u) => u())
    }
  }, [schluessel])
  return rows
}

export async function withStore(fn) {
  const store = await getStore()
  return fn(store)
}

// Ein settings-Dokument anlegen/aktualisieren – ohne vorherigen list()-Roundtrip.
// `vorhanden` liefert die aufrufende Komponente aus ihrem Live-Abo (useCollection).
export async function speichereSetting(id, daten, vorhanden) {
  await withStore(async (s) => {
    if (vorhanden) await s.update('settings', id, { ...daten, id })
    else await s.add('settings', { ...daten, id })
  })
}
