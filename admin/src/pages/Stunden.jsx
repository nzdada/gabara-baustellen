import { useMemo, useState } from 'react'
import { Icon } from '@shared/ui.jsx'
import { useLang, t, datumLok, lokale } from '@shared/i18n.js'
import { heuteISO } from '@shared/slots.js'
import { euro } from '@shared/format.js'
import { useCollection, useEinstellungen } from '../hooks.js'
import * as S from '../stil.js'
import { Seitenkopf, Leer } from '../components/Seite.jsx'
import { druckeStundenliste, druckeStundenlistenSammel } from '../drucken.js'

// Monats-Stundenlisten je Mitarbeiter (BG-Bau-tauglicher Stundenzettel).
//
// AP 9 (Plan Kapitel 6): Quelle ist die Sammlung `stunden` – dort landen
// ALLE Stunden (Kolonnenzeile der Monteure, Regie-Meldungen, und die
// Stundenzeilen der Büro-Regieberichte beim Einreichen). Die alte Auswertung
// las nur Regieberichte; wer einen Monat reine Vertragsleistung gearbeitet
// hatte, bekam einen LEEREN Zettel (Stunden.jsx:66 in V1).
//
// Neu gegenüber V1:
//  - Spalte ART mit getrennten Summen Auftrag/Regie (der Auftragsteil ist
//    Innenkalkulation und Lohnnachweis, der Regieteil Vergütungsnachweis).
//  - `bemerkungen` je Person befüllbar (stand vorher hart auf '').
//  - CSV-Export je Monat für das Lohnbüro.
//  - Der Bildschirm zeigt ALLE Kalendertage wie das PDF – keine zweite
//    Wahrheit mehr zwischen Ansicht und Ausdruck.
// Die Liste rechnet NICHT neu, sie fasst nur zusammen (§ 15 Abs. 3 VOB/B).

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

function stdText(n) {
  return (Number(n) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Art eines Tages als deutscher Text – er landet auch im PDF und in der CSV
// (beide bewusst deutsch: Empfänger sind Lohnbüro, BG und Auftraggeber).
function artText(auftrag, regie) {
  if (auftrag > 0 && regie > 0) return 'Auftrag + Regie'
  if (regie > 0) return 'Regie'
  if (auftrag > 0) return 'Auftrag'
  return ''
}

export default function Stunden() {
  useLang()
  const stunden = useCollection('stunden')
  const projekte = useCollection('projekte')
  const users = useCollection('users')
  const anordnungen = useCollection('regieanordnungen')
  const einst = useEinstellungen()

  const heute = heuteISO()
  const [monat, setMonat] = useState(() => monatsSchluessel(heute))
  const [umfang, setUmfang] = useState('ganz')  // ganz | bisHeute
  const [bemerkungen, setBemerkungen] = useState({})   // personId -> Text

  const istAktuellerMonat = monat === monatsSchluessel(heute)
  // "Monat bis heute" ergibt nur im laufenden Monat Sinn
  const bisHeute = umfang === 'bisHeute' && istAktuellerMonat

  // Anordnungszeile fürs PDF (deutsch, Plan 6.4 Punkt 3)
  const anordnungText = (id) => {
    const a = anordnungen.find((x) => x.id === id)
    if (!a) return ''
    const art = a.anzeigeArt === 'schriftlich' ? 'schriftlich' : a.anzeigeArt === 'mail' ? 'per E-Mail' : 'mündlich'
    const teile = [a.titel, [a.angeordnetDurch, a.angeordnetAm, art].filter(Boolean).join(', ')]
    return teile.filter(Boolean).join(' – ')
  }

  const auswertung = useMemo(() => {
    const alleTage = tageImMonat(monat)
    const tage = bisHeute ? alleTage.filter((d) => d <= heute) : alleTage

    // Stundenzeilen des Monats je Person bündeln (Stornos bleiben draußen)
    const jePerson = new Map()
    for (const z of stunden) {
      if (z.storniert) continue
      if (!z.datum || !tage.includes(z.datum)) continue
      const user = users.find((u) => u.id === z.userId)
      const schluessel = z.userId || (z.name || '').trim()
      if (!schluessel) continue
      if (!jePerson.has(schluessel)) {
        jePerson.set(schluessel, {
          id: schluessel,
          name: user?.name || z.name || schluessel,
          qualifikation: user?.qualifikation || z.qualifikation || '',
          zeilen: [],
        })
      }
      const projekt = projekte.find((p) => p.id === z.projektId)
      jePerson.get(schluessel).zeilen.push({
        datum: z.datum,
        von: z.von || '',
        bis: z.bis || '',
        stunden: Number(z.stundenGesamt) || 0,
        art: z.art === 'regie' ? 'regie' : 'auftrag',
        satzCent: Math.round(Number(z.satzCent) || 0),
        projekt: projekt ? `${projekt.nummer} · ${projekt.name}` : '',
        taetigkeit: z.taetigkeit || '',
        anordnungId: z.anordnungId || '',
      })
    }

    // Je Person eine Zeile pro Kalendertag – auch für Tage ohne Einsatz,
    // damit das Blatt wie der Papier-Stundenzettel aussieht (und der
    // Bildschirm wie das Blatt – Plan 6.4 Punkt 6).
    const personen = [...jePerson.values()].map((p) => {
      const jeTag = tage.map((datum) => {
        const treffer = p.zeilen.filter((z) => z.datum === datum)
        if (!treffer.length) return { datum, stunden: 0, auftrag: 0, regie: 0, art: '' }
        const gesamt = treffer.reduce((s, z) => s + z.stunden, 0)
        const auftrag = treffer.filter((z) => z.art === 'auftrag').reduce((s, z) => s + z.stunden, 0)
        const regie = treffer.filter((z) => z.art === 'regie').reduce((s, z) => s + z.stunden, 0)
        const beginn = treffer.map((z) => z.von).filter(Boolean).sort()[0] || ''
        const ende = treffer.map((z) => z.bis).filter(Boolean).sort().slice(-1)[0] || ''
        // Pause wird GERECHNET, nicht erfasst: Anwesenheit minus gemeldete
        // Arbeitszeit. Zwei Baustellen an einem Tag -> die Fahrt zählt als
        // Pause. Unplausible Tage bleiben gelb mit "prüfen" (Plan 6.4).
        const anwesend = spanneMinuten(beginn, ende)
        const pauseMin = anwesend > 0 ? Math.max(0, Math.round(anwesend - gesamt * 60)) : 0
        const unstimmig = anwesend > 0 && gesamt * 60 > anwesend + 1
        const taetigkeit = [...new Set(treffer.map((z) => [z.projekt, z.taetigkeit].filter(Boolean).join(' – ')))]
          .filter(Boolean).join('\n')
        return { datum, beginn, ende, pauseMin, stunden: gesamt, auftrag, regie, art: artText(auftrag, regie), taetigkeit, unstimmig }
      })
      const summe = jeTag.reduce((s, z) => s + z.stunden, 0)
      const summeAuftrag = jeTag.reduce((s, z) => s + z.auftrag, 0)
      const summeRegie = jeTag.reduce((s, z) => s + z.regie, 0)
      const unstimmige = jeTag.filter((z) => z.unstimmig).length
      const lohnCent = p.zeilen.reduce((s, z) => s + Math.round(z.stunden * z.satzCent), 0)
      // Regiezeilen fürs PDF: je Tag und Anordnung eine Zeile mit Satz,
      // Betrag und Anordnungstext (Vergütungsnachweis, Plan 6.4 Punkt 3).
      const regieZeilen = p.zeilen.filter((z) => z.art === 'regie').map((z) => ({
        datum: z.datum,
        stunden: z.stunden,
        satzCent: z.satzCent,
        betragCent: Math.round(z.stunden * z.satzCent),
        anordnung: anordnungText(z.anordnungId),
      }))
      return {
        ...p, jeTag, summe, summeAuftrag, summeRegie, lohnCent, unstimmige, regieZeilen,
        arbeitstage: jeTag.filter((z) => z.stunden > 0).length,
      }
    }).sort((a, b) => a.name.localeCompare(b.name, 'de'))

    return { tage, personen, gesamt: personen.reduce((s, p) => s + p.summe, 0) }
  }, [stunden, projekte, users, anordnungen, monat, bisHeute, heute]) // eslint-disable-line react-hooks/exhaustive-deps

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
        art: z.art,
        taetigkeit: z.taetigkeit,
        unstimmig: z.unstimmig,
      })),
      zeitraum: {
        titel: zeitraumTitel,
        von: new Date(`${auswertung.tage[0]}T12:00:00`).toLocaleDateString('de-DE'),
        bis: new Date(`${auswertung.tage[auswertung.tage.length - 1]}T12:00:00`).toLocaleDateString('de-DE'),
      },
      summe: person.summe,
      summeAuftrag: person.summeAuftrag,
      summeRegie: person.summeRegie,
      regie: person.regieZeilen,
      bemerkungen: bemerkungen[person.id] || '',
      einst,
    }
  }

  const drucken = (person) => druckeStundenliste(blattVon(person))

  // EIN Dokument mit je einer Seite pro Person. Mehrere Druckfenster
  // hintereinander lässt der Browser nicht durch – ab dem zweiten kommt nur
  // die Popup-Blocker-Meldung.
  const alleDrucken = () =>
    druckeStundenlistenSammel(auswertung.personen.map(blattVon), einst)

  // CSV je Monat für das Lohnbüro (Plan 6.4 Punkt 5). Semikolon-getrennt,
  // deutsches Dezimalkomma, BOM für Excel. Nur Tage mit Stunden – das
  // Lohnbüro rechnet Zeilen, keine Kalender-Optik.
  function csvExport() {
    const zelle = (wert) => {
      const s = String(wert ?? '')
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const zeilen = [['Mitarbeiter', 'Qualifikation', 'Datum', 'Wochentag', 'Beginn', 'Ende', 'Pause (Min)', 'Stunden', 'Art', 'Taetigkeit'].join(';')]
    for (const p of auswertung.personen) {
      for (const z of p.jeTag) {
        if (!z.stunden) continue
        zeilen.push([
          p.name,
          QUALI_SCHLUESSEL[p.qualifikation] ? t(QUALI_SCHLUESSEL[p.qualifikation]) : p.qualifikation,
          new Date(`${z.datum}T12:00:00`).toLocaleDateString('de-DE'),
          new Date(`${z.datum}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'long' }),
          z.beginn, z.ende, z.pauseMin || 0,
          stdText(z.stunden),
          z.art,
          z.taetigkeit.replace(/\n/g, ' | '),
        ].map(zelle).join(';'))
      }
      zeilen.push([p.name, '', '', '', '', '', 'Summe', stdText(p.summe), `Auftrag ${stdText(p.summeAuftrag)} / Regie ${stdText(p.summeRegie)}`, ''].map(zelle).join(';'))
    }
    const blob = new Blob([`﻿${zeilen.join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `stunden-${monat}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className={S.SEITE}>
      <Seitenkopf icon="clock" titel={t('stunden.titel')} sub={t('stunden.subV2')}>
        {auswertung.personen.length > 0 && (
          <button onClick={csvExport} className={S.BTN_ZWEIT}>
            <Icon name="upload" groesse="s" /> {t('stunden.csv')}
          </button>
        )}
        {auswertung.personen.length > 1 && (
          <button onClick={alleDrucken} className={S.BTN_ZWEIT}>
            <Icon name="doc" groesse="s" /> {t('stunden.alleDrucken')}
          </button>
        )}
      </Seitenkopf>

      {/* Auswahl: Monat, Umfang */}
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

        <p className="ml-auto text-sm text-schrift-leise pb-2">
          {t('stunden.gesamt')}: <strong className="text-schrift-stark tabular-nums">
            {stdText(auswertung.gesamt)} {t('allg.stunden')}
          </strong>
        </p>
      </div>

      {auswertung.personen.length === 0 ? (
        <div className={S.KARTE}>
          <Leer icon="clock" titel={t('stunden.leerTitel')} text={t('stunden.leerTextV2')} />
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
                {/* Getrennte Summen Auftrag/Regie (Plan 6.4 Punkt 2) */}
                <span className="text-sm text-schrift-leise tabular-nums">
                  {t('stunden.artAuftrag')} <strong className="text-schrift-stark">{stdText(p.summeAuftrag)}</strong>
                  {' · '}{t('stunden.artRegie')} <strong className="text-schrift-stark">{stdText(p.summeRegie)}</strong>
                  {' · '}<strong className="text-schrift-stark">{stdText(p.summe)} {t('allg.stunden')}</strong>
                </span>
                {p.lohnCent > 0 && <span className="text-sm text-schrift-leise tabular-nums">{euro(p.lohnCent / 100)}</span>}
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
                <table className="w-full text-sm min-w-[760px]">
                  <thead>
                    <tr className="text-left text-[12px] uppercase tracking-wide text-schrift-zart border-b border-rahmen">
                      <th className="px-4 py-2">{t('stunden.tag')}</th>
                      <th className="px-3 py-2">{t('allg.datum')}</th>
                      <th className="px-3 py-2 text-right">{t('stunden.beginn')}</th>
                      <th className="px-3 py-2 text-right">{t('stunden.ende')}</th>
                      <th className="px-3 py-2 text-right">{t('stunden.pause')}</th>
                      <th className="px-3 py-2 text-right">{t('allg.stunden')}</th>
                      <th className="px-3 py-2">{t('stunden.art')}</th>
                      <th className="px-4 py-2">{t('stunden.taetigkeit')}</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {/* ALLE Kalendertage – wie das PDF (Plan 6.4 Punkt 6) */}
                    {p.jeTag.map((z) => (
                      <tr key={z.datum} className={`border-b border-rahmen ${z.unstimmig ? 'bg-amber-50' : ''} ${!z.stunden ? 'text-schrift-zart' : ''}`}>
                        <td className={`px-4 py-2 whitespace-nowrap ${z.stunden ? 'text-schrift-leise' : ''}`}>
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
                        <td className={`px-3 py-2 text-right font-semibold ${z.stunden ? 'text-schrift-stark' : ''}`}>
                          {z.stunden ? stdText(z.stunden) : ''}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {z.regie > 0 && (
                            <span className="text-[11px] font-bold rounded-full px-2 py-0.5 bg-amber-100 text-amber-800 mr-1">{t('stunden.artRegie')}</span>
                          )}
                          {z.auftrag > 0 && (
                            <span className="text-[11px] font-bold rounded-full px-2 py-0.5 bg-gedeckt-tief text-schrift-leise">{t('stunden.artAuftrag')}</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-schrift-leise whitespace-pre-line">{z.taetigkeit || (z.stunden ? '–' : '')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bemerkungen fürs Blatt (Plan 6.4 Punkt 4 – stand hart auf '') */}
              <div className="px-5 py-3 border-t border-rahmen">
                <label className="block text-xs font-semibold text-schrift-leise mb-1">{t('stunden.bemerkungen')}</label>
                <input
                  type="text"
                  value={bemerkungen[p.id] || ''}
                  onChange={(e) => setBemerkungen((alt) => ({ ...alt, [p.id]: e.target.value }))}
                  placeholder={t('stunden.bemerkungenPlatz')}
                  className={S.FELD}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 text-xs text-schrift-zart">{t('stunden.hinweisV2')}</p>
    </div>
  )
}
