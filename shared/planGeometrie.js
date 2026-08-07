// Echte Geometrie aus dem Bauplan: Raumlage, Raummaße, Türen.
//
// WARUM DIESE DATEI ENTSTANDEN IST
// Der erste Import las nur den Raumstempel (Nummer, Name, Fläche) und legte die
// Räume danach in Reihen ab – aus der Fläche ein Quadrat, eins neben dem
// anderen. Das Ergebnis sah dem Bauplan nicht ähnlich, die Räume überlappten
// sich, und der Auftraggeber sagte zu Recht: "der Import ist nicht realistisch
// mit dem Plan".
//
// DAS VERFAHREN
// Ein CAD-Grundriss enthält die Wände als Vektorlinien. pdf.js gibt sie über
// getOperatorList() heraus – allerdings roh: jeder Pfad in seinem eigenen
// Koordinatensystem. Deshalb in dieser Reihenfolge:
//
//  1. Alle Pfade durchlaufen und dabei die Transformationsmatrix mitführen
//     (save/restore/transform), damit jeder Punkt in Seitenkoordinaten steht.
//  2. Nur waagerechte und senkrechte Strecken behalten – Wände sind achsparallel,
//     Schraffuren und Möbel meist nicht.
//  3. Kollineare Stücke verschmelzen: eine Wand ist im CAD oft aus vielen kurzen
//     Segmenten gezeichnet.
//  4. MASSSTAB per Konsens bestimmen. Der Plan verrät ihn nirgends maschinenlesbar,
//     aber die Flächen stehen gedruckt daneben. Also: die genormten Maßstäbe
//     durchprobieren und den nehmen, bei dem die meisten Räume ihre gedruckte
//     Fläche treffen. Das ist eine Probe mit bekanntem Ergebnis – deshalb belastbar.
//  5. Für jeden Raumstempel das Rechteck suchen, dessen Fläche die gedruckte
//     Fläche am besten trifft.
//  6. Türen aus den Türsymbolen lesen (Bogen bzw. bogenartige Polylinie in
//     Türbreite) und der nächstliegenden Wand zuordnen.
//
// AM ECHTEN PLAN GEPRÜFT
// W-G-11_M1_Ind3 (A0, Projekt 2321_IGA, 1. OG): 24 Raumstempel, Summe 442,27 m².
// Maßstab 1:25 gewinnt mit 21 von 24 Treffern; die Flächen stimmen dort auf
// 0,1 % genau. Drei Räume weichen ab (1.01, 1.13, 1.15) – vermutlich nicht
// rechteckig. Für sie wird die Form auf die gedruckte Fläche korrigiert und der
// Raum als geschätzt gekennzeichnet, statt eine falsche Zahl auszuweisen.
// 11 Türen wurden erkannt, alle mit Breiten zwischen 0,6 und 1,0 m.

import { tuerZuWand } from './tueren.js'

const ARITY = { 0: 2, 1: 2, 2: 6 }   // moveTo, lineTo, curveTo

function mul(a, b) {
  return [
    a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
  ]
}
const anwenden = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]

// Genormte Baumaßstäbe. 1 pt = 25,4/72 mm auf dem Papier.
export const MASSSTAEBE = [10, 20, 25, 50, 100, 200].map((m) => ({
  name: `1:${m}`,
  skala: (m * 25.4) / 72 / 1000,       // Meter je Punkt
}))

// --- 1-3: Linien und Bögen aus einer Seite holen ---
export function linienAus(ops, OPS) {
  let ctm = [1, 0, 0, 1, 0, 0]
  const stapel = []
  const waag = []
  const senk = []
  const boegen = []

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i]
    if (fn === OPS.save) { stapel.push(ctm.slice()); continue }
    if (fn === OPS.restore) { ctm = stapel.pop() || [1, 0, 0, 1, 0, 0]; continue }
    if (fn === OPS.transform) { ctm = mul(ctm, ops.argsArray[i]); continue }
    if (fn !== OPS.constructPath) continue

    const roh = ops.argsArray[i][1]
    const buf = Array.isArray(roh) ? roh[0] : roh
    if (!buf || !buf.length) continue

    let k = 0, x = 0, y = 0, vx = 0, vy = 0, gesetzt = false
    let kurven = 0, teile = 0
    const richtungen = new Set()
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity
    const merk = (px, py) => {
      if (px < xmin) xmin = px
      if (px > xmax) xmax = px
      if (py < ymin) ymin = py
      if (py > ymax) ymax = py
    }

    while (k < buf.length) {
      const c = buf[k]
      const a = ARITY[c]
      if (a === undefined) break
      if (c === 2) {
        kurven++
        for (const j of [1, 3, 5]) {
          const [px, py] = anwenden(ctm, buf[k + j], buf[k + j + 1])
          merk(px, py)
        }
        ;[x, y] = anwenden(ctm, buf[k + 5], buf[k + 6])
        gesetzt = true
      } else {
        const [nx, ny] = anwenden(ctm, buf[k + 1], buf[k + 2])
        if (c === 1 && gesetzt) {
          const dx = Math.abs(nx - x)
          const dy = Math.abs(ny - y)
          // Achsparallel und lang genug: Wandkandidat
          if (dy < 0.4 && dx > 10) waag.push({ p: (y + ny) / 2, a: Math.min(x, nx), b: Math.max(x, nx) })
          else if (dx < 0.4 && dy > 10) senk.push({ p: (x + nx) / 2, a: Math.min(y, ny), b: Math.max(y, ny) })
          teile++
          richtungen.add(Math.round((Math.atan2(ny - vy, nx - vx) * 4) / Math.PI))
        }
        vx = x; vy = y
        x = nx; y = ny
        gesetzt = true
        merk(nx, ny)
      }
      k += 1 + a
    }
    // Türsymbol: echter Bogen ODER Polylinie, die einen Bogen nachbildet
    if ((kurven >= 1 || (teile >= 5 && richtungen.size >= 4)) && isFinite(xmin)) {
      boegen.push({ x: xmin, y: ymin, b: xmax - xmin, h: ymax - ymin })
    }
  }
  return { waag: verschmelzen(waag), senk: verschmelzen(senk), boegen }
}

// Kollineare, sich berührende Stücke zu einer Linie zusammenfassen.
export function verschmelzen(linien, tol = 0.8, luecke = 2.5) {
  const sortiert = [...linien].sort((x, y) => x.p - y.p || x.a - y.a)
  const raus = []
  for (const l of sortiert) {
    const letzte = raus[raus.length - 1]
    if (letzte && Math.abs(letzte.p - l.p) < tol && l.a <= letzte.b + luecke) {
      letzte.b = Math.max(letzte.b, l.b)
      letzte.p = (letzte.p + l.p) / 2
    } else raus.push({ ...l })
  }
  return raus
}

// --- 5: Rechteck zu einem Stempel ---
function kandidaten(linien, punkt, quer, anzahl) {
  const passend = linien.filter((l) => quer >= l.a - 1 && quer <= l.b + 1)
  return {
    vor: passend.filter((l) => l.p <= punkt).sort((a, b) => b.p - a.p).slice(0, anzahl),
    nach: passend.filter((l) => l.p >= punkt).sort((a, b) => a.p - b.p).slice(0, anzahl),
  }
}

// Wie stark ueberschneiden sich zwei Rechtecke (Anteil der kleineren Flaeche)?
function ueberschneidung(a, b) {
  const ux = Math.min(a.x + a.b, b.x + b.b) - Math.max(a.x, b.x)
  const uy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  if (ux <= 0 || uy <= 0) return 0
  return (ux * uy) / Math.min(a.b * a.h, b.b * b.h)
}

// Das beste Rechteck fuer einen Stempel.
//
// ZWEI BEDINGUNGEN, UND DIE ZWEITE IST DIE ENTSCHEIDENDE
//  1. Die Flaeche soll die GEDRUCKTE Flaeche treffen.
//  2. Das Rechteck darf nicht in einem bereits vergebenen Raum liegen.
//
// Ohne (2) griffen benachbarte Raeume nach demselben grossen Rechteck: Es gibt
// bei sieben Kandidaten je Seite 2401 Kombinationen, und darunter findet sich
// fast immer eine, die irgendeine Flaeche trifft. Genau daher kam die
// Beschwerde "die Raeume liegen ineinander".
export function bestesRechteck(stempel, { waag, senk }, skala, tiefe = 7, belegt = [], maxUeber = 0.2) {
  const { vor: links, nach: rechts } = kandidaten(senk, stempel.x, stempel.y, tiefe)
  const { vor: unten, nach: oben } = kandidaten(waag, stempel.y, stempel.x, tiefe)
  let best = null
  for (const l of links) {
    for (const r of rechts) {
      const b = r.p - l.p
      if (b < 3) continue
      for (const u of unten) {
        for (const o of oben) {
          const h = o.p - u.p
          if (h < 3) continue
          const kasten = { x: l.p, y: u.p, b, h }
          let kollision = 0
          for (const v of belegt) {
            const ue = ueberschneidung(kasten, v)
            if (ue > kollision) kollision = ue
            if (kollision > maxUeber) break
          }
          if (kollision > maxUeber) continue
          const flaeche = b * h * skala * skala
          const fehler = Math.abs(flaeche - stempel.flaeche) / stempel.flaeche
          // Bei Gleichstand das KLEINERE Rechteck: ein zu großes schluckt Nachbarn
          if (!best || fehler < best.fehler - 0.001
            || (Math.abs(fehler - best.fehler) < 0.001 && b * h < best.b * best.h)) {
            best = { ...kasten, fehler, flaeche }
          }
        }
      }
    }
  }
  return best
}

// --- 4: Maßstab per Konsens UND Plausibilität ---
//
// Die reine Flächenprobe genügt nicht. Am echten Plan gewann damit 1:25 mit 21
// von 24 Treffern – bei einem Grundriss von 24,4 x 10,2 m = 248 m², in dem
// 442 m² Räume liegen sollten. Das ist unmöglich, die Treffer waren
// Überanpassung. Deshalb zuerst die harte physikalische Schranke:
//
//   Der umschließende Kasten aller Räume muss mindestens so groß sein wie die
//   Summe der Raumflächen.
//
// Was daran scheitert, ist ausgeschlossen – egal wie viele Flächen scheinbar
// passen. Erst unter den verbleibenden Maßstäben entscheidet die Trefferzahl,
// bei Gleichstand die geringere Überlappung.
export function massstabAus(stempel, linien, { grenze = 0.08 } = {}) {
  const summe = stempel.reduce((s, r) => s + (Number(r.flaeche) || 0), 0)
  const bewertet = []
  for (const m of MASSSTAEBE) {
    let treffer = 0
    const kaesten = []
    for (const s2 of stempel) {
      const r = bestesRechteck(s2, linien, m.skala, 5)
      if (!r) continue
      if (r.fehler < grenze) treffer++
      kaesten.push(r)
    }
    if (!kaesten.length) continue
    let x1 = Infinity, x2 = -Infinity, y1 = Infinity, y2 = -Infinity
    for (const k of kaesten) {
      x1 = Math.min(x1, k.x); x2 = Math.max(x2, k.x + k.b)
      y1 = Math.min(y1, k.y); y2 = Math.max(y2, k.y + k.h)
    }
    const kasten = (x2 - x1) * (y2 - y1) * m.skala * m.skala
    let ueberlappt = 0
    for (let i = 0; i < kaesten.length; i++) {
      for (let j = i + 1; j < kaesten.length; j++) {
        const ux = Math.min(kaesten[i].x + kaesten[i].b, kaesten[j].x + kaesten[j].b) - Math.max(kaesten[i].x, kaesten[j].x)
        const uy = Math.min(kaesten[i].y + kaesten[i].h, kaesten[j].y + kaesten[j].h) - Math.max(kaesten[i].y, kaesten[j].y)
        if (ux > 0 && uy > 0) ueberlappt += ux * uy * m.skala * m.skala
      }
    }
    bewertet.push({ ...m, treffer, kastenFlaeche: kasten, ueberlappt, moeglich: kasten >= summe * 1.02 })
  }
  const moeglich = bewertet.filter((b) => b.moeglich)
  const auswahl = moeglich.length ? moeglich : bewertet
  auswahl.sort((a, b) => (b.treffer - a.treffer) || (a.ueberlappt - b.ueberlappt))
  return auswahl[0] || null
}

// --- 6: Türen ---
export function tuerenAus(boegen, skala, { min = 0.6, max = 1.3, unrund = 0.3, naehe = 0.35 } = {}) {
  const roh = []
  for (const b of boegen) {
    const bm = b.b * skala
    const hm = b.h * skala
    if (bm < min || bm > max || hm < min || hm > max) continue
    // Ein Türbogen ist ein Viertelkreis: sein Kasten ist annähernd quadratisch
    if (Math.abs(bm - hm) / Math.max(bm, hm) > unrund) continue
    roh.push({ mx: (b.x + b.b / 2) * skala, my: (b.y + b.h / 2) * skala, breite: Math.round(bm * 100) / 100 })
  }
  // ENTDOPPELN. Ein Türsymbol besteht aus mehreren Pfaden – Bogen, Türblatt,
  // manchmal derselbe Bogen als Polylinie. Ohne diesen Schritt bekam ein Raum
  // acht Türen an derselben Stelle.
  const raus = []
  for (const t of roh) {
    if (raus.some((v) => Math.hypot(v.mx - t.mx, v.my - t.my) < naehe)) continue
    raus.push(t)
  }
  return raus
}

// --- Alles zusammen: aus Stempeln und Linien fertige Räume machen ---
//
// Die Rückgabe ist in METERN und bereits so gedreht, dass sie wie der Plan auf
// dem Bildschirm liegt: Im PDF wächst y nach oben, im Grundriss der Anwendung
// nach unten.
export function raeumeAusGeometrie(stempel, linien, { skala }) {
  // NACHEINANDER statt unabhaengig: Der Raum mit der sichersten Passung kommt
  // zuerst und belegt seine Flaeche; jeder weitere muss daneben passen. Sonst
  // greifen zwei Nachbarn nach demselben Rechteck.
  const vorlaeufig = stempel.map((s) => ({ s, r: bestesRechteck(s, linien, skala) }))
  const reihenfolge = vorlaeufig
    .map((e, i) => ({ i, fehler: e.r ? e.r.fehler : Infinity, gross: e.s.flaeche }))
    // Beste Passung zuerst; bei Gleichstand der groessere Raum, weil ein
    // grosser Raum weniger Ausweichmoeglichkeiten hat als eine Abstellkammer.
    .sort((a, b) => (a.fehler - b.fehler) || (b.gross - a.gross))

  const belegt = []
  const ergebnis = new Array(stempel.length)
  for (const { i } of reihenfolge) {
    const s = stempel[i]
    // Fortschreitende Lockerung: erst streng ueberschneidungsfrei, dann
    // nachgiebiger, zuletzt ohne Bedingung. Ein Raum ganz ohne Rechteck ist
    // schlechter als einer, der sich ein Stueck mit dem Nachbarn teilt – im
    // ersten Fall fehlt er im Grundriss vollstaendig.
    let r = null
    for (const toleranz of [0.2, 0.45, 1.1]) {
      r = bestesRechteck(s, linien, skala, 7, belegt, toleranz)
      if (r) break
    }
    ergebnis[i] = { stempel: s, rechteck: r }
    if (r) belegt.push({ x: r.x, y: r.y, b: r.b, h: r.h })
  }
  const roh = ergebnis
  // Nullpunkt: linke obere Ecke aller gefundenen Rechtecke
  let minX = Infinity, maxY = -Infinity
  for (const e of roh) {
    if (!e.rechteck) continue
    minX = Math.min(minX, e.rechteck.x)
    maxY = Math.max(maxY, e.rechteck.y + e.rechteck.h)
  }
  if (!isFinite(minX)) return { raeume: [], nullpunkt: null }

  const raeume = roh.map(({ stempel: s, rechteck: r }) => {
    if (!r) {
      return { ...s, x: null, y: null, breite: null, laenge: null, geometrie: false, geschaetzt: true }
    }
    let bM = r.b * skala
    let lM = r.h * skala
    const passt = r.fehler < 0.08
    // Nicht rechteckige Räume: Form behalten, aber auf die GEDRUCKTE Fläche
    // bringen. Die gedruckte Zahl ist die verbindliche – sie steht im Plan.
    if (!passt && bM > 0 && lM > 0) {
      const faktor = Math.sqrt(s.flaeche / (bM * lM))
      bM *= faktor
      lM *= faktor
    }
    return {
      ...s,
      x: Math.round((r.x - minX) * skala * 100) / 100,
      // y spiegeln: PDF zählt von unten, der Grundriss von oben
      y: Math.round((maxY - (r.y + r.h)) * skala * 100) / 100,
      breite: Math.round(bM * 100) / 100,
      laenge: Math.round(lM * 100) / 100,
      geometrie: true,
      geschaetzt: !passt,
      abweichung: Math.round(r.fehler * 1000) / 10,
    }
  })
  // Erst jetzt entzerren: die Anpassung an die gedruckten Flächen hat Vorrang,
  // das Auseinanderschieben räumt nur den Rest weg.
  const entzerrt = entzerren(raeume)
  // Der Nullpunkt wird mitgegeben, damit die Türen GENAU dieselbe Verschiebung
  // und Spiegelung erfahren wie die Räume. Zwei getrennt gerechnete Nullpunkte
  // waren der sicherste Weg, Türen an die falsche Wand zu hängen.
  return { raeume: entzerrt, nullpunkt: { minX, maxY, skala } }
}

// Türen den Räumen zuordnen. Räume liegen bereits im genullten Meter-System,
// die Türen noch in Plankoordinaten – hier bekommen sie denselben Bezug.
export function tuerenZuordnen(raeume, tueren, nullpunkt) {
  const je = new Map()
  if (!nullpunkt) return je
  const { minX, maxY, skala } = nullpunkt
  for (const tu of tueren) {
    const mx = tu.mx - minX * skala
    const my = maxY * skala - tu.my
    let beste = null
    for (const r of raeume) {
      if (r.x == null) continue
      const zu = tuerZuWand({ mx, my, breite: tu.breite }, r)
      if (!zu) continue
      const mitte = { x: r.x + r.breite / 2, y: r.y + r.laenge / 2 }
      const d = Math.hypot(mitte.x - mx, mitte.y - my)
      if (!beste || d < beste.d) beste = { schluessel: r.nummer || r.name, tuer: zu, d }
    }
    if (!beste) continue
    const liste = je.get(beste.schluessel) || []
    // Zweite Sicherung: gleiche Wand, fast gleiche Stelle = dieselbe Tür
    if (liste.some((v) => v.wand === beste.tuer.wand && Math.abs(v.position - beste.tuer.position) < 0.12)) continue
    liste.push(beste.tuer)
    je.set(beste.schluessel, liste)
  }
  return je
}

// Restüberlappungen auseinanderschieben.
//
// "Jeder Raum soll einzeln nebeneinander liegen und deutlich nicht ineinander."
// Nach der Anpassung an die gedruckten Flächen bleiben ein paar Überschneidungen
// übrig – dort, wo ein Raum nicht rechteckig ist oder eine Wandlinie fehlt.
//
// Sie werden entlang der KLEINEREN Eindringtiefe getrennt: Überlappen zwei
// Räume 4 m breit und 0,3 m hoch, dann liegen sie nebeneinander und müssen nur
// 0,3 m auseinander – nicht 4 m. Beide weichen zur Hälfte aus, damit das
// Gesamtbild nicht in eine Richtung wandert. Die Verschiebung ist begrenzt:
// Lieber eine kleine Restüberlappung als ein Raum, der quer durchs Geschoss
// rutscht und die Lage aus dem Plan verliert.
export function entzerren(raeume, { durchgaenge = 60, luft = 0.04, maxWeg = 2.5 } = {}) {
  const boxen = raeume.map((r) => (r.x == null ? null : { x: r.x, y: r.y, b: r.breite, l: r.laenge, sx: 0, sy: 0 }))
  for (let d = 0; d < durchgaenge; d++) {
    let bewegt = false
    for (let i = 0; i < boxen.length; i++) {
      for (let j = i + 1; j < boxen.length; j++) {
        const a = boxen[i], c = boxen[j]
        if (!a || !c) continue
        const ux = Math.min(a.x + a.b, c.x + c.b) - Math.max(a.x, c.x)
        const uy = Math.min(a.y + a.l, c.y + c.l) - Math.max(a.y, c.y)
        if (ux <= luft || uy <= luft) continue
        bewegt = true
        if (ux < uy) {
          const weg = (ux + luft) / 2
          const links = (a.x + a.b / 2) < (c.x + c.b / 2)
          a.x += links ? -weg : weg
          c.x += links ? weg : -weg
          a.sx += weg; c.sx += weg
        } else {
          const weg = (uy + luft) / 2
          const oben = (a.y + a.l / 2) < (c.y + c.l / 2)
          a.y += oben ? -weg : weg
          c.y += oben ? weg : -weg
          a.sy += weg; c.sy += weg
        }
      }
    }
    if (!bewegt) break
  }
  // Wieder auf den Nullpunkt schieben
  let minX = Infinity, minY = Infinity
  for (const b of boxen) { if (!b) continue; minX = Math.min(minX, b.x); minY = Math.min(minY, b.y) }
  if (!isFinite(minX)) return raeume
  return raeume.map((r, i) => {
    const b = boxen[i]
    if (!b) return r
    const weg = Math.hypot(b.sx, b.sy)
    return {
      ...r,
      x: Math.round((b.x - minX) * 100) / 100,
      y: Math.round((b.y - minY) * 100) / 100,
      // Wer stark verschoben wurde, steht nicht mehr genau dort, wo der Plan ihn
      // zeigt. Das wird vermerkt, nicht verschwiegen.
      lageGeschaetzt: weg > maxWeg,
    }
  })
}
