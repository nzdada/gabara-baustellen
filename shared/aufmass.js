// Aufmaß nach Regelwerk – der Geldkern von V2.
//
// WARUM ES DIESE DATEI GIBT
// V1 zog pauschal 1,9 m² je Tür und 1,6 m² je Fenster von der Wandfläche ab
// (raumflaeche.js, ABZUG_TUER/ABZUG_FENSTER). Nach ATV DIN 18363 Abschnitt
// 5.3.1 werden Öffnungen bis 2,50 m² Einzelgröße aber ÜBERMESSEN – mitbezahlt,
// als wäre die Wand geschlossen. Dazu verlangt 5.2.1 das Rohbaumaß (bis zu den
// ungeputzten, nicht bekleideten Bauteilen, z. B. Rohfußboden), und 5.2.4
// stellt Leibungen und Nischen-Rückflächen GESONDERT in Rechnung, unabhängig
// von ihrer Einzelgröße. Alle drei Fehler wirkten in dieselbe Richtung:
// je Raum rund 15–20 % zu wenig abgerechnete Fläche.
//
// Deshalb hier: KEIN fester Abzug im Code. Die Abrechnungsregel ist je
// Baustelle wählbar – die VOB/C gilt nur, wenn sie vereinbart ist, und ein
// Nachunternehmervertrag kann Abweichendes vorschreiben. Die gewählte Regel
// steht als Klartext auf jedem Aufmaßblatt und wird an jeder Aufmaßzeile als
// Schnappschuss gespeichert, damit eine spätere Umstellung alte Rechnungen
// nicht rückwirkend verändert.
//
// GRUNDREGELN DIESES MODULS
// - Reine Rechenfunktionen, kein React, kein Store, keine Nebenwirkungen.
// - Jede Menge trägt ihren ANSATZ als Formeltext mit ("18,00 × 2,62") –
//   das Aufmaßblatt nach § 14 Abs. 1 VOB/B verlangt den Rechenweg,
//   nicht nur die Endsumme.
// - Geschätzte Werte werden gekennzeichnet und sind stromabwärts für die
//   Rechnung GESPERRT. Eine geschätzte Menge darf gemeldet, aber nie
//   fakturiert werden.

// ------------------------------------------------------------- Standardmaße
// Nur als VORBELEGUNG im Formular, nie als stiller Rechenwert: Der Anwender
// sieht die Zahl und kann sie ändern.
export const TUER_BREITE_STD = 0.885
export const TUER_HOEHE_STD = 2.01
export const FENSTER_BREITE_STD = 1.2
export const FENSTER_HOEHE_STD = 1.3
export const LEIBUNG_TIEFE_TUER = 0.15
export const LEIBUNG_TIEFE_FENSTER = 0.2
// Üblicher Bodenaufbau (Estrich + Dämmung) zwischen Rohfußboden und Oberkante
// Fertigboden. PFLICHTANGABE je Baustelle – ein stiller Vorgabewert würde bei
// einem Bestandsboden ohne Estrich Fläche berechnen, die es nicht gibt.
export const AUFBAU_BODEN_UEBLICH = 0.12

// ------------------------------------------------------------- Regelwerke
//
// 'vob18363'          Vorgabe: ATV DIN 18363 Abschnitt 5 (Übermessung,
//                     Rohbaumaß, Leibungen gesondert).
// 'vertragAbzugAlle'  wenn der Vertrag abweichend "Öffnungen werden abgezogen"
//                     vorschreibt: lichte Maße, jeder Abzug, keine Leibungen.
// 'pauschal'          Pauschalpreis, kein Aufmaß – Mengen nur zur Planung.
export const REGELWERKE = {
  vob18363: {
    id: 'vob18363',
    name: 'VOB/C ATV DIN 18363, Abschnitt 5',
    klartext:
      'Öffnungen bis 2,50 m² übermessen (5.3.1) · Rohbaumaß bis zu den '
      + 'ungeputzten Bauteilen (5.2.1) · Leibungen gesondert (5.2.4)',
    uebermessenBisM2: 2.5,     // Flächenmaß Wand/Decke: darunter kein Abzug
    bodenOeffnungBisM2: 0.5,   // Öffnungen in Böden
    unterbrechungBisM: 1.0,    // Längenmaß: Unterbrechungen bis 1,00 m
    faschenBisM: 0.3,          // Gesimse, Friese, Faschen bis 30 cm Breite
    leisteBisM: 0.1,           // Fußleisten bis 10 cm Höhe
    leibungenGesondert: true,
    hoeheRohbau: true,
    aufmass: true,
  },
  vertragAbzugAlle: {
    id: 'vertragAbzugAlle',
    name: 'Vertraglich abweichend: alle Öffnungen werden abgezogen',
    klartext:
      'Abzug aller Öffnungen unabhängig von der Einzelgröße · lichte Maße · '
      + 'Leibungen nur nach gesonderter Vereinbarung',
    uebermessenBisM2: 0,
    bodenOeffnungBisM2: 0,
    unterbrechungBisM: 0,
    faschenBisM: 0,
    leisteBisM: 0,
    leibungenGesondert: false,
    hoeheRohbau: false,
    aufmass: true,
  },
  pauschal: {
    id: 'pauschal',
    name: 'Pauschalpreis – kein Aufmaß',
    klartext: 'Vergütung pauschal; Mengen dienen nur der internen Planung',
    uebermessenBisM2: 0,
    bodenOeffnungBisM2: 0,
    unterbrechungBisM: 0,
    faschenBisM: 0,
    leisteBisM: 0,
    leibungenGesondert: false,
    hoeheRohbau: false,
    aufmass: false,
  },
}

// Kein stilles Zurückfallen auf eine Vorgabe: Das Regelwerk ist Pflichtfeld
// der Baustelle. Wer hier ohne gültige Kennung ankommt, bekommt null und muss
// den Anwender fragen – bei Geld wird nicht geraten.
export function regelwerkVon(id) {
  return REGELWERKE[id] || null
}

// ------------------------------------------------------------- Zahlhelfer

function runde(n, stellen = 3) {
  const f = 10 ** stellen
  return Math.round((Number(n) || 0) * f) / f
}

// Zahl als deutscher Formeltext: 18.2 → "18,20" · 4.905 → "4,905".
// Drei Nachkommastellen, eine überflüssige End-Null wird entfernt –
// so sehen Aufmaßblätter im Bauwesen üblicherweise aus.
export function zahlText(n) {
  let s = (Number(n) || 0).toFixed(3)
  if (s.endsWith('0')) s = s.slice(0, -1)
  return s.replace('.', ',')
}

// ------------------------------------------------------------- Öffnungen
//
// Eine Öffnung: { art: 'tuer'|'fenster'|'nische'|'aussparung', breite, hoehe,
//                 anzahl, leibungstiefe, leibungBeschichtet }
// Für das Maß der Öffnung sind nach 5.3.1 die jeweils KLEINSTEN Maße
// maßgebend – erfasst wird deshalb das lichte Öffnungsmaß.

function masseVon(o) {
  const art = o?.art || 'tuer'
  const breite = Number(o?.breite)
    || (art === 'fenster' ? FENSTER_BREITE_STD : TUER_BREITE_STD)
  const hoehe = Number(o?.hoehe)
    || (art === 'fenster' ? FENSTER_HOEHE_STD : TUER_HOEHE_STD)
  return { art, breite, hoehe, anzahl: Math.max(1, Number(o?.anzahl) || 1) }
}

// Einzelgröße einer Öffnung in m² (kleinste Maße, eine Öffnung – die Schwelle
// gilt je Einzelöffnung, nicht für die Summe).
export function oeffnungsFlaeche(o) {
  const m = masseVon(o)
  return runde(m.breite * m.hoehe)
}

// Abzug einer Öffnung nach Regelwerk.
// Unter der Schwelle wird übermessen: Abzug 0. Darüber wird die tatsächliche
// Einzelgröße abgezogen – je Öffnung, multipliziert mit der Anzahl.
export function abzugFuerOeffnung(o, rw) {
  if (!rw) return { abzug: 0, uebermessen: false }
  const m = masseVon(o)
  const einzel = m.breite * m.hoehe
  const schwelle = Number(rw.uebermessenBisM2) || 0
  if (einzel <= schwelle) {
    return { abzug: 0, uebermessen: true, einzel: runde(einzel) }
  }
  return { abzug: runde(einzel * m.anzahl), uebermessen: false, einzel: runde(einzel) }
}

// Leibungsfläche einer Öffnung (je Öffnung × Anzahl).
// Tür: drei Seiten (2 × Höhe + Breite) – unten ist der Boden.
// Fenster/Nische/Aussparung: vier Seiten, 2 × (Breite + Höhe).
// Nur wenn die Leibung tatsächlich beschichtet wird (leibungBeschichtet).
export function leibungsFlaeche(o) {
  if (o?.leibungBeschichtet === false) return { flaeche: 0, laufmeter: 0, tiefe: 0 }
  const m = masseVon(o)
  const tiefe = Number(o?.leibungstiefe)
    || (m.art === 'tuer' ? LEIBUNG_TIEFE_TUER : LEIBUNG_TIEFE_FENSTER)
  const laufmeter = m.art === 'tuer'
    ? 2 * m.hoehe + m.breite
    : 2 * (m.breite + m.hoehe)
  return {
    flaeche: runde(laufmeter * tiefe * m.anzahl),
    laufmeter: runde(laufmeter),
    tiefe: runde(tiefe),
  }
}

// ------------------------------------------------------------- Höhe
//
// 5.2.1: Maße bis zu den begrenzenden, ungeputzten, nicht bekleideten
// Bauteilen – beim Boden also bis zum ROHfußboden. Der Monteur misst die
// lichte Höhe (Fertigboden bis Decke); der Bodenaufbau kommt dazu.
// Eine abgehängte Decke ist selbst ein begrenzendes Bauteil – nach oben
// wird deshalb nichts addiert.
export function abrechnungsHoehe(raum, rw) {
  const licht = Number(raum?.hoeheLicht) || Number(raum?.hoehe) || 0
  if (!rw?.hoeheRohbau) {
    return { hoehe: runde(licht), rohbau: false, aufbauFehlt: false }
  }
  const aufbau = raum?.aufbauBoden
  const aufbauFehlt = aufbau === undefined || aufbau === null || aufbau === ''
  return {
    hoehe: runde(licht + (Number(aufbau) || 0)),
    rohbau: true,
    // Pflichtangabe: Ohne bewusst erfassten Bodenaufbau bleibt die Zeile
    // geschätzt – ein stiller Vorgabewert würde Fläche mit dem Anschein von
    // Genauigkeit erfinden.
    aufbauFehlt,
  }
}

// ------------------------------------------------------------- Raum-Aufmaß
//
// Liefert je Mengenart eine Zeile mit Ansatz-Formeltext – die Grundlage der
// Sammlung `aufmasszeilen` und des Aufmaßblatts.
//
// raum: { nummer, name, grundflaeche|flaeche, breite, laenge,
//         umfang, umfangGemessen, hoeheLicht, aufbauBoden, oeffnungen[] }
//
// Rückgabe:
//   zeilen[]   { art: 'wand'|'decke'|'leibung'|'abzug', bauteil, ansatz,
//                faktor, menge, geschaetzt, hinweis? }
//   summen     { wand, decke, leibungen, abzuege, wandUndLeibungen }
//   geschaetzt true, wenn irgendeine Zeile geschätzt ist
//   hinweise[] Klartexte fürs Blatt (Übermessungen, fehlende Angaben)
export function raumAufmass(raum, rwOderId) {
  const rw = typeof rwOderId === 'string' ? regelwerkVon(rwOderId) : rwOderId
  const zeilen = []
  const hinweise = []
  if (!rw) {
    return {
      zeilen, hinweise: ['Kein Abrechnungs-Regelwerk gewählt – Aufmaß nicht möglich.'],
      summen: { wand: 0, decke: 0, leibungen: 0, abzuege: 0, wandUndLeibungen: 0 },
      geschaetzt: true,
    }
  }
  if (!rw.aufmass) {
    return {
      zeilen, hinweise: [`${rw.name}: es wird kein Aufmaß erstellt.`],
      summen: { wand: 0, decke: 0, leibungen: 0, abzuege: 0, wandUndLeibungen: 0 },
      geschaetzt: false,
    }
  }

  const bauteil = [raum?.nummer, raum?.name].filter(Boolean).join(' ') || 'Raum'

  // --- Umfang: gemessen oder aus Maßen; der 4·√A-Überschlag ist GESCHÄTZT
  //     und sperrt die Wandzeile für die Rechnung.
  const b = Math.max(0, Number(raum?.breite) || 0)
  const l = Math.max(0, Number(raum?.laenge) || 0)
  const grund = Number(raum?.grundflaeche) || Number(raum?.flaeche) || runde(b * l)
  let umfang = Number(raum?.umfang) || 0
  let umfangGeschaetzt = false
  if (umfang > 0) {
    umfangGeschaetzt = raum?.umfangGemessen === false
  } else if (b > 0 && l > 0) {
    umfang = runde(2 * (b + l))
  } else if (grund > 0) {
    // Kleinstmöglicher Umfang für die Fläche – bei einem Flur deutlich zu
    // wenig. Deshalb geschätzt und gesperrt.
    umfang = runde(4 * Math.sqrt(grund))
    umfangGeschaetzt = true
  }

  const h = abrechnungsHoehe(raum, rw)
  const wandGeschaetzt = umfangGeschaetzt || h.aufbauFehlt || !h.hoehe

  if (h.aufbauFehlt) {
    hinweise.push('Bodenaufbau nicht erfasst – Abrechnungshöhe unvollständig (5.2.1), Zeile geschätzt.')
  }
  if (umfangGeschaetzt) {
    hinweise.push('Umfang nur überschlagen (4·√A, Untergrenze) – vor der Rechnung nachmessen.')
  }

  // --- Öffnungen: Abzüge und Übermessungen
  const oeffnungen = Array.isArray(raum?.oeffnungen) ? raum.oeffnungen : []
  let abzugSumme = 0
  const uebermessen = []
  for (const o of oeffnungen) {
    const m = masseVon(o)
    const a = abzugFuerOeffnung(o, rw)
    if (a.uebermessen) {
      uebermessen.push(`${m.anzahl}× ${m.art} ${zahlText(a.einzel)} m²`)
    } else if (a.abzug > 0) {
      abzugSumme += a.abzug
      zeilen.push({
        art: 'abzug',
        bauteil: `${bauteil} / ${m.art}`,
        ansatz: `${zahlText(m.breite)} × ${zahlText(m.hoehe)}`,
        faktor: -m.anzahl,
        menge: runde(a.abzug),
        geschaetzt: false,
        hinweis: `Einzelgröße ${zahlText(a.einzel)} m² über ${zahlText(rw.uebermessenBisM2)} m² – Abzug`,
      })
    }
  }
  if (uebermessen.length) {
    hinweise.push(`Übermessen nach 5.3.1 (bis ${zahlText(rw.uebermessenBisM2)} m²): ${uebermessen.join(', ')}`)
  }

  // --- Wand: Umfang × Abrechnungshöhe, minus Abzüge über der Schwelle
  const wandBrutto = umfang * h.hoehe
  const wand = runde(Math.max(0, wandBrutto - abzugSumme))
  if (umfang > 0 && h.hoehe > 0) {
    zeilen.unshift({
      art: 'wand',
      bauteil: `${bauteil} / Wand`,
      ansatz: `${zahlText(umfang)} × ${zahlText(h.hoehe)}`,
      faktor: 1,
      menge: runde(wandBrutto),
      geschaetzt: wandGeschaetzt,
    })
  }

  // --- Decke
  if (grund > 0) {
    const ansatzDecke = b > 0 && l > 0 ? `${zahlText(b)} × ${zahlText(l)}` : zahlText(grund)
    zeilen.push({
      art: 'decke',
      bauteil: `${bauteil} / Decke`,
      ansatz: ansatzDecke,
      faktor: 1,
      menge: runde(grund),
      geschaetzt: false,
    })
  }

  // --- Leibungen: gesondert nach 5.2.4, unabhängig von der Einzelgröße –
  //     auch bei übermessenen Öffnungen. Das ist seit VOB 2006 ausdrücklich
  //     beides zusammen.
  let leibungSumme = 0
  if (rw.leibungenGesondert) {
    for (const o of oeffnungen) {
      const m = masseVon(o)
      const le = leibungsFlaeche(o)
      if (le.flaeche <= 0) continue
      leibungSumme += le.flaeche
      zeilen.push({
        art: 'leibung',
        bauteil: `${bauteil} / ${m.art}leibung`,
        ansatz: `${zahlText(le.laufmeter)} × ${zahlText(le.tiefe)}`,
        faktor: m.anzahl,
        menge: le.flaeche,
        geschaetzt: false,
      })
    }
  }

  const summen = {
    wand,
    decke: runde(grund),
    leibungen: runde(leibungSumme),
    abzuege: runde(abzugSumme),
    wandUndLeibungen: runde(wand + leibungSumme),
  }
  return {
    zeilen,
    summen,
    geschaetzt: zeilen.some((z) => z.geschaetzt),
    hinweise,
  }
}

// ------------------------------------------------------------- § 2 Abs. 3
//
// Weicht die ausgeführte Menge um mehr als 10 % von der Vertragsmenge ab,
// kann jede Seite für den übersteigenden Teil einen neuen Einheitspreis
// verlangen. Ein systematisch zu niedriges Aufmaß drückt eine berechtigte
// Mehrmengenforderung rechnerisch unter genau diese Schwelle.
export const MENGEN_SCHWELLE_PROZENT = 10

export function mengenAbweichung(vertragsMenge, aufmassMenge) {
  const soll = Number(vertragsMenge) || 0
  const ist = Number(aufmassMenge) || 0
  if (soll <= 0) {
    return { prozent: 0, ueberSchwelle: false, richtung: 'keine', hinweis: '' }
  }
  const prozent = runde(((ist - soll) / soll) * 100, 1)
  const ueberSchwelle = Math.abs(prozent) > MENGEN_SCHWELLE_PROZENT
  const richtung = prozent > 0 ? 'mehr' : prozent < 0 ? 'weniger' : 'gleich'
  return {
    prozent,
    ueberSchwelle,
    richtung,
    hinweis: ueberSchwelle
      ? `§ 2 Abs. 3 VOB/B: Abweichung ${zahlText(Math.abs(prozent))} % über 10 % – `
        + 'neuer Einheitspreis verlangbar, mathematische Herleitung beilegen.'
      : '',
  }
}
