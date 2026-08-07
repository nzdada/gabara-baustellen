/**
 * FastBill-CORS-Proxy für die Gabara-Verwaltung (V2 / Produktion).
 *
 * Warum: Der Browser darf my.fastbill.com nicht direkt aufrufen (CORS).
 * Im Dev übernimmt der Vite-Proxy (admin/vite.config.js) – in Produktion
 * (Firebase Hosting) leitet diese Google-Apps-Script-Web-App die Aufrufe weiter.
 *
 * Einrichtung:
 * 1. script.google.com → Neues Projekt (Google-Konto der Firma) → diesen Code einfügen.
 * 2. SECRET unten auf einen langen Zufallswert ändern (mind. 24 Zeichen) – derselbe
 *    Wert kommt in die Verwaltung (Einstellungen → FastBill → Proxy-URL:
 *    "<WebApp-URL>?secret=<SECRET>").
 * 3. Bereitstellen → Web-App: Ausführen als "Ich", Zugriff "Jeder".
 * 4. Web-App-URL inkl. ?secret=... in den Einstellungen als Proxy-URL eintragen.
 *
 * SICHERHEIT
 * - Secret UND FastBill-Zugang kommen im POST-BODY, nicht in der URL. URLs landen
 *   im Browser-Verlauf, in Referrern und in den Server-Logs von Google – der
 *   FastBill-API-Key hat dort nichts verloren. Die Verwaltung schneidet das
 *   ?secret= aus der Proxy-URL heraus und packt es in den Body.
 * - Der alte Weg (secret/auth als Query-Parameter) wird noch angenommen, damit
 *   eine bereits laufende Installation beim Update nicht ausfällt. Nach dem
 *   Update der Verwaltung kommt er nicht mehr vor.
 * - Solange SECRET auf dem Platzhalter steht, antwortet der Proxy gar nicht:
 *   ein voreingestelltes Secret ist dasselbe wie kein Secret.
 * - Dieses Skript speichert nichts und protokolliert keine Zugangsdaten.
 *
 * Hinweis: Google Apps Script kann bei ContentService KEINEN HTTP-Statuscode
 * setzen (immer 200) und reicht KEINE eigenen Request-Header durch. Fehler
 * werden deshalb wie bei FastBill im Body als RESPONSE.ERRORS gemeldet – die
 * Verwaltung wertet genau das aus.
 */

const SECRET = 'HIER-EIGENES-SECRET-EINTRAGEN'
const PLATZHALTER = 'HIER-EIGENES-SECRET-EINTRAGEN'
const FASTBILL_URL = 'https://my.fastbill.com/api/1.0/api.php'

function doPost(e) {
  try {
    if (!SECRET || SECRET === PLATZHALTER || SECRET.length < 16) {
      return fehler_('Proxy nicht eingerichtet: SECRET im Skript setzen (mind. 16 Zeichen).')
    }

    const roh = (e && e.postData && e.postData.contents) || '{}'
    let umschlag = {}
    try { umschlag = JSON.parse(roh) || {} } catch (err) { umschlag = {} }

    // Bevorzugt aus dem Body, ersatzweise aus der Query (Alt-Installation)
    const secret = umschlag.secret || (e.parameter && e.parameter.secret) || ''
    // Fehlendes und falsches Secret AUSEINANDERHALTEN: bei der Einrichtung ist
    // der haeufigste Fehler, das "?secret=..." am Ende der Web-App-Adresse
    // schlicht zu vergessen. "falsches Secret" schickt einen dann auf die
    // Suche nach einem Tippfehler, den es gar nicht gibt.
    if (!secret) {
      return fehler_('Proxy: kein Secret uebermittelt – fehlt "?secret=..." am Ende der Proxy-Adresse in den Einstellungen?')
    }
    if (!gleich_(secret, SECRET)) {
      return fehler_('Proxy: falsches Secret – der Wert hinter ?secret= stimmt nicht mit SECRET im Skript ueberein.')
    }

    const auth = umschlag.auth || (e.parameter && e.parameter.auth) || ''
    if (!auth) {
      return fehler_('Proxy: kein FastBill-Zugang übermittelt')
    }

    // Neuer Weg: die eigentliche FastBill-Anfrage steckt in .payload.
    // Alter Weg: der ganze Body IST die Anfrage.
    const nutzlast = umschlag.payload ? JSON.stringify(umschlag.payload) : roh

    const res = UrlFetchApp.fetch(FASTBILL_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Basic ' + auth },
      payload: nutzlast,
      muteHttpExceptions: true,
    })
    return ContentService.createTextOutput(res.getContentText())
      .setMimeType(ContentService.MimeType.JSON)
  } catch (err) {
    // Bewusst ohne Details: die Meldung geht an den Browser zurück
    return fehler_('Proxy-Fehler beim Weiterleiten')
  }
}

// Verbindungstest: <WebApp-URL>?ping=1 im Browser öffnen.
// Verrät bewusst nichts über Zugang oder Secret.
function doGet(e) {
  if (e && e.parameter && e.parameter.ping) {
    return antwort_({ ok: true, dienst: 'gabara-fastbill-proxy' })
  }
  return antwort_({ ok: false })
}

// Vergleich mit fester Laufzeit – verrät nicht über die Antwortzeit,
// wie viele Zeichen eines geratenen Secrets gestimmt haben.
function gleich_(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (a.length !== b.length) return false
  let abweichung = 0
  for (let i = 0; i < a.length; i++) {
    abweichung |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return abweichung === 0
}

function fehler_(text) {
  return antwort_({ RESPONSE: { ERRORS: [text] } })
}

function antwort_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
}
