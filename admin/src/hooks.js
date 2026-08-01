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
