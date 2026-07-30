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

export function alter(geburtsdatum) {
  if (!geburtsdatum) return null
  const g = new Date(geburtsdatum)
  const heute = new Date()
  let a = heute.getFullYear() - g.getFullYear()
  const m = heute.getMonth() - g.getMonth()
  if (m < 0 || (m === 0 && heute.getDate() < g.getDate())) a--
  return a
}

export function fmtGeburtstag(iso) {
  if (!iso) return '–'
  const [j, m, t] = iso.split('-')
  return `${t}.${m}.${j}`
}

// Risiko-/Info-Tags eines Patienten: manuell gesetzte (patient.tags)
// + automatisch abgeleitete (Neukunde, Senior, Angst-Heuristik aus Notizen)
export function patientTags(patient) {
  if (!patient) return []
  const tags = []
  const manuell = patient.tags || []
  if (manuell.includes('angst') || /angst/i.test(patient.notizen || '')) {
    tags.push({ key: 'angst', icon: '⚠️', farbe: 'bg-red-100 text-red-700 border-red-200', dunkelFarbe: 'bg-red-500/20 text-red-300 border-red-500/30', label: { de: 'Angstpatient', en: 'Anxious patient', ar: 'مريض قلق' } })
  }
  if (manuell.includes('schmerz')) {
    tags.push({ key: 'schmerz', icon: '⏱️', farbe: 'bg-orange-100 text-orange-700 border-orange-200', dunkelFarbe: 'bg-orange-500/20 text-orange-300 border-orange-500/30', label: { de: 'Chronische Schmerzen', en: 'Chronic pain', ar: 'آلام مزمنة' } })
  }
  if (patient.createdAt && Date.now() - patient.createdAt < 30 * 86400000) {
    tags.push({ key: 'neu', icon: '🆕', farbe: 'bg-sky-100 text-sky-700 border-sky-200', dunkelFarbe: 'bg-sky-500/20 text-sky-300 border-sky-500/30', label: { de: 'Neukunde', en: 'New patient', ar: 'مريض جديد' } })
  }
  const jahre = alter(patient.geburtsdatum)
  if (jahre !== null && jahre >= 70) {
    tags.push({ key: 'senior', icon: '👵', farbe: 'bg-slate-200 text-slate-600 border-slate-300', dunkelFarbe: 'bg-slate-500/25 text-slate-300 border-slate-500/30', label: { de: 'Senior', en: 'Senior', ar: 'كبير السن' } })
  }
  return tags
}
