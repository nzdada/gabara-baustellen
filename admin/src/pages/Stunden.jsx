import { useMemo, useState } from 'react'
import { Icon } from '@shared/ui.jsx'
import { useLang, t, datumLok, lokale } from '@shared/i18n.js'
import { heuteISO } from '@shared/slots.js'
import { euro } from '@shared/format.js'
import { useCollection, useEinstellungen } from '../hooks.js'
import * as S from '../stil.js'
import { Seitenkopf, Leer } from '../components/Seite.jsx'
import { FeldLabel } from '../components/InfoHinweis.jsx'
import { HINWEIS } from '../hinweise.js'
import { druckeStundenliste, druckeStundenlistenSammel } from '../drucken.js'

// Monats-Stundenlisten je Mitarbeiter (BG-Bau-tauglicher Stundenzettel).
//
// Quelle sind die Stundenzeilen der Regieberichte – dort steht je Person
// Datum, Von, Bis und die gemeldete Stundenzahl (§ 15 Abs. 3 VOB/B).
// Die Liste rechnet NICHT neu, sie fasst nur zusammen: was der Monteur
// gemeldet und das Büro freigegeben hat, steht auch auf dem Blatt.

const QUALI_SCHLUESSEL = { facharbeiter: 'einst.facharbeiter', helfer: 'einst.helfer' }

function monatsSchluessel(iso) {
  return (iso || heuteISO()).slice(0, 7)
}

// 'JJJJ-MM' -> alle Kalendertage des Monats als ISO-Liste
function tageImMonat(monat) {
  const [jahr, mon] = monat.split('-').map(Number)
  const anzahl = new Date(jahr, mon, 0).getDate()
  return Array.from({ length: anzahl }, (_, i) =>
    `${monat}-${String(i + 1).padStart(2, '0')}`)
}

// Minuten zwischen zwei 'HH:MM' – negativ/leer ergibt 0
function spanneMinuten(von, bis) {
  if (!von || !bis) return 0
  const [h1, m1] = von.split(':').map(Number)
  const [h2, m2] = bis.split(':').map(Number)
  const diff = (h2 * 60 + m2) - (h1 * 60 + m1)
  return diff > 0 ? diff : 0
}

export default function Stunden() {
  useLang()
  const berichte = useCollection('berichte')
  const projekte = useCollection('projekte')
  const users = useCollection('users')
  const einst = useEinstellungen()

  const heute = heuteISO()
  const [monat, setMonat] = useState(() => monatsSchluessel(heute))
  const [umfang, setUmfang] = useState('ganz')  // ganz | bisHeute
  const [nurFreigegeben, setNurFreigegeben] = useState(true)

  const istAktuellerMonat = monat === monatsSchluessel(heute)
  // "Monat bis heute" ergibt nur im laufenden Monat Sinn
  const bisHeute = umfang === 'bisHeute' && istAktuellerMonat

  const auswertung = useMemo(() => {
    const alleTage = tageImMonat(monat)
    const tage = bisHeute ? alleTage.filter((d) => d <= heute) : alleTage

    // Stundenzeilen aller passenden Berichte einsammeln und je Person bündeln
    const jePerson = new Map()
    for (const b of berichte) {
      if (b.typ !== 'regie') continue
      if (nurFreigegeben && !['freigegeben', 'abgerechnet'].includes(b.status)) continue
      const projekt = projekte.find((p) => p.id === b.projektId)
      for (const z of b.stunden || []) {
        // Ohne eigenes Datum zählt die Zeile zum Berichtsdatum
        const datum = z.datum || b.datum
        if (!datum || !tage.includes(datum)) continue
        const name = (z.name || '').trim()
        const user = users.find((u) => u.id === z.userId) || users.find((u) => u.name === name)
        const schluessel = user?.id || name || '–'
        if (!schluessel || schluessel === '–') continue
        if (!jePerson.has(schluessel)) {
          jePerson.set(schluessel, {
            id: schluessel,
            name: user?.name || name,
            qualifikation: user?.qualifikation || z.art || '',
            zeilen: [],
          })
        }
        jePerson.get(schluessel).zeilen.push({
          datum,
          von: z.von || '',
          bis: z.bis || '',
          stunden: Number(z.anzahl) || 0,
          satz: Number(z.satz) || 0,
          projekt: projekt ? `${projekt.nummer} · ${projekt.name}` : '',
          beschreibung: b.beschreibung || '',
          berichtNummer: b.nummer || '',
        })
      }
    }

    // Je Person eine Zeile pro Kalendertag – auch für Tage ohne Einsatz,
    // damit das Blatt wie der Papier-Stundenzettel aussieht.
    const personen = [...jePerson.values()].map((p) => {
      const jeTag = tage.map((datum) => {
        const treffer = p.zeilen.filter((z) => z.datum === datum)
        if (!treffer.length) return { datum, stunden: 0 }
        const stunden = treffer.reduce((s, z) => s + z.stunden, 0)
        const beginn = treffer.map((z) => z.von).filter(Boolean).sort()[0] || ''
        const ende = treffer.map((z) => z.bis).filter(Boolean).sort().slice(-1)[0] || ''
        // Pause = Anwesenheit minus gemeldete Arbeitszeit
        const anwesend = spanneMinuten(beginn, ende)
        const pauseMin = anwesend > 0 ? Math.max(0, Math.round(anwesend - stunden * 60)) : 0
        // Mehr Stunden als Anwesenheit = die Zeile trägt keinen Nachweis.
        // Auf einem Blatt für die BG muss das auffallen, nicht untergehen.
        const unstimmig = anwesend > 0 && stunden * 60 > anwesend + 1
        const taetigkeit = [...new Set(treffer.map((z) => [z.projekt, z.beschreibung].filter(Boolean).join(' – ')))]
          .filter(Boolean).join('\n')
        return { datum, beginn, ende, pauseMin, stunden, taetigkeit, unstimmig }
      })
      const summe = jeTag.reduce((s, z) => s + z.stunden, 0)
      const unstimmige = jeTag.filter((z) => z.unstimmig).length
      const lohn = p.zeilen.reduce((s, z) => s + z.stunden * z.satz, 0)
      return { ...p, jeTag, summe, lohn, unstimmige, arbeitstage: jeTag.filter((z) => z.stunden > 0).length }
    }).sort((a, b) => a.name.localeCompare(b.name, 'de'))

    return { tage, personen, gesamt: personen.reduce((s, p) => s + p.summe, 0) }
  }, [berichte, projekte, users, monat, bisHeute, nurFreigegeben, heute])

  // Monatsauswahl: laufender Monat und die 11 davor
  const monate = useMemo(() => {
    const liste = []
    const d = new Date(`${monatsSchluessel(heute)}-01T12:00:00`)
    for (let i = 0; i < 12; i++) {
      const m = new Date(d.getFullYear(), d.getMonth() - i, 1, 12)
      liste.push({
        wert: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`,
        label: m.toLocaleDateString(lokale(), { month: 'long', year: 'numeric' }),
      })
    }
    return liste
  }, [heute])

  const monatsTitel = monate.find((m) => m.wert === monat)?.label || monat
  const zeitraumTitel = bisHeute ? t('stunden.bisHeuteTitel', { monat: monatsTitel }) : monatsTitel

  function blattVon(person) {
    return {
      mitarbeiter: {
        name: person.name,
        qualifikation: QUALI_SCHLUESSEL[person.qualifikation]
          ? t(QUALI_SCHLUESSEL[person.qualifikation])
          : person.qualifikation,
      },
      tage: person.jeTag.map((z) => ({
        datum: new Date(`${z.datum}T12:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        wochentag: new Date(`${z.datum}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'long' }),
        beginn: z.beginn,
        ende: z.ende,
        pauseMin: z.pauseMin,
        stunden: z.stunden,
        taetigkeit: z.taetigkeit,
        unstimmig: z.unstimmig,
      })),
      zeitraum: {
        titel: zeitraumTitel,
        von: new Date(`${auswertung.tage[0]}T12:00:00`).toLocaleDateString('de-DE'),
        bis: new Date(`${auswertung.tage[auswertung.tage.length - 1]}T12:00:00`).toLocaleDateString('de-DE'),
      },
      summe: person.summe,
      bemerkungen: '',
      einst,
    }
  }

  const drucken = (person) => druckeStundenliste(blattVon(person))

  // EIN Dokument mit je einer Seite pro Person. Mehrere Druckfenster
  // hintereinander lässt der Browser nicht durch – ab dem zweiten kommt nur
  // die Popup-Blocker-Meldung.
  const alleDrucken = () =>
    druckeStundenlistenSammel(auswertung.personen.map(blattVon), einst)

  return (
    <div className={S.SEITE}>
      <Seitenkopf icon="clock" titel={t('stunden.titel')} sub={t('stunden.sub')}>
        {auswertung.personen.length > 1 && (
          <button onClick={alleDrucken} className={S.BTN_ZWEIT}>
            <Icon name="doc" groesse="s" /> {t('stunden.alleDrucken')}
          </button>
        )}
      </Seitenkopf>

      {/* Auswahl: Monat, Umfang, Datenbasis */}
      <div className="mb-4 bg-karte rounded-karte border border-rahmen shadow-karte p-4 flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="block text-xs font-semibold text-schrift-leise mb-1">{t('stunden.monat')}</span>
          <select value={monat} onChange={(e) => setMonat(e.target.value)} className={S.FELD}>
            {monate.map((m) => <option key={m.wert} value={m.wert}>{m.label}</option>)}
          </select>
        </label>

        <div>
          <span className="block text-xs font-semibold text-schrift-leise mb-1">{t('stunden.umfang')}</span>
          <div className="flex items-center gap-1 bg-gedeckt-tief rounded-full p-1">
            {[['ganz', t('stunden.ganzerMonat')], ['bisHeute', t('stunden.bisHeute')]].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setUmfang(id)}
                disabled={id === 'bisHeute' && !istAktuellerMonat}
                className={`text-xs font-semibold px-3.5 py-2 rounded-full transition disabled:opacity-40 ${
                  umfang === id ? 'bg-praxis-600 text-white' : 'text-schrift-leise hover:text-schrift'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-schrift pb-2">
          <input
            type="checkbox"
            checked={nurFreigegeben}
            onChange={(e) => setNurFreigegeben(e.target.checked)}
            className="w-4 h-4"
          />
          <FeldLabel info={HINWEIS.stundenFreigabe}>{t('stunden.nurFreigegeben')}</FeldLabel>
        </label>

        <p className="ml-auto text-sm text-schrift-leise pb-2">
          {t('stunden.gesamt')}: <strong className="text-schrift-stark tabular-nums">
            {auswertung.gesamt.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {t('allg.stunden')}
          </strong>
        </p>
      </div>

      {auswertung.personen.length === 0 ? (
        <div className={S.KARTE}>
          <Leer icon="clock" titel={t('stunden.leerTitel')} text={t('stunden.leerText')} />
        </div>
      ) : (
        <div className="space-y-3">
          {auswertung.personen.map((p) => (
            <div key={p.id} className="bg-karte rounded-karte border border-rahmen shadow-karte overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-rahmen bg-gedeckt/70">
                <Icon name="person" className="w-4 h-4 text-praxis-700" />
                <p className="font-bold text-schrift-stark">{p.name}</p>
                {p.qualifikation && (
                  <span className="text-[11px] font-bold rounded-full px-2.5 py-1 bg-gedeckt-tief text-schrift-leise">
                    {QUALI_SCHLUESSEL[p.qualifikation] ? t(QUALI_SCHLUESSEL[p.qualifikation]) : p.qualifikation}
                  </span>
                )}
                <span className="text-sm text-schrift-leise tabular-nums">
                  {t(p.arbeitstage === 1 ? 'stunden.arbeitstag' : 'stunden.arbeitstage', { n: p.arbeitstage })}
                </span>
                <span className="text-sm font-bold text-schrift-stark tabular-nums">
                  {p.summe.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {t('allg.stunden')}
                </span>
                {p.lohn > 0 && <span className="text-sm text-schrift-leise tabular-nums">{euro(p.lohn)}</span>}
                {p.unstimmige > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-bold rounded-full px-2.5 py-1 bg-amber-100 text-amber-800">
                    <Icon name="alert" className="w-3.5 h-3.5" />
                    {t('stunden.unstimmig', { n: p.unstimmige })}
                  </span>
                )}
                <button onClick={() => drucken(p)} className={`${S.BTN_PRIMAER} ml-auto`}>
                  <Icon name="doc" groesse="s" /> {t('stunden.drucken')}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead>
                    <tr className="text-left text-[12px] uppercase tracking-wide text-schrift-zart border-b border-rahmen">
                      <th className="px-4 py-2">{t('stunden.tag')}</th>
                      <th className="px-3 py-2">{t('allg.datum')}</th>
                      <th className="px-3 py-2 text-right">{t('stunden.beginn')}</th>
                      <th className="px-3 py-2 text-right">{t('stunden.ende')}</th>
                      <th className="px-3 py-2 text-right">{t('stunden.pause')}</th>
                      <th className="px-3 py-2 text-right">{t('allg.stunden')}</th>
                      <th className="px-4 py-2">{t('stunden.taetigkeit')}</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {p.jeTag.filter((z) => z.stunden > 0).map((z) => (
                      <tr key={z.datum} className={`border-b border-rahmen ${z.unstimmig ? 'bg-amber-50' : ''}`}>
                        <td className="px-4 py-2 text-schrift-leise whitespace-nowrap">
                          {datumLok(z.datum, { weekday: 'short' })}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {datumLok(z.datum, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </td>
                        <td className="px-3 py-2 text-right" dir="ltr">{z.beginn || '–'}</td>
                        <td className="px-3 py-2 text-right" dir="ltr">{z.ende || '–'}</td>
                        <td className="px-3 py-2 text-right text-schrift-leise" title={z.unstimmig ? t('stunden.unstimmigHinweis') : ''}>
                          {z.unstimmig ? <span className="text-amber-700 font-bold">!</span> : (z.pauseMin || '–')}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-schrift-stark">
                          {z.stunden.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2 text-schrift-leise whitespace-pre-line">{z.taetigkeit || '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 text-xs text-schrift-zart">{t('stunden.hinweis')}</p>
    </div>
  )
}
