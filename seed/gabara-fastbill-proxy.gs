/**
 * FastBill-CORS-Proxy für die Gabara-Verwaltung (V2 / Produktion).
 *
 * Warum: Der Browser darf my.fastbill.com nicht direkt aufrufen (CORS).
 * Im Dev übernimmt der Vite-Proxy (admin/vite.config.js) – in Produktion
 * (Firebase Hosting) leitet diese Google-Apps-Script-Web-App die Aufrufe weiter.
 *
 * Einrichtung:
 * 1. script.google.com → Neues Projekt (Google-Konto der Firma) → diesen Code einfügen.
 * 2. SECRET unten ändern (frei wählbar) – derselbe Wert kommt in die Verwaltung
 *    (Einstellungen → FastBill → Proxy-URL: "<WebApp-URL>?secret=<SECRET>").
 * 3. Bereitstellen → Web-App: Ausführen als "Ich", Zugriff "Jeder".
 * 4. Web-App-URL inkl. ?secret=... in den Einstellungen als Proxy-URL eintragen.
 *
 * Die Verwaltung sendet den FastBill-Basic-Auth-Header mit; dieses Skript
 * reicht ihn nur durch und speichert nichts.
 */

const SECRET = 'HIER-EIGENES-SECRET-EINTRAGEN'
const FASTBILL_URL = 'https://my.fastbill.com/api/1.0/api.php'

function doPost(e) {
  try {
    const secret = (e.parameter && e.parameter.secret) || ''
    if (secret !== SECRET) {
      return antwort_({ RESPONSE: { ERRORS: ['Proxy: falsches Secret'] } }, 403)
    }
    const auth = (e.parameter && e.parameter.auth) || ''
    const res = UrlFetchApp.fetch(FASTBILL_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Basic ' + auth },
      payload: e.postData && e.postData.contents ? e.postData.contents : '{}',
      muteHttpExceptions: true,
    })
    return ContentService.createTextOutput(res.getContentText())
      .setMimeType(ContentService.MimeType.JSON)
  } catch (err) {
    return antwort_({ RESPONSE: { ERRORS: ['Proxy-Fehler: ' + err] } }, 500)
  }
}

// Verbindungstest: <WebApp-URL>?ping=1 im Browser öffnen
function doGet(e) {
  if (e.parameter && e.parameter.ping) {
    return antwort_({ ok: true, dienst: 'gabara-fastbill-proxy' }, 200)
  }
  return antwort_({ ok: false }, 200)
}

function antwort_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
}
