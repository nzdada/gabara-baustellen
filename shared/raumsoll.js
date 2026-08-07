// Die Brücke zwischen Räumen und Leistungsverzeichnis.
//
// DAS ZIEL DES BETRIEBS
// "Die Quadratmeter ergeben sich aus den Räumen, der Preis aus dem LV."
// Genau das leistet diese Datei: Sie verteilt die Menge einer LV-Position auf
// die Räume – nach der Fläche, die dort tatsächlich anfällt.
//
// WIE DIE VERTEILUNG ENTSTEHT
// Das Büro wählt je LV-Position EINE Bezugsfläche:
//   Decke / Boden  -> Grundfläche des Raums (steht im Bauplan)
//   Wand           -> Umfang × Höhe abzüglich Türen und Fenster
//   Wand + Decke   -> beides
//   Stück          -> von Hand, z. B. Zargen
// Daraus entsteht je Raum eine Sollmenge. Der Preis bleibt, wo er hingehört:
// beim LV. Hier wird nur die MENGE bestimmt.
//
// WARUM EINE EIGENE SAMMLUNG UND KEIN FELD AM RAUM
// Eine Position kommt in vielen Räumen vor, ein Raum trägt viele Positionen –
// das ist n:m. Als Feld am Raum wäre es eine Liste, die bei jeder LV-Änderung
// in jedem Raum nachgezogen werden müsste.

import { mengeFuerBezug, BEZUG } from './raumflaeche.js'

export { BEZUG }

function runde(n) {
  return Math.round((Number(n) || 0) * 1000) / 1000
}

// Sollmengen für EINE Position über alle Räume berechnen.
// Liefert Vorschläge – gespeichert wird erst auf Knopfdruck.
export function verteile(position, raeume, bezug, opts = {}) {
  const zeilen = []
  let summe = 0
  let geschaetzt = false
  for (const r of raeume || []) {
    if (r.aktiv === false) continue
    const m = mengeFuerBezug(r, bezug, opts)
    if (m.menge <= 0) continue
    zeilen.push({
      raumId: r.id,
      raumName: r.name || r.nummer || '',
      sollMenge: runde(m.menge),
      geschaetzt: m.geschaetzt,
    })
    summe += m.menge
    if (m.geschaetzt) geschaetzt = true
  }
  const lv = Number(position?.menge) || 0
  return {
    zeilen,
    summe: runde(summe),
    lvMenge: lv,
    // Abweichung ist ein HINWEIS, kein Fehler: Ein Bauplan zeigt ein Geschoss,
    // das Leistungsverzeichnis umfasst oft mehrere. Erst wenn die Räume MEHR
    // ergeben als der Vertrag hergibt, wird es kritisch.
    abweichung: runde(summe - lv),
    ueberVertrag: lv > 0 && summe > lv * 1.001,
    geschaetzt,
  }
}

export function baueSoll({ projektId, position, raumId, raumName, menge, bezug, quelle = 'verteilt' }) {
  return {
    id: `rs-${position.id}-${raumId}`,     // fest: erneutes Verteilen ersetzt, statt zu verdoppeln
    projektId,
    positionId: position.id,
    oz: position.oz || '',
    einheit: position.einheit || '',
    raumId,
    raumName: raumName || '',
    sollMenge: runde(menge),
    bezug,
    quelle,
    erstelltAm: Date.now(),
  }
}

// Was ist in einem Raum noch offen?
// gemeldet = Summe der bereits gemeldeten Leistungen für diesen Raum und diese
// Position (Sammlung 'leistungen').
export function offenJeRaum(soll, meldungen) {
  const gemeldet = {}
  for (const m of meldungen || []) {
    if (m.storniert || !m.raumId) continue
    const k = `${m.positionId}|${m.raumId}`
    gemeldet[k] = (gemeldet[k] || 0) + (Number(m.menge) || 0)
  }
  return (soll || []).map((s) => {
    const k = `${s.positionId}|${s.raumId}`
    const schon = gemeldet[k] || 0
    return { ...s, gemeldet: runde(schon), offen: runde(Math.max(0, (Number(s.sollMenge) || 0) - schon)) }
  })
}

// Die Mengen eines FERTIGEN Raums in Meldezeilen umwandeln.
//
// Das ist der Moment, in dem aus "Wand gestrichen" eine abrechenbare Menge
// wird. Bewusst ein ausdrücklicher Schritt und kein Automatismus: Der Monteur
// hakt ab, das Büro prüft und übernimmt. Wer beides automatisch koppelt,
// fakturiert irgendwann eine Wand, die nur versehentlich angetippt wurde.
//
// DOPPELZÄHLUNG: Es wird nur das OFFENE übernommen (Soll minus bereits
// gemeldet). Hat der Monteur die Menge zusätzlich von Hand gemeldet, bleibt
// hier nichts übrig – die Zahl kann also nicht zweimal in die Rechnung.
export function meldezeilenFuerRaum({ raum, soll, meldungen, positionen, projektId, user, datum }) {
  const offen = offenJeRaum(soll.filter((s) => s.raumId === raum.id), meldungen)
  const zeilen = []
  for (const s of offen) {
    if (s.offen <= 0) continue
    const p = (positionen || []).find((x) => x.id === s.positionId)
    if (!p) continue
    zeilen.push({
      projektId,
      positionId: s.positionId,
      oz: s.oz || p.oz || '',
      einheit: s.einheit || p.einheit || '',
      raumId: raum.id,
      raumName: raum.name || raum.nummer || '',
      menge: s.offen,
      datum,
      mitarbeiterId: user?.userId || '',
      mitarbeiterName: user?.name || '',
      terminId: '',
      notiz: `Raum fertig: ${raum.nummer || raum.name || ''}`.trim(),
      storniert: false,
      storniertAm: 0,
      storniertVon: '',
      quelle: 'raum',
      erfasstAm: Date.now(),
    })
  }
  return zeilen
}
