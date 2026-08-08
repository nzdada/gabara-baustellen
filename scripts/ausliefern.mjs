// Auslieferung als ERZWUNGENE Kette (AP 3).
//
// Warum ein Skript statt einer Merkliste: Jeder Auslieferungsfehler der
// Vergangenheit war ein übersprungener Schritt – Regeln in der Datei, aber nie
// deployt (raumsoll); Indizes leer, Abfragen scheitern erst im Echtbetrieb;
// Build grün, aber ungetestete Änderungen im Arbeitsverzeichnis. Dieses Skript
// bricht bei JEDEM Fehler ab, in fester Reihenfolge:
//
//   1. git status leer            (nur Committetes wird ausgeliefert)
//   2. node pruefe-importe.mjs    (fehlende Importe findet der Build nicht)
//   3. npm test                   (alle Prüfdateien)
//   4. npm run build -w admin     und  -w website
//   5. firebase deploy --only hosting,firestore:rules,firestore:indexes,storage
//      → Storage ist evtl. noch nicht eingerichtet (Blaze-Upgrade offen):
//        dann wird NUR Storage mit Warnung übersprungen und ohne ihn deployt.
//   6. git tag v2-<datum>-<uhrzeit>   (NICHT gepusht – das entscheidet der
//      Inhaber mit `git push --tags`)
//
// Aufruf:  npm run ausliefern     (oder: node scripts/ausliefern.mjs)

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Einen Befehl ausführen. fange=true sammelt die Ausgabe ein (für die
// Storage-Fehlerprüfung), sonst läuft sie direkt ins Terminal durch.
function lauf(befehl, { fange = false, darfScheitern = false } = {}) {
  console.log(`\n▶ ${befehl}`)
  const erg = spawnSync(befehl, {
    shell: true,
    cwd: WURZEL,
    encoding: 'utf8',
    stdio: fange ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  })
  const ausgabe = fange ? `${erg.stdout || ''}${erg.stderr || ''}` : ''
  if (fange && ausgabe.trim()) console.log(ausgabe.trim())
  if (erg.status !== 0 && !darfScheitern) {
    console.error(`\n✗ Abbruch: "${befehl}" endete mit Code ${erg.status}.`)
    console.error('  Nichts wurde ausgeliefert. Fehler beheben und neu starten.')
    process.exit(erg.status || 1)
  }
  return { code: erg.status, ausgabe }
}

console.log('Gabara-Auslieferung – erzwungene Kette (AP 3)')
console.log('==============================================')

// --- 1. Arbeitsverzeichnis muss sauber sein --------------------------------
const status = lauf('git status --porcelain', { fange: true })
if (status.ausgabe.trim()) {
  console.error('\n✗ Abbruch: Das Arbeitsverzeichnis ist nicht leer.')
  console.error('  Ausgeliefert wird nur ein committeter Stand – sonst bezeichnet')
  console.error('  die Versionskennung (Git-Hash in der Fußzeile) etwas anderes')
  console.error('  als das, was tatsächlich online liegt.')
  console.error('  Erst committen (oder stashen), dann erneut ausliefern.')
  process.exit(1)
}
console.log('✓ Arbeitsverzeichnis leer.')

// --- 2.–4. Prüfen und bauen ------------------------------------------------
lauf('node pruefe-importe.mjs')
lauf('npm test')
lauf('npm run build -w admin')
lauf('npm run build -w website')

// --- 5. Deploy: Hosting + Regeln + Indizes + Storage -----------------------
// Die Fünf-Eintragungen-Regel (Plan 4.1) verlangt, dass Regeln und Indizes
// IMMER mitfahren – eine Regel, die nur in der Datei steht, hat schon einmal
// still das Verteilen zerbrochen. Storage kommt erst nach dem Blaze-Upgrade;
// solange es fehlt, wird es erkannt und mit Warnung übersprungen.
const ALLES = 'firebase deploy --only hosting,firestore:rules,firestore:indexes,storage'
const OHNE_STORAGE = 'firebase deploy --only hosting,firestore:rules,firestore:indexes'

const erster = lauf(ALLES, { fange: true, darfScheitern: true })
if (erster.code !== 0) {
  // Sieht der Fehler nach "Storage nicht eingerichtet" aus? Typische
  // CLI-Meldungen: "firebase init storage", "does not have a default Storage
  // bucket", "storage is not set up", "Cannot understand what targets to deploy".
  const storageFehlt =
    /firebase init storage/i.test(erster.ausgabe)
    || /default (Cloud )?Storage bucket/i.test(erster.ausgabe)
    || /storage[^\n]*not (been )?set ?up/i.test(erster.ausgabe)
    || /not (been )?set ?up[^\n]*storage/i.test(erster.ausgabe)
    || /Cannot understand what targets to deploy/i.test(erster.ausgabe)
  if (!storageFehlt) {
    console.error('\n✗ Abbruch: Deploy fehlgeschlagen – und NICHT wegen fehlendem Storage.')
    console.error('  Meldung oben lesen, Ursache beheben, neu ausliefern.')
    process.exit(erster.code)
  }
  console.warn('\n⚠ Storage ist in diesem Firebase-Projekt noch nicht eingerichtet')
  console.warn('  (Blaze-Upgrade/`firebase init storage` offen). storage.rules wird')
  console.warn('  ÜBERSPRUNGEN – nach der Einrichtung liefert der nächste Lauf sie mit aus.')
  lauf(OHNE_STORAGE)
} else {
  console.log('✓ Deploy inklusive Storage-Regeln.')
}

// --- 6. Tag setzen (nicht pushen) ------------------------------------------
const jetzt = new Date()
const stempel = jetzt.toISOString().slice(0, 10)
  + '-' + String(jetzt.getHours()).padStart(2, '0') + String(jetzt.getMinutes()).padStart(2, '0')
const tag = `v2-${stempel}`
lauf(`git tag ${tag}`)

console.log('\n==============================================')
console.log(`✓ Auslieferung fertig. Tag: ${tag} (lokal – pushen entscheidet der Inhaber: git push --tags)`)
console.log('  Webseite:   https://gabara-system.web.app')
console.log('  Verwaltung: https://gabara-system-admin.web.app')
