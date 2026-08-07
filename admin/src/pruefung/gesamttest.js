// Gesamttest der Rechenkerne.
//
// WARUM DIESE DATEI EXISTIERT
// Ein grüner Build sagt nur, dass der Code sich übersetzen lässt. Er sagt nichts
// darüber, ob 1.150 als tausendeinhundertfünfzig oder als 1,15 gelesen wird –
// und genau daran hängt hier Geld. Jeder Fall unten prüft einen ERWARTETEN WERT,
// nicht bloß, dass etwas zurückkommt.
//
// Ausführen: in der Browser-Konsole der laufenden Verwaltung
//   import('/src/pruefung/gesamttest.js').then(m => m.laufe())

const F = (n) => Math.round(n * 1000) / 1000

export async function laufe() {
  const [RF, RA, RS, LE, NS, PI, FB, PS] = await Promise.all([
    import('@shared/raumflaeche.js'),
    import('@shared/raumaufgaben.js'),
    import('@shared/raumsoll.js'),
    import('@shared/leistungen.js'),
    import('@shared/naechsterSchritt.js'),
    import('@shared/planImport.js'),
    import('@shared/fastbill.js'),
    import('@shared/projektstatus.js'),
  ])
  const csv = await import('../csv.js')

  const faelle = []
  const p = (bereich, name, ist, soll) => {
    const gleich = JSON.stringify(ist) === JSON.stringify(soll)
    faelle.push({ bereich, name, ist, soll, ok: gleich })
  }

  // ---------------------------------------------------------------- Flächen
  const raum = { id: 'r1', name: 'Wohnzimmer', breite: 5, laenge: 4, hoehe: 2.5, flaeche: 20 }
  const ef = RF.einzelflaechen(raum, {})
  p('Fläche', 'Decke 5×4', ef.find((f) => f.id === 'decke').groesse, 20)
  p('Fläche', 'Wand Nord (5 m breit)', ef.find((f) => f.id === 'wandN').groesse, 12.5)
  p('Fläche', 'Wand Ost (4 m tief)', ef.find((f) => f.id === 'wandO').groesse, 10)
  p('Fläche', 'Umfang-Überschlag Quadrat 16 m²', RF.umfangUeberschlag(16).umfang, 16)
  p('Fläche', 'Überschlag ist als geschätzt markiert', RF.umfangUeberschlag(16).geschaetzt, true)
  p('Fläche', 'Menge für Bezug Decke', RF.mengeFuerBezug(raum, 'decke', {}).menge, 20)
  p('Fläche', 'Menge für Bezug Wand', F(RF.mengeFuerBezug(raum, 'wand', {}).menge), 45)
  p('Fläche', 'Menge für Bezug Wand+Decke', F(RF.mengeFuerBezug(raum, 'wanddecke', {}).menge), 65)
  p('Fläche', 'Stück ist keine Fläche', RF.mengeFuerBezug(raum, 'stueck', {}).menge, 0)
  p('Fläche', 'Summe über zwei Räume', F(RF.summeFuerBezug([raum, { ...raum, id: 'r2' }], 'decke', {}).menge), 40)

  // ------------------------------------------------------------- Aufgaben
  const auf = (n, fertig) => Array.from({ length: n }, (_, i) => ({
    id: `a${i}`, text: `Schritt ${i + 1}`, sort: i, fertig: i < fertig,
  }))
  p('Aufgaben', '3 von 7 erledigt', RA.fortschrittAufgaben({ aufgaben: auf(7, 3) }).prozent, 43)
  p('Aufgaben', 'nächster offener Schritt', RA.fortschrittAufgaben({ aufgaben: auf(7, 3) }).naechste.text, 'Schritt 4')
  p('Aufgaben', 'alles erledigt', RA.fortschrittAufgaben({ aufgaben: auf(7, 7) }).alleFertig, true)
  p('Aufgaben', 'Raum ohne Aufgaben ist NICHT fertig', RA.fortschrittAufgaben({ aufgaben: [] }).alleFertig, false)
  p('Aufgaben', 'alle fertig → jede Fläche grün', RA.flaechenZustand({ aufgaben: auf(3, 3) }, 'wandN'), 'fertig')
  p('Aufgaben', 'teilweise → in Arbeit', RA.flaechenZustand({ aufgaben: auf(3, 1) }, 'wandN'), 'arbeit')
  p('Aufgaben', 'nichts begonnen → offen', RA.flaechenZustand({ aufgaben: auf(3, 0) }, 'wandN'), 'offen')
  p('Aufgaben', 'einzeln gemeldete Wand schlägt durch',
    RA.flaechenZustand({ aufgaben: auf(3, 0), status: { wandN: 'fertig' } }, 'wandN'), 'fertig')
  p('Aufgaben', 'Gesamtfortschritt zweier Räume',
    RA.fortschrittGesamtAufgaben([{ aufgaben: auf(4, 2) }, { aufgaben: auf(4, 4) }]).prozent, 75)
  p('Aufgaben', 'stillgelegter Raum zählt nicht mit',
    RA.fortschrittGesamtAufgaben([{ aufgaben: auf(4, 2) }, { aufgaben: auf(4, 0), aktiv: false }]).prozent, 50)

  // --------------------------------------------------------------- Mengen
  const pos = { id: 'p1', oz: '2.1', menge: 100, einheit: 'm²' }
  const rr = [
    { id: 'r1', name: 'Wohnzimmer', breite: 5, laenge: 4, hoehe: 2.5, aktiv: true },
    { id: 'r2', name: 'Flur', breite: 6, laenge: 5, hoehe: 2.5, aktiv: true },
  ]
  const v = RS.verteile(pos, rr, 'decke')
  p('Mengen', 'Verteilung auf zwei Räume', v.zeilen.map((z) => z.sollMenge), [20, 30])
  p('Mengen', 'Summe unter Vertragsmenge → kein Alarm', v.ueberVertrag, false)
  p('Mengen', 'Abweichung als Hinweis', v.abweichung, -50)
  p('Mengen', 'mehr als der Vertrag hergibt → Alarm',
    RS.verteile({ ...pos, menge: 40 }, rr, 'decke').ueberVertrag, true)
  const soll = v.zeilen.map((z) => RS.baueSoll({ projektId: 'x', position: pos, raumId: z.raumId, raumName: z.raumName, menge: z.sollMenge, bezug: 'decke' }))
  p('Mengen', 'feste Dokument-ID (kein Verdoppeln)', soll[0].id, 'rs-p1-r1')
  const meld = (m) => RS.meldezeilenFuerRaum({ raum: rr[0], soll, meldungen: m, positionen: [pos], projektId: 'x', user: { userId: 'U' }, datum: '2026-08-03' })
  p('Mengen', 'nichts gemeldet → volle Menge', meld([]).map((z) => z.menge), [20])
  p('Mengen', '12 gemeldet → nur der Rest', meld([{ positionId: 'p1', raumId: 'r1', menge: 12 }]).map((z) => z.menge), [8])
  p('Mengen', 'alles gemeldet → keine Zeile', meld([{ positionId: 'p1', raumId: 'r1', menge: 20 }]).length, 0)
  p('Mengen', 'zweite Übernahme erzeugt nichts', meld(meld([]).map((z) => ({ positionId: z.positionId, raumId: z.raumId, menge: z.menge }))).length, 0)
  p('Mengen', 'Storno macht die Menge wieder offen', meld([{ positionId: 'p1', raumId: 'r1', menge: 20, storniert: true }]).map((z) => z.menge), [20])
  p('Mengen', 'Meldung im Nachbarraum wirkt nicht', meld([{ positionId: 'p1', raumId: 'r2', menge: 20 }]).map((z) => z.menge), [20])

  // ------------------------------------------------------------ Ist-Summen
  // summiereIst liefert EINE Zahl, summeJePosition die Aufteilung je Position.
  p('Ist', 'Gleitkomma sauber gerundet', LE.summiereIst([{ menge: 0.1 }, { menge: 0.2 }]), 0.3)
  p('Ist', 'Storno zählt nicht mit', LE.summiereIst([{ menge: 5 }, { menge: 3, storniert: true }]), 5)
  p('Ist', 'Summe je Position',
    LE.summeJePosition([{ positionId: 'p1', menge: 0.1 }, { positionId: 'p1', menge: 0.2 }, { positionId: 'p2', menge: 4 }]),
    { p1: 0.3, p2: 4 })

  // ------------------------------------------------------------- Zahlen
  p('Zahlen', 'Tausenderpunkt: 1.150', csv.parseZahlPruef('1.150').wert, 1150)
  p('Zahlen', 'Dezimalkomma: 8,5', csv.parseZahlPruef('8,5').wert, 8.5)
  p('Zahlen', 'englisch: 1150.5', csv.parseZahlPruef('1150.5').wert, 1150.5)
  p('Zahlen', 'Unfug wird abgewiesen', csv.parseZahlPruef('abc').ok, false)
  // Leer ist ausdruecklich als leer gekennzeichnet – der Wert 0 allein waere
  // nicht von einer eingetippten Null zu unterscheiden.
  p('Zahlen', 'leer wird als leer gemeldet', csv.parseZahlPruef('').leer, true)
  p('Zahlen', 'eingetippte Null ist nicht leer', csv.parseZahlPruef('0').leer, false)

  // ------------------------------------------------------------- Führung
  // 'inArbeit' ist ein OFFENER Status (shared/projektstatus.js) – nur dafür
  // greift die Regel, ein abgeschlossenes Projekt braucht kein LV mehr.
  const leer = NS.schritteBuero({ projekte: [{ id: 'p', name: 'IGA', status: 'inArbeit' }], lvpositionen: [] })
  // text ist zweisprachig ({de, ar}) – der Regex muss auf die deutsche Fassung
  p('Führung', 'Baustelle ohne LV wird gemeldet', leer.some((s) => /Leistungsverzeichnis/i.test(s.text?.de || '')), true)
  // Jeder Schritt braucht ein ZIEL und einen Knopf – sonst nennt die Führung ein
  // Problem, ohne einen Weg dorthin zu zeigen.
  p('Führung', 'jeder Schritt hat ein Ziel', leer.every((s) => Boolean(s.ziel)), true)
  p('Führung', 'jeder Schritt hat einen Knopf', leer.every((s) => Boolean(s.knopf?.de)), true)
  p('Führung', 'Ziel zeigt auf den LV-Bereich', leer[0].ziel.includes('bereich=lv'), true)
  p('Führung', 'nichts zu tun → leere Liste', NS.schritteBuero({}).length, 0)
  p('Führung', 'abgeschlossenes Projekt braucht kein LV',
    NS.schritteBuero({ projekte: [{ id: 'p', name: 'X', status: 'abgeschlossen' }], lvpositionen: [] }).length, 0)
  p('Führung', 'Monteur ohne Termin bekommt nichts', NS.schritteMonteur({ appointments: [], berichte: [], projekte: [], user: { id: 'u' } }).length, 0)

  // ---------------------------------------------------------- Plan-Import
  const w = [
    { text: '1.06a', x: 100, y: 100 },
    { text: 'Multifunktionsraum', x: 100, y: 112 },
    { text: 'A=19,53qm', x: 100, y: 124 },
    { text: 'A=', x: 300, y: 200 }, { text: '16,14', x: 320, y: 200 }, { text: 'qm', x: 350, y: 200 },
  ]
  const fl = PI.flaechenAus(w)
  p('Plan', 'Fläche am Stück erkannt', fl[0].flaeche, 19.53)
  p('Plan', 'Fläche getrennt erkannt', fl.length, 2)
  p('Plan', 'Stempel über der Fläche', PI.stempelZu(fl[0], w).nummer, '1.06a')
  p('Plan', 'Name aus derselben Spalte', PI.stempelZu(fl[0], w).name, 'Multifunktionsraum')
  p('Plan', 'Nachbarspalte wird NICHT eingesammelt', PI.stempelZu(fl[1], w).nummer, '')

  // ------------------------------------------------------- Sicherheitseinbehalt
  const eb = FB.einbehaltText({ einbehaltProzent: 5, einbehaltBetrag: 595, zahlbetrag: 11305 })
  p('Einbehalt', 'Betrag steht auf der Rechnung', eb.includes('595,00'), true)
  p('Einbehalt', 'Zahlbetrag steht darunter', eb.includes('11.305,00'), true)
  p('Einbehalt', 'ohne Einbehalt kein Text', FB.einbehaltText({ einbehaltProzent: 0 }), '')

  // ------------------------------------------------------------ Projektstatus
  p('Status', 'fünf Projektstufen', PS.PROJEKT_STATUS.length, 5)
  p('Status', 'offene Stufen erkannt', PS.istOffen('inArbeit'), true)
  p('Status', 'abgeschlossen ist nicht offen', PS.istOffen('abgeschlossen'), false)

  // ------------------------------------------------------------- Türen
  const TU = await import('@shared/tueren.js')
  const rz = { x: 10, y: 20, breite: 5, laenge: 4 }
  p('Türen', 'Nordwand mittig', TU.tuerZuWand({ mx: 12.5, my: 20, breite: 0.9 }, rz).wand, 'wandN')
  p('Türen', 'zu weit weg wird verworfen', TU.tuerZuWand({ mx: 40, my: 20, breite: 0.9 }, rz), null)

  // ------------------------------------------------------- Entzerrung
  const GEO = await import('@shared/planGeometrie.js')
  const ent = GEO.entzerren([{ x: 0, y: 0, breite: 5, laenge: 4 }, { x: 4, y: 0, breite: 5, laenge: 4 }])
  p('Grundriss', 'Räume liegen nicht mehr ineinander',
    Math.min(ent[0].x + 5, ent[1].x + 5) - Math.max(ent[0].x, ent[1].x) <= 0.05, true)
  p('Grundriss', 'Maße bleiben unangetastet', [ent[0].breite, ent[0].laenge], [5, 4])

  // ------------------------------------------- Fortschritt über alle Räume
  p('Aufgaben', 'ein geplanter Raum von zwei ist NICHT vollständig',
    RA.fortschrittGesamtAufgaben([{ aufgaben: auf(3, 3) }, { aufgaben: [] }]).vollstaendig, false)
  p('Aufgaben', 'alle geplant ist vollständig',
    RA.fortschrittGesamtAufgaben([{ aufgaben: auf(3, 3) }, { aufgaben: auf(2, 0) }]).vollstaendig, true)
  p('Aufgaben', 'ungeplante Räume werden gezählt',
    RA.fortschrittGesamtAufgaben([{ aufgaben: auf(3, 3) }, { aufgaben: [] }, { aufgaben: [] }]).raeumeMitAufgaben, 1)

  const durch = faelle.filter((f) => f.ok).length
  const fehl = faelle.filter((f) => !f.ok)
  console.table(faelle.map((f) => ({ Bereich: f.bereich, Fall: f.name, ok: f.ok ? '✓' : '✗' })))
  if (fehl.length) console.error('FEHLGESCHLAGEN:', fehl)
  return { gesamt: faelle.length, bestanden: durch, fehlgeschlagen: fehl.length, fehler: fehl }
}
