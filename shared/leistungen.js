// Leistungsmeldungen: das Tagesprotokoll der Baustelle.
//
// WARUM ES DIESE SAMMLUNG GIBT
// Bis hierher kannte die App nur einen Zustand je LV-Position: istMenge = 940.
// Wer heute 120 m² geschafft hatte, musste selbst 820 + 120 rechnen und die
// Summe eintippen – auf der Leiter, mit Handschuhen. Zwei Monteure am selben
// Tag überschrieben sich gegenseitig, eine Korrektur war nicht von einer
// Neumeldung zu unterscheiden, und rückgängig machen ging gar nicht.
//
// Jetzt gilt: eine Zeile je Meldung. Der Monteur meldet, was er HEUTE geschafft
// hat. istMenge bleibt erhalten und wird zur Summe dieser Zeilen – deshalb
// funktionieren Fortschrittsbalken, Dashboard und Rechnungsstellung unverändert
// weiter, sie lesen dasselbe Feld wie vorher.
//
// BEWEISWERT: Eine Meldung wird NIE gelöscht, nur storniert. Berichte sind
// gegenüber dem Generalunternehmer Beweismittel (VOB/B § 15 Abs. 3); für die
// gemeldeten Mengen gilt dasselbe. Ein Protokoll, aus dem sich Zeilen entfernen
// lassen, ist im Streitfall wenig wert.

// Zählt eine Zeile mit? Stornierte nicht.
export function gilt(zeile) {
  return Boolean(zeile) && !zeile.storniert
}

// Summe der gemeldeten Menge – die Zahl, die in lvpositionen.istMenge gehört.
// Rundung auf 3 Nachkommastellen: Fließkomma summiert sonst 0.1+0.2 zu
// 0.30000000000000004, und diese Zahl landet in einer Rechnung.
export function summiereIst(zeilen) {
  const summe = (zeilen || []).filter(gilt).reduce((s, z) => s + (Number(z.menge) || 0), 0)
  return Math.round(summe * 1000) / 1000
}

// Summen je LV-Position: { positionId: menge }
export function summeJePosition(zeilen) {
  const raus = {}
  for (const z of (zeilen || []).filter(gilt)) {
    raus[z.positionId] = (raus[z.positionId] || 0) + (Number(z.menge) || 0)
  }
  for (const k of Object.keys(raus)) raus[k] = Math.round(raus[k] * 1000) / 1000
  return raus
}

// Summen je Raum: { raumId: menge } – '' ist der gültige Schlüssel für
// "ohne Raum", damit Projekte ohne Raumpflege unverändert funktionieren.
export function summeJeRaum(zeilen, positionId = null) {
  const raus = {}
  for (const z of (zeilen || []).filter(gilt)) {
    if (positionId && z.positionId !== positionId) continue
    const k = z.raumId || ''
    raus[k] = (raus[k] || 0) + (Number(z.menge) || 0)
  }
  for (const k of Object.keys(raus)) raus[k] = Math.round(raus[k] * 1000) / 1000
  return raus
}

// Weicht die gespeicherte istMenge von der Summe der Meldungen ab?
//
// Das ist die wichtigste Prüfung des ganzen Umbaus. istMenge wird inkrementell
// fortgeschrieben (schnell, offline-fähig, atomar), die Meldungen sind die
// Wahrheit. Läuft beides auseinander – abgebrochener Schreibvorgang, doppelt
// ausgeführte Migration –, dann steht in der Rechnung eine Menge, für die es
// keinen Nachweis gibt. Toleranz 0,001, alles darüber ist ein Fehler.
export function abweichung(position, zeilen) {
  const gemeldet = summiereIst((zeilen || []).filter((z) => z.positionId === position.id))
  const gespeichert = Number(position.istMenge) || 0
  const diff = Math.round((gespeichert - gemeldet) * 1000) / 1000
  return { gemeldet, gespeichert, diff, stimmt: Math.abs(diff) < 0.001 }
}

// Alle Positionen eines Projekts prüfen. Liefert nur die abweichenden.
export function pruefeAlle(positionen, zeilen) {
  return (positionen || [])
    .filter((p) => p.typ === 'position')
    .map((p) => ({ position: p, ...abweichung(p, zeilen) }))
    .filter((e) => !e.stimmt)
}

// Baut eine Meldezeile. Alles, was später auf dem Nachweis stehen muss, wird
// als Schnappschuss mitgeschrieben – oz, einheit und raumName können sich
// ändern, die Meldung von damals darf davon nicht rückwirkend betroffen sein.
export function baueMeldung({
  position, projektId, menge, raum = null, datum, user, terminId = '', notiz = '', quelle = 'monteur',
}) {
  return {
    projektId,
    positionId: position.id,
    oz: position.oz || '',
    einheit: position.einheit || '',
    raumId: raum?.id || '',
    raumName: raum?.name || '',
    menge: Math.round((Number(menge) || 0) * 1000) / 1000,
    datum,
    mitarbeiterId: user?.userId || '',
    mitarbeiterName: user?.name || '',
    terminId,
    notiz,
    storniert: false,
    storniertAm: 0,
    storniertVon: '',
    quelle,
    erfasstAm: Date.now(),
  }
}

// Zeilen absteigend nach Tag, innerhalb des Tages nach Erfassungszeit.
export function sortiereNeuesteZuerst(zeilen) {
  return [...(zeilen || [])].sort((a, b) => {
    if (a.datum !== b.datum) return (b.datum || '').localeCompare(a.datum || '')
    return (b.erfasstAm || 0) - (a.erfasstAm || 0)
  })
}
