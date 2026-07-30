// Google-Kalender-Anbindung (Hauptsystem für Termine im Produktivbetrieb).
//
// Datenschutz-Prinzip: In den Google-Kalender schreiben wir NUR
// Behandlungsart + Patienten-Kürzel (z. B. "PZR – A. B.") — die vollen
// Patientendaten bleiben in der geschützten Datenbank. Die Verknüpfung
// läuft über extendedProperties.private.patientId.
//
// Ohne konfigurierte OAuth-Client-ID (shared/firebase-config.js) läuft der
// Kalender im Demo-Modus: Termine liegen nur in der eigenen Datenbank.

import { GOOGLE_KALENDER } from './firebase-config.js'

let tokenClient = null
let accessToken = null

export function kalenderKonfiguriert() {
  return Boolean(GOOGLE_KALENDER.clientId)
}

export function kalenderVerbunden() {
  return Boolean(accessToken)
}

function ladeScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve()
    const s = document.createElement('script')
    s.src = src
    s.onload = resolve
    s.onerror = () => reject(new Error(`Konnte ${src} nicht laden`))
    document.head.appendChild(s)
  })
}

// Öffnet das Google-Login und holt eine Kalender-Berechtigung (Praxis-Konto)
export async function kalenderVerbinden() {
  if (!kalenderKonfiguriert()) throw new Error('Keine Google-Client-ID konfiguriert (shared/firebase-config.js).')
  await ladeScript('https://accounts.google.com/gsi/client')
  return new Promise((resolve, reject) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_KALENDER.clientId,
      scope: 'https://www.googleapis.com/auth/calendar.events',
      callback: (resp) => {
        if (resp.error) return reject(new Error(resp.error))
        accessToken = resp.access_token
        resolve(true)
      },
    })
    tokenClient.requestAccessToken()
  })
}

async function api(pfad, options = {}) {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_KALENDER.kalenderId)}${pfad}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    }
  )
  if (!res.ok) throw new Error(`Google Kalender: ${res.status} ${await res.text()}`)
  return res.status === 204 ? null : res.json()
}

function patientenKuerzel(name) {
  const teile = (name || '').trim().split(/\s+/)
  if (teile.length < 2) return teile[0] || 'Patient'
  return `${teile[0][0]}. ${teile[teile.length - 1][0]}.`
}

// Legt ein Kalender-Event an — bewusst OHNE volle Patientendaten im Titel.
// patientEmail landet in den (unsichtbaren) shared-Properties, damit das
// Erinnerungs-Skript (seed/erinnerung.gs) sie per getTag() lesen kann.
export async function eventAnlegen(termin, patientEmail = '') {
  if (!kalenderVerbunden()) return null
  const event = {
    summary: `${termin.behandlung} – ${patientenKuerzel(termin.patientName)}`,
    description: 'Details in der Praxis-Verwaltung (geschützt).',
    start: { dateTime: `${termin.datum}T${termin.start}:00`, timeZone: 'Europe/Berlin' },
    end: { dateTime: `${termin.datum}T${termin.ende}:00`, timeZone: 'Europe/Berlin' },
    extendedProperties: {
      private: { patientId: termin.patientId || '', terminId: termin.id || '' },
      shared: patientEmail ? { patientEmail } : {},
    },
  }
  const angelegt = await api('/events', { method: 'POST', body: JSON.stringify(event) })
  return angelegt.id
}

export async function eventLoeschen(eventId) {
  if (!kalenderVerbunden() || !eventId) return
  await api(`/events/${eventId}`, { method: 'DELETE' })
}

export async function eventVerschieben(eventId, termin) {
  if (!kalenderVerbunden() || !eventId) return
  await api(`/events/${eventId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      start: { dateTime: `${termin.datum}T${termin.start}:00`, timeZone: 'Europe/Berlin' },
      end: { dateTime: `${termin.datum}T${termin.ende}:00`, timeZone: 'Europe/Berlin' },
    }),
  })
}
