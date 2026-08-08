import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@shared/ui.jsx'
import { t, useLang, datumLok } from '@shared/i18n.js'
import { heuteISO } from '@shared/slots.js'
import { istMonteurRolle, istVorarbeiterRolle } from '@shared/auth.js'
import { istOffen } from '@shared/projektstatus.js'
import { zahlText } from '@shared/aufmass.js'
import {
  einsatzFuerTag, minutenVon, zeitText, stundenAus, taetigkeitAusAufgaben, stundenZeile,
} from '@shared/monteurtag.js'
import { useCollection, useWhere, useContains, withStore } from '../../hooks.js'

// STUNDEN als Kolonnenzeile (Plan Kapitel 3.1, Bildschirm 4 – der größte
// Zeitgewinn): Datum, Baustelle, Mannschaft, Von/Bis und Art kommen aus dem
// Einsatz, die Tätigkeit wird aus den heute gemeldeten Schritten ERZEUGT
// (Pflichttext § 15 Abs. 3 VOB/B). 2 Tipps für drei Mann.
//
// Wer darf senden: NUR Vorarbeiter und Büro schicken die ganze Kolonne.
// Jeder andere sieht seine eigene Zeile vorbelegt und sendet nur sie.
// Die Zeile hat die feste Kennung std-<userId>-<datum>-<projektId>-<art>
// und wird per set() geschrieben – der letzte gewinnt BEWUSST und SICHTBAR
// („zuletzt geändert 16:20 · Samir").
//
// Bedienregel: keine tippbare Zahl – Zeiten und Pause laufen über ±15-Minuten-
// Stufen, nur der Tätigkeitstext ist (auf Wunsch) frei änderbar.

const KURZDATUM = { weekday: 'short', day: '2-digit', month: '2-digit' }

function uhrzeitVon(ms) {
  return new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

// ±15-Minuten-Stufe: [−] 07:00 [+]
function ZeitStufe({ beschriftung, wert, onWert, min = 0, max = 24 * 60 }) {
  const minuten = minutenVon(wert)
  const setze = (delta) => {
    const neu = Math.min(max, Math.max(min, minuten + delta))
    onWert(zeitText(neu))
  }
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-400 w-10">{beschriftung}</span>
      <button onClick={() => setze(-15)} className="w-11 min-h-11 rounded-xl border border-slate-200 font-black text-slate-600">−</button>
      <span className="w-16 text-center font-bold text-slate-900" dir="ltr">{wert}</span>
      <button onClick={() => setze(15)} className="w-11 min-h-11 rounded-xl border border-slate-200 font-black text-slate-600">+</button>
    </div>
  )
}

export default function StundenKachel({ user }) {
  useLang()
  const navigate = useNavigate()
  const heute = heuteISO()

  const einsaetze = useContains('einsaetze', 'tage', heute)
  const einsatz = useMemo(
    () => einsatzFuerTag(einsaetze, user, heute, { alleSehen: !istMonteurRolle(user?.rolle) }),
    [einsaetze, user, heute]
  )
  const projekte = useCollection('projekte')
  const users = useCollection('users')
  const [projektWahl, setProjektWahl] = useState('')
  const projektId = einsatz?.projektId || projektWahl
  const projekt = projekte.find((p) => p.id === projektId)
  const alleAufgaben = useWhere('aufgaben', 'projektId', projektId)
  const anordnungen = useWhere('regieanordnungen', 'projektId', projektId)
  const stundenHeute = useWhere('stunden', 'datum', heute)

  const [art, setArt] = useState('auftrag')
  const [von, setVon] = useState('07:00')
  const [bis, setBis] = useState('16:00')
  const [pauseMin, setPauseMin] = useState(30)
  const [gewaehlt, setGewaehlt] = useState(() => new Set())
  const [taetigkeitManuell, setTaetigkeitManuell] = useState(null)
  const [anordnungId, setAnordnungId] = useState('')
  const [quittung, setQuittung] = useState('')

  const darfKolonne = !istMonteurRolle(user?.rolle) || istVorarbeiterRolle(user?.rolle)

  // Mannschaft aus dem Einsatz; ohne Einsatz nur die eigene Person.
  const mannschaft = useMemo(() => {
    const ids = einsatz?.mitarbeiterIds?.length ? einsatz.mitarbeiterIds : [user?.userId].filter(Boolean)
    return ids
      .map((id) => users.find((u) => u.id === id) || (id === user?.userId ? { id, name: user?.name || '' } : null))
      .filter(Boolean)
  }, [einsatz, users, user])

  // Vorbelegung aus dem Einsatz – und die ganze Kolonne angehakt (nur wer
  // senden darf, kann fremde Haken ändern).
  useEffect(() => {
    if (einsatz?.von) setVon(einsatz.von)
    if (einsatz?.bis) setBis(einsatz.bis)
    setGewaehlt(new Set(darfKolonne
      ? (einsatz?.mitarbeiterIds || [user?.userId].filter(Boolean))
      : [user?.userId].filter(Boolean)))
  }, [einsatz?.id, darfKolonne, user?.userId]) // eslint-disable-line react-hooks/exhaustive-deps

  const anordnung = anordnungen.find((a) => a.id === anordnungId)
  const erzeugteTaetigkeit = art === 'regie'
    ? [anordnung?.titel, anordnung?.beschreibung].filter(Boolean).join(' – ')
    : taetigkeitAusAufgaben(alleAufgaben, heute)
  const taetigkeit = taetigkeitManuell ?? erzeugteTaetigkeit
  const stunden = stundenAus(von, bis, pauseMin)

  // „zuletzt geändert" – sichtbar machen, wer die Kolonnenzeile zuletzt schrieb.
  const letzte = useMemo(() => {
    const passend = stundenHeute
      .filter((s) => s.projektId === projektId && s.art === art)
      .sort((a, b) => (b.zuletztGeaendertAm || 0) - (a.zuletztGeaendertAm || 0))
    return passend[0] || null
  }, [stundenHeute, projektId, art])

  function haken(id) {
    if (!darfKolonne && id !== user?.userId) return
    setGewaehlt((alt) => {
      const neu = new Set(alt)
      if (neu.has(id)) neu.delete(id)
      else neu.add(id)
      return neu
    })
  }

  async function bestaetigen() {
    if (!projektId || stunden <= 0) return
    if (art === 'regie' && !anordnungId) { setQuittung(t('mt.keineAnordnung')); return }
    const ziel = mannschaft.filter((m) => gewaehlt.has(m.id) && (darfKolonne || m.id === user?.userId))
    if (!ziel.length) return
    // EIN Vorgang (writeBatch) statt await-Schleife: Offline löst ein
    // einzelnes setDoc erst bei Server-Bestätigung auf – der erste await
    // hinge für immer, nur ein Teil der Kolonnenzeilen läge in der
    // Warteschlange und die Quittung käme nie (Heimweg-Fall). schreibeVorgang
    // quittiert nach spätestens 2500 ms und schreibt ALLE Zeilen zusammen.
    // Deterministische Kennungen machen den Vorgang idempotent – ein
    // Wiederholen ERSETZT statt zu verdoppeln (set()-Verhalten, beide Modi).
    const sets = ziel.map((mitglied) => ({
      coll: 'stunden',
      daten: stundenZeile({
        mitglied,
        datum: heute,
        projektId,
        einsatzId: einsatz?.id || '',
        teamId: einsatz?.teamId || '',
        von,
        bis,
        pauseMin,
        art,
        taetigkeit,
        anordnungId: art === 'regie' ? anordnungId : '',
        geaendertVon: user?.name || '',
      }),
    }))
    try {
      await withStore((s) => s.schreibeVorgang({ sets }, { onFehler: () => setQuittung(t('mt.meldungFehler')) }))
    } catch (e) {
      setQuittung(t('mt.meldungFehler'))
      return
    }
    setQuittung(t('mt.stundenGesendet'))
    setTimeout(() => setQuittung(''), 4000)
  }

  // Ohne Einsatz: Baustelle wählen (offene Projekte), dann dieselbe Kachel.
  if (!projektId) {
    const offene = projekte.filter((p) => istOffen(p.status))
    return (
      <div className="p-4 space-y-3 pb-24">
        <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-2xl px-4 py-3">
          {t('mt.keinEinsatz')} {t('mt.baustelleWaehlen')}:
        </p>
        {offene.map((p) => (
          <button
            key={p.id}
            onClick={() => setProjektWahl(p.id)}
            className="w-full min-h-16 text-start bg-white rounded-2xl border border-slate-200 px-4 font-bold text-slate-800 active:bg-slate-50"
          >
            {p.name}
            <span className="block text-xs font-normal text-slate-400">{p.nummer}</span>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 pb-28">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{datumLok(heute, KURZDATUM)}</p>
          <p className="font-bold text-lg text-slate-900 leading-snug">{projekt?.name}</p>
        </div>

        {/* Art: Auftrag | Regie */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-2xl p-1">
          {[['auftrag', t('mt.artAuftrag')], ['regie', t('mt.artRegie')]].map(([id, beschriftung]) => (
            <button
              key={id}
              onClick={() => { setArt(id); setTaetigkeitManuell(null) }}
              className={`flex-1 min-h-12 rounded-xl text-sm font-bold ${art === id ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
            >
              {beschriftung}
            </button>
          ))}
        </div>

        {/* Regie braucht die Anordnung ZUERST (§ 2 Abs. 8 VOB/B) */}
        {art === 'regie' && (
          anordnungen.length ? (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{t('mt.anordnungWaehlen')}</p>
              {anordnungen.map((a) => (
                <button
                  key={a.id}
                  onClick={() => { setAnordnungId(a.id); setTaetigkeitManuell(null) }}
                  className={`w-full min-h-12 text-start rounded-xl border px-3 text-sm font-semibold ${anordnungId === a.id ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-slate-200 text-slate-600'}`}
                >
                  {a.titel || t('mt.artRegie')}
                  <span className="block text-xs font-normal text-slate-400">
                    {a.angeordnetDurch}{a.angeordnetAm ? ` · ${datumLok(a.angeordnetAm, KURZDATUM)}` : ''}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
              {t('mt.keineAnordnung')}
              <button
                onClick={() => navigate(`/monteur/regie?projekt=${projektId}`)}
                className="block mt-2 min-h-11 px-3 rounded-xl bg-amber-500 text-white font-bold"
              >
                {t('mt.regieMelden')}
              </button>
            </div>
          )
        )}

        {/* Von / Bis / Pause – ±15 Minuten, keine tippbare Zahl */}
        <div className="space-y-2">
          <ZeitStufe beschriftung={t('mt.von')} wert={von} onWert={setVon} />
          <ZeitStufe beschriftung={t('mt.bisZeit')} wert={bis} onWert={setBis} />
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-400 w-10">{t('mt.pause')}</span>
            <button onClick={() => setPauseMin((p) => Math.max(0, p - 15))} className="w-11 min-h-11 rounded-xl border border-slate-200 font-black text-slate-600">−</button>
            <span className="w-16 text-center font-bold text-slate-900" dir="ltr">{pauseMin} {t('mt.minKurz')}</span>
            <button onClick={() => setPauseMin((p) => p + 15)} className="w-11 min-h-11 rounded-xl border border-slate-200 font-black text-slate-600">+</button>
          </div>
        </div>

        {/* Mannschaft */}
        <div>
          {mannschaft.map((m) => {
            const an = gewaehlt.has(m.id)
            const sperrig = !darfKolonne && m.id !== user?.userId
            return (
              <button
                key={m.id}
                onClick={() => haken(m.id)}
                disabled={sperrig}
                className={`w-full min-h-14 flex items-center gap-3 border-b border-slate-100 last:border-b-0 px-1 text-start ${sperrig ? 'opacity-40' : ''}`}
              >
                <span className={`text-2xl leading-none ${an ? 'text-praxis-600' : 'text-slate-300'}`}>{an ? '☑' : '☐'}</span>
                <span className="flex-1 font-semibold text-slate-800">{m.name}</span>
                <span className="font-bold text-slate-900" dir="ltr">{an ? `${zahlText(stunden)} ${t('mt.stdKurz')}` : ''}</span>
              </button>
            )
          })}
          {!darfKolonne && (
            <p className="mt-2 text-[12px] text-slate-400">{t('mt.nurEigeneZeile')}</p>
          )}
        </div>

        {/* Tätigkeit: erzeugt aus den heute gemeldeten Schritten */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">
            {t('mt.taetigkeit')} <span className="normal-case font-normal">({taetigkeitManuell === null ? t('mt.erzeugt') : t('mt.aendern')})</span>
          </p>
          {taetigkeitManuell === null ? (
            <div className="flex items-start gap-2">
              <p className="flex-1 text-sm text-slate-700 bg-slate-50 rounded-xl px-3 py-2.5 min-h-11" dir="ltr">
                {taetigkeit || '—'}
              </p>
              <button
                onClick={() => setTaetigkeitManuell(taetigkeit)}
                className="min-h-11 px-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-600"
              >
                {t('mt.aendern')}
              </button>
            </div>
          ) : (
            <textarea
              value={taetigkeitManuell}
              onChange={(e) => setTaetigkeitManuell(e.target.value)}
              rows={2}
              dir="ltr"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          )}
        </div>

        <button
          onClick={bestaetigen}
          disabled={stunden <= 0 || gewaehlt.size === 0}
          className={`w-full min-h-14 rounded-2xl font-black text-base ${stunden > 0 && gewaehlt.size > 0 ? 'bg-praxis-600 text-white active:scale-[0.99]' : 'bg-slate-100 text-slate-400'}`}
        >
          ✓ {t('mt.bestaetigen')}
        </button>

        {letzte && (
          <p className="text-[12px] text-slate-400 text-center">
            {t('mt.zuletztGeaendert', { zeit: uhrzeitVon(letzte.zuletztGeaendertAm), name: letzte.zuletztGeaendertVon || letzte.name })}
          </p>
        )}
      </div>

      {/* Spesen bleiben erreichbar – sie sind aus der unteren Leiste gewichen */}
      <button
        onClick={() => navigate('/monteur/spesen')}
        className="w-full min-h-14 rounded-2xl border border-slate-200 bg-white font-bold text-slate-600 flex items-center justify-center gap-2"
      >
        <Icon name="spesen" className="w-5 h-5" /> {t('monteur.spesen')}
      </button>

      {quittung && (
        <div className="fixed bottom-20 left-3 right-3 z-50 bg-slate-800 text-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-lg">
          <span className="flex-1 text-sm font-semibold">{quittung}</span>
          <button onClick={() => setQuittung('')} aria-label={t('allg.schliessen')} className="min-h-11 px-2">
            <Icon name="x" className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
