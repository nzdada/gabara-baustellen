// Zentrale Absage-Logik mit 24-Stunden-Regel (§ 615 BGB Ausfallhonorar):
// Delta = Terminzeit - Absagezeit. Unter der Frist wird automatisch die
// Ausfallgebühr als Abrechnungsposition erfasst, der Termin geht in die
// Abrechnungs-Pipeline ('pruefen') und der Patient erhält die Gebühren-Mail.
// (Frist/Gebühr werden in WP G aus den globalen Einstellungen gelesen.)

import { sendePatientenMail } from '@shared/mail.js'

export const STORNO_FRIST_STUNDEN = 24 // Fallback – tatsächlicher Wert kommt aus den Einstellungen
export const AUSFALL_GEBUEHR = 50

export function stundenBisTermin(termin) {
  return (new Date(`${termin.datum}T${termin.start}:00`).getTime() - Date.now()) / 3600000
}

export function istKurzfristig(termin, fristStunden = STORNO_FRIST_STUNDEN) {
  const h = stundenBisTermin(termin)
  return h > 0 && h < fristStunden
}

// gebuehrBerechnen: true = Ausfallhonorar ansetzen (Entscheidung trifft der Aufrufer,
// z. B. nach Rückfrage – bei Absage DURCH die Praxis fällt keine Gebühr an)
export async function terminAbsagen(store, termin, { gebuehrBerechnen = false, gebuehr = AUSFALL_GEBUEHR } = {}) {
  const patch = { status: 'abgesagt', abgesagtAm: new Date().toISOString() }
  if (gebuehrBerechnen) {
    patch.kurzfristig = true
    patch.ausfallgebuehr = 'ausstehend'
    patch.rechnung = 'pruefen'
    patch.leistungen = [
      ...(termin.leistungen || []),
      {
        katalogId: 'ausfall',
        code: '§ 615 BGB',
        name: 'Ausfallhonorar – kurzfristige Absage',
        preis: gebuehr,
        anzahl: 1,
      },
    ]
  }
  await store.update('appointments', termin.id, patch)
  if (store.mode === 'firebase') await store.loescheSlot(termin.id)

  if (gebuehrBerechnen && termin.patientEmail) {
    sendePatientenMail('gebuehr', {
      email: termin.patientEmail,
      name: termin.patientName,
      datum: new Date(termin.datum + 'T12:00:00').toLocaleDateString('de-DE'),
      start: termin.start,
      behandlung: termin.behandlung,
      sprache: termin.sprache || 'de',
    }).catch(() => {})
  }
  return gebuehrBerechnen
}
