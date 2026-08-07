// Findet benutzte, aber nicht importierte Hilfsfunktionen.
//
// WARUM ES DIESE PRUEFUNG GIBT
// `npm run build` meldet einen fehlenden Import NICHT. Vite und esbuild
// buendeln froehlich weiter; erst beim Rendern schlaegt es fehl:
//   "summeFahrten is not defined"
// Genau das ist zweimal passiert – einmal mit `t` in den Anfragen, einmal mit
// den Fahrten. Beide Male war der Build gruen und die Seite kaputt.
//
// Das Verfahren ist bewusst eng: Es kennt die Namen, die aus shared/ und
// admin/src/ exportiert werden, und prueft fuer jede Datei, ob ein benutzter
// Name auch importiert oder dort selbst definiert ist. Eine vollstaendige
// Gueltigkeitsbereichsanalyse waere schoener, braucht aber einen Parser –
// dieser Ansatz findet den fraglichen Fehler und laeuft in einer Sekunde.
//
// Aufruf:  node pruefe-importe.mjs

import fs from 'node:fs'
import path from 'node:path'

const WURZEL = process.cwd()
const ORDNER = ['shared', 'admin/src', 'website/src']

function dateien(ordner) {
  const voll = path.join(WURZEL, ordner)
  if (!fs.existsSync(voll)) return []
  const raus = []
  for (const eintrag of fs.readdirSync(voll, { withFileTypes: true })) {
    const p = path.join(ordner, eintrag.name)
    if (eintrag.isDirectory()) raus.push(...dateien(p))
    else if (/\.(js|jsx)$/.test(eintrag.name) && !eintrag.name.endsWith('.test.js')) raus.push(p)
  }
  return raus
}

// Was exportiert eine Datei?
function exporte(text) {
  const namen = new Set()
  for (const m of text.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)) namen.add(m[1])
  for (const m of text.matchAll(/^export\s*\{([^}]+)\}/gm)) {
    for (const teil of m[1].split(',')) {
      const name = teil.trim().split(/\s+as\s+/).pop().trim()
      if (name) namen.add(name)
    }
  }
  return namen
}

// Was importiert eine Datei namentlich?
function importe(text) {
  const namen = new Set()
  // Auch die Mischform erfassen: `import Standard, { Name } from '…'`.
  // Ohne den optionalen Teil davor blieb `{ FeldLabel }` unsichtbar, und die
  // Prüfung meldete drei Importe als fehlend, die sehr wohl dastanden.
  for (const m of text.matchAll(/import\s+(?:[A-Za-z_$][\w$]*\s*,\s*)?\{([^}]+)\}\s*from/g)) {
    for (const teil of m[1].split(',')) {
      const name = teil.trim().split(/\s+as\s+/).pop().trim()
      if (name) namen.add(name)
    }
  }
  for (const m of text.matchAll(/import\s+([A-Za-z_$][\w$]*)\s*(?:,|from)/g)) namen.add(m[1])
  for (const m of text.matchAll(/import\s*\*\s*as\s+([A-Za-z_$][\w$]*)/g)) namen.add(m[1])
  return namen
}

// Was definiert eine Datei selbst?
function eigene(text) {
  const namen = new Set()
  for (const m of text.matchAll(/(?:^|\s)(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g)) namen.add(m[1])
  // Zerlegende Zuweisungen: const { a, b } = ...
  for (const m of text.matchAll(/(?:const|let|var)\s*\{([^}]*)\}\s*=/g)) {
    for (const teil of m[1].split(',')) {
      const name = teil.trim().split(':').pop().trim().split('=')[0].trim()
      if (/^[A-Za-z_$][\w$]*$/.test(name)) namen.add(name)
    }
  }
  return namen
}

// 1. Alle exportierten Namen einsammeln
const alleExporte = new Map()      // Name -> Datei
for (const d of ORDNER.flatMap(dateien)) {
  const text = fs.readFileSync(path.join(WURZEL, d), 'utf8')
  for (const n of exporte(text)) {
    if (!alleExporte.has(n)) alleExporte.set(n, d)
  }
}

// 2. Je Datei prüfen
const funde = []
for (const d of ORDNER.flatMap(dateien)) {
  const text = fs.readFileSync(path.join(WURZEL, d), 'utf8')
  const hat = new Set([...importe(text), ...eigene(text), ...exporte(text)])
  // Kommentare und Zeichenketten grob entfernen, damit Erwähnungen im Text
  // keinen Fehlalarm auslösen.
  const code = text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')

  for (const [name, quelle] of alleExporte) {
    if (quelle === d || hat.has(name)) continue
    // Zwei Verwendungsarten zählen:
    //   Aufruf/Objektzugriff:  name(...)   name{...}
    //   JSX-Element:           <Name ...>
    // Ausdrücklich NICHT: `Datenschutz</Link>` – dort gehört das < zum
    // schließenden Tag des UMGEBENDEN Elements, nicht zum Namen. Genau daran
    // meldete diese Prüfung zuerst drei Fehlalarme.
    const alsAufruf = new RegExp(`(?<![.\\w$])${name}\\s*[({]`).test(code)
    // Nur GROSS geschriebene Namen können JSX-Bauteile sein. Kleingeschriebene
    // Elemente sind in React immer HTML – sonst meldet die Prüfung jedes <tr>
    // einer Tabelle als fehlenden Import von tr() aus der Sprachdatei.
    const alsElement = /^[A-Z]/.test(name) && new RegExp(`<${name}[\\s/>]`).test(code)
    if (alsAufruf || alsElement) funde.push({ datei: d, name, quelle })
  }
}

if (!funde.length) {
  console.log('Alle benutzten Hilfsfunktionen sind importiert.')
  process.exit(0)
}
console.log(`${funde.length} fehlende Einbindung(en):\n`)
for (const f of funde) console.log(`  ${f.datei}\n    benutzt "${f.name}" (aus ${f.quelle}) ohne Import\n`)
process.exit(1)
