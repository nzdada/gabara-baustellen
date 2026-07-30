// Patienten-Mails über den kostenlosen Apps-Script-Mail-Dienst (seed/erinnerung.gs).
// Der Aufruf läuft mit mode:'no-cors' – die Antwort ist nicht lesbar, der Versand
// funktioniert trotzdem; Fehler werfen nur bei Netzwerkproblemen.

import { MAIL_DIENST } from './firebase-config.js'

export function mailKonfiguriert() {
  return Boolean(MAIL_DIENST.url)
}

// typ: 'bestaetigung' | 'absage'
// daten: { email, name, datum (dd.mm.yyyy), start, behandlung }
export async function sendePatientenMail(typ, daten) {
  if (!mailKonfiguriert() || !daten.email) return false
  try {
    await fetch(MAIL_DIENST.url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...daten, typ, secret: MAIL_DIENST.secret }),
    })
    return true
  } catch (e) {
    return false
  }
}
