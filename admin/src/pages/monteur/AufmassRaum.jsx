import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLang, t } from '@shared/i18n.js'
import { Icon } from '@shared/ui.jsx'
import { istVorarbeiterRolle } from '@shared/auth.js'
import { istOffen } from '@shared/projektstatus.js'
import { parseZahl } from '@shared/format.js'
import { heuteISO } from '@shared/slots.js'
import {
  regelwerkVon, raumAufmass, zahlText,
  TUER_BREITE_STD, TUER_HOEHE_STD, FENSTER_BREITE_STD, FENSTER_HOEHE_STD,
  LEIBUNG_TIEFE_TUER, LEIBUNG_TIEFE_FENSTER,
} from '@shared/aufmass.js'
import { useCollection, useWhere, withStore } from '../../hooks.js'

// Aufmaß-Bildschirm je Raum (Plan 3.1, Bildschirm 7): der EINZIGE Bildschirm
// mit Zahlenfeldern – nicht Teil des Tagesablaufs, nur Vorarbeiter und Büro.
// Er darf absichtlich langsam und ausführlich sein: einmal je Raum.
// Alle Eingaben laufen über parseZahl – Number("16,4") wäre NaN und würde
// still zu Null. Das Regelwerk kommt vom Projekt (Pflichtfeld) und wird nur
// ANGEZEIGT, nie hier gewählt.

const FELD = 'w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-base font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-praxis-500'

const STAND_FARBE = {
  geschaetzt: 'bg-red-100 text-red-700',
  gemessen: 'bg-sky-100 text-sky-700',
  bestaetigt: 'bg-emerald-100 text-emerald-700',
}

function neueOeffnung(art) {
  const tuer = art === 'tuer'
  return {
    id: `o-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    art,
    breite: String(tuer ? TUER_BREITE_STD : FENSTER_BREITE_STD).replace('.', ','),
    hoehe: String(tuer ? TUER_HOEHE_STD : FENSTER_HOEHE_STD).replace('.', ','),
    anzahl: '1',
    leibungstiefe: String(tuer ? LEIBUNG_TIEFE_TUER : LEIBUNG_TIEFE_FENSTER).replace('.', ','),
    leibungBeschichtet: true,
  }
}

function alsText(n) {
  if (n === undefined || n === null || n === 0 || n === '') return ''
  return String(n).replace('.', ',')
}

// Formular-Zustand aus dem Raum-Dokument (Zahlen als deutsche Texte).
function entwurfAus(raum) {
  return {
    laenge: alsText(raum.laenge),
    breite: alsText(raum.breite),
    grundflaeche: alsText(raum.grundflaeche),
    umfang: alsText(raum.umfang),
    umfangGemessen: raum.umfangGemessen === true,
    hoeheLicht: alsText(raum.hoeheLicht),
    aufbauBoden: raum.aufbauBoden === undefined || raum.aufbauBoden === null || raum.aufbauBoden === ''
      ? '' : String(raum.aufbauBoden).replace('.', ','),
    oeffnungen: (raum.oeffnungen || []).map((o) => ({
      id: o.id || `o-${Math.random().toString(36).slice(2, 9)}`,
      art: o.art || 'tuer',
      breite: alsText(o.breite),
      hoehe: alsText(o.hoehe),
      anzahl: String(o.anzahl || 1),
      leibungstiefe: alsText(o.leibungstiefe),
      leibungBeschichtet: o.leibungBeschichtet !== false,
    })),
    aufmassStand: raum.aufmassStand || 'geschaetzt',
  }
}

// Raum-Objekt für die Live-Rechnung (raumAufmass) aus dem Formular-Entwurf.
function raumAusEntwurf(raum, e) {
  return {
    ...raum,
    laenge: parseZahl(e.laenge),
    breite: parseZahl(e.breite),
    grundflaeche: parseZahl(e.grundflaeche),
    umfang: parseZahl(e.umfang),
    umfangGemessen: e.umfangGemessen,
    hoeheLicht: parseZahl(e.hoeheLicht),
    aufbauBoden: e.aufbauBoden === '' ? '' : parseZahl(e.aufbauBoden),
    oeffnungen: e.oeffnungen.map((o) => ({
      id: o.id,
      art: o.art,
      breite: parseZahl(o.breite),
      hoehe: parseZahl(o.hoehe),
      anzahl: Math.max(1, Math.round(parseZahl(o.anzahl) || 1)),
      leibungstiefe: parseZahl(o.leibungstiefe),
      leibungBeschichtet: o.leibungBeschichtet,
    })),
  }
}

function RaumFormular({ raum, projekt, user, onZurueck }) {
  const [e, setE] = useState(() => entwurfAus(raum))
  const [meldung, setMeldung] = useState(null)
  const rw = regelwerkVon(projekt?.abrechnungsregel)
  const istBuero = user?.rolle === 'admin'

  const live = useMemo(() => raumAufmass(raumAusEntwurf(raum, e), rw), [raum, e, rw])
  const setFeld = (feld, wert) => setE((alt) => ({ ...alt, [feld]: wert }))
  const setOeffnung = (id, feld, wert) => setE((alt) => ({
    ...alt,
    oeffnungen: alt.oeffnungen.map((o) => (o.id === id ? { ...o, [feld]: wert } : o)),
  }))

  function ausMassenRechnen() {
    const b = parseZahl(e.breite)
    const l = parseZahl(e.laenge)
    if (!(b > 0) || !(l > 0)) {
      setMeldung({ art: 'warnung', text: t('amr.erstMasse') })
      return
    }
    setE((alt) => ({
      ...alt,
      grundflaeche: zahlText(Math.round(b * l * 1000) / 1000),
      umfang: zahlText(Math.round(2 * (b + l) * 1000) / 1000),
      umfangGemessen: true,
    }))
  }

  const abrHoehe = Math.round((parseZahl(e.hoeheLicht) + (e.aufbauBoden === '' ? 0 : parseZahl(e.aufbauBoden))) * 1000) / 1000

  async function speichern() {
    setMeldung(null)
    const roh = raumAusEntwurf(raum, e)
    const patch = {
      laenge: roh.laenge,
      breite: roh.breite,
      grundflaeche: roh.grundflaeche,
      umfang: roh.umfang,
      umfangGemessen: roh.umfangGemessen,
      hoeheLicht: roh.hoeheLicht,
      aufbauBoden: roh.aufbauBoden,
      oeffnungen: roh.oeffnungen,
      aufmassStand: e.aufmassStand,
      aufmassVon: user?.name || '',
      aufmassAm: heuteISO(),
    }
    // Gemessene Flächen als Mengenvorgabe je Bezug mitschreiben – künftige
    // Aufgaben rechnen damit statt mit der alten Schätzung. Nur wenn wirklich
    // etwas herauskam: eine leere Rechnung darf keine Vorgabe überschreiben.
    if (rw && live.summen.wandUndLeibungen + live.summen.decke > 0) {
      patch.mengen = {
        ...(raum.mengen || {}),
        wanddecke: Math.round((live.summen.wand + live.summen.decke) * 1000) / 1000,
        leibung: live.summen.leibungen,
      }
    }
    try {
      await withStore((s) => s.update('raeume', raum.id, patch))
      setMeldung({ art: 'ok', text: t('amr.gespeichert') })
    } catch (err) {
      setMeldung({ art: 'gefahr', text: err.message })
    }
  }

  const radio = (feld, wert, label) => (
    <button
      onClick={() => setFeld(feld, wert)}
      className={`flex-1 py-2.5 rounded-xl text-sm font-bold ${e[feld] === wert ? 'bg-praxis-600 text-white' : 'bg-slate-100 text-slate-500'}`}
    >
      {label}
    </button>
  )

  return (
    <div className="p-4 pb-28 space-y-4">
      <button onClick={onZurueck} className="inline-flex items-center gap-1.5 text-sm font-bold text-praxis-700">
        ← {t('amr.zurueck')}
      </button>

      <div className="bg-white rounded-3xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="font-bold text-lg text-slate-900">{raum.nummer} {raum.name}</p>
          <span className={`text-[11px] font-bold rounded-full px-2.5 py-1 ${STAND_FARBE[e.aufmassStand] || STAND_FARBE.geschaetzt}`}>
            {t(`am.stand_${e.aufmassStand}`)}
          </span>
        </div>

        {/* Boden/Decke aus B × L */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[12px] font-bold text-slate-400 mb-1">{t('amr.laenge')} (m)</p>
            <input type="text" inputMode="decimal" dir="ltr" className={FELD} value={e.laenge} onChange={(ev) => setFeld('laenge', ev.target.value)} />
          </div>
          <div>
            <p className="text-[12px] font-bold text-slate-400 mb-1">{t('amr.breite')} (m)</p>
            <input type="text" inputMode="decimal" dir="ltr" className={FELD} value={e.breite} onChange={(ev) => setFeld('breite', ev.target.value)} />
          </div>
        </div>
        <button onClick={ausMassenRechnen} className="w-full py-2.5 rounded-2xl bg-praxis-50 text-praxis-700 text-sm font-bold">
          {t('amr.ausBxL')}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[12px] font-bold text-slate-400 mb-1">{t('amr.bodenDecke')} (m²)</p>
            <input type="text" inputMode="decimal" dir="ltr" className={FELD} value={e.grundflaeche} onChange={(ev) => setFeld('grundflaeche', ev.target.value)} />
          </div>
          <div>
            <p className="text-[12px] font-bold text-slate-400 mb-1">{t('amr.umfang')} (m)</p>
            <input type="text" inputMode="decimal" dir="ltr" className={FELD} value={e.umfang} onChange={(ev) => setFeld('umfang', ev.target.value)} />
          </div>
        </div>
        <div className="flex gap-2">
          {radio('umfangGemessen', false, t('am.stand_geschaetzt'))}
          {radio('umfangGemessen', true, t('am.stand_gemessen'))}
        </div>
      </div>

      {/* Höhe: licht + Bodenaufbau = Abrechnungshöhe (5.2.1 Rohbaumaß) */}
      <div className="bg-white rounded-3xl border border-slate-200 p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[12px] font-bold text-slate-400 mb-1">{t('amr.hoeheLicht')} (m)</p>
            <input type="text" inputMode="decimal" dir="ltr" className={FELD} value={e.hoeheLicht} onChange={(ev) => setFeld('hoeheLicht', ev.target.value)} />
          </div>
          <div>
            <p className="text-[12px] font-bold text-slate-400 mb-1">+ {t('amr.aufbauBoden')} (m)</p>
            <input type="text" inputMode="decimal" dir="ltr" className={FELD} value={e.aufbauBoden}
              onChange={(ev) => setFeld('aufbauBoden', ev.target.value)} placeholder="0,12" />
          </div>
        </div>
        <p className="text-sm text-slate-600">
          = {t('amr.abrechnungshoehe')}: <strong dir="ltr">{zahlText(abrHoehe)} m</strong>
        </p>
        {e.aufbauBoden === '' && rw?.hoeheRohbau && (
          <p className="text-[12px] text-red-600 font-semibold">{t('amr.aufbauPflicht')}</p>
        )}
      </div>

      {/* Öffnungen mit Leibungstiefe */}
      <div className="bg-white rounded-3xl border border-slate-200 p-4 space-y-3">
        <p className="font-bold text-slate-800 uppercase tracking-wide text-sm">{t('amr.oeffnungen')}</p>
        {e.oeffnungen.map((o) => (
          <div key={o.id} className="border border-slate-200 rounded-2xl p-3 space-y-2">
            <div className="flex items-center gap-2">
              <select value={o.art} onChange={(ev) => setOeffnung(o.id, 'art', ev.target.value)} className={`${FELD} !py-2 flex-1`}>
                <option value="tuer">{t('am.tuer')}</option>
                <option value="fenster">{t('am.fenster')}</option>
                <option value="nische">{t('am.nische')}</option>
              </select>
              <button onClick={() => setE((alt) => ({ ...alt, oeffnungen: alt.oeffnungen.filter((x) => x.id !== o.id) }))}
                className="w-10 h-10 rounded-xl bg-red-50 text-red-500 font-bold shrink-0">×</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-[11px] font-bold text-slate-400 mb-0.5">{t('amr.breite')}</p>
                <input type="text" inputMode="decimal" dir="ltr" className={`${FELD} !py-2`} value={o.breite} onChange={(ev) => setOeffnung(o.id, 'breite', ev.target.value)} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 mb-0.5">{t('amr.hoehe')}</p>
                <input type="text" inputMode="decimal" dir="ltr" className={`${FELD} !py-2`} value={o.hoehe} onChange={(ev) => setOeffnung(o.id, 'hoehe', ev.target.value)} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 mb-0.5">{t('am.anzahl')}</p>
                <input type="text" inputMode="numeric" dir="ltr" className={`${FELD} !py-2`} value={o.anzahl} onChange={(ev) => setOeffnung(o.id, 'anzahl', ev.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-[11px] font-bold text-slate-400 mb-0.5">{t('am.leibungstiefe')} (m)</p>
                <input type="text" inputMode="decimal" dir="ltr" className={`${FELD} !py-2`} value={o.leibungstiefe} onChange={(ev) => setOeffnung(o.id, 'leibungstiefe', ev.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600 pt-4">
                <input type="checkbox" checked={o.leibungBeschichtet} onChange={(ev) => setOeffnung(o.id, 'leibungBeschichtet', ev.target.checked)} className="w-5 h-5" />
                {t('am.leibungBeschichtet')}
              </label>
            </div>
          </div>
        ))}
        <div className="flex gap-2">
          <button onClick={() => setE((alt) => ({ ...alt, oeffnungen: [...alt.oeffnungen, neueOeffnung('tuer')] }))}
            className="flex-1 py-2.5 rounded-2xl bg-slate-100 text-slate-600 text-sm font-bold">+ {t('am.tuer')}</button>
          <button onClick={() => setE((alt) => ({ ...alt, oeffnungen: [...alt.oeffnungen, neueOeffnung('fenster')] }))}
            className="flex-1 py-2.5 rounded-2xl bg-slate-100 text-slate-600 text-sm font-bold">+ {t('am.fenster')}</button>
        </div>
      </div>

      {/* Ergebnis nach Regelwerk */}
      <div className="bg-white rounded-3xl border border-slate-200 p-4 space-y-2">
        {rw ? (
          <>
            <p className="text-[12px] text-slate-400">{t('am.regelwerk')}: <strong className="text-slate-600">{rw.name}</strong></p>
            <div className="text-sm space-y-1" dir="ltr">
              {live.zeilen.map((z, i) => (
                <div key={i} className={`flex justify-between ${z.geschaetzt ? 'text-red-600' : 'text-slate-700'}`}>
                  <span>{t(`amr.zeile_${z.art}`)} · {z.ansatz}{z.geschaetzt ? ' ⚠' : ''}</span>
                  <strong>{zahlText(z.menge)} m²</strong>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-200 pt-2 text-sm flex justify-between font-bold text-slate-900" dir="ltr">
              <span>{t('amr.summeWandLeibung')}</span>
              <span>{zahlText(live.summen.wandUndLeibungen)} m² + {zahlText(live.summen.decke)} m² {t('amr.decke')}</span>
            </div>
            {live.hinweise.map((h, i) => (
              <p key={i} className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{h}</p>
            ))}
          </>
        ) : (
          <p className="text-sm text-red-600 font-semibold">{t('am.regelwerkFehlt')}</p>
        )}
      </div>

      {/* Stand + Speichern */}
      <div className="bg-white rounded-3xl border border-slate-200 p-4 space-y-3">
        <p className="text-[12px] font-bold text-slate-400">{t('am.stand')}</p>
        <div className="flex gap-2">
          {radio('aufmassStand', 'geschaetzt', t('am.stand_geschaetzt'))}
          {radio('aufmassStand', 'gemessen', t('am.stand_gemessen'))}
          {istBuero && radio('aufmassStand', 'bestaetigt', t('am.stand_bestaetigt'))}
        </div>
        {!istBuero && <p className="text-[12px] text-slate-400">{t('amr.bestaetigtNurBuero')}</p>}
        {meldung && (
          <p className={`text-sm rounded-xl px-3 py-2 border ${
            meldung.art === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : meldung.art === 'gefahr' ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-amber-50 border-amber-200 text-amber-700'
          }`}>{meldung.text}</p>
        )}
        <button onClick={speichern} className="w-full py-4 rounded-2xl bg-praxis-600 text-white font-bold active:scale-[0.99]">
          {t('allg.speichern')}
        </button>
      </div>
    </div>
  )
}

export default function AufmassRaum({ user }) {
  useLang()
  const [params, setParams] = useSearchParams()
  const projekte = useCollection('projekte')
  const offene = useMemo(() => projekte.filter((p) => istOffen(p.status)), [projekte])
  const projektId = params.get('projekt') || ''
  const projekt = projekte.find((p) => p.id === projektId)
  const raeume = useWhere('raeume', 'projektId', projektId)
  const [raumId, setRaumId] = useState('')

  const darf = istVorarbeiterRolle(user?.rolle) || user?.rolle === 'admin'
  if (!darf) {
    return (
      <p className="m-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
        {t('amr.nurVorarbeiter')}
      </p>
    )
  }

  if (!projekt) {
    return (
      <div className="p-4 space-y-3 pb-24">
        <p className="text-sm text-slate-500">{t('amr.baustelleWaehlen')}</p>
        {offene.map((p) => (
          <button key={p.id} onClick={() => setParams({ projekt: p.id }, { replace: true })}
            className="w-full text-left bg-white rounded-3xl border border-slate-200 shadow-sm p-4 active:scale-[0.99]">
            <p className="font-bold text-slate-900">{p.name}</p>
            <p className="text-sm text-slate-500">{p.nummer}</p>
          </button>
        ))}
      </div>
    )
  }

  const raum = raeume.find((r) => r.id === raumId)
  if (raum) {
    return <RaumFormular key={raum.id} raum={raum} projekt={projekt} user={user} onZurueck={() => setRaumId('')} />
  }

  const sortiert = raeume
    .filter((r) => r.aktiv !== false)
    .sort((a, b) => String(a.nummer).localeCompare(String(b.nummer), 'de', { numeric: true }))

  return (
    <div className="p-4 space-y-3 pb-24">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{projekt.name}</p>
      {sortiert.length === 0 && (
        <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-2xl px-4 py-3">{t('fa.keineRaeume')}</p>
      )}
      {sortiert.map((r) => (
        <button key={r.id} onClick={() => setRaumId(r.id)}
          className="w-full min-h-16 text-left bg-white rounded-3xl border border-slate-200 shadow-sm p-4 flex items-center gap-3 active:scale-[0.99]">
          <span className="flex-1 min-w-0">
            <span className="block font-bold text-slate-900">{r.nummer} {r.name}</span>
            <span className="block text-xs text-slate-400" dir="ltr">
              {parseZahl(r.grundflaeche) > 0 ? `${zahlText(parseZahl(r.grundflaeche))} m² · ` : ''}
              {parseZahl(r.umfang) > 0 ? `U ${zahlText(parseZahl(r.umfang))} m` : t('amr.ohneMasse')}
            </span>
          </span>
          <span className={`text-[11px] font-bold rounded-full px-2.5 py-1 shrink-0 ${STAND_FARBE[r.aufmassStand] || STAND_FARBE.geschaetzt}`}>
            {t(`am.stand_${r.aufmassStand || 'geschaetzt'}`)}
          </span>
          <Icon name="chevronRechts" className="w-4 h-4 text-slate-300 shrink-0" />
        </button>
      ))}
    </div>
  )
}
