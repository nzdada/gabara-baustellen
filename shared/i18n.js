// Mehrsprachigkeit (Deutsch / Arabisch) für Webseite, Verwaltung und Monteur-App.
// - useLang(): React-Hook, abonniert die aktuelle Sprache
// - tr(obj):   übersetzt {de,ar}-Objekte (Strings gehen unverändert durch)
// - t(key):    schlägt einen Schlüssel im zentralen Wörterbuch nach (shared/texte.js)
// - Arabisch schaltet das ganze Dokument auf RTL (rechts-nach-links)
//
// Zwei Sprachen (Wunsch des Auftraggebers, 01.08.2026). Alte {de,en,ar}-Objekte
// funktionieren weiter – der überzählige en-Schlüssel wird schlicht ignoriert.

import { useSyncExternalStore } from 'react'

export const SPRACHEN = [
  { code: 'de', label: 'DE', name: 'Deutsch' },
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

// Übersetzt ein {de,ar}-Objekt in die aktuelle Sprache (Fallback: Deutsch)
export function tr(obj) {
  if (obj == null) return ''
  if (typeof obj === 'string') return obj
  return obj[lang] ?? obj.de ?? ''
}

// Zentrales Wörterbuch (shared/texte.js) wird beim Start einmal registriert –
// so bleibt i18n.js frei von Inhalten und es gibt keinen Import-Ringschluss.
let woerterbuch = {}
export function registriereTexte(katalog) {
  woerterbuch = { ...woerterbuch, ...katalog }
}

/**
 * Schlüssel-Übersetzung mit Platzhaltern:
 *   t('projekt.anzahl', { n: 3 })  ->  "3 Projekte" / "3 مشاريع"
 * Unbekannte Schlüssel geben den Schlüssel selbst zurück – so fällt im
 * Betrieb sofort auf, was noch fehlt (statt leerer Fläche).
 */
export function t(schluessel, werte) {
  const eintrag = woerterbuch[schluessel]
  let text = eintrag == null ? schluessel : (eintrag[lang] ?? eintrag.de ?? schluessel)
  if (werte) {
    for (const [k, v] of Object.entries(werte)) text = text.split(`{${k}}`).join(String(v))
  }
  return text
}

// Ist gerade eine Rechts-nach-links-Sprache aktiv?
export function istRtl() {
  return lang === 'ar'
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

// Aktuelles Gebietsschema – für Intl-Formate, die kein eigenes Wörterbuch brauchen
export function lokale() {
  return LOCALES[lang] || 'de-DE'
}

// Lokalisiertes Datum, z. B. datumLok('2026-07-08', { weekday:'long', day:'numeric', month:'long' })
export function datumLok(iso, opts = { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }) {
  return new Date(iso + 'T12:00:00').toLocaleDateString(LOCALES[lang], opts)
}
