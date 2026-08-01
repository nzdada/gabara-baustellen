import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@shared/ui.jsx'
import { euro } from '@shared/format.js'
import { heuteISO, addTage } from '@shared/slots.js'
import { useCollection } from '../hooks.js'
import { teamFuerTermin } from '@shared/teams.js'
import { istOffen, normalisiereStatus, statusInfo, istUeberfaellig } from '@shared/projektstatus.js'

// Finanz-Dashboard: Verdienst/Gewinn je Baustelle (Näherung), offene Rechnungen,
// überfällige Projekte. Alle Zahlen aus Ist-Mengen, Regieberichten und internen Sätzen.
//
// Diagramm-Farben sind NICHT frei gewählt, sondern mit dem Prüfskript der
// Datenvisualisierungs-Methodik gegen die weiße Kartenfläche validiert:
//  - RAMPE  (ordinal, eine Hue hell→dunkel): Fortschritt je Baustelle
//  - KAT    (kategorial, 4 Slots):           Umsatzverwendung
//  - STATUS (gut/kritisch):                  Ergebnis über/unter null
// Texte tragen immer Text-Farben (slate), nie die Serienfarbe – die Identität
// kommt vom farbigen Feld daneben bzw. aus der Legende.
const RAMPE = { offen: '#dda6a6', geleistet: '#b52d2d', abgerechnet: '#701414' }
const KAT = ['#b52d2d', '#2a78d6', '#e07a1f', '#1baf7a']
const STATUS = { gut: '#0ca30c', schlecht: '#d03b3b' }
const SPUR = '#f1f5f9'

function stundenAus(start, ende) {
  if (!start || !ende) return 0
  const [h1, m1] = start.split(':').map(Number)
  const [h2, m2] = ende.split(':').map(Number)
  return Math.max(0, (h2 * 60 + m2 - h1 * 60 - m1) / 60)
}

function Kpi({ icon, label, wert, farbe = 'text-slate-900' }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
      <p className="text-xs text-slate-400 flex items-center gap-1.5"><Icon name={icon} className="w-3.5 h-3.5" /> {label}</p>
      <p className={`mt-1 text-xl font-bold ${farbe}`}>{wert}</p>
    </div>
  )
}

function Karte({ titel, hinweis, kinder, leer }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <p className="text-sm font-bold text-slate-800">{titel}</p>
      {hinweis && <p className="text-xs text-slate-400 mt-0.5">{hinweis}</p>}
      <div className="mt-4">{leer || kinder}</div>
    </div>
  )
}

// Legende: immer vorhanden ab 2 Serien – Identität nie nur über Farbe.
function Legende({ eintraege }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3">
      {eintraege.map((e) => (
        <span key={e.label} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: e.farbe }} />
          {e.label}
        </span>
      ))}
    </div>
  )
}

// Gestapelter Balken: 2px Flächenabstand zwischen den Segmenten (kein Rahmen!),
// nur das letzte sichtbare Segment bekommt das abgerundete Datenende.
function StapelBalken({ segmente, gesamt, hoehe = 'h-3.5' }) {
  const summe = gesamt || segmente.reduce((s, x) => s + Math.max(0, x.wert), 0) || 1
  const sichtbar = segmente.filter((s) => s.wert > 0)
  return (
    <div className={`flex w-full ${hoehe} rounded-l-sm overflow-hidden`} style={{ backgroundColor: SPUR }}>
      {sichtbar.map((s, i) => (
        <div
          key={s.label}
          title={`${s.label}: ${euro(s.wert)}`}
          className="h-full"
          style={{
            width: `${(s.wert / summe) * 100}%`,
            backgroundColor: s.farbe,
            marginRight: i < sichtbar.length - 1 ? 2 : 0,
            borderTopRightRadius: i === sichtbar.length - 1 ? 4 : 0,
            borderBottomRightRadius: i === sichtbar.length - 1 ? 4 : 0,
          }}
        />
      ))}
    </div>
  )
}

export default function Dashboard() {
  const projekte = useCollection('projekte')
  const lv = useCollection('lvpositionen')
  const berichte = useCollection('berichte')
  const spesen = useCollection('spesen')
  const rechnungen = useCollection('rechnungen')
  const appointments = useCollection('appointments')
  const users = useCollection('users')
  const katalog = useCollection('katalog')

  const heute = heuteISO()

  const zeilen = useMemo(() => {
    const relevant = projekte.filter((p) => istOffen(p.status) || normalisiereStatus(p.status) === 'abgeschlossen')
    return relevant.map((p) => {
      const pos = lv.filter((x) => x.projektId === p.id && x.typ === 'position' && !x.flags?.bedarf && !x.flags?.nep)
      const auftragswert = pos.reduce((s, x) => s + (x.menge || 0) * (x.einheitspreis || 0), 0)
      const geleistet = pos.reduce((s, x) => s + (x.istMenge || 0) * (x.einheitspreis || 0), 0)
      const abgerechnet = pos.reduce((s, x) => s + (x.abgerechnetMenge || 0) * (x.einheitspreis || 0), 0)

      const regie = berichte.filter((b) => b.projektId === p.id && b.typ === 'regie' && ['freigegeben', 'abgerechnet'].includes(b.status))
      const regieErloes = regie.reduce((s, b) =>
        s + (b.stunden || []).reduce((x, z) => x + (z.anzahl || 0) * (z.satz || 0), 0)
          + (b.material || []).reduce((x, m) => x + (m.menge || 0) * (m.preis || 0), 0), 0)
      const materialKosten = regie.reduce((s, b) => s + (b.material || []).reduce((x, m) => {
        const art = katalog.find((a) => a.id === m.artikelId)
        const ek = art?.ekPreis || (m.preis || 0) * 0.7
        return x + (m.menge || 0) * ek
      }, 0), 0)

      const einsaetze = appointments.filter((t) => t.projektId === p.id && t.erledigt)
      const lohnKosten = einsaetze.reduce((s, t) => {
        const std = stundenAus(t.start, t.ende)
        const satzSumme = (t.mitarbeiterIds || []).reduce((x, id) => x + (users.find((u) => u.id === id)?.stundensatzIntern || 0), 0)
        return s + std * satzSumme
      }, 0)

      const spesenSumme = spesen.filter((s) => s.projektId === p.id).reduce((x, s) => x + (s.betrag || 0), 0)
      const ergebnis = geleistet + regieErloes - materialKosten - lohnKosten - spesenSumme

      return { p, auftragswert, geleistet, abgerechnet, regieErloes, materialKosten, lohnKosten, spesenSumme, ergebnis }
    })
  }, [projekte, lv, berichte, spesen, appointments, users, katalog])

  const laufende = projekte.filter((p) => istOffen(p.status)).length
  const offeneRechnungen = rechnungen.filter((r) => ['uebertragen', 'gestellt'].includes(r.status))
  const offeneSumme = offeneRechnungen.reduce((s, r) => s + (r.zahlbetrag ?? r.netto ?? 0), 0)
  const bezahltSumme = rechnungen.filter((r) => r.status === 'bezahlt').reduce((s, r) => s + (r.zahlbetrag ?? r.netto ?? 0), 0)
  const eingereicht = berichte.filter((b) => b.status === 'eingereicht').length
  const offeneSpesen = spesen.filter((s) => s.status === 'eingereicht').reduce((x, s) => x + (s.betrag || 0), 0)

  const ueberfaellig = projekte.filter((p) => istUeberfaellig(p, heute))

  // --- Hero: eine einzige Leitzahl für die ganze Ansicht ---
  const gesamtErgebnis = zeilen.reduce((s, z) => s + z.ergebnis, 0)
  const gesamtErloes = zeilen.reduce((s, z) => s + z.geleistet + z.regieErloes, 0)
  const marge = gesamtErloes > 0 ? Math.round((gesamtErgebnis / gesamtErloes) * 100) : 0

  // --- Diagramm 1: Fortschritt je Baustelle (ordinale Rampe, gestapelt) ---
  const fortschritt = useMemo(() => zeilen
    .filter((z) => istOffen(z.p.status) && z.auftragswert > 0)
    .sort((a, b) => b.auftragswert - a.auftragswert)
    .slice(0, 8), [zeilen])

  // --- Diagramm 2: Ergebnis je Baustelle (divergierend um die Nulllinie) ---
  const ergebnisse = useMemo(() => {
    const liste = zeilen.filter((z) => z.geleistet > 0 || z.regieErloes > 0 || z.ergebnis !== 0)
    const max = Math.max(1, ...liste.map((z) => Math.abs(z.ergebnis)))
    return { liste: [...liste].sort((a, b) => b.ergebnis - a.ergebnis).slice(0, 8), max }
  }, [zeilen])

  // --- Diagramm 3: Wohin geht der Umsatz (kategorial, Teil-zum-Ganzen) ---
  const verwendung = useMemo(() => {
    const material = zeilen.reduce((s, z) => s + z.materialKosten, 0)
    const lohn = zeilen.reduce((s, z) => s + z.lohnKosten, 0)
    const spesenGes = zeilen.reduce((s, z) => s + z.spesenSumme, 0)
    const rest = Math.max(0, gesamtErloes - material - lohn - spesenGes)
    return [
      { label: 'Lohn intern', wert: lohn, farbe: KAT[0] },
      { label: 'Material (EK)', wert: material, farbe: KAT[1] },
      { label: 'Spesen', wert: spesenGes, farbe: KAT[2] },
      { label: 'Ergebnis', wert: rest, farbe: KAT[3] },
    ]
  }, [zeilen, gesamtErloes])

  // --- Diagramm 5: Abgerechnet nach Quelle ---
  // Jede Rechnungsposition trägt ihre Herkunft (quelle): LV-Position, Regiebericht
  // (Stunden/Material), Spesen oder frei erfasst. So wird sichtbar, wie viel Umsatz
  // tatsächlich aus Regie kommt – auch wenn kein LV dahintersteht.
  const nachQuelle = useMemo(() => {
    const topf = { lv: 0, regie: 0, spesen: 0, frei: 0 }
    const jeProjekt = new Map()
    for (const r of rechnungen) {
      if (r.status === 'storniert') continue
      for (const p of r.positionen || []) {
        const betrag = (Number(p.menge) || 0) * (Number(p.ep) || 0)
        const art = p.quelle === 'lv' ? 'lv'
          : (p.quelle === 'regie' || p.quelle === 'material') ? 'regie'
          : p.quelle === 'spesen' ? 'spesen' : 'frei'
        topf[art] += betrag
        if (!jeProjekt.has(r.projektId)) jeProjekt.set(r.projektId, { lv: 0, regie: 0, spesen: 0, frei: 0, summe: 0 })
        const z = jeProjekt.get(r.projektId)
        z[art] += betrag
        z.summe += betrag
      }
    }
    const gesamt = topf.lv + topf.regie + topf.spesen + topf.frei
    const segmente = [
      { label: 'LV-Positionen', wert: topf.lv, farbe: KAT[0] },
      { label: 'Regie (Stunden + Material)', wert: topf.regie, farbe: KAT[1] },
      { label: 'Spesen', wert: topf.spesen, farbe: KAT[2] },
      { label: 'Freie Positionen', wert: topf.frei, farbe: KAT[3] },
    ]
    const projektListe = [...jeProjekt.entries()]
      .map(([id, z]) => ({ projekt: projekte.find((p) => p.id === id), ...z }))
      .filter((z) => z.summe > 0)
      .sort((a, b) => b.summe - a.summe)
      .slice(0, 6)
    return { segmente, gesamt, regieAnteil: gesamt > 0 ? Math.round((topf.regie / gesamt) * 100) : 0, projektListe }
  }, [rechnungen, projekte])

  // --- Diagramm 4: Einsatzstunden je Team (letzte 30 Tage, eine Serie) ---
  const auslastung = useMemo(() => {
    const von = addTage(heute, -30)
    const map = new Map()
    for (const t of appointments) {
      if (t.status === 'abgesagt' || t.intern) continue
      if (!t.datum || t.datum < von || t.datum > heute) continue
      const std = stundenAus(t.start, t.ende)
      if (std <= 0) continue
      const team = teamFuerTermin(t, users)
      if (!team.zugewiesen) continue
      // Stunden je beteiligter Person zählen (2 Monteure × 8 Std. = 16 Std. Einsatzzeit)
      const anzahl = Math.max(1, (t.mitarbeiterIds || []).length)
      const vorher = map.get(team.name) || { name: team.name, farbe: team.farbe, stunden: 0 }
      vorher.stunden += std * anzahl
      map.set(team.name, vorher)
    }
    const liste = [...map.values()].sort((a, b) => b.stunden - a.stunden)
    return { liste, max: Math.max(1, ...liste.map((x) => x.stunden)) }
  }, [appointments, users, heute])

  const leerHinweis = (text) => <p className="text-sm text-slate-400 py-6 text-center">{text}</p>

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Finanzielle Auswertung je Baustelle – Näherung auf Basis Ist-Mengen und internen Sätzen</p>
      </div>

      {/* Leitzahl + Kennzahlen */}
      <div className="grid lg:grid-cols-3 gap-3 mb-3">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 lg:col-span-1">
          <p className="text-xs text-slate-400">Ergebnis über alle Baustellen</p>
          <p
            className="mt-1 text-5xl font-bold leading-none"
            style={{ color: gesamtErgebnis >= 0 ? STATUS.gut : STATUS.schlecht }}
          >
            {euro(gesamtErgebnis)}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {gesamtErloes > 0
              ? <>bei {euro(gesamtErloes)} Erlös · <strong className="text-slate-700">{marge} % Marge</strong></>
              : 'noch kein Erlös erfasst'}
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3 lg:col-span-2">
          <Kpi icon="folder" label="Laufende Baustellen" wert={laufende} />
          <Kpi icon="euro" label="Offene Rechnungen" wert={euro(offeneSumme)} farbe="text-amber-600" />
          <Kpi icon="check" label="Bezahlt" wert={euro(bezahltSumme)} farbe="text-emerald-600" />
          <Kpi icon="bericht" label="Berichte eingereicht" wert={eingereicht} />
          <Kpi icon="truck" label="Offene Spesen" wert={euro(offeneSpesen)} />
          <Kpi icon="alert" label="Überfällig" wert={ueberfaellig.length} farbe={ueberfaellig.length ? 'text-red-600' : 'text-slate-900'} />
        </div>
      </div>

      {ueberfaellig.length > 0 && (
        <div className="mb-3 bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-sm font-bold text-red-700 mb-1.5 flex items-center gap-1.5"><Icon name="alert" className="w-4 h-4" /> Überfällige Projekte</p>
          {ueberfaellig.map((p) => (
            <Link key={p.id} to={`/projekte/${p.id}`} className="block text-sm text-red-700 hover:underline">
              {p.nummer} · {p.name} – geplantes Ende {new Date(p.endeDatum + 'T12:00:00').toLocaleDateString('de-DE')}
            </Link>
          ))}
        </div>
      )}

      {/* Diagramme */}
      <div className="grid lg:grid-cols-2 gap-3 mb-3">
        <Karte
          titel="Fortschritt je Baustelle"
          hinweis="Anteil am LV-Auftragswert · größte 8 offene Baustellen"
          leer={fortschritt.length === 0 ? leerHinweis('Noch keine Baustelle mit Leistungsverzeichnis.') : null}
          kinder={
            <>
              <Legende eintraege={[
                { label: 'Abgerechnet', farbe: RAMPE.abgerechnet },
                { label: 'Geleistet, noch nicht fakturiert', farbe: RAMPE.geleistet },
                { label: 'Noch nicht geleistet', farbe: RAMPE.offen },
              ]} />
              <div className="space-y-3">
                {fortschritt.map((z) => {
                  const geleistetOffen = Math.max(0, z.geleistet - z.abgerechnet)
                  const nochOffen = Math.max(0, z.auftragswert - z.geleistet)
                  const proz = Math.round((z.geleistet / z.auftragswert) * 100)
                  return (
                    <div key={z.p.id}>
                      <div className="flex items-baseline justify-between gap-3 mb-1">
                        <Link to={`/projekte/${z.p.id}`} className="text-xs font-medium text-slate-700 hover:text-praxis-700 truncate">
                          {z.p.nummer} · {z.p.name}
                        </Link>
                        <span className="text-xs text-slate-500 shrink-0 tabular-nums">
                          {proz} % · {euro(z.auftragswert)}
                        </span>
                      </div>
                      <StapelBalken
                        gesamt={z.auftragswert}
                        segmente={[
                          { label: 'Abgerechnet', wert: z.abgerechnet, farbe: RAMPE.abgerechnet },
                          { label: 'Geleistet, noch nicht fakturiert', wert: geleistetOffen, farbe: RAMPE.geleistet },
                          { label: 'Noch nicht geleistet', wert: nochOffen, farbe: RAMPE.offen },
                        ]}
                      />
                      {/* Regie liegt AUSSERHALB des LV – separat ausweisen, nicht in die Quote mischen */}
                      {z.regieErloes > 0 && (
                        <p className="mt-1 text-[11px] text-slate-500">
                          zusätzlich <strong className="text-slate-700">{euro(z.regieErloes)}</strong> aus Regieberichten (nicht im LV)
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          }
        />

        <Karte
          titel="Ergebnis je Baustelle"
          hinweis="Erlös minus Material, Lohn und Spesen · links Verlust, rechts Gewinn"
          leer={ergebnisse.liste.length === 0 ? leerHinweis('Noch keine geleisteten Mengen erfasst.') : null}
          kinder={
            <div className="space-y-2.5">
              {ergebnisse.liste.map((z) => {
                const positiv = z.ergebnis >= 0
                const breite = (Math.abs(z.ergebnis) / ergebnisse.max) * 50
                return (
                  <div key={z.p.id}>
                    <div className="flex items-baseline justify-between gap-3 mb-1">
                      <Link to={`/projekte/${z.p.id}`} className="text-xs font-medium text-slate-700 hover:text-praxis-700 truncate">
                        {z.p.nummer} · {z.p.name}
                      </Link>
                      <span className="text-xs font-semibold shrink-0 tabular-nums" style={{ color: positiv ? '#166534' : '#b91c1c' }}>
                        {euro(z.ergebnis)}
                      </span>
                    </div>
                    {/* Nulllinie in der Mitte, Balken wächst nach links oder rechts */}
                    <div className="relative h-3.5" style={{ backgroundColor: SPUR }}>
                      <div className="absolute inset-y-0 left-1/2 w-px" style={{ backgroundColor: '#cbd5e1' }} />
                      <div
                        title={`${z.p.name}: ${euro(z.ergebnis)}`}
                        className="absolute inset-y-0"
                        style={{
                          backgroundColor: positiv ? STATUS.gut : STATUS.schlecht,
                          width: `${breite}%`,
                          left: positiv ? '50%' : `${50 - breite}%`,
                          borderTopRightRadius: positiv ? 4 : 0,
                          borderBottomRightRadius: positiv ? 4 : 0,
                          borderTopLeftRadius: positiv ? 0 : 4,
                          borderBottomLeftRadius: positiv ? 0 : 4,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          }
        />

        <Karte
          titel="Wohin geht der Umsatz"
          hinweis={`Aufteilung von ${euro(gesamtErloes)} Erlös über alle Baustellen`}
          leer={gesamtErloes <= 0 ? leerHinweis('Noch kein Erlös erfasst.') : null}
          kinder={
            <>
              <Legende eintraege={verwendung.map((v) => ({ label: v.label, farbe: v.farbe }))} />
              <StapelBalken segmente={verwendung} gesamt={gesamtErloes} hoehe="h-5" />
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {verwendung.map((v) => (
                  <div key={v.label}>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: v.farbe }} />
                      {v.label}
                    </p>
                    <p className="text-sm font-bold text-slate-800 tabular-nums">{euro(v.wert)}</p>
                    <p className="text-[11px] text-slate-400 tabular-nums">
                      {gesamtErloes > 0 ? Math.round((v.wert / gesamtErloes) * 100) : 0} %
                    </p>
                  </div>
                ))}
              </div>
            </>
          }
        />

        <Karte
          titel="Einsatzstunden je Team"
          hinweis="Geplante Personenstunden der letzten 30 Tage"
          leer={auslastung.liste.length === 0 ? leerHinweis('In den letzten 30 Tagen keine zugewiesenen Einsätze.') : null}
          kinder={
            <div className="space-y-3">
              {auslastung.liste.map((t) => (
                <div key={t.name}>
                  <div className="flex items-baseline justify-between gap-3 mb-1">
                    <span className="text-xs font-medium text-slate-700 inline-flex items-center gap-1.5 truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.farbe }} />
                      {t.name}
                    </span>
                    <span className="text-xs text-slate-500 shrink-0 tabular-nums">
                      {t.stunden.toLocaleString('de-DE', { maximumFractionDigits: 1 })} Std.
                    </span>
                  </div>
                  <div className="h-3.5 w-full" style={{ backgroundColor: SPUR }}>
                    <div
                      title={`${t.name}: ${t.stunden.toLocaleString('de-DE', { maximumFractionDigits: 1 })} Stunden`}
                      className="h-full"
                      style={{
                        width: `${(t.stunden / auslastung.max) * 100}%`,
                        backgroundColor: RAMPE.geleistet,
                        borderTopRightRadius: 4,
                        borderBottomRightRadius: 4,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          }
        />
        {/* Woraus die gestellten Rechnungen bestehen – macht Regie-Umsatz sichtbar */}
        <div className="lg:col-span-2">
          <Karte
            titel="Abgerechnet nach Quelle"
            hinweis={nachQuelle.gesamt > 0
              ? `${euro(nachQuelle.gesamt)} in Rechnungen · davon ${nachQuelle.regieAnteil} % aus Regieberichten`
              : 'Woraus sich die gestellten Rechnungen zusammensetzen'}
            leer={nachQuelle.gesamt <= 0 ? leerHinweis('Noch keine Rechnung erstellt. Sobald eine Rechnung Positionen aus einem Regiebericht enthält, erscheint der Anteil hier.') : null}
            kinder={
              <>
                <Legende eintraege={nachQuelle.segmente.map((s) => ({ label: s.label, farbe: s.farbe }))} />
                <StapelBalken segmente={nachQuelle.segmente} gesamt={nachQuelle.gesamt} hoehe="h-5" />
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {nachQuelle.segmente.map((s) => (
                    <div key={s.label}>
                      <p className="text-xs text-slate-400 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: s.farbe }} />
                        {s.label}
                      </p>
                      <p className="text-sm font-bold text-slate-800 tabular-nums">{euro(s.wert)}</p>
                      <p className="text-[11px] text-slate-400 tabular-nums">
                        {nachQuelle.gesamt > 0 ? Math.round((s.wert / nachQuelle.gesamt) * 100) : 0} %
                      </p>
                    </div>
                  ))}
                </div>

                {nachQuelle.projektListe.length > 0 && (
                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2.5">Je Baustelle</p>
                    <div className="space-y-3">
                      {nachQuelle.projektListe.map((z) => (
                        <div key={z.projekt?.id || z.summe}>
                          <div className="flex items-baseline justify-between gap-3 mb-1">
                            {z.projekt ? (
                              <Link to={`/projekte/${z.projekt.id}`} className="text-xs font-medium text-slate-700 hover:text-praxis-700 truncate">
                                {z.projekt.nummer} · {z.projekt.name}
                              </Link>
                            ) : <span className="text-xs text-slate-400">ohne Projekt</span>}
                            <span className="text-xs text-slate-500 shrink-0 tabular-nums">
                              {euro(z.summe)}
                              {z.regie > 0 && <span className="text-slate-400"> · {Math.round((z.regie / z.summe) * 100)} % Regie</span>}
                            </span>
                          </div>
                          <StapelBalken
                            gesamt={z.summe}
                            segmente={[
                              { label: 'LV-Positionen', wert: z.lv, farbe: KAT[0] },
                              { label: 'Regie (Stunden + Material)', wert: z.regie, farbe: KAT[1] },
                              { label: 'Spesen', wert: z.spesen, farbe: KAT[2] },
                              { label: 'Freie Positionen', wert: z.frei, farbe: KAT[3] },
                            ]}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            }
          />
        </div>
      </div>

      {/* Tabellen-Ansicht: alle Werte auch ohne Farbwahrnehmung lesbar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
        <p className="text-sm font-bold text-slate-800 px-4 pt-4">Alle Zahlen je Baustelle</p>
        <table className="w-full text-sm min-w-[980px] mt-2">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-400 border-b border-slate-100">
              <th className="px-4 py-3">Baustelle</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">LV-Auftragswert</th>
              <th className="px-4 py-3 text-right">Geleistet (Ist)</th>
              <th className="px-4 py-3 text-right">Abgerechnet</th>
              <th className="px-4 py-3 text-right">Regie-Erlös</th>
              <th className="px-4 py-3 text-right">Material</th>
              <th className="px-4 py-3 text-right">Lohn intern</th>
              <th className="px-4 py-3 text-right">Spesen</th>
              <th className="px-4 py-3 text-right">Ergebnis</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {zeilen.map(({ p, auftragswert, geleistet, abgerechnet, regieErloes, materialKosten, lohnKosten, spesenSumme, ergebnis }) => {
              const st = statusInfo(p.status)
              return (
                <tr key={p.id} className="border-b border-slate-50">
                  <td className="px-4 py-3">
                    <Link to={`/projekte/${p.id}`} className="font-medium text-praxis-600 hover:underline">{p.nummer}</Link>
                    <p className="text-xs text-slate-500 truncate max-w-[200px]">{p.name}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ color: st.farbe, backgroundColor: `${st.farbe}1f` }}>{st.label}</span>
                  </td>
                  <td className="px-4 py-3 text-right">{auftragswert ? euro(auftragswert) : '–'}</td>
                  <td className="px-4 py-3 text-right">{euro(geleistet)}</td>
                  <td className="px-4 py-3 text-right">{euro(abgerechnet)}</td>
                  <td className="px-4 py-3 text-right">{euro(regieErloes)}</td>
                  <td className="px-4 py-3 text-right text-slate-500">− {euro(materialKosten)}</td>
                  <td className="px-4 py-3 text-right text-slate-500">− {euro(lohnKosten)}</td>
                  <td className="px-4 py-3 text-right text-slate-500">− {euro(spesenSumme)}</td>
                  <td className={`px-4 py-3 text-right font-bold ${ergebnis >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{euro(ergebnis)}</td>
                </tr>
              )
            })}
            {zeilen.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-slate-400">Noch keine Baustellen erfasst.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
