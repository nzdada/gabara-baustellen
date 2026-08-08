import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '@shared/ui.jsx'
import { useCollection, useWhere, useKennzahlenListe, useEinsaetzeTage, withStore } from '../hooks.js'
import { istOffen } from '@shared/projektstatus.js'
import { useLang, t, tr, datumLok } from '@shared/i18n.js'
import * as S from '../stil.js'
import { Seitenkopf, Meldung } from '../components/Seite.jsx'
import Modal from '../components/Modal.jsx'
import { heuteISO } from '@shared/slots.js'
import { euro, parseZahl } from '@shared/format.js'
import { zahlText } from '@shared/aufmass.js'
import { schritteBuero, schritteLeitstand, DRINGEND, OFFEN } from '@shared/naechsterSchritt.js'
import { teamsAus, textAuf } from '@shared/teams.js'
import {
  wochenTage, einsatzTage, zuweisungBauen, parseRaumliste, schnellanlageBauen,
} from '@shared/leitstand.js'
import { istFertigStatus } from '@shared/monteurtag.js'

// Der Büro-Leitstand (Plan Kapitel 3.2, AP 7): VIER Bänder, alles ohne einen
// einzigen Klick sichtbar – HEUTE (Kolonnen mit Einsätzen), WAS HAKT (max.
// 7 Zeilen, sonst grüner Balken), BAUSTELLEN (drei benannte Zahlen aus dem
// Kennzahlen-Unterdokument – KEIN Aufgaben-Vollabo, Kaltstart unter 100
// Dokumenten) und WOCHENTAFEL (Mo–Fr × Kolonnen, Einsätze ziehen/anlegen).

const KURZ = { weekday: 'short', day: '2-digit', month: '2-digit' }

// Gehört dieser Einsatz zu dieser Kolonne? Kolonnen kommen aus teamsAus()
// (Mitarbeiter-Stammdaten), Einsätze tragen teamId/teamName ODER nur
// Mitarbeiter – alle drei Wege zählen.
function gehoertZuTeam(einsatz, team) {
  return einsatz.teamId === team.name || einsatz.teamName === team.name
    || (einsatz.mitarbeiterIds || []).some((id) => team.mitglieder.some((m) => m.id === id))
}

function BandTitel({ nr, schluessel }) {
  return (
    <p className="flex items-center gap-2 text-[12px] font-black uppercase tracking-wider text-schrift-leise mb-2">
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-praxis-600 text-white text-[11px]">{nr}</span>
      {t(schluessel)}
    </p>
  )
}

// Eine Handlung im Band WAS HAKT: ein Satz, eine Begründung, ein Knopf.
function Handlung({ h }) {
  const farbe = h.stufe === DRINGEND
    ? 'border-l-red-500 bg-red-50/50'
    : h.stufe === OFFEN ? 'border-l-amber-400 bg-amber-50/40' : 'border-l-rahmen-stark'
  return (
    <div className={`flex items-start gap-3 border border-rahmen border-l-4 ${farbe} rounded-feld px-4 py-3`}>
      <Icon name={h.icon} className="w-5 h-5 mt-0.5 text-schrift-leise shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-schrift-stark">{tr(h.text)}</p>
        {h.detail && <p className="text-[12px] text-schrift mt-0.5">{tr(h.detail)}</p>}
      </div>
      {h.ziel && (
        <Link
          to={h.ziel}
          onClick={(e) => {
            // Anker auf derselben Seite: nicht neu laden, nur hinscrollen.
            if (h.ziel.includes('#wochentafel')) {
              e.preventDefault()
              document.getElementById('wochentafel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          }}
          className="shrink-0 px-3.5 min-h-11 flex items-center rounded-feld bg-praxis-600 text-white text-xs font-bold hover:bg-praxis-700 whitespace-nowrap"
        >
          {tr(h.knopf)}
        </Link>
      )}
    </div>
  )
}

// ------------------------------------------------------- Dialog: Zuweisen
//
// Plan 3.2 „Aufgaben erteilen – ein Zug, drei Tipps": Bereich wählen,
// Schritte anhaken, ZUWEISEN schreibt 1 Einsatz + n Aufgaben-Patches in
// EINEM Vorgang (store.schreibeVorgang). Keine Blockaden, Zeiten frei.
function ZuweisenDialog({ vorgabe, offene, arbeitsschritte, lvpositionen, onClose, onOk }) {
  useLang()
  const [projektId, setProjektId] = useState(vorgabe.projektId || '')
  const [dauer, setDauer] = useState(1)
  const [von, setVon] = useState('07:00')
  const [bis, setBis] = useState('16:00')
  const [bereich, setBereich] = useState('')
  const [schrittIds, setSchrittIds] = useState(() => new Set())
  const [hinweis, setHinweis] = useState('')
  const [fehler, setFehler] = useState('')

  const projekt = offene.find((p) => p.id === projektId)
  const raeume = useWhere('raeume', 'projektId', projektId)
  const aufgaben = useWhere('aufgaben', 'projektId', projektId)
  const bereiche = useMemo(
    () => [...new Set(raeume.filter((r) => r.aktiv !== false).map((r) => r.bereich).filter(Boolean))],
    [raeume]
  )
  const tage = useMemo(() => einsatzTage(vorgabe.tag, dauer), [vorgabe.tag, dauer])
  const schritte = useMemo(
    () => arbeitsschritte.filter((s) => s.aktiv !== false).sort((a, b) => parseZahl(a.sort) - parseZahl(b.sort)),
    [arbeitsschritte]
  )
  const offenJeSchritt = (sid) => aufgaben
    .filter((a) => (!bereich || a.bereich === bereich) && a.schrittId === sid && !istFertigStatus(a.status)).length
  const kandidaten = useMemo(
    () => aufgaben.filter((a) => (!bereich || a.bereich === bereich)
      && schrittIds.has(a.schrittId) && !istFertigStatus(a.status)),
    [aufgaben, bereich, schrittIds]
  )
  const vorschau = useMemo(() => {
    if (!projekt || !schrittIds.size || !kandidaten.length) return null
    const namen = schritte.filter((s) => schrittIds.has(s.id)).map((s) => s.nameDe)
    try {
      return zuweisungBauen({
        projekt,
        teamId: vorgabe.teamName,
        teamName: vorgabe.teamName,
        farbe: vorgabe.farbe,
        mitarbeiterIds: vorgabe.mitarbeiterIds,
        tage,
        von,
        bis,
        titel: [bereich, namen.join(' + ')].filter(Boolean).join(' · '),
        hinweis,
        kandidaten,
      })
    } catch (e) {
      return null
    }
  }, [projekt, schrittIds, kandidaten, tage, von, bis, bereich, hinweis, vorgabe, schritte])

  function umschalten(sid) {
    setSchrittIds((alt) => {
      const neu = new Set(alt)
      if (neu.has(sid)) neu.delete(sid)
      else neu.add(sid)
      return neu
    })
  }

  async function zuweisen() {
    if (!vorschau) return
    try {
      await withStore((s) => s.schreibeVorgang({
        sets: [{ coll: 'einsaetze', daten: vorschau.einsatz }],
        patches: vorschau.patches,
      }, { onFehler: (e) => setFehler(t('lt.vorgangFehler', { text: e.message || '' })) }))
      onOk(t('lt.zugewiesenOk', { n: vorschau.zusammenfassung.anzahl }))
    } catch (e) {
      setFehler(t('lt.vorgangFehler', { text: e.message || '' }))
    }
  }

  return (
    <Modal titel={`${vorgabe.teamName} → ${datumLok(vorgabe.tag, KURZ)}`} icon="calendar" onClose={onClose}
      fuss={(
        <div className="flex items-center gap-3 w-full">
          <p className="flex-1 text-sm font-bold text-schrift-stark" dir="ltr">
            {vorschau
              ? t('lt.zusammenfassung', {
                  n: vorschau.zusammenfassung.anzahl,
                  m2: zahlText(vorschau.zusammenfassung.m2),
                  euro: euro(vorschau.zusammenfassung.wertCent / 100),
                })
              : (projektId && schrittIds.size > 0 ? t('lt.keineKandidaten') : '')}
          </p>
          <button onClick={onClose} className={S.BTN_ZWEIT}>{t('allg.abbrechen')}</button>
          <button onClick={zuweisen} disabled={!vorschau} className={S.BTN_PRIMAER}>{t('lt.zuweisen')}</button>
        </div>
      )}
    >
      <div className="space-y-4">
        <div>
          <label className={S.LABEL}>{t('lt.baustelle')}</label>
          <select className={S.SELECT} value={projektId} onChange={(e) => { setProjektId(e.target.value); setBereich(''); setSchrittIds(new Set()) }}>
            <option value="">–</option>
            {offene.map((p) => <option key={p.id} value={p.id}>{p.nummer ? `${p.nummer} · ` : ''}{p.name}</option>)}
          </select>
        </div>
        <div className={S.FELD_REIHE}>
          <div>
            <label className={S.LABEL}>{t('lt.dauer')}</label>
            <select className={S.SELECT} value={dauer} onChange={(e) => setDauer(parseZahl(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className={S.LABEL}>{t('allg.von')} / {t('allg.bis')}</label>
            <div className="flex gap-2" dir="ltr">
              <input type="time" className={S.FELD} value={von} onChange={(e) => setVon(e.target.value)} />
              <input type="time" className={S.FELD} value={bis} onChange={(e) => setBis(e.target.value)} />
            </div>
          </div>
        </div>
        {bereiche.length > 0 && (
          <div>
            <label className={S.LABEL}>{t('lt.bereich')}</label>
            <select className={S.SELECT} value={bereich} onChange={(e) => setBereich(e.target.value)}>
              <option value="">{t('lt.alleBereiche')}</option>
              {bereiche.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className={S.LABEL}>{t('lt.schritte')}</label>
          <div className="grid sm:grid-cols-2 gap-2">
            {schritte.map((s) => {
              const n = offenJeSchritt(s.id)
              const an = schrittIds.has(s.id)
              return (
                <button
                  key={s.id}
                  onClick={() => umschalten(s.id)}
                  disabled={n === 0}
                  className={`flex items-center gap-2 rounded-feld border px-3 py-2.5 text-sm text-start transition ${
                    an ? 'border-praxis-500 bg-praxis-50 text-praxis-800 font-bold' : 'border-rahmen text-schrift'
                  } disabled:opacity-40`}
                >
                  <span className="w-4 text-center">{an ? '☑' : '☐'}</span>
                  <span className="flex-1 min-w-0 truncate">{tr({ de: s.nameDe, ar: s.nameAr })}</span>
                  <span className="text-xs text-schrift-zart zahl">{n}</span>
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <label className={S.LABEL}>{t('allg.kommentar')}</label>
          <input className={S.FELD} value={hinweis} onChange={(e) => setHinweis(e.target.value)} />
        </div>
        {fehler && <Meldung art="fehler">{fehler}</Meldung>}
      </div>
    </Modal>
  )
}

// ------------------------------------------------- Dialog: Schnellanlage
//
// Raumliste als Text einfügen („1.01 Flur 24"), Schrittvorlage wählen →
// Räume + Aufgaben in EINEM Vorgang. Jede fehlerhafte Zeile wird MIT Zeile,
// Feld und Originalwert gemeldet – nie still 0 (Plan AP 7).
function SchnellanlageDialog({ vorgabeProjektId, offene, arbeitsschritte, lvpositionen, onClose, onOk }) {
  useLang()
  const [projektId, setProjektId] = useState(vorgabeProjektId || offene[0]?.id || '')
  const [text, setText] = useState('')
  const [bereich, setBereich] = useState('')
  const [schrittIds, setSchrittIds] = useState(() => new Set())
  const [posJeSchritt, setPosJeSchritt] = useState({})
  const [fehler, setFehler] = useState('')

  const projekt = offene.find((p) => p.id === projektId)
  const raeume = useWhere('raeume', 'projektId', projektId)
  const positionen = useMemo(
    () => lvpositionen.filter((p) => p.projektId === projektId && p.typ === 'position'),
    [lvpositionen, projektId]
  )
  const schritte = useMemo(
    () => arbeitsschritte.filter((s) => s.aktiv !== false).sort((a, b) => parseZahl(a.sort) - parseZahl(b.sort)),
    [arbeitsschritte]
  )
  const parse = useMemo(
    () => parseRaumliste(text, { vorhandeneNummern: raeume.map((r) => r.nummer) }),
    [text, raeume]
  )
  const gewaehlt = schritte.filter((s) => schrittIds.has(s.id))
  const vorschau = useMemo(() => {
    if (!projekt || !parse.zeilen.length || !gewaehlt.length) return null
    const positionenJeSchritt = {}
    for (const s of gewaehlt) {
      const pos = positionen.find((p) => p.id === posJeSchritt[s.id])
      if (pos) positionenJeSchritt[s.id] = pos
    }
    try {
      return schnellanlageBauen({
        projekt,
        zeilen: parse.zeilen,
        schritte: gewaehlt,
        positionenJeSchritt,
        bereich,
        sortStart: raeume.reduce((max, r) => Math.max(max, parseZahl(r.sort)), 0),
      })
    } catch (e) {
      return null
    }
  }, [projekt, parse, gewaehlt, posJeSchritt, bereich, positionen, raeume])

  const feldText = { zeile: 'lt.feldZeile', menge: 'lt.feldMenge', nummer: 'lt.feldNummer' }

  function umschalten(sid) {
    setSchrittIds((alt) => {
      const neu = new Set(alt)
      if (neu.has(sid)) neu.delete(sid)
      else neu.add(sid)
      return neu
    })
  }

  async function anlegen() {
    if (!vorschau) return
    try {
      await withStore((s) => s.schreibeVorgang({
        sets: [
          ...vorschau.raeume.map((d) => ({ coll: 'raeume', daten: d })),
          ...vorschau.aufgaben.map((d) => ({ coll: 'aufgaben', daten: d })),
        ],
        kennzahlen: vorschau.kennzahlen,
      }, { onFehler: (e) => setFehler(t('lt.vorgangFehler', { text: e.message || '' })) }))
      onOk(t('lt.angelegtOk', { r: vorschau.raeume.length, n: vorschau.aufgaben.length }))
    } catch (e) {
      setFehler(t('lt.vorgangFehler', { text: e.message || '' }))
    }
  }

  return (
    <Modal titel={t('lt.schnellanlage')} icon="raum" onClose={onClose} breite="max-w-2xl"
      fuss={(
        <div className="flex items-center gap-3 w-full">
          <p className="flex-1 text-sm font-bold text-schrift-stark" dir="ltr">
            {vorschau && t('lt.anlegenZusammen', {
              r: vorschau.raeume.length,
              n: vorschau.aufgaben.length,
              m2: zahlText(vorschau.kennzahlen.deltas.m2Gesamt),
              euro: euro(vorschau.kennzahlen.deltas.wertGesamtCent / 100),
            })}
          </p>
          <button onClick={onClose} className={S.BTN_ZWEIT}>{t('allg.abbrechen')}</button>
          <button onClick={anlegen} disabled={!vorschau || parse.fehler.length > 0} className={S.BTN_PRIMAER}>
            {t('lt.anlegen')}
          </button>
        </div>
      )}
    >
      <div className="space-y-4">
        <div className={S.FELD_REIHE}>
          <div>
            <label className={S.LABEL}>{t('lt.baustelle')}</label>
            <select className={S.SELECT} value={projektId} onChange={(e) => { setProjektId(e.target.value); setPosJeSchritt({}) }}>
              {offene.map((p) => <option key={p.id} value={p.id}>{p.nummer ? `${p.nummer} · ` : ''}{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className={S.LABEL}>{t('lt.bereich')}</label>
            <input className={S.FELD} value={bereich} onChange={(e) => setBereich(e.target.value)} placeholder="1. OG" />
          </div>
        </div>
        <div>
          <label className={S.LABEL}>{t('lt.raumliste')}</label>
          <textarea
            className={`${S.TEXTAREA} font-mono`}
            dir="ltr"
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'1.01 Flur 24\n1.02 Büro 38\n1.03 Besprechung 52'}
          />
        </div>
        {parse.fehler.length > 0 && (
          <div className="border border-red-200 bg-red-50 rounded-feld px-4 py-3">
            <p className="text-sm font-bold text-red-800 mb-1">
              {t('lt.fehlerUeberschrift', { n: parse.fehler.length })}
            </p>
            <ul className="space-y-0.5">
              {parse.fehler.map((f) => (
                <li key={`${f.zeile}-${f.feld}`} className="text-[13px] text-red-700">
                  {t('lt.fehlerZeile', { zeile: f.zeile, feld: t(feldText[f.feld] || 'lt.feldZeile'), wert: f.wert })}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <label className={S.LABEL}>{t('lt.schritte')}</label>
          <div className="space-y-2">
            {schritte.map((s) => {
              const an = schrittIds.has(s.id)
              return (
                <div key={s.id} className={`rounded-feld border px-3 py-2 ${an ? 'border-praxis-500 bg-praxis-50' : 'border-rahmen'}`}>
                  <div className="flex items-center gap-2">
                    <button onClick={() => umschalten(s.id)} className="flex items-center gap-2 flex-1 min-w-0 text-start text-sm font-semibold text-schrift-stark">
                      <span className="w-4 text-center">{an ? '☑' : '☐'}</span>
                      <span className="truncate">{tr({ de: s.nameDe, ar: s.nameAr })}</span>
                    </button>
                    {an && (
                      <select
                        className={`${S.SELECT_S} max-w-56`}
                        value={posJeSchritt[s.id] || ''}
                        onChange={(e) => setPosJeSchritt((alt) => ({ ...alt, [s.id]: e.target.value }))}
                      >
                        <option value="">{t('lt.ohneLv')}</option>
                        {positionen.map((p) => (
                          <option key={p.id} value={p.id}>{p.oz ? `${p.oz} · ` : ''}{p.kurztext}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        {fehler && <Meldung art="fehler">{fehler}</Meldung>}
      </div>
    </Modal>
  )
}

// ------------------------------------------------------------- Leitstand

export default function Uebersicht({ user }) {
  useLang()
  const navigate = useNavigate()
  const heute = heuteISO()

  const projekte = useCollection('projekte')
  const users = useCollection('users')
  const berichte = useCollection('berichte')
  const requests = useCollection('requests')
  const lvpositionen = useCollection('lvpositionen')
  const regieanordnungen = useCollection('regieanordnungen')
  const geraete = useCollection('geraete')
  const arbeitsschritte = useCollection('arbeitsschritte')

  const tage = useMemo(() => wochenTage(heute), [heute])
  const alleTage = useMemo(() => (tage.includes(heute) ? tage : [heute, ...tage]), [tage, heute])
  const einsaetze = useEinsaetzeTage(alleTage)
  const einsaetzeHeute = useMemo(
    () => einsaetze.filter((e) => e.status !== 'abgesagt' && (e.tage || []).includes(heute)),
    [einsaetze, heute]
  )

  const offene = useMemo(() => projekte.filter((p) => istOffen(p.status)), [projekte])
  const kennzahlen = useKennzahlenListe(useMemo(() => offene.map((p) => p.id), [offene]))
  const teams = useMemo(() => teamsAus(users), [users])

  const [zuweisung, setZuweisung] = useState(null)   // { teamName, farbe, mitarbeiterIds, tag, projektId? }
  const [schnell, setSchnell] = useState(null)       // { projektId? }
  const [meldung, setMeldung] = useState('')

  useEffect(() => {
    if (!meldung) return undefined
    const uhr = setTimeout(() => setMeldung(''), 6000)
    return () => clearTimeout(uhr)
  }, [meldung])

  // Band 2: WAS HAKT – Stockungserkennung (neu) + die bewährten Büro-Schritte.
  const handlungen = useMemo(() => {
    const leitstand = schritteLeitstand({
      teams, einsaetzeHeute, regieanordnungen, lvpositionen, projekte, geraete, kennzahlen, users,
    })
    const klassisch = schritteBuero({ projekte, lvpositionen, berichte, requests, users })
    return [...leitstand, ...klassisch].sort((a, b) => a.stufe - b.stufe).slice(0, 7)
  }, [teams, einsaetzeHeute, regieanordnungen, lvpositionen, projekte, geraete, kennzahlen, users, berichte, requests])

  // Band 4: Baustellen ohne Kolonne diese Woche
  const ohneKolonne = useMemo(() => {
    const versorgt = new Set(einsaetze
      .filter((e) => e.status !== 'abgesagt' && (e.tage || []).some((tg) => tage.includes(tg)))
      .map((e) => e.projektId))
    return offene.filter((p) => !versorgt.has(p.id))
  }, [einsaetze, offene, tage])

  const kzVon = (projektId) => kennzahlen.find((k) => k.id === projektId)

  function zelleEinsaetze(team, tag) {
    return einsaetze.filter((e) => e.status !== 'abgesagt' && (e.tage || []).includes(tag) && gehoertZuTeam(e, team))
  }

  function aufDrop(e, team, tag) {
    e.preventDefault()
    const projektId = e.dataTransfer.getData('text/plain')
    setZuweisung({ teamName: team.name, farbe: team.farbe, mitarbeiterIds: team.mitglieder.map((m) => m.id), tag, projektId: projektId || '' })
  }

  return (
    <div className={S.SEITE}>
      <Seitenkopf icon="home" titel={t('nav.uebersicht')} sub={t('lt.sub')}>
        <div className={S.KOPF_AKTION}>
          <button onClick={() => setSchnell({})} className={S.BTN_ZWEIT}>
            <Icon name="raum" groesse="s" /> {t('lt.schnellanlage')}
          </button>
        </div>
      </Seitenkopf>

      {meldung && <div className="mb-4"><Meldung art="erfolg">{meldung}</Meldung></div>}

      {/* ---------------- Band 1: HEUTE ---------------- */}
      <section className="mb-6">
        <BandTitel nr="1" schluessel="lt.heute" />
        <div className={`${S.KARTE} divide-y divide-rahmen`}>
          {teams.map((team) => {
            const einsatz = einsaetzeHeute.find((e) => gehoertZuTeam(e, team))
            const projekt = projekte.find((p) => p.id === einsatz?.projektId)
            return (
              <div key={team.name} className="flex items-center gap-3 px-4 py-3">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: team.farbe }} />
                <span className="w-28 shrink-0 font-bold text-sm text-schrift-stark truncate">{team.name}</span>
                {einsatz ? (
                  <>
                    <span className="flex-1 min-w-0 text-sm text-schrift truncate">
                      {projekt?.name || einsatz.projektName}{einsatz.titel ? ` · ${einsatz.titel}` : ''}
                    </span>
                    <span className="text-xs text-schrift-leise shrink-0">
                      {t('lt.mann', { n: (einsatz.mitarbeiterIds || []).length || team.mitglieder.length })}
                    </span>
                    <span className="text-xs text-schrift-leise shrink-0" dir="ltr">{einsatz.von}–{einsatz.bis}</span>
                    <Link to={`/projekte/${einsatz.projektId}`} className={S.BTN_ICON} aria-label={t('allg.ansehen')}>
                      <Icon name="arrowRight" groesse="s" />
                    </Link>
                  </>
                ) : (
                  <>
                    <span className="flex-1 min-w-0 text-sm text-schrift-zart">{t('lt.keinEinsatz')}</span>
                    <span className={S.CHIP_WARN}>⚠ {t('lt.mannFrei', { n: team.mitglieder.length })}</span>
                    <button
                      onClick={() => document.getElementById('wochentafel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                      className={S.BTN_ZWEIT_S}
                    >
                      {t('lt.einplanen')}
                    </button>
                  </>
                )}
              </div>
            )
          })}
          {teams.length === 0 && (
            <p className="px-4 py-3 text-sm text-schrift-leise">{t('allg.keineTreffer')}</p>
          )}
        </div>
      </section>

      {/* ---------------- Band 2: WAS HAKT ---------------- */}
      <section className="mb-6">
        <BandTitel nr="2" schluessel="lt.wasHakt" />
        {handlungen.length > 0 ? (
          <div className="space-y-2">
            {handlungen.map((h) => <Handlung key={h.id} h={h} />)}
          </div>
        ) : (
          <div className="flex items-center gap-3 border border-emerald-200 bg-emerald-50 rounded-feld px-4 py-3">
            <Icon name="erfolg" className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-sm font-semibold text-emerald-800">{t('lt.nichtsDringend')}</p>
          </div>
        )}
      </section>

      {/* ---------------- Band 3: BAUSTELLEN ---------------- */}
      <section className="mb-6">
        <BandTitel nr="3" schluessel="lt.baustellen" />
        <div className={S.TAB_HUELLE}>
          <div className={S.TAB_SCROLL}>
            <table className={S.TAB}>
              <thead>
                <tr>
                  <th className={S.TH}>{t('lt.baustelle')}</th>
                  <th className={S.TH}>{t('lt.leistung')}</th>
                  <th className={S.TH}>{t('lt.flaeche')}</th>
                  <th className={S.TH}>{t('lt.raeumeSp')}</th>
                  <th className={S.TH}>{t('lt.fotoSp')}</th>
                  <th className={`${S.TH} text-right`}>{t('lt.gebautOffen')}</th>
                  <th className={S.TH} />
                </tr>
              </thead>
              <tbody>
                {offene.map((p) => {
                  const kz = kzVon(p.id)
                  const gesamtCent = Math.round(parseZahl(kz?.wertGesamtCent))
                  const fertigCent = Math.round(parseZahl(kz?.wertFertigCent))
                  const prozent = gesamtCent > 0 ? Math.round((fertigCent / gesamtCent) * 100) : 0
                  const offenCent = Math.max(0, fertigCent - Math.round(parseZahl(kz?.abgerechnetCent)))
                  const ohneVorher = Math.round(parseZahl(kz?.raeumeOhneVorher))
                  return (
                    <tr
                      key={p.id}
                      className={S.TR}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', p.id)
                        e.dataTransfer.effectAllowed = 'copy'
                      }}
                      onClick={() => navigate(`/projekte/${p.id}`)}
                      title={t('lt.ziehenHinweis')}
                    >
                      <td className={S.TD_STARK}>
                        {p.nummer && <span className="text-schrift-zart font-normal me-1.5 zahl">{p.nummer}</span>}
                        {p.name}
                      </td>
                      <td className={S.TD}>
                        {kz && gesamtCent > 0 ? (
                          <span className="inline-flex items-center gap-2" dir="ltr">
                            <span className="inline-block w-24 h-2 rounded-full bg-gedeckt-tief overflow-hidden">
                              <span className="block h-full bg-praxis-600" style={{ width: `${Math.min(100, prozent)}%` }} />
                            </span>
                            <span className="text-xs font-bold text-schrift-stark zahl">{prozent} %</span>
                          </span>
                        ) : (
                          <span className="text-xs text-schrift-zart">{t('lt.keineKennzahlen')}</span>
                        )}
                      </td>
                      <td className={S.TD} dir="ltr">
                        {kz ? `${zahlText(parseZahl(kz.m2Fertig))}/${zahlText(parseZahl(kz.m2Gesamt))} m²` : '–'}
                      </td>
                      <td className={S.TD} dir="ltr">
                        {kz ? `${Math.round(parseZahl(kz.raeumeFertig))}/${Math.round(parseZahl(kz.raeumeGesamt))}` : '–'}
                      </td>
                      <td className={S.TD}>
                        {ohneVorher > 0 ? (
                          <Link
                            to={`/fotoampel?projekt=${p.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className={S.CHIP_WARN}
                          >
                            ⚠ {ohneVorher}
                          </Link>
                        ) : (
                          <span className="text-emerald-600 font-bold">✓</span>
                        )}
                      </td>
                      <td className={S.TD_ZAHL} dir="ltr">
                        {kz ? `${euro(fertigCent / 100)} / ${euro(offenCent / 100)}` : '–'}
                      </td>
                      <td className={`${S.TD} w-12`}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSchnell({ projektId: p.id }) }}
                          className={S.BTN_ICON}
                          aria-label={t('lt.schnellanlage')}
                          title={t('lt.schnellanlage')}
                        >
                          <Icon name="raum" groesse="s" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {offene.length === 0 && (
                  <tr><td className={S.TD_LEISE} colSpan={7}>{t('lt.keineBaustellen')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ---------------- Band 4: WOCHENTAFEL ---------------- */}
      <section id="wochentafel" className="mb-6 scroll-mt-4">
        <BandTitel nr="4" schluessel="lt.wochentafel" />
        <div className={S.TAB_HUELLE}>
          <div className={S.TAB_SCROLL}>
            <table className={S.TAB}>
              <thead>
                <tr>
                  <th className={S.TH} />
                  {tage.map((tag) => (
                    <th key={tag} className={`${S.TH} ${tag === heute ? 'text-praxis-700' : ''}`}>
                      {datumLok(tag, KURZ)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teams.map((team) => (
                  <tr key={team.name} className="border-b border-rahmen last:border-0">
                    <td className={`${S.TD_STARK} whitespace-nowrap`}>
                      <span className="inline-block w-2.5 h-2.5 rounded-full me-2" style={{ background: team.farbe }} />
                      {team.name}
                    </td>
                    {tage.map((tag) => {
                      const zelle = zelleEinsaetze(team, tag)
                      return (
                        <td
                          key={tag}
                          className="px-1.5 py-1.5 align-top min-w-32"
                          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
                          onDrop={(e) => aufDrop(e, team, tag)}
                        >
                          <div className="space-y-1">
                            {zelle.map((e) => (
                              <button
                                key={e.id}
                                onClick={() => e.projektId && navigate(`/projekte/${e.projektId}`)}
                                className="w-full text-start rounded-feld px-2 py-1.5 text-[12px] font-bold leading-tight truncate"
                                style={{ background: e.farbe || team.farbe, color: textAuf(e.farbe || team.farbe) }}
                                title={`${e.projektName}${e.titel ? ` · ${e.titel}` : ''}`}
                              >
                                {e.projektName}
                              </button>
                            ))}
                            <button
                              onClick={() => setZuweisung({ teamName: team.name, farbe: team.farbe, mitarbeiterIds: team.mitglieder.map((m) => m.id), tag })}
                              className="w-full rounded-feld border border-dashed border-rahmen-stark text-schrift-zart hover:text-praxis-600 hover:border-praxis-400 text-sm py-1"
                              aria-label={t('lt.einplanen')}
                            >
                              +
                            </button>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {ohneKolonne.length > 0 && (
            <p className="px-4 py-3 border-t border-rahmen text-sm text-schrift">
              <span className="font-bold">{t('lt.ohneKolonne')}</span>{' '}
              {ohneKolonne.map((p, i) => (
                <span key={p.id}>
                  {i > 0 && ' · '}
                  <Link to={`/projekte/${p.id}`} className="text-praxis-700 hover:underline">
                    {p.name}
                  </Link>
                  {p.endeDatum && <span className="text-amber-600"> ({datumLok(p.endeDatum, KURZ)} ⚠)</span>}
                </span>
              ))}
            </p>
          )}
          <p className="px-4 py-2.5 border-t border-rahmen text-[12px] text-schrift-zart">{t('lt.ziehenHinweis')}</p>
        </div>
      </section>

      {zuweisung && (
        <ZuweisenDialog
          vorgabe={zuweisung}
          offene={offene}
          arbeitsschritte={arbeitsschritte}
          lvpositionen={lvpositionen}
          onClose={() => setZuweisung(null)}
          onOk={(text2) => { setZuweisung(null); setMeldung(text2) }}
        />
      )}
      {schnell && (
        <SchnellanlageDialog
          vorgabeProjektId={schnell.projektId}
          offene={offene}
          arbeitsschritte={arbeitsschritte}
          lvpositionen={lvpositionen}
          onClose={() => setSchnell(null)}
          onOk={(text2) => { setSchnell(null); setMeldung(text2) }}
        />
      )}
    </div>
  )
}
