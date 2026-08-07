// Kunden-Mails über einen kostenlosen Apps-Script-Mail-Dienst.
// ACHTUNG: Das Gegenstück-Skript liegt noch NICHT im Repo und MAIL_DIENST.url ist
// leer -> es wird derzeit nichts versendet (mailKonfiguriert() = false).
// Rechnungen verschickt ohnehin FastBill; dieser Weg ist nur für sonstige Mails.
// Der Aufruf läuft mit mode:'no-cors' – die Antwort ist nicht lesbar, der Versand
// funktioniert trotzdem; Fehler werfen nur bei Netzwerkproblemen.

import { MAIL_DIENST } from './firebase-config.js'

export function mailKonfiguriert() {
  return Boolean(MAIL_DIENST.url)
}

// typ: 'bestaetigung' | 'absage'
// daten: { email, name, datum (dd.mm.yyyy), start, behandlung }
// Feldname 'behandlung' bleibt: er ist Teil des Datenformats (siehe Termin-Objekt).
export async function sendeKundenMail(typ, daten) {
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
