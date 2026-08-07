// Räume aus einem Bauplan-PDF lesen.
//
// ZWEI STUFEN, UND DIE ZWEITE IST DIE WICHTIGE
// Stufe 1 (diese Datei) liest den TEXT: Raumnummer, Name, Fläche.
// Stufe 2 (shared/planGeometrie.js) liest die ZEICHNUNG: Lage, Maße, Türen.
// Erst zusammen ergibt sich ein Grundriss, der dem Plan gleicht. Ohne Stufe 2
// landeten die Räume als gleich große Quadrate in Reihen – und lagen dabei
// übereinander.
//
// GRUNDLAGE
// Architektur-Grundrisse (hier: OpenBuildings Designer / Bentley) tragen je Raum
// einen "Raumstempel": Nummer, Name und Fläche stehen als Text UNTEREINANDER in
// einer schmalen Spalte, z. B.
//
//        1.06a
//        Multifunktionsraum
//        A=19,53qm
//
// Genau daran hängt sich dieses Verfahren auf: Es sucht zuerst die
// Flächenangaben und liest Nummer und Namen aus der engen Spalte darüber.
//
// AN EINEM ECHTEN PLAN GEPRÜFT
// W-G-11_M1_Ind3 (A0, Projekt 2321_IGA, Bauherr Barmer, 1. OG):
// 24 Räume, Summe 442,27 m². Nummern und Flächen kommen zuverlässig,
// die NAMEN bei 7 von 24 nicht – dort steht der Name weiter weg oder ist
// umbrochen. Deshalb ist der Import ein VORSCHLAG mit Kontrolltabelle und
// kein Automatismus. Unvollständiges wird markiert, nicht stillschweigend
// übernommen.
//
// WAS DER PLAN NICHT HERGIBT
// Nur die Bodenfläche. Der Umfang steht nirgends als Text – für Wandflächen
// muss er nachgetragen oder überschlagen werden (siehe shared/raumflaeche.js).

// Raumnummern: 1.01, 1.06a, 1.TRH1L, 3.2.6.3
const RAUMNR = /^\d+\.(?:\d+[a-z]?|[A-Z]+\d*[LP]?)(?:\.\d+)*$/
// Wörter, die im Raumstempel nichts zu suchen haben (Legende, Bemaßung)
const KEIN_NAME = /^(BT|HK|OK|UK|BRH|FFB|RD|AB|BSK|BSV|Oberlicht|Trennschiene|Tür|Fenster)$/i

function zahl(text) {
  return Number(String(text).replace(/\./g, '').replace(',', '.'))
}

// Wörter einer Seite in eine einheitliche Form bringen: { text, x, y }.
// pdf.js liefert je Textstück eine Transformationsmatrix; x und y stehen an
// Position 4 und 5. Die y-Achse läuft im PDF von UNTEN nach oben – für die
// Spaltenlogik wird sie gedreht, damit "darüber" auch darüber heißt.
export function woerterAus(textInhalt, seitenHoehe) {
  const raus = []
  for (const st of textInhalt.items || []) {
    const roh = (st.str || '').trim()
    if (!roh) continue
    const x = st.transform?.[4] ?? 0
    const y = seitenHoehe - (st.transform?.[5] ?? 0)
    // Ein Textstück kann mehrere durch Leerzeichen getrennte Wörter enthalten.
    // Für die Spaltenlogik reicht die Position des Stücks.
    for (const w of roh.split(/\s+/)) raus.push({ text: w, x, y })
  }
  return raus
}

// Flächenangaben finden: "A=16,14qm" am Stück ODER "A=" + Zahl + "qm" getrennt.
// Beide Formen kommen im selben Plan vor – je nachdem, wie das CAD-Programm
// den Text zerlegt hat.
export function flaechenAus(woerter) {
  const raus = []
  for (let i = 0; i < woerter.length; i++) {
    const w = woerter[i]
    const m = w.text.match(/^A=([\d.,]+)\s*(?:qm|m²)$/i)
    if (m) { raus.push({ flaeche: zahl(m[1]), x: w.x, y: w.y }); continue }
    if (/^A=$/i.test(w.text)) {
      const nah = woerter
        .filter((o) => Math.abs(o.y - w.y) < 4 && o.x > w.x && o.x - w.x < 70)
        .sort((a, b) => a.x - b.x)
      const z = nah.find((o) => /^[\d.,]+$/.test(o.text))
      if (z) raus.push({ flaeche: zahl(z.text), x: w.x, y: w.y })
    }
  }
  return raus
}

// Zu einer Flächenangabe Nummer und Namen aus der engen Spalte darüber holen.
// Der Korridor ist bewusst schmal (±34 pt waagerecht): Ein weiterer Radius
// zieht Nachbarbeschriftungen herein, und dann heißt ein Raum
// "Besprechung Demontage Palazzo".
export function stempelZu(flaeche, woerter, { xToleranz = 34, yToleranz = 36 } = {}) {
  const spalte = woerter
    .filter((w) => Math.abs(w.x - flaeche.x) < xToleranz
      && flaeche.y - w.y > -6 && flaeche.y - w.y < yToleranz)
    .sort((a, b) => a.y - b.y)

  const nummer = spalte.find((w) => RAUMNR.test(w.text))?.text || ''
  const namen = spalte
    .filter((w) => /^[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß.\-]{2,}$/.test(w.text) && !KEIN_NAME.test(w.text))
    .map((w) => w.text)
  return { nummer, name: namen.slice(0, 3).join(' ').trim() }
}

// Eine bereits geladene pdf.js-Seite auswerten
export async function seiteAuswerten(seite) {
  const sicht = seite.getViewport({ scale: 1 })
  const inhalt = await seite.getTextContent()
  const woerter = woerterAus(inhalt, sicht.height)
  const flaechen = flaechenAus(woerter)
  return flaechen.map((f) => {
    const st = stempelZu(f, woerter)
    return {
      nummer: st.nummer,
      name: st.name,
      flaeche: Math.round(f.flaeche * 100) / 100,
      x: f.x,
      y: f.y,
      // Was fehlt, wird benannt – die Kontrolltabelle färbt danach ein
      vollstaendig: Boolean(st.nummer && st.name),
      fehlt: [!st.nummer && 'nummer', !st.name && 'name'].filter(Boolean),
    }
  })
}

// Ganzes PDF auswerten. pdf.js wird NACHGELADEN – die Bibliothek wiegt
// mehrere hundert Kilobyte und wird nur beim Import gebraucht.
export async function planAuswerten(datei, { aufFortschritt, mitGeometrie = true } = {}) {
  const pdfjs = await import('pdfjs-dist')
  const geo = mitGeometrie ? await import('./planGeometrie.js') : null
  // Der Arbeiter-Prozess muss ausdrücklich gesetzt werden, sonst sucht pdf.js
  // ihn auf einem CDN – das scheitert unter der strengen Auslieferung.
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  const puffer = await datei.arrayBuffer()
  // Den Ladevorgang festhalten: aufgeraeumt wird ueber IHN, nicht ueber das
  // Dokument. dok.destroy() gibt es in pdf.js 6 nicht mehr.
  const ladevorgang = pdfjs.getDocument({ data: puffer })
  const dok = await ladevorgang.promise
  const alle = []
  let massstab = null
  let tuerZahl = 0
  for (let n = 1; n <= dok.numPages; n++) {
    aufFortschritt?.({ seite: n, gesamt: dok.numPages })
    const seite = await dok.getPage(n)
    const raeume = await seiteAuswerten(seite)
    let angereichert = raeume

    if (geo && raeume.length) {
      // Die ZEICHNUNG auswerten. Scheitert das, bleibt der Textimport bestehen –
      // ein Plan ohne brauchbare Vektoren darf den ganzen Vorgang nicht kippen.
      try {
        aufFortschritt?.({ seite: n, gesamt: dok.numPages, schritt: 'geometrie' })
        const ops = await seite.getOperatorList()
        const linien = geo.linienAus(ops, pdfjs.OPS)
        const sichtG = seite.getViewport({ scale: 1 })
        // seiteAuswerten dreht die y-Achse fuer die Spaltenlogik. Die Geometrie
        // rechnet in PDF-Koordinaten (y nach oben) – also zurueckdrehen. Die
        // 10 pt heben den Suchpunkt von der Beschriftung in die freie Raummitte.
        const stempel = raeume.map((r) => ({
          nummer: r.nummer,
          flaeche: r.flaeche,
          x: r.x,
          y: sichtG.height - r.y + 10,
        }))
        const m = geo.massstabAus(stempel, linien)
        // Ein Massstab, den nur zwei von zwanzig Raeumen bestaetigen, ist kein
        // Massstab, sondern Zufall. Erst ab 40 % wird die Geometrie uebernommen.
        const schwelle = Math.max(2, Math.round(stempel.length * 0.4))
        if (m && m.treffer >= schwelle) {
          massstab = m
          const { raeume: mitGeo, nullpunkt } = geo.raeumeAusGeometrie(stempel, linien, { skala: m.skala })
          const gefunden = geo.tuerenAus(linien.boegen, m.skala)
          const jeRaum = geo.tuerenZuordnen(mitGeo, gefunden, nullpunkt)
          for (const liste of jeRaum.values()) tuerZahl += liste.length
          angereichert = raeume.map((r, i) => ({
            ...r,
            x: mitGeo[i]?.x ?? null,
            y: mitGeo[i]?.y ?? null,
            breite: mitGeo[i]?.breite ?? null,
            laenge: mitGeo[i]?.laenge ?? null,
            geometrie: Boolean(mitGeo[i]?.geometrie),
            formGeschaetzt: Boolean(mitGeo[i]?.geschaetzt),
            tueren: jeRaum.get(r.nummer || r.name) || [],
          }))
        }
      } catch (e) {
        // Bewusst still: die Textauswertung steht, und die Kontrolltabelle
        // zeigt ohnehin an, ob Geometrie vorliegt.
        if (typeof console !== 'undefined') console.warn('Plangeometrie nicht lesbar:', e?.message)
      }
    }

    for (const r of angereichert) alle.push({ ...r, seite: n })
  }
  await ladevorgang.destroy()

  // Doppelte Nummern über mehrere Seiten zusammenführen wäre falsch: Ein Plan
  // je Geschoss kann dieselbe Nummer tragen. Stattdessen nur innerhalb einer
  // Seite entdoppeln (derselbe Stempel zweimal erkannt).
  const gesehen = new Set()
  const sauber = []
  for (const r of alle) {
    const k = `${r.seite}|${r.nummer}|${r.flaeche}`
    if (gesehen.has(k)) continue
    gesehen.add(k)
    sauber.push(r)
  }
  sauber.sort((a, b) => (a.seite - b.seite) || a.nummer.localeCompare(b.nummer, 'de'))
  return {
    raeume: sauber,
    seiten: dok.numPages,
    massstab: massstab ? { name: massstab.name, treffer: massstab.treffer } : null,
    mitGeometrie: sauber.filter((r) => r.geometrie).length,
    tueren: tuerZahl,
    summe: Math.round(sauber.reduce((s, r) => s + r.flaeche, 0) * 100) / 100,
    unvollstaendig: sauber.filter((r) => !r.vollstaendig).length,
  }
}
