// Rollen als Custom Claims ins Anmelde-Token schreiben.
//
// WARUM: Ein users-Dokument kann (bei zu laxen Regeln) vom Client selbst
// geschrieben werden – ein Custom Claim nicht. Erst mit Claims kann die
// Übergangsregel keinRollenmodell() in firestore.rules auf `false` gestellt
// werden. Rollen: admin (Büro) | vorarbeiter | mitarbeiter (Monteur).
//
// VORAUSSETZUNG (einmalig):
//   1. Firebase-Konsole → Projekteinstellungen → Dienstkonten →
//      "Neuen privaten Schlüssel erzeugen" → Datei speichern als
//      scripts/dienstkonto.json   (ist per .gitignore ausgeschlossen!)
//   2. npm i -D firebase-admin   (nur im Wurzelverzeichnis, devDependency)
//
// AUFRUFE:
//   node scripts/setze-rolle.mjs --liste
//       zeigt alle Auth-Konten mit heutigem Claim und users-Dokument
//   node scripts/setze-rolle.mjs --email buero@gabara-demo.de --rolle admin
//       setzt die Rolle EINES Kontos und widerruft dessen alte Token
//   node scripts/setze-rolle.mjs --alle
//       überträgt die Rolle aus der users-Sammlung (Feld rolle) auf alle
//       Konten, die per E-Mail zuzuordnen sind – der Übergangslauf
//
// NACH DEM LAUF --alle:
//   - Ausgabe prüfen: jedes aktive Konto muss eine Rolle haben
//   - in firestore.rules keinRollenmodell() auf `return false;` stellen
//   - firebase deploy --only firestore:rules
//   - Die App holt sich beim nächsten Start ein frisches Token
//     (revokeRefreshTokens zwingt dazu – Wirkung binnen ~1 Stunde,
//     sofort bei Ab- und wieder Anmelden).

import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HIER = path.dirname(fileURLToPath(import.meta.url))
const SCHLUESSEL = path.join(HIER, 'dienstkonto.json')

const ROLLEN = ['admin', 'vorarbeiter', 'mitarbeiter']

function argument(name) {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1) return null
  const wert = process.argv[i + 1]
  return wert && !wert.startsWith('--') ? wert : true
}

if (!existsSync(SCHLUESSEL)) {
  console.error(`Dienstkonto-Schlüssel fehlt: ${SCHLUESSEL}`)
  console.error('Firebase-Konsole → Projekteinstellungen → Dienstkonten → neuen privaten Schlüssel erzeugen.')
  process.exit(1)
}

const { default: admin } = await import('firebase-admin')
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(readFileSync(SCHLUESSEL, 'utf8'))),
})
const auth = admin.auth()
const db = admin.firestore()

async function alleKonten() {
  const konten = []
  let seite = await auth.listUsers(1000)
  konten.push(...seite.users)
  while (seite.pageToken) {
    seite = await auth.listUsers(1000, seite.pageToken)
    konten.push(...seite.users)
  }
  return konten
}

async function usersDokumente() {
  const schnapp = await db.collection('users').get()
  return schnapp.docs.map((d) => ({ id: d.id, ...d.data() }))
}

async function setzeRolle(konto, rolle, quelle) {
  await auth.setCustomUserClaims(konto.uid, { rolle })
  // Alte Token sofort entwerten – sonst wirkt die neue (oder entzogene)
  // Rolle bis zu einer Stunde lang nicht.
  await auth.revokeRefreshTokens(konto.uid)
  console.log(`  ✓ ${konto.email}  →  ${rolle}   (${quelle})`)
}

const liste = argument('liste')
const alle = argument('alle')
const email = argument('email')
const rolle = argument('rolle')

if (liste) {
  const [konten, profile] = await Promise.all([alleKonten(), usersDokumente()])
  console.log(`${konten.length} Auth-Konten, ${profile.length} users-Dokumente:\n`)
  for (const k of konten) {
    const claim = k.customClaims?.rolle || '—'
    const profil = profile.find((p) => (p.email || '').toLowerCase() === (k.email || '').toLowerCase())
    const doc = profil ? `users/${profil.id} (rolle: ${profil.rolle || '—'})` : 'KEIN users-Dokument'
    console.log(`  ${k.email}\n    Claim: ${claim}   ·   ${doc}`)
  }
  const ohne = konten.filter((k) => !k.customClaims?.rolle)
  console.log(`\n${ohne.length} Konto/Konten ohne Claim.`)
  if (ohne.length === 0) {
    console.log('Alle Konten haben eine Rolle → keinRollenmodell() kann jetzt auf `return false;` gestellt werden.')
  }
  process.exit(0)
}

if (email && rolle) {
  if (!ROLLEN.includes(rolle)) {
    console.error(`Unbekannte Rolle "${rolle}". Erlaubt: ${ROLLEN.join(' | ')}`)
    process.exit(1)
  }
  const konto = await auth.getUserByEmail(email).catch(() => null)
  if (!konto) {
    console.error(`Kein Auth-Konto mit der E-Mail ${email}.`)
    process.exit(1)
  }
  await setzeRolle(konto, rolle, 'von Hand')
  process.exit(0)
}

if (alle) {
  const [konten, profile] = await Promise.all([alleKonten(), usersDokumente()])
  let gesetzt = 0
  const offen = []
  for (const k of konten) {
    const profil = profile.find((p) => (p.email || '').toLowerCase() === (k.email || '').toLowerCase())
    // 'admin'/'mitarbeiter' aus dem users-Dokument; alles Unbekannte wird NICHT
    // geraten, sondern gemeldet – bei Rechten wird nicht gewürfelt.
    const r = profil?.rolle
    if (ROLLEN.includes(r)) {
      await setzeRolle(k, r, `users/${profil.id}`)
      gesetzt++
    } else {
      offen.push(k.email || k.uid)
    }
  }
  console.log(`\n${gesetzt} Rolle(n) gesetzt.`)
  if (offen.length) {
    console.log(`OFFEN (kein zuordenbares users-Dokument – von Hand setzen mit --email … --rolle …):`)
    for (const e of offen) console.log(`  - ${e}`)
    console.log('\nkeinRollenmodell() erst abschalten, wenn diese Liste leer ist!')
    process.exit(1)
  }
  console.log('Alle Konten haben eine Rolle → jetzt keinRollenmodell() auf `return false;` stellen und Regeln ausliefern.')
  process.exit(0)
}

console.log('Aufruf: --liste  |  --email <mail> --rolle <admin|vorarbeiter|mitarbeiter>  |  --alle')
process.exit(1)
