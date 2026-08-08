// JSON-Export ALLER Firestore-Sammlungen (AP 3).
//
// "Eine Sicherung, die nie zurückgespielt wurde, ist keine Sicherung" – dieses
// Skript ist die erste Hälfte: ein vollständiger, lesbarer Abzug. Es schreibt
// je Wurzel-Sammlung eine JSON-Datei nach  sicherungen/<zeitstempel>/  und
// nimmt Unter-Sammlungen (z. B. projekte/{id}/kennzahlen) je Dokument mit.
//
// WICHTIG: Die nächtliche Foto-Kopie sichert nur Bilder – Aufgaben, Räume,
// Stunden, Berichte, LV und Rechnungen sichert NUR dieser Export (Plan 9,
// "Sicherung"). Der Ordner sicherungen/ ist per .gitignore ausgeschlossen:
// er enthält echte Betriebsdaten und gehört nicht in das Repo.
//
// VORAUSSETZUNG (wie scripts/setze-rolle.mjs):
//   1. Firebase-Konsole → Projekteinstellungen → Dienstkonten →
//      "Neuen privaten Schlüssel erzeugen" → speichern als
//      scripts/dienstkonto.json   (per .gitignore ausgeschlossen!)
//   2. npm i -D firebase-admin
//
// Aufruf:  npm run sicherung     (oder: node scripts/sicherung.mjs)

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HIER = path.dirname(fileURLToPath(import.meta.url))
const WURZEL = path.resolve(HIER, '..')
const SCHLUESSEL = path.join(HIER, 'dienstkonto.json')

if (!existsSync(SCHLUESSEL)) {
  console.error('✗ Dienstkonto-Schlüssel fehlt: scripts/dienstkonto.json')
  console.error('  Ohne ihn kann kein Skript die Datenbank vollständig lesen.')
  console.error('  Firebase-Konsole → Projekteinstellungen → Dienstkonten →')
  console.error('  "Neuen privaten Schlüssel erzeugen" → als scripts/dienstkonto.json speichern.')
  console.error('  Die Datei ist per .gitignore ausgeschlossen – NIE einchecken.')
  process.exit(1)
}

let admin
try {
  admin = (await import('firebase-admin')).default
} catch (e) {
  console.error('✗ firebase-admin ist nicht installiert.')
  console.error('  Einmalig im Wurzelverzeichnis:  npm i -D firebase-admin')
  process.exit(1)
}

const dienstkonto = JSON.parse(readFileSync(SCHLUESSEL, 'utf8'))
admin.initializeApp({ credential: admin.credential.cert(dienstkonto) })
const db = admin.firestore()

// Firestore-Sonderwerte in reines JSON übersetzen. Zeitstempel werden als
// ISO-Text exportiert, Verweise als Pfad-Text – beim Zurückspielen muss das
// berücksichtigt werden (Rückweg-Protokoll, AP-3-Checkliste des Inhabers).
function wandle(wert) {
  if (wert === null || wert === undefined) return wert
  if (typeof wert.toDate === 'function') return wert.toDate().toISOString()          // Timestamp
  if (typeof wert.latitude === 'number' && typeof wert.longitude === 'number') {
    return { lat: wert.latitude, lng: wert.longitude }                               // GeoPoint
  }
  if (wert.constructor?.name === 'DocumentReference') return `verweis:${wert.path}`
  if (Buffer.isBuffer(wert)) return `base64:${wert.toString('base64')}`
  if (Array.isArray(wert)) return wert.map(wandle)
  if (typeof wert === 'object') {
    const raus = {}
    for (const [k, v] of Object.entries(wert)) raus[k] = wandle(v)
    return raus
  }
  return wert
}

// Ein Dokument samt Unter-Sammlungen (Tiefe begrenzt – heute gibt es nur
// projekte/{id}/kennzahlen, aber der Export soll auch Künftiges mitnehmen).
async function dokumentLesen(doc, tiefe) {
  const eintrag = { id: doc.id, daten: wandle(doc.data()) }
  if (tiefe <= 0) return eintrag
  const unter = await doc.ref.listCollections()
  if (unter.length) {
    eintrag.unterSammlungen = {}
    for (const sammlung of unter) {
      const snap = await sammlung.get()
      eintrag.unterSammlungen[sammlung.id] = []
      for (const d of snap.docs) {
        eintrag.unterSammlungen[sammlung.id].push(await dokumentLesen(d, tiefe - 1))
      }
    }
  }
  return eintrag
}

// Registrierte Sammlungen aus shared/store.js (nur als TEXT gelesen – das
// Modul selbst ist Browser-Code). Leere Sammlungen tauchen in
// listCollections() nicht auf; die Übersicht nennt sie trotzdem, damit
// "fehlt in der Sicherung" von "ist wirklich leer" unterscheidbar bleibt.
function registrierteSammlungen() {
  try {
    const text = readFileSync(path.join(WURZEL, 'shared', 'store.js'), 'utf8')
    const block = text.split('const COLLECTIONS = [')[1]?.split(']')[0] || ''
    return [...block.matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1])
  } catch (e) {
    return []
  }
}

const start = Date.now()
const jetzt = new Date()
const stempel = jetzt.toISOString().slice(0, 10)
  + '-' + String(jetzt.getHours()).padStart(2, '0') + String(jetzt.getMinutes()).padStart(2, '0')
const ZIEL = path.join(WURZEL, 'sicherungen', stempel)
mkdirSync(ZIEL, { recursive: true })

console.log(`Sicherung von Projekt "${dienstkonto.project_id}" nach sicherungen/${stempel}/`)

const wurzelSammlungen = await db.listCollections()
const uebersicht = {}
for (const sammlung of wurzelSammlungen) {
  const snap = await sammlung.get()
  const dokumente = []
  for (const doc of snap.docs) dokumente.push(await dokumentLesen(doc, 2))
  writeFileSync(
    path.join(ZIEL, `${sammlung.id}.json`),
    JSON.stringify({ sammlung: sammlung.id, exportiertAm: jetzt.toISOString(), anzahl: dokumente.length, dokumente }, null, 2),
    'utf8',
  )
  uebersicht[sammlung.id] = dokumente.length
  console.log(`  ✓ ${sammlung.id}: ${dokumente.length} Dokument(e)`)
}

const leer = registrierteSammlungen().filter((name) => !(name in uebersicht))
writeFileSync(
  path.join(ZIEL, '_uebersicht.json'),
  JSON.stringify({
    projekt: dienstkonto.project_id,
    exportiertAm: jetzt.toISOString(),
    dauerMs: Date.now() - start,
    sammlungen: uebersicht,
    // Registriert (store.js COLLECTIONS), aber ohne ein einziges Dokument –
    // deshalb ohne eigene Datei. Das ist KEIN Fehler der Sicherung.
    registriertAberLeer: leer,
  }, null, 2),
  'utf8',
)

console.log(`\n✓ Fertig: ${Object.keys(uebersicht).length} Sammlung(en) in ${Date.now() - start} ms.`)
if (leer.length) console.log(`  Registriert, aber leer (keine Datei): ${leer.join(', ')}`)
console.log('  Hinweis: Der Rückweg (Zurückspielen) ist einmal ECHT durchzuspielen')
console.log('  und zu protokollieren – Konsolen-Aufgabe des Inhabers (AP 3).')
process.exit(0)
