// Mehrsprachigkeit (Deutsch / Englisch / Arabisch) für Webseite und Verwaltung.
// - useLang(): React-Hook, abonniert die aktuelle Sprache
// - tr(obj):   übersetzt {de,en,ar}-Objekte (Strings gehen unverändert durch)
// - Arabisch schaltet das ganze Dokument auf RTL (rechts-nach-links)

import { useSyncExternalStore } from 'react'

export const SPRACHEN = [
  { code: 'de', label: 'DE', name: 'Deutsch' },
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'ar', label: 'ع', name: 'العربية' },
]

const KEY = 'praxis-sprache'
let lang = 'de'
try {
  const gespeichert = localStorage.getItem(KEY)
  if (gespeichert && SPRACHEN.some((s) => s.code === gespeichert)) lang = gespeichert
} catch (e) { /* localStorage gesperrt */ }

const subs = new Set()

function anwenden() {
  document.documentElement.lang = lang
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
}
anwenden()

export function setLang(neu) {
  lang = neu
  try { localStorage.setItem(KEY, neu) } catch (e) { /* egal */ }
  anwenden()
  subs.forEach((cb) => cb())
}

export function getLang() {
  return lang
}

export function useLang() {
  return useSyncExternalStore(
    (cb) => { subs.add(cb); return () => subs.delete(cb) },
    () => lang
  )
}

// Übersetzt ein {de,en,ar}-Objekt in die aktuelle Sprache (Fallback: Deutsch)
export function tr(obj) {
  if (obj == null) return ''
  if (typeof obj === 'string') return obj
  return obj[lang] ?? obj.de ?? ''
}

// Zentrale Wochentagsnamen (0 = Sonntag … 6 = Samstag) – eine Quelle für
// Einstellungen, Kalender und die öffentliche Öffnungszeiten-Tabelle
export const WOCHENTAGE = {
  0: { de: 'Sonntag', en: 'Sunday', ar: 'الأحد' },
  1: { de: 'Montag', en: 'Monday', ar: 'الاثنين' },
  2: { de: 'Dienstag', en: 'Tuesday', ar: 'الثلاثاء' },
  3: { de: 'Mittwoch', en: 'Wednesday', ar: 'الأربعاء' },
  4: { de: 'Donnerstag', en: 'Thursday', ar: 'الخميس' },
  5: { de: 'Freitag', en: 'Friday', ar: 'الجمعة' },
  6: { de: 'Samstag', en: 'Saturday', ar: 'السبت' },
}

export const T_GESCHLOSSEN = { de: 'geschlossen', en: 'closed', ar: 'مغلق' }
export const T_NUR_TELEFON = { de: 'nur telefonisch erreichbar', en: 'reachable by phone only', ar: 'متاحون هاتفيًا فقط' }

const LOCALES = { de: 'de-DE', en: 'en-GB', ar: 'ar' }

// Lokalisiertes Datum, z. B. datumLok('2026-07-08', { weekday:'long', day:'numeric', month:'long' })
export function datumLok(iso, opts = { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }) {
  return new Date(iso + 'T12:00:00').toLocaleDateString(LOCALES[lang], opts)
}
