import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { useCollection, useEinstellungen, useWhere, withStore } from '../hooks.js'
import { Icon } from '@shared/ui.jsx'
import { euro } from '@shared/format.js'
import { PROJEKT_STATUS, statusInfo } from '@shared/projektstatus.js'
import { useLang, t, datumLok } from '@shared/i18n.js'
import LvEditor from '../components/LvEditor.jsx'
import RaumPlaner from '../components/RaumPlaner.jsx'
import Raum3D from '../components/Raum3D.jsx'
import RaumVerteilung from '../components/RaumVerteilung.jsx'
import LvImport from '../components/LvImport.jsx'
import RechnungWizard from '../components/RechnungWizard.jsx'
import BerichtForm from '../components/BerichtForm.jsx'
import Modal from '../components/Modal.jsx'
import * as S from '../stil.js'
import { Seitenkopf, Leer, ChipReihe, Segment, Meldung } from '../components/Seite.jsx'
import { druckeRegiebericht, druckeAbnahme, druckeAbschluss } from '../drucken.js'
import { REGELWERKE } from '@shared/aufmass.js'

// Projekt-Detailseite (#/projekte/:id): Dreispalter im HERO-Stil –
// links Bereichs-Navigation, Mitte Inhalt, rechts Projektdaten-Panel.

const BERICHT_STATUS = {
  entwurf: { schluessel: 'status.entwurf', klasse: 'bg-gedeckt-tief text-schrift-leise' },
  eingereicht: { schluessel: 'status.eingereicht', klasse: 'bg-sky-100 text-sky-700' },
  freigegeben: { schluessel: 'status.freigegeben', klasse: 'bg-emerald-100 text-emerald-700' },
  abgerechnet: { schluessel: 'status.abgerechnet', klasse: 'bg-gedeckt-tief text-schrift' },
}

const TYP_SCHLUESSEL = { regie: 'bericht.regie', reklamation: 'bericht.reklamation', abnahme: 'bericht.abnahme' }
const typText = (typ) => (TYP_SCHLUESSEL[typ] ? t(TYP_SCHLUESSEL[typ]) : t('bericht.bericht'))

const KATEGORIE_SCHLUESSEL = {
  umsetzung: 'kat.umsetzung',
  fertigstellung: 'kat.fertigstellung',
  reklamation: 'kat.reklamationKurz',
  krank: 'kat.krankKurz',
  privat: 'kat.privatKurz',
}
const katText = (k) => (KATEGORIE_SCHLUESSEL[k] ? t(KATEGORIE_SCHLUESSEL[k]) : k || '–')

const SPESEN_TYP = { hotel: 'spesen.hotel', fahrt: 'spesen.fahrt', sonstig: 'spesen.sonstig' }
const spesenText = (typ) => (SPESEN_TYP[typ] ? t(SPESEN_TYP[typ]) : typ)

const PHASE_BADGE = {
  vorher: 'bg-schrift text-white',
  nachher: 'bg-emerald-600 text-white',
  beleg: 'bg-amber-500 text-white',
  sonstig: 'bg-schrift-zart text-white',
}

function datumDe(iso) {
  return iso ? new Date(iso + 'T12:00:00').toLocaleDateString('de-DE') : '–'
}

function StatusBadge({ status }) {
  useLang()
  // Die Tabelle oben liefert 'schluessel' (i18n-Schluessel), NICHT 'label'.
  // Vorher stand hier s.label -> undefined -> der Chip war fuer JEDEN bekannten
  // Status leer; nur der unbekannte Fall zeigte etwas an.
  const s = BERICHT_STATUS[status]
  const text = s ? t(s.schluessel) : (status || '–')
  const klasse = s?.klasse || 'bg-gedeckt-tief text-schrift-leise'
  return <span className={`text-[11px] font-bold rounded-full px-2.5 py-1 whitespace-nowrap ${klasse}`}>{text}</span>
}

// Debounce-Eingabefeld (SummaryEditor-Muster): lokaler Draft + 600 ms + Blur-Flush
function FeldInput({ wert, onWert, typ = 'text', className = '', platzhalter = '' }) {
  const [draft, setDraft] = useState(wert === undefined || wert === null ? '' : String(wert))
  const fokus = useRef(false)
  const timer = useRef(null)

  useEffect(() => {
    if (!fokus.current) setDraft(wert === undefined || wert === null ? '' : String(wert))
  }, [wert])
  useEffect(() => () => clearTimeout(timer.current), [])

  function speichern(v) {
    onWert(typ === 'number' ? (Number(v) || 0) : v)
  }
  function aendern(v) {
    setDraft(v)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => speichern(v), 600)
  }

  return (
    <input
      type={typ}
      step={typ === 'number' ? '0.01' : undefined}
      value={draft}
      placeholder={platzhalter}
      onChange={(e) => aendern(e.target.value)}
      onFocus={() => { fokus.current = true }}
      onBlur={(e) => { fokus.current = false; clearTimeout(timer.current); speichern(e.target.value) }}
      className={`w-full rounded-feld border border-rahmen px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500 ${className}`}
    />
  )
}

function FeldTextarea({ wert, onWert, rows = 4, platzhalter = '' }) {
  const [draft, setDraft] = useState(wert || '')
  const fokus = useRef(false)
  const timer = useRef(null)

  useEffect(() => {
    if (!fokus.current) setDraft(wert || '')
  }, [wert])
  useEffect(() => () => clearTimeout(timer.current), [])

  function aendern(v) {
    setDraft(v)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onWert(v), 600)
  }

  return (
    <textarea
      value={draft}
      rows={rows}
      placeholder={platzhalter}
      onChange={(e) => aendern(e.target.value)}
      onFocus={() => { fokus.current = true }}
      onBlur={(e) => { fokus.current = false; clearTimeout(timer.current); onWert(e.target.value) }}
      className="w-full rounded-feld border border-rahmen px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-praxis-500"
    />
  )
}

// WICHTIG: `user` muss als Prop ankommen – sie wird an <BerichtDetail> weitergereicht.
// (Fehlte früher: Klick auf eine Berichtskarte warf „user is not defined" und
//  riss die ganze Seite ab.)
export default function ProjektDetail({ user }) {
  const lang = useLang()
  const { id } = useParams()
  const [suchParams, setSuchParams] = useSearchParams()
  const projekte = useCollection('projekte')
  const kunden = useCollection('patients')
  const users = useCollection('users')
  const einst = useEinstellungen()
  const lv = useWhere('lvpositionen', 'projektId', id)
  const fotos = useWhere('photos', 'projektId', id)
  const raeume = useWhere('raeume', 'projektId', id)
  const berichte = useWhere('berichte', 'projektId', id)
  const termine = useWhere('appointments', 'projektId', id)
  const spesen = useWhere('spesen', 'projektId', id)
  const rechnungen = useWhere('rechnungen', 'projektId', id)

  const projekt = projekte.find((p) => p.id === id)
  const kunde = kunden.find((k) => k.id === projekt?.kundeId)

  // Bereich kommt aus der URL (?bereich=regie) -> Direktsprung aus dem Kalender
  const bereich = suchParams.get('bereich') || 'uebersicht'
  const setBereich = (b) => setSuchParams(b === 'uebersicht' ? {} : { bereich: b }, { replace: true })
  const [zeigeImport, setZeigeImport] = useState(false)
  const [raumSicht, setRaumSicht] = useState('2d')
  const [zeigeRechnungWizard, setZeigeRechnungWizard] = useState(false)
  const [vollbildFoto, setVollbildFoto] = useState(null)
  const [berichtId, setBerichtId] = useState(null)
  const [neuerBericht, setNeuerBericht] = useState(null)   // 'regie'|'reklamation'|'abnahme'
  const [bearbeiteBericht, setBearbeiteBericht] = useState(null)

  function berichtDrucken(b) {
    const bilder = fotos.filter((f) => f.berichtId === b.id)
    if (b.typ === 'abnahme') druckeAbnahme({ bericht: b, projekt, kunde, fotos: bilder, einst })
    else druckeRegiebericht({ bericht: b, projekt, kunde, fotos: bilder, einst })
  }

  // Klick auf eine Berichtskarte: Entwürfe direkt zum Bearbeiten öffnen,
  // eingereichte/freigegebene in der Detail-Ansicht anzeigen.
  function berichtOeffnen(b) {
    if (b.status === 'entwurf') setBearbeiteBericht(b)
    else setBerichtId(b.id)
  }

  // LV-Summe = Σ Menge × EP aller echten Positionen (ohne Bedarf/NEP)
  const lvSumme = lv
    .filter((p) => p.typ === 'position' && !p.flags?.bedarf && !p.flags?.nep)
    .reduce((s, p) => s + (p.menge || 0) * (p.einheitspreis || 0), 0)
  const hatLv = lv.some((p) => p.typ === 'position')

  const anzahl = {
    lv: lv.filter((p) => p.typ === 'position').length,
    bilder: fotos.length,
    regie: berichte.filter((b) => b.typ === 'regie').length,
    reklamation: berichte.filter((b) => b.typ === 'reklamation').length,
    abnahme: berichte.filter((b) => b.typ === 'abnahme').length,
    rechnungen: rechnungen.length,
    termine: termine.length,
    spesen: spesen.length,
  }

  const BEREICHE = [
    { id: 'uebersicht', label: t('pd.uebersicht'), icon: 'home' },
    { id: 'lv', label: t('pd.lv'), icon: 'lv', zahl: anzahl.lv },
    { id: 'raeume', label: t('pd.raeume'), icon: 'raum', zahl: raeume.filter((r) => r.aktiv !== false).length },
    { id: 'bilder', label: t('pd.bilder'), icon: 'foto', zahl: anzahl.bilder },
    { id: 'regie', label: t('pd.regieberichte'), icon: 'regie', zahl: anzahl.regie },
    { id: 'reklamation', label: t('pd.reklamationen'), icon: 'reklamation', zahl: anzahl.reklamation },
    { id: 'abnahme', label: t('pd.abnahmen'), icon: 'abnahme', zahl: anzahl.abnahme },
    { id: 'rechnungen', label: t('pd.rechnungen'), icon: 'rechnung', zahl: anzahl.rechnungen },
    { id: 'termine', label: t('termine.titel'), icon: 'calendar', zahl: anzahl.termine },
    { id: 'spesen', label: t('monteur.spesen'), icon: 'spesen', zahl: anzahl.spesen },
  ]

  // Logbuch: Termine + eingereichte/freigegebene Berichte gemischt, neueste oben
  const logbuch = useMemo(() => {
    const eintraege = []
    for (const termin of termine) {
      eintraege.push({
        id: `t-${termin.id}`,
        datum: termin.datum,
        zeit: termin.start || '',
        icon: 'calendar',
        titel: termin.titel || termin.behandlung || t('termine.neu'),
        sub: `${t('termine.neu')} · ${katText(termin.kategorie)}${termin.erledigt ? ` · ${t('monteur.erledigt')}` : ''}`,
      })
    }
    for (const b of berichte) {
      if (b.status === 'entwurf') continue
      eintraege.push({
        id: `b-${b.id}`,
        datum: b.datum,
        zeit: '',
        icon: b.typ === 'reklamation' ? 'alert' : 'bericht',
        titel: `${typText(b.typ)} – ${b.mitarbeiterName || '–'}`,
        sub: `${BERICHT_STATUS[b.status] ? t(BERICHT_STATUS[b.status].schluessel) : b.status}${b.beschreibung ? ` · ${b.beschreibung}` : ''}`,
      })
    }
    return eintraege.sort((a, b) => `${b.datum} ${b.zeit}`.localeCompare(`${a.datum} ${a.zeit}`))
  }, [termine, berichte, lang])

  const gewaehlterBericht = berichte.find((b) => b.id === berichtId)

  function patchProjekt(felder) {
    withStore((s) => s.update('projekte', id, felder))
  }

  if (!projekt) {
    return (
      <div className="p-6">
        <Link to="/projekte" className="inline-flex items-center gap-1.5 text-sm font-semibold text-praxis-700 hover:underline">
          <Icon name="arrowLeft" className="w-4 h-4" /> {t('pd.zurueckProjekte')}
        </Link>
        <div className="mt-4 bg-karte rounded-karte border border-rahmen p-10 text-center text-schrift-zart text-sm">
          {t(projekte.length === 0 ? 'pd.projektLaedt' : 'pd.projektFehlt')}
        </div>
      </div>
    )
  }

  const status = statusInfo(projekt.status)

  return (
    <div className={S.SEITE}>
      {/* Kopf */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Link
          to="/projekte"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-schrift-leise hover:text-praxis-700"
        >
          <Icon name="arrowLeft" className="w-4 h-4" /> {t('nav.projekte')}
        </Link>
        <span className="text-schrift-zart">/</span>
        {/* Der Name war bisher nur beim Anlegen setzbar. Ein Tippfehler in der
            Baustellenbezeichnung blieb damit fuer immer stehen – und er steht
            auf jedem Regiebericht, jedem Protokoll und jeder Rechnung.
            Deshalb hier direkt bearbeitbar, mit derselben verzoegerten
            Speicherung wie die uebrigen Felder. */}
        <FeldInput
          wert={projekt.name}
          onWert={(v) => { if (String(v).trim()) patchProjekt({ name: String(v).trim() }) }}
          platzhalter={t('projekt.namePlatzhalter')}
          className="!text-xl !font-bold !text-schrift-stark !border-transparent hover:!border-rahmen focus:!border-rahmen !bg-transparent !px-2 !w-auto min-w-48"
        />
        <FeldInput
          wert={projekt.nummer}
          onWert={(v) => patchProjekt({ nummer: String(v).trim() })}
          platzhalter={t('projekt.nummer')}
          className="!text-xs !font-mono !text-schrift-zart !bg-karte !rounded-full !px-2.5 !py-1 !w-28"
        />
        <span
          className="inline-flex items-center gap-1.5 text-xs font-bold rounded-full px-3 py-1.5"
          style={{ backgroundColor: `${status.farbe}1a`, color: status.farbe }}
        >
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: status.farbe }} />
          {t(`projektstatus.${status.id}`)}
        </span>
      </div>

      {/* Mobil: Bereichs-Auswahl */}
      <select
        value={bereich}
        onChange={(e) => setBereich(e.target.value)}
        className="lg:hidden w-full mb-4 rounded-feld border border-rahmen bg-karte px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-praxis-500"
      >
        {BEREICHE.map((b) => (
          <option key={b.id} value={b.id}>
            {b.label}{b.zahl !== undefined ? ` (${b.zahl})` : ''}
          </option>
        ))}
      </select>

      <div className="lg:flex lg:items-start gap-5 space-y-4 lg:space-y-0">
        {/* LINKS: Bereichs-Navigation */}
        <nav className="hidden lg:block w-56 shrink-0 bg-karte rounded-karte border border-rahmen p-2">
          {BEREICHE.map((b) => (
            <button
              key={b.id}
              onClick={() => setBereich(b.id)}
              className={`w-full ${S.NAV_LINK} ${bereich === b.id ? S.NAV_HELL_AN : S.NAV_HELL_AUS}`}
            >
              <Icon name={b.icon} className="w-4 h-4 shrink-0" />
              <span className="flex-1 truncate">{b.label}</span>
              {b.zahl !== undefined && b.zahl > 0 && (
                <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${
                  bereich === b.id ? 'bg-karte/20 text-white' : 'bg-gedeckt-tief text-schrift-leise'
                }`}>
                  {b.zahl}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* MITTE: Inhalt des gewählten Bereichs */}
        <div className="flex-1 min-w-0 space-y-4">
          {bereich === 'uebersicht' && (
            <>
              <div className="bg-karte rounded-karte border border-rahmen p-5">
                <h2 className="font-bold text-schrift-stark text-sm mb-2">{t('allg.beschreibung')}</h2>
                <FeldTextarea
                  wert={projekt.beschreibung}
                  onWert={(v) => patchProjekt({ beschreibung: v })}
                  platzhalter={t('pd.beschreibungPlatz')}
                />
              </div>
              <div className="bg-karte rounded-karte border border-rahmen p-5">
                <h2 className="font-bold text-schrift-stark text-sm mb-3">{t('pd.logbuch')}</h2>
                {logbuch.length === 0 ? (
                  <p className="text-sm text-schrift-zart">{t('pd.keinLogbuch')}</p>
                ) : (
                  <div className="space-y-2">
                    {logbuch.map((e) => (
                      <div key={e.id} className="flex items-start gap-3 border border-rahmen rounded-feld px-4 py-3">
                        <Icon name={e.icon} className="w-4 h-4 text-praxis-700 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-schrift-stark">
                            {datumDe(e.datum)}{e.zeit ? ` · ${e.zeit} ${t('allg.uhr')}` : ''} — {e.titel}
                          </p>
                          <p className="text-xs text-schrift-leise truncate">{e.sub}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {bereich === 'lv' && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-schrift-stark">{t('pd.lv')}</h2>
                <button
                  onClick={() => setZeigeImport(true)}
                  className="inline-flex items-center gap-1.5 bg-praxis-600 hover:bg-praxis-700 text-white text-sm font-semibold px-4 py-2 rounded-full"
                >
                  <Icon name="upload" className="w-4 h-4" /> {t('pd.lvImportieren')}
                </button>
              </div>
              <LvEditor projektId={id} />
            </>
          )}

          {bereich === 'raeume' && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-bold text-schrift-stark">{t('pd.raeume')}</h2>
                {/* Zwei Sichten auf dieselben Daten: die Draufsicht zum ANLEGEN,
                    die Raumansicht zum SEHEN, wie weit es ist. Eine gestrichene
                    Nordwand ist von oben unsichtbar. */}
                <div className="flex rounded-feld border border-rahmen overflow-hidden">
                  {[['2d', t('raum.ansicht2d')], ['3d', t('raum.ansicht3d')], ['mengen', t('pd.verteilung')]].map(([id2, label]) => (
                    <button
                      key={id2}
                      onClick={() => setRaumSicht(id2)}
                      className={`px-4 min-h-11 text-sm font-semibold ${
                        raumSicht === id2 ? 'bg-praxis-600 text-white' : 'bg-karte text-schrift'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Aus den abgehakten Taetigkeiten ein Dokument machen. Erst wenn
                  alles erledigt ist, ist es die Fertigstellungsanzeige nach
                  Paragraf 12 Abs. 1 VOB/B - sonst ein Zwischenstand, und genau
                  das steht dann auch drauf. */}
              {raeume.some((r) => r.aktiv !== false) && (
                <button
                  onClick={() => druckeAbschluss({
                    projekt, kunde, raeume, positionen: lv, berichte, einst,
                    fertigAm: projekt?.fertigAm || '',
                  })}
                  className="inline-flex items-center gap-2 px-4 min-h-11 rounded-feld border border-rahmen bg-karte text-sm font-semibold text-schrift hover:bg-gedeckt"
                >
                  <Icon name="drucken" className="w-4 h-4" /> {t('pd.abschlussDrucken')}
                </button>
              )}
              {raumSicht === 'mengen'
                ? <RaumVerteilung projektId={id} user={user} />
                : raumSicht === '2d'
                ? <RaumPlaner projektId={id} user={user} />
                : (
                  <Raum3D
                    raeume={raeume}
                    aufFlaeche={async (raumId, flaecheId) => {
                      // Klick auf eine Fläche schaltet ihren Zustand weiter:
                      // offen -> in Arbeit -> fertig -> offen
                      const r = raeume.find((x) => x.id === raumId)
                      if (!r) return
                      const jetzt = (r.status || {})[flaecheId] || 'offen'
                      const naechster = jetzt === 'offen' ? 'arbeit' : jetzt === 'arbeit' ? 'fertig' : 'offen'
                      await withStore((s2) => s2.update('raeume', raumId, {
                        status: { ...(r.status || {}), [flaecheId]: naechster },
                      }))
                    }}
                  />
                )}
            </>
          )}

          {bereich === 'bilder' && (
            <div className="bg-karte rounded-karte border border-rahmen p-5">
              <h2 className="font-bold text-schrift-stark text-sm mb-3">{t('pd.bilder')} ({fotos.length})</h2>
              {fotos.length === 0 ? (
                <p className="text-sm text-schrift-zart">{t('pd.keineFotos')}</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {[...fotos].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setVollbildFoto(f)}
                      className="relative rounded-feld overflow-hidden border border-rahmen aspect-[4/3] bg-gedeckt-tief group"
                    >
                      <img src={f.dataUrl} alt={f.name || 'Foto'} className="w-full h-full object-cover group-hover:scale-105 transition" />
                      <span className={`absolute top-2 left-2 text-[11px] font-bold rounded-full px-2 py-0.5 ${PHASE_BADGE[f.phase] || PHASE_BADGE.sonstig}`}>
                        {f.phase || 'sonstig'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {(bereich === 'regie' || bereich === 'reklamation' || bereich === 'abnahme') && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-schrift-stark">
                  {t(bereich === 'regie' ? 'pd.regieberichte' : bereich === 'reklamation' ? 'pd.reklamationen' : 'pd.abnahmen')}
                </h2>
                <button
                  onClick={() => setNeuerBericht(bereich)}
                  className="inline-flex items-center gap-1.5 bg-praxis-600 hover:bg-praxis-700 text-white text-sm font-semibold px-4 py-2 rounded-full"
                >
                  <Icon name="plus" className="w-4 h-4" />
                  {t(bereich === 'regie' ? 'bericht.regie' : bereich === 'reklamation' ? 'bericht.reklamation' : 'bericht.abnahme')}
                </button>
              </div>
              {berichte.filter((b) => b.typ === bereich).length === 0 && (
                <div className="bg-karte rounded-karte border border-rahmen p-8 text-center text-sm text-schrift-zart">
                  {t('pd.keineBerichte')}
                </div>
              )}
              {berichte
                .filter((b) => b.typ === bereich)
                .sort((a, b) => (b.datum || '').localeCompare(a.datum || ''))
                .map((b) => (
                  <div
                    key={b.id}
                    className="bg-karte rounded-karte border border-rahmen hover:border-praxis-400 px-5 py-4 transition"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <button onClick={() => berichtOeffnen(b)} className="text-left min-w-0 flex-1">
                        <p className="text-sm font-semibold text-schrift-stark">
                          {b.nummer ? `${b.nummer} · ` : ''}{datumDe(b.datum)} · {b.mitarbeiterName || '–'}
                        </p>
                        {b.beschreibung && <p className="mt-1 text-sm text-schrift-leise line-clamp-2">{b.beschreibung}</p>}
                      </button>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={b.status} />
                        <button
                          onClick={() => berichtDrucken(b)}
                          className="px-3 py-1.5 rounded-feld bg-gedeckt-tief text-schrift text-xs font-medium hover:bg-gedeckt-tief inline-flex items-center gap-1"
                        >
                          <Icon name="doc" className="w-3.5 h-3.5" /> PDF
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {bereich === 'rechnungen' && (
            <div className="bg-karte rounded-karte border border-rahmen overflow-hidden">
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <h2 className="font-bold text-schrift-stark text-sm">{t('pd.rechnungen')}</h2>
                <button onClick={() => setZeigeRechnungWizard(true)}
                  className="px-3 py-1.5 rounded-feld bg-praxis-600 text-white text-xs font-bold hover:bg-praxis-700">
                  {t('pd.rechnungZuProjekt')}
                </button>
              </div>
              {rechnungen.length === 0 ? (
                <p className="px-5 pb-6 text-sm text-schrift-zart">{t('pd.keineRechnungen')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-rahmen text-left text-[12px] font-bold uppercase tracking-wide text-schrift-zart">
                        <th className="px-5 py-2">{t('rechnung.nummer')}</th>
                        <th className="px-3 py-2 text-right">{t('pd.netto')}</th>
                        <th className="px-5 py-2 text-right">{t('allg.status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rechnungen.map((r) => (
                        <tr key={r.id} className="border-b border-rahmen">
                          <td className="px-5 py-2.5 font-mono text-xs text-schrift">{r.nummer || r.fastbillInvoiceId || r.id}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-schrift-stark">{euro(r.netto)}</td>
                          <td className="px-5 py-2.5 text-right">
                            <span className="text-[11px] font-bold rounded-full px-2.5 py-1 bg-gedeckt-tief text-schrift">{r.status || '–'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {bereich === 'termine' && (
            <div className="bg-karte rounded-karte border border-rahmen overflow-hidden">
              <h2 className="font-bold text-schrift-stark text-sm px-5 pt-4 pb-2">{t('termine.titel')}</h2>
              {termine.length === 0 ? (
                <p className="px-5 pb-6 text-sm text-schrift-zart">{t('pd.keineTermine')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-rahmen text-left text-[12px] font-bold uppercase tracking-wide text-schrift-zart">
                        <th className="px-5 py-2">{t('allg.datum')}</th>
                        <th className="px-3 py-2">{t('termine.titelSpalte')}</th>
                        <th className="px-3 py-2">{t('termine.kategorie')}</th>
                        <th className="px-5 py-2 text-right">{t('pd.erledigt')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...termine]
                        .sort((a, b) => `${b.datum}${b.start}`.localeCompare(`${a.datum}${a.start}`))
                        .map((termin) => (
                          <tr key={termin.id} className="border-b border-rahmen">
                            <td className="px-5 py-2.5 whitespace-nowrap text-schrift">{datumDe(termin.datum)} · {termin.start}</td>
                            <td className="px-3 py-2.5 font-semibold text-schrift-stark">{termin.titel || termin.behandlung}</td>
                            <td className="px-3 py-2.5 text-schrift-leise">{katText(termin.kategorie)}</td>
                            <td className="px-5 py-2.5 text-right">
                              {termin.erledigt ? <Icon name="check" className="w-4 h-4 text-emerald-600 inline" /> : <span className="text-schrift-zart">–</span>}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {bereich === 'spesen' && (
            <div className="bg-karte rounded-karte border border-rahmen overflow-hidden">
              <h2 className="font-bold text-schrift-stark text-sm px-5 pt-4 pb-2">{t('monteur.spesen')}</h2>
              {spesen.length === 0 ? (
                <p className="px-5 pb-6 text-sm text-schrift-zart">{t('pd.keineSpesen')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-rahmen text-left text-[12px] font-bold uppercase tracking-wide text-schrift-zart">
                        <th className="px-5 py-2">{t('allg.datum')}</th>
                        <th className="px-3 py-2">{t('kunden.typ')}</th>
                        <th className="px-3 py-2">{t('berichte.mitarbeiter')}</th>
                        <th className="px-3 py-2 text-right">{t('allg.betrag')}</th>
                        <th className="px-5 py-2 text-right">{t('allg.status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...spesen]
                        .sort((a, b) => (b.datum || '').localeCompare(a.datum || ''))
                        .map((s) => (
                          <tr key={s.id} className="border-b border-rahmen">
                            <td className="px-5 py-2.5 whitespace-nowrap text-schrift">{datumDe(s.datum)}</td>
                            <td className="px-3 py-2.5 text-schrift-leise">{spesenText(s.typ)}</td>
                            <td className="px-3 py-2.5 text-schrift-leise">{users.find((u) => u.id === s.mitarbeiterId)?.name || '–'}</td>
                            <td className="px-3 py-2.5 text-right font-semibold text-schrift-stark">{euro(s.betrag)}</td>
                            <td className="px-5 py-2.5 text-right"><StatusBadge status={s.status} /></td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RECHTS: Projektdaten-Panel */}
        <aside className="lg:w-72 shrink-0">
          <div className="bg-karte rounded-karte border border-rahmen p-5 space-y-4">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wide text-schrift-zart mb-1.5">{t('allg.status')}</p>
              <select
                value={statusInfo(projekt.status).id}
                onChange={(e) => patchProjekt({ status: e.target.value })}
                className="w-full rounded-feld border border-rahmen bg-karte px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-praxis-500"
              >
                {PROJEKT_STATUS.map((s) => (
                  <option key={s.id} value={s.id}>{t(`projektstatus.${s.id}`)}</option>
                ))}
              </select>
            </div>

            <div>
              <p className="text-[12px] font-bold uppercase tracking-wide text-schrift-zart mb-1">{t('kunden.kunde')}</p>
              <select
                value={projekt.kundeId || ''}
                onChange={(e) => patchProjekt({ kundeId: e.target.value })}
                className="w-full rounded-feld border border-rahmen bg-karte px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-praxis-500"
              >
                <option value="">{t('projekt.kundeWaehlen')}</option>
                {kunden.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.firma || `${k.vorname || ''} ${k.nachname || ''}`.trim() || k.id}
                  </option>
                ))}
              </select>
              {/* Der Kunde bestimmt Anschrift, Umsatzsteuermodus und den
                  FastBill-Empfaenger. Sind schon Rechnungen gestellt, aendert
                  ein Wechsel den Empfaenger der KUENFTIGEN Rechnungen – die
                  bereits uebertragenen bleiben, wo sie sind. Das muss dastehen,
                  bevor jemand es herausfindet. */}
              {rechnungen.length > 0 && (
                <p className="text-[12px] text-amber-700 mt-1.5">{t('pd.kundeWechselHinweis', { anzahl: rechnungen.length })}</p>
              )}
              {kunde?.telefon && (
                <p className="text-sm text-schrift-leise mt-0.5">
                  <Icon name="phone" className="w-3.5 h-3.5 inline mr-1" />{kunde.telefon}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-wide text-schrift-zart mb-1">{t('rechnung.nummer')}</p>
                <FeldInput
                  wert={projekt.nummer}
                  onWert={(v) => patchProjekt({ nummer: String(v).trim() })}
                  platzhalter="–"
                />
              </div>
              <div>
                <p className="text-[12px] font-bold uppercase tracking-wide text-schrift-zart mb-1">{t('projekte.gewerk')}</p>
                <FeldInput
                  wert={projekt.gewerk}
                  onWert={(v) => patchProjekt({ gewerk: String(v).trim() })}
                  platzhalter="–"
                />
              </div>
            </div>

            {/* Abrechnungsregel (Plan 8.2): PFLICHTFELD aus dem Nachunternehmer-
                vertrag. Sie steht im Klartext auf jedem Aufmaßblatt und wird an
                jeder Aufmaßzeile als Schnappschuss gespeichert. Ein Wechsel
                mitten im Projekt WARNT mit der Zahl gestellter Rechnungen –
                ein stiller Wechsel sähe für den GU nach Aufschlag aus. */}
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wide text-schrift-zart mb-1">{t('pd.regelwerk')}</p>
              <select
                value={projekt.abrechnungsregel || ''}
                onChange={(e) => {
                  const neu = e.target.value
                  if (!neu) return
                  const gestellte = rechnungen.filter((r) => ['uebertragen', 'gestellt', 'bezahlt'].includes(r.status)).length
                  if (projekt.abrechnungsregel && neu !== projekt.abrechnungsregel && gestellte > 0
                    && !window.confirm(t('pd.regelwerkWechselFrage', { anzahl: gestellte }))) return
                  patchProjekt({ abrechnungsregel: neu })
                }}
                className="w-full rounded-feld border border-rahmen bg-karte px-3 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-praxis-500"
              >
                <option value="">{t('pd.regelwerkWaehlen')}</option>
                {Object.values(REGELWERKE).map((rw) => (
                  <option key={rw.id} value={rw.id}>{rw.name}</option>
                ))}
              </select>
              {!projekt.abrechnungsregel ? (
                <p className="text-[12px] text-red-600 mt-1.5">{t('pd.regelwerkPflicht')}</p>
              ) : (
                <p className="text-[12px] text-schrift-zart mt-1.5">{REGELWERKE[projekt.abrechnungsregel]?.klartext}</p>
              )}
            </div>

            <div>
              <p className="text-[12px] font-bold uppercase tracking-wide text-schrift-zart mb-1">{t('pd.bodenaufbau')}</p>
              <FeldInput
                wert={projekt.bodenaufbauStd}
                onWert={(v) => patchProjekt({ bodenaufbauStd: v })}
                platzhalter="0,12"
              />
              <p className="text-[12px] text-schrift-zart mt-1">{t('pd.bodenaufbauHinweis')}</p>
            </div>

            <div>
              <p className="text-[12px] font-bold uppercase tracking-wide text-schrift-zart mb-1.5">{t('projekte.zeitraum')}</p>
              <div className="space-y-2">
                <input
                  type="date"
                  value={projekt.startDatum || ''}
                  onChange={(e) => patchProjekt({ startDatum: e.target.value })}
                  className="w-full rounded-feld border border-rahmen px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500"
                />
                <input
                  type="date"
                  value={projekt.endeDatum || ''}
                  onChange={(e) => patchProjekt({ endeDatum: e.target.value })}
                  className="w-full rounded-feld border border-rahmen px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500"
                />
              </div>
            </div>

            <div>
              <p className="text-[12px] font-bold uppercase tracking-wide text-schrift-zart mb-1.5">{t('allg.anschrift')}</p>
              <div className="space-y-2">
                <FeldInput
                  wert={projekt.anschrift?.strasse}
                  onWert={(v) => patchProjekt({ anschrift: { ...(projekt.anschrift || {}), strasse: v } })}
                  platzhalter={t('projekte.strassePlatz')}
                />
                <FeldInput
                  wert={projekt.anschrift?.plzOrt}
                  onWert={(v) => patchProjekt({ anschrift: { ...(projekt.anschrift || {}), plzOrt: v } })}
                  platzhalter={t('projekte.plzOrtPlatz')}
                />
              </div>
            </div>

            <div className="border-t border-rahmen pt-4">
              <p className="text-[12px] font-bold uppercase tracking-wide text-schrift-zart mb-1">{t('pd.projektvolumen')}</p>
              {hatLv ? (
                <>
                  <p className="text-xl font-bold text-schrift-stark">{euro(lvSumme)}</p>
                  <p className="text-[12px] text-schrift-zart mt-0.5">{t('pd.ausLv')}</p>
                </>
              ) : (
                <>
                  <FeldInput
                    typ="number"
                    wert={projekt.projektvolumen}
                    onWert={(v) => patchProjekt({ projektvolumen: v })}
                    platzhalter="0"
                  />
                  <p className="text-[12px] text-schrift-zart mt-1">{t('pd.manuell')}</p>
                </>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* LV-Import-Modal */}
      {zeigeImport && <LvImport projektId={id} onClose={() => setZeigeImport(false)} />}

      {/* Rechnung direkt aus dem Projekt (Wizard startet in Schritt 2) */}
      {zeigeRechnungWizard && <RechnungWizard projektIdVorbelegt={id} onClose={() => setZeigeRechnungWizard(false)} />}

      {/* Foto-Vollbild-Overlay */}
      {vollbildFoto && (
        <div
          className="fixed inset-0 z-[90] bg-praxis-900/92 flex flex-col items-center justify-center p-4"
          onClick={() => setVollbildFoto(null)}
        >
          <img
            src={vollbildFoto.dataUrl}
            alt={vollbildFoto.name || 'Foto'}
            className="max-w-[92vw] max-h-[82vh] object-contain rounded-feld"
          />
          <p className="mt-3 text-sm text-white/80">
            <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 mr-2 ${PHASE_BADGE[vollbildFoto.phase] || PHASE_BADGE.sonstig}`}>
              {vollbildFoto.phase || 'sonstig'}
            </span>
            {vollbildFoto.name || ''}{vollbildFoto.von ? ` · ${vollbildFoto.von}` : ''}
          </p>
          <button className="mt-2 text-xs font-semibold text-white/60 hover:text-white">{t('allg.schliessen')}</button>
        </div>
      )}

      {/* Bericht-Detail-Modal */}
      {gewaehlterBericht && (
        <BerichtDetail
          bericht={gewaehlterBericht}
          user={user}
          onClose={() => setBerichtId(null)}
          onFoto={setVollbildFoto}
          onDrucken={() => berichtDrucken(gewaehlterBericht)}
        />
      )}

      {/* Bericht neu erfassen / Entwurf bearbeiten */}
      {neuerBericht && (
        <BerichtForm typ={neuerBericht} projektId={id} user={user} onClose={() => setNeuerBericht(null)} />
      )}
      {bearbeiteBericht && (
        <BerichtForm
          typ={bearbeiteBericht.typ}
          bericht={bearbeiteBericht}
          user={user}
          onClose={() => setBearbeiteBericht(null)}
        />
      )}
    </div>
  )
}

// Detail-Ansicht eines Berichts: alle Felder, Vorher/Nachher-Fotos, Unterschrift, Freigabe
function BerichtDetail({ bericht, user, onClose, onFoto, onDrucken }) {
  useLang()
  const fotos = useWhere('photos', 'berichtId', bericht.id)
  const vorher = fotos.filter((f) => f.phase === 'vorher')
  const nachher = fotos.filter((f) => f.phase === 'nachher')
  const weitere = fotos.filter((f) => f.phase !== 'vorher' && f.phase !== 'nachher')

  const stundenSumme = (bericht.stunden || []).reduce((s, z) => s + (z.anzahl || 0) * (z.satz || 0), 0)
  const materialSumme = (bericht.material || []).reduce((s, m) => s + (m.menge || 0) * (m.preis || 0), 0)

  function setzeStatus(status) {
    withStore((s) => s.update('berichte', bericht.id, status === 'freigegeben'
      ? { status, freigegebenAm: Date.now(), freigegebenVon: user?.name || '' }
      : { status }))
  }

  const fotoKachel = (f) => (
    <button key={f.id} onClick={() => onFoto(f)} className="rounded-feld overflow-hidden border border-rahmen aspect-[4/3] bg-gedeckt-tief">
      <img src={f.dataUrl} alt={f.name || 'Foto'} className="w-full h-full object-cover" />
    </button>
  )

  return (
    <Modal titel={`${typText(bericht.typ)} · ${datumDe(bericht.datum)}`} onClose={onClose} breite="max-w-2xl">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={bericht.status} />
          <span className="text-sm text-schrift-leise">
            <Icon name="users" className="w-3.5 h-3.5 inline mr-1" />{bericht.mitarbeiterName || '–'}
          </span>
          {bericht.terminId && <span className="text-xs text-schrift-zart">{t('pd.ausTermin')}</span>}
        </div>

        {bericht.beschreibung && (
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wide text-schrift-zart mb-1">{t('allg.beschreibung')}</p>
            <p className="text-sm text-schrift leading-relaxed">{bericht.beschreibung}</p>
          </div>
        )}

        {/* Reklamation: Ursache + Maßnahme */}
        {bericht.ursache && (
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wide text-schrift-zart mb-1">{t('pd.ursache')}</p>
            <p className="text-sm text-schrift">{bericht.ursache}</p>
          </div>
        )}
        {bericht.massnahme && (
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wide text-schrift-zart mb-1">{t('pd.massnahme')}</p>
            <p className="text-sm text-schrift">{bericht.massnahme}</p>
          </div>
        )}

        {/* Abnahme: Ergebnis + Mängelliste ({text, frist}-Objekte!) */}
        {bericht.typ === 'abnahme' && (
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wide text-schrift-zart mb-1">{t('pd.abnahmeErgebnis')}</p>
            {bericht.ohneMaengel ? (
              <p className="text-sm font-semibold text-emerald-700">{t('pd.ohneMaengel')}</p>
            ) : (bericht.maengel || []).length > 0 ? (
              <div className="space-y-1">
                {bericht.maengel.map((m, i) => (
                  <p key={i} className="text-sm text-schrift">
                    • {m.text || '–'}
                    {m.frist && <span className="text-schrift-zart"> · {t('pd.frist', { datum: datumDe(m.frist) })}</span>}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-schrift-leise">{t('pd.mitMaengeln')}</p>
            )}
          </div>
        )}
        {bericht.ergebnis && (
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wide text-schrift-zart mb-1">{t('dash.ergebnis')}</p>
            <p className="text-sm text-schrift">{bericht.ergebnis}</p>
          </div>
        )}

        {/* Regie: Stunden */}
        {(bericht.stunden || []).length > 0 && (
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wide text-schrift-zart mb-1.5">{t('pd.stunden')}</p>
            <div className="space-y-1.5">
              {bericht.stunden.map((z, i) => (
                <div key={i} className="flex items-center justify-between text-sm bg-gedeckt border border-rahmen rounded-feld px-3.5 py-2">
                  <span className="text-schrift">
                    {z.art === 'facharbeiter' ? t('pd.facharbeiter') : z.art === 'helfer' ? t('pd.helfer') : z.art} · {z.anzahl} {t('allg.stunden')} × {euro(z.satz)}
                  </span>
                  <span className="font-semibold text-schrift-stark">{euro((z.anzahl || 0) * (z.satz || 0))}</span>
                </div>
              ))}
              <div className="flex items-center justify-between text-sm font-bold text-praxis-900 bg-praxis-50 rounded-feld px-3.5 py-2">
                <span>{t('pd.summeStunden')}</span><span>{euro(stundenSumme)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Regie: Material */}
        {(bericht.material || []).length > 0 && (
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wide text-schrift-zart mb-1.5">{t('dash.material')}</p>
            <div className="space-y-1.5">
              {bericht.material.map((m, i) => (
                <div key={i} className="flex items-center justify-between text-sm bg-gedeckt border border-rahmen rounded-feld px-3.5 py-2">
                  <span className="text-schrift">{m.name} · {m.menge} {m.einheit} × {euro(m.preis)}</span>
                  <span className="font-semibold text-schrift-stark">{euro((m.menge || 0) * (m.preis || 0))}</span>
                </div>
              ))}
              <div className="flex items-center justify-between text-sm font-bold text-praxis-900 bg-praxis-50 rounded-feld px-3.5 py-2">
                <span>{t('pd.summeMaterial')}</span><span>{euro(materialSumme)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Fotos: Vorher/Nachher-Gegenüberstellung */}
        {(vorher.length > 0 || nachher.length > 0) && (
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wide text-schrift-zart mb-1.5">{t('pd.fotos')}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-bold text-schrift-leise mb-1.5">{t('pd.vorher')}</p>
                <div className="space-y-2">
                  {vorher.length > 0 ? vorher.map(fotoKachel) : <p className="text-xs text-schrift-zart">–</p>}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-600 mb-1.5">{t('pd.nachher')}</p>
                <div className="space-y-2">
                  {nachher.length > 0 ? nachher.map(fotoKachel) : <p className="text-xs text-schrift-zart">–</p>}
                </div>
              </div>
            </div>
          </div>
        )}
        {weitere.length > 0 && (
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wide text-schrift-zart mb-1.5">{t('pd.weitereFotos')}</p>
            <div className="grid grid-cols-3 gap-2">{weitere.map(fotoKachel)}</div>
          </div>
        )}

        {/* Unterschrift */}
        {bericht.unterschriftKunde && (
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wide text-schrift-zart mb-1.5">
              <Icon name="signatur" className="w-3.5 h-3.5 inline mr-1" />{t('pd.unterschrift')}
            </p>
            <div className="bg-karte border border-rahmen rounded-feld p-3 w-fit">
              <img src={bericht.unterschriftKunde} alt="Unterschrift" className="h-20" />
            </div>
            {bericht.unterschriftName && <p className="text-xs text-schrift-leise mt-1">{bericht.unterschriftName}</p>}
          </div>
        )}

        {/* Freigabe-Workflow + PDF */}
        <div className="flex flex-wrap gap-2 pt-1">
          {bericht.status === 'eingereicht' && (
            <>
              <button
                onClick={() => setzeStatus('freigegeben')}
                className="flex-1 min-w-[130px] bg-praxis-600 hover:bg-praxis-700 text-white font-bold py-3 rounded-feld"
              >
                {t('berichte.freigeben')}
              </button>
              <button
                onClick={() => setzeStatus('entwurf')}
                className="flex-1 min-w-[130px] bg-karte border border-rahmen hover:border-red-300 text-schrift hover:text-red-600 font-semibold py-3 rounded-feld"
              >
                {t('pd.zurueckweisen')}
              </button>
            </>
          )}
          <button
            onClick={onDrucken}
            className="flex-1 min-w-[130px] inline-flex items-center justify-center gap-1.5 bg-gedeckt-tief hover:bg-gedeckt-tief text-schrift font-semibold py-3 rounded-feld"
          >
            <Icon name="doc" className="w-4 h-4" /> {t('pd.pdfDrucken')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
