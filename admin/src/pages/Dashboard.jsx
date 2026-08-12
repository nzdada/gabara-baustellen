import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@shared/ui.jsx'
import { euro } from '@shared/format.js'
import { heuteISO, addTage } from '@shared/slots.js'
import { useCollection } from '../hooks.js'
import * as S from '../stil.js'
import { Seitenkopf, Leer, ChipReihe, Segment, Meldung } from '../components/Seite.jsx'
import { teamFuerTermin } from '@shared/teams.js'
import { istOffen, normalisiereStatus, statusInfo, istUeberfaellig } from '@shared/projektstatus.js'
import { useLang, t, datumLok } from '@shared/i18n.js'

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

function Kpi({ icon, label, wert, farbe = 'text-schrift-stark' }) {
  return (
    <div className="bg-karte rounded-karte border border-rahmen shadow-karte p-4">
      <p className="text-xs text-schrift-zart flex items-center gap-1.5"><Icon name={icon} className="w-3.5 h-3.5" /> {label}</p>
      <p className={`mt-1 text-xl font-bold ${farbe}`}>{wert}</p>
    </div>
  )
}

function Karte({ titel, hinweis, kinder, leer }) {
  return (
    <div className="bg-karte rounded-karte border border-rahmen shadow-karte p-5">
      <p className="text-sm font-bold text-schrift-stark">{titel}</p>
      {hinweis && <p className="text-xs text-schrift-zart mt-0.5">{hinweis}</p>}
      <div className="mt-4">{leer || kinder}</div>
    </div>
  )
}

// Legende: immer vorhanden ab 2 Serien – Identität nie nur über Farbe.
function Legende({ eintraege }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3">
      {eintraege.map((e) => (
        <span key={e.label} className="inline-flex items-center gap-1.5 text-xs text-schrift">
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
  const lang = useLang()
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

      // Harter Filter: freie Regieberichte (frei: true) zählen in KEINE Kennzahl.
      const regie = berichte.filter((b) => b.frei !== true && b.projektId === p.id && b.typ === 'regie' && ['freigegeben', 'abgerechnet'].includes(b.status))
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
      { label: t('dash.lohnIntern'), wert: lohn, farbe: KAT[0] },
      { label: t('dash.materialEk'), wert: material, farbe: KAT[1] },
      { label: t('monteur.spesen'), wert: spesenGes, farbe: KAT[2] },
      { label: t('dash.ergebnis'), wert: rest, farbe: KAT[3] },
    ]
  }, [zeilen, gesamtErloes, lang])

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
      { label: t('dash.lvPositionen'), wert: topf.lv, farbe: KAT[0] },
      { label: t('dash.regieQuelle'), wert: topf.regie, farbe: KAT[1] },
      { label: t('monteur.spesen'), wert: topf.spesen, farbe: KAT[2] },
      { label: t('dash.freiePositionen'), wert: topf.frei, farbe: KAT[3] },
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
    for (const termin of appointments) {
      if (termin.status === 'abgesagt' || termin.intern) continue
      if (!termin.datum || termin.datum < von || termin.datum > heute) continue
      const std = stundenAus(termin.start, termin.ende)
      if (std <= 0) continue
      const team = teamFuerTermin(termin, users)
      if (!team.zugewiesen) continue
      // Stunden je beteiligter Person zählen (2 Monteure × 8 Std. = 16 Std. Einsatzzeit)
      const anzahl = Math.max(1, (termin.mitarbeiterIds || []).length)
      const vorher = map.get(team.name) || { name: team.name, farbe: team.farbe, stunden: 0 }
      vorher.stunden += std * anzahl
      map.set(team.name, vorher)
    }
    const liste = [...map.values()].sort((a, b) => b.stunden - a.stunden)
    return { liste, max: Math.max(1, ...liste.map((x) => x.stunden)) }
  }, [appointments, users, heute])

  const leerHinweis = (text) => <p className="text-sm text-schrift-zart py-6 text-center">{text}</p>

  return (
    <div className={S.SEITE}>
      <Seitenkopf icon="diagramm" titel={t('nav.dashboard')} sub={t('dash.sub')} />

      {/* Leitzahl + Kennzahlen */}
      <div className="grid lg:grid-cols-3 gap-3 mb-3">
        <div className="bg-karte rounded-karte border border-rahmen shadow-karte p-5 lg:col-span-1">
          <p className="text-xs text-schrift-zart">{t('dash.gesamtergebnis')}</p>
          <p
            className="mt-1 text-5xl font-bold leading-none"
            style={{ color: gesamtErgebnis >= 0 ? STATUS.gut : STATUS.schlecht }}
          >
            {euro(gesamtErgebnis)}
          </p>
          <p className="mt-2 text-xs text-schrift-leise">
            {gesamtErloes > 0
              ? <>{t('dash.beiErloes', { erloes: euro(gesamtErloes) })} · <strong className="text-schrift">{t('dash.marge', { n: marge })}</strong></>
              : t('dash.keinErloes')}
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3 lg:col-span-2">
          <Kpi icon="folder" label={t('dash.laufende')} wert={laufende} />
          <Kpi icon="euro" label={t('dash.offeneRechnungen')} wert={euro(offeneSumme)} farbe="text-amber-600" />
          <Kpi icon="check" label={t('dash.bezahlt')} wert={euro(bezahltSumme)} farbe="text-emerald-600" />
          <Kpi icon="bericht" label={t('dash.berichteEingereicht')} wert={eingereicht} />
          <Kpi icon="truck" label={t('dash.offeneSpesen')} wert={euro(offeneSpesen)} />
          <Kpi icon="alert" label={t('dash.ueberfaellig')} wert={ueberfaellig.length} farbe={ueberfaellig.length ? 'text-red-600' : 'text-schrift-stark'} />
        </div>
      </div>

      {ueberfaellig.length > 0 && (
        <div className="mb-3 bg-red-50 border border-red-200 rounded-karte p-4">
          <p className="text-sm font-bold text-red-700 mb-1.5 flex items-center gap-1.5"><Icon name="alert" className="w-4 h-4" /> {t('dash.ueberfaelligeProjekte')}</p>
          {ueberfaellig.map((p) => (
            <Link key={p.id} to={`/projekte/${p.id}`} className="block text-sm text-red-700 hover:underline">
              {p.nummer} · {p.name} – {t('dash.geplantesEnde', { datum: datumLok(p.endeDatum, { day: '2-digit', month: '2-digit', year: 'numeric' }) })}
            </Link>
          ))}
        </div>
      )}

      {/* Diagramme */}
      <div className="grid lg:grid-cols-2 gap-3 mb-3">
        <Karte
          titel={t('dash.fortschritt')}
          hinweis={t('dash.fortschrittSub')}
          leer={fortschritt.length === 0 ? leerHinweis(t('dash.keinLv')) : null}
          kinder={
            <>
              <Legende eintraege={[
                { label: t('dash.abgerechnet'), farbe: RAMPE.abgerechnet },
                { label: t('dash.geleistetOffen'), farbe: RAMPE.geleistet },
                { label: t('dash.nochNicht'), farbe: RAMPE.offen },
              ]} />
              <div className="space-y-3">
                {fortschritt.map((z) => {
                  const geleistetOffen = Math.max(0, z.geleistet - z.abgerechnet)
                  const nochOffen = Math.max(0, z.auftragswert - z.geleistet)
                  const proz = Math.round((z.geleistet / z.auftragswert) * 100)
                  return (
                    <div key={z.p.id}>
                      <div className="flex items-baseline justify-between gap-3 mb-1">
                        <Link to={`/projekte/${z.p.id}`} className="text-xs font-medium text-schrift hover:text-praxis-700 truncate">
                          {z.p.nummer} · {z.p.name}
                        </Link>
                        <span className="text-xs text-schrift-leise shrink-0 tabular-nums">
                          {proz} % · {euro(z.auftragswert)}
                        </span>
                      </div>
                      <StapelBalken
                        gesamt={z.auftragswert}
                        segmente={[
                          { label: t('dash.abgerechnet'), wert: z.abgerechnet, farbe: RAMPE.abgerechnet },
                          { label: t('dash.geleistetOffen'), wert: geleistetOffen, farbe: RAMPE.geleistet },
                          { label: t('dash.nochNicht'), wert: nochOffen, farbe: RAMPE.offen },
                        ]}
                      />
                      {/* Regie liegt AUSSERHALB des LV – separat ausweisen, nicht in die Quote mischen */}
                      {z.regieErloes > 0 && (
                        <p className="mt-1 text-[12px] text-schrift-leise">
                          {t('dash.zusaetzlichRegie', { betrag: euro(z.regieErloes) })}
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
          titel={t('dash.ergebnisJe')}
          hinweis={t('dash.ergebnisJeSub')}
          leer={ergebnisse.liste.length === 0 ? leerHinweis(t('dash.keineMengen')) : null}
          kinder={
            <div className="space-y-2.5">
              {ergebnisse.liste.map((z) => {
                const positiv = z.ergebnis >= 0
                const breite = (Math.abs(z.ergebnis) / ergebnisse.max) * 50
                return (
                  <div key={z.p.id}>
                    <div className="flex items-baseline justify-between gap-3 mb-1">
                      <Link to={`/projekte/${z.p.id}`} className="text-xs font-medium text-schrift hover:text-praxis-700 truncate">
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
          titel={t('dash.wohin')}
          hinweis={t('dash.wohinSub', { erloes: euro(gesamtErloes) })}
          leer={gesamtErloes <= 0 ? leerHinweis(t('dash.keinUmsatz')) : null}
          kinder={
            <>
              <Legende eintraege={verwendung.map((v) => ({ label: v.label, farbe: v.farbe }))} />
              <StapelBalken segmente={verwendung} gesamt={gesamtErloes} hoehe="h-5" />
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {verwendung.map((v) => (
                  <div key={v.label}>
                    <p className="text-xs text-schrift-zart flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: v.farbe }} />
                      {v.label}
                    </p>
                    <p className="text-sm font-bold text-schrift-stark tabular-nums">{euro(v.wert)}</p>
                    <p className="text-[12px] text-schrift-zart tabular-nums">
                      {gesamtErloes > 0 ? Math.round((v.wert / gesamtErloes) * 100) : 0} %
                    </p>
                  </div>
                ))}
              </div>
            </>
          }
        />

        <Karte
          titel={t('dash.stundenTeam')}
          hinweis={t('dash.stundenTeamSub')}
          leer={auslastung.liste.length === 0 ? leerHinweis(t('dash.keineEinsaetze30')) : null}
          kinder={
            <div className="space-y-3">
              {auslastung.liste.map((reihe) => (
                <div key={reihe.name}>
                  <div className="flex items-baseline justify-between gap-3 mb-1">
                    <span className="text-xs font-medium text-schrift inline-flex items-center gap-1.5 truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: reihe.farbe }} />
                      {reihe.name}
                    </span>
                    <span className="text-xs text-schrift-leise shrink-0 tabular-nums">
                      {reihe.stunden.toLocaleString('de-DE', { maximumFractionDigits: 1 })} {t('allg.stunden')}
                    </span>
                  </div>
                  <div className="h-3.5 w-full" style={{ backgroundColor: SPUR }}>
                    <div
                      title={`${reihe.name}: ${reihe.stunden.toLocaleString('de-DE', { maximumFractionDigits: 1 })}`}
                      className="h-full"
                      style={{
                        width: `${(reihe.stunden / auslastung.max) * 100}%`,
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
            titel={t('dash.nachQuelle')}
            hinweis={nachQuelle.gesamt > 0
              ? t('dash.nachQuelleSub', { summe: euro(nachQuelle.gesamt), n: nachQuelle.regieAnteil })
              : t('dash.nachQuelleLeerSub')}
            leer={nachQuelle.gesamt <= 0 ? leerHinweis(t('dash.keineRechnung')) : null}
            kinder={
              <>
                <Legende eintraege={nachQuelle.segmente.map((s) => ({ label: s.label, farbe: s.farbe }))} />
                <StapelBalken segmente={nachQuelle.segmente} gesamt={nachQuelle.gesamt} hoehe="h-5" />
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {nachQuelle.segmente.map((s) => (
                    <div key={s.label}>
                      <p className="text-xs text-schrift-zart flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: s.farbe }} />
                        {s.label}
                      </p>
                      <p className="text-sm font-bold text-schrift-stark tabular-nums">{euro(s.wert)}</p>
                      <p className="text-[12px] text-schrift-zart tabular-nums">
                        {nachQuelle.gesamt > 0 ? Math.round((s.wert / nachQuelle.gesamt) * 100) : 0} %
                      </p>
                    </div>
                  ))}
                </div>

                {nachQuelle.projektListe.length > 0 && (
                  <div className="mt-5 border-t border-rahmen pt-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-schrift-zart mb-2.5">{t('dash.jeBaustelle')}</p>
                    <div className="space-y-3">
                      {nachQuelle.projektListe.map((z) => (
                        <div key={z.projekt?.id || z.summe}>
                          <div className="flex items-baseline justify-between gap-3 mb-1">
                            {z.projekt ? (
                              <Link to={`/projekte/${z.projekt.id}`} className="text-xs font-medium text-schrift hover:text-praxis-700 truncate">
                                {z.projekt.nummer} · {z.projekt.name}
                              </Link>
                            ) : <span className="text-xs text-schrift-zart">{t('dash.ohneProjekt')}</span>}
                            <span className="text-xs text-schrift-leise shrink-0 tabular-nums">
                              {euro(z.summe)}
                              {z.regie > 0 && <span className="text-schrift-zart"> · {t('dash.regieAnteil', { n: Math.round((z.regie / z.summe) * 100) })}</span>}
                            </span>
                          </div>
                          <StapelBalken
                            gesamt={z.summe}
                            segmente={[
                              { label: t('dash.lvPositionen'), wert: z.lv, farbe: KAT[0] },
                              { label: t('dash.regieQuelle'), wert: z.regie, farbe: KAT[1] },
                              { label: t('monteur.spesen'), wert: z.spesen, farbe: KAT[2] },
                              { label: t('dash.freiePositionen'), wert: z.frei, farbe: KAT[3] },
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
      <div className="bg-karte rounded-karte border border-rahmen shadow-karte overflow-x-auto">
        <p className="text-sm font-bold text-schrift-stark px-4 pt-4">{t('dash.tabelle')}</p>
        <table className="w-full text-sm min-w-[980px] mt-2">
          <thead>
            <tr className="text-left text-xs uppercase text-schrift-zart border-b border-rahmen">
              <th className="px-4 py-3">{t('dash.baustelle')}</th>
              <th className="px-4 py-3">{t('allg.status')}</th>
              <th className="px-4 py-3 text-right">{t('dash.lvWert')}</th>
              <th className="px-4 py-3 text-right">{t('dash.geleistetIst')}</th>
              <th className="px-4 py-3 text-right">{t('dash.abgerechnet')}</th>
              <th className="px-4 py-3 text-right">{t('dash.regieErloes')}</th>
              <th className="px-4 py-3 text-right">{t('dash.material')}</th>
              <th className="px-4 py-3 text-right">{t('dash.lohnIntern')}</th>
              <th className="px-4 py-3 text-right">{t('monteur.spesen')}</th>
              <th className="px-4 py-3 text-right">{t('dash.ergebnis')}</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {zeilen.map(({ p, auftragswert, geleistet, abgerechnet, regieErloes, materialKosten, lohnKosten, spesenSumme, ergebnis }) => {
              const st = statusInfo(p.status)
              return (
                <tr key={p.id} className="border-b border-rahmen">
                  <td className="px-4 py-3">
                    <Link to={`/projekte/${p.id}`} className="font-medium text-praxis-600 hover:underline">{p.nummer}</Link>
                    <p className="text-xs text-schrift-leise truncate max-w-[200px]">{p.name}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ color: st.farbe, backgroundColor: `${st.farbe}1f` }}>{t(`projektstatus.${st.id}`)}</span>
                  </td>
                  <td className="px-4 py-3 text-right">{auftragswert ? euro(auftragswert) : '–'}</td>
                  <td className="px-4 py-3 text-right">{euro(geleistet)}</td>
                  <td className="px-4 py-3 text-right">{euro(abgerechnet)}</td>
                  <td className="px-4 py-3 text-right">{euro(regieErloes)}</td>
                  <td className="px-4 py-3 text-right text-schrift-leise">− {euro(materialKosten)}</td>
                  <td className="px-4 py-3 text-right text-schrift-leise">− {euro(lohnKosten)}</td>
                  <td className="px-4 py-3 text-right text-schrift-leise">− {euro(spesenSumme)}</td>
                  <td className={`px-4 py-3 text-right font-bold ${ergebnis >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{euro(ergebnis)}</td>
                </tr>
              )
            })}
            {zeilen.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-schrift-zart">{t('dash.keineBaustellen')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
