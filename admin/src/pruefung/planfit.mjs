// Raumrechtecke robust bestimmen: Massstab per Konsens, Kanten per Anpassung
// an die GEDRUCKTE Flaeche. Versuch am echten Plan.
import fs from 'node:fs'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'

const OPS = pdfjs.OPS
const ARITY = { 0: 2, 1: 2, 2: 6 }
const mul = (a, b) => [
  a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
]
const anw = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]

const dok = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(process.argv[2])) }).promise
const seite = await dok.getPage(1)
const ops = await seite.getOperatorList()

let ctm = [1, 0, 0, 1, 0, 0]
const stapel = []
let waag = [], senk = []
for (let i = 0; i < ops.fnArray.length; i++) {
  const fn = ops.fnArray[i]
  if (fn === OPS.save) { stapel.push(ctm.slice()); continue }
  if (fn === OPS.restore) { ctm = stapel.pop() || [1, 0, 0, 1, 0, 0]; continue }
  if (fn === OPS.transform) { ctm = mul(ctm, ops.argsArray[i]); continue }
  if (fn !== OPS.constructPath) continue
  const buf = ops.argsArray[i][1][0]
  let k = 0, x = 0, y = 0, gesetzt = false
  while (k < buf.length) {
    const c = buf[k]; const a = ARITY[c]
    if (a === undefined) break
    if (c === 0) { [x, y] = anw(ctm, buf[k + 1], buf[k + 2]); gesetzt = true }
    else if (c === 1) {
      const [nx, ny] = anw(ctm, buf[k + 1], buf[k + 2])
      if (gesetzt) {
        const dx = Math.abs(nx - x), dy = Math.abs(ny - y)
        if (dy < 0.4 && dx > 10) waag.push({ p: (y + ny) / 2, a: Math.min(x, nx), b: Math.max(x, nx) })
        else if (dx < 0.4 && dy > 10) senk.push({ p: (x + nx) / 2, a: Math.min(y, ny), b: Math.max(y, ny) })
      }
      x = nx; y = ny; gesetzt = true
    } else { [x, y] = anw(ctm, buf[k + 5], buf[k + 6]); gesetzt = true }
    k += 1 + a
  }
}

// Kollineare Linien zusammenfassen: eine Wand ist im CAD oft aus vielen kurzen
// Stuecken gezeichnet, und eine durchgehende Linie traegt mehr Aussage.
function verschmelzen(linien, tol = 0.8) {
  linien.sort((x, y) => x.p - y.p || x.a - y.a)
  const raus = []
  for (const l of linien) {
    const letzte = raus[raus.length - 1]
    if (letzte && Math.abs(letzte.p - l.p) < tol && l.a <= letzte.b + 2.5) {
      letzte.b = Math.max(letzte.b, l.b)
      letzte.p = (letzte.p + l.p) / 2
    } else raus.push({ ...l })
  }
  return raus
}
waag = verschmelzen(waag)
senk = verschmelzen(senk)
console.log(`Linien nach Verschmelzen: ${waag.length} waagerecht, ${senk.length} senkrecht`)

// --- Stempel ---
const inhalt = await seite.getTextContent()
const woerter = inhalt.items.map((s) => ({ text: (s.str || '').trim(), x: s.transform[4], y: s.transform[5] })).filter((w) => w.text)
const stempel = []
for (const w of woerter) {
  const m = w.text.match(/^A=([\d.,]+)\s*(?:qm|m²)$/i)
  let flaeche = null
  if (m) flaeche = Number(m[1].replace(/\./g, '').replace(',', '.'))
  else if (/^A=$/i.test(w.text)) {
    const z = woerter.find((o) => Math.abs(o.y - w.y) < 4 && o.x > w.x && o.x - w.x < 70 && /^[\d.,]+$/.test(o.text))
    if (z) flaeche = Number(z.text.replace(/\./g, '').replace(',', '.'))
  }
  if (flaeche == null) continue
  const spalte = woerter.filter((o) => Math.abs(o.x - w.x) < 34 && o.y - w.y > -6 && o.y - w.y < 36)
  const nummer = spalte.find((o) => /^\d+\.(?:\d+[a-z]?|[A-Z]+\d*[LP]?)(?:\.\d+)*$/.test(o.text))?.text || ''
  stempel.push({ nummer, flaeche, x: w.x, y: w.y + 10 })
}

// Kandidatenkanten um einen Punkt
function kanten(linien, punkt, quer, anzahl = 7) {
  const passend = linien.filter((l) => quer >= l.a - 1 && quer <= l.b + 1)
  const vor = passend.filter((l) => l.p <= punkt).sort((a, b) => b.p - a.p).slice(0, anzahl)
  const nach = passend.filter((l) => l.p >= punkt).sort((a, b) => a.p - b.p).slice(0, anzahl)
  return { vor, nach }
}

// Bestes Rechteck fuer einen Stempel bei gegebenem Massstab
function bestesRechteck(s, skala) {
  const { vor: links, nach: rechts } = kanten(senk, s.x, s.y)
  const { vor: unten, nach: oben } = kanten(waag, s.y, s.x)
  let best = null
  for (const l of links) for (const r of rechts) {
    const b = r.p - l.p
    if (b < 3) continue
    for (const u of unten) for (const o of oben) {
      const h = o.p - u.p
      if (h < 3) continue
      const flaeche = b * h * skala * skala
      const fehler = Math.abs(flaeche - s.flaeche) / s.flaeche
      // Bei Gleichstand das KLEINERE Rechteck: ein zu grosses schluckt Nachbarn
      if (!best || fehler < best.fehler - 0.001 || (Math.abs(fehler - best.fehler) < 0.001 && b * h < best.b * best.h)) {
        best = { x: l.p, y: u.p, b, h, fehler, flaeche }
      }
    }
  }
  return best
}

// --- Massstab per Konsens suchen ---
// Baumassstaebe sind genormt. Wir pruefen die ueblichen und nehmen den, bei dem
// die meisten Raeume ihre gedruckte Flaeche treffen.
const KANDIDATEN = []
for (const m of [10, 20, 25, 50, 100, 200, 500]) KANDIDATEN.push({ name: `1:${m}`, skala: m / 1000 * (25.4 / 72) * 1000 / 1000 })
// 1 pt = 25.4/72 mm auf dem Papier; bei 1:M entspricht das M*25.4/72 mm in echt
for (const k of KANDIDATEN) k.skala = Number(k.name.slice(2)) * (25.4 / 72) / 1000

console.log('\nMassstab-Prüfung (Treffer innerhalb 8 %):')
let besterMassstab = null
for (const k of KANDIDATEN) {
  let treffer = 0
  for (const s of stempel) {
    const r = bestesRechteck(s, k.skala)
    if (r && r.fehler < 0.08) treffer++
  }
  console.log(`  ${k.name.padEnd(7)} ${k.skala.toFixed(5)} m/pt → ${treffer} von ${stempel.length}`)
  if (!besterMassstab || treffer > besterMassstab.treffer) besterMassstab = { ...k, treffer }
}
console.log(`\nGewaehlt: ${besterMassstab.name} (${besterMassstab.treffer}/${stempel.length})`)

const S = besterMassstab.skala
console.log('\nNr        gedruckt   ausPlan   Abw.     Masse (m)          Lage (m)')
let gut = 0
for (const s of stempel) {
  const r = bestesRechteck(s, S)
  if (!r) { console.log((s.nummer || '?').padEnd(10), 'kein Rechteck'); continue }
  const ab = ((r.flaeche - s.flaeche) / s.flaeche) * 100
  if (Math.abs(ab) < 8) gut++
  console.log(
    (s.nummer || '?').padEnd(10),
    String(s.flaeche).padStart(8),
    r.flaeche.toFixed(2).padStart(9),
    ((ab >= 0 ? '+' : '') + ab.toFixed(1) + '%').padStart(8),
    ' ', ((r.b * S).toFixed(2) + ' x ' + (r.h * S).toFixed(2)).padEnd(18),
    (r.x * S).toFixed(1) + ' / ' + (r.y * S).toFixed(1)
  )
}
console.log(`\nInnerhalb 8 %: ${gut} von ${stempel.length}`)
