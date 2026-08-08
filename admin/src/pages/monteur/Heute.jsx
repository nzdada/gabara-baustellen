import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@shared/ui.jsx'
import { t, tr, useLang, datumLok } from '@shared/i18n.js'
import { heuteISO, addTage } from '@shared/slots.js'
import { meldungBauen } from '@shared/aufgaben.js'
import { zahlText } from '@shared/aufmass.js'
import { istMonteurRolle } from '@shared/auth.js'
import { fotoAus } from '@shared/bild.js'
import {
  ZEICHEN, WARTET_GRUENDE, einsatzFuerTag, aufgabenZumEinsatz, tagesgruppen,
  summeM2, laeuftBauen, wartetBauen, weiterBauen,
} from '@shared/monteurtag.js'
import { useCollection, useWhere, useContains, withStore } from '../../hooks.js'

// HEUTE (Plan Kapitel 3.1, Bildschirm 1 + 2): öffnet direkt, kein Zwischenmenü.
// Gruppen je Arbeitsschritt, Mehrfachauswahl, [alle], FERTIG -> Kamera ->
// store.meldeAufgaben, Quittung mit 10 Sekunden Rückgängig.
//
// Feste Bedienregeln (verbindlich): Zeilen mindestens 64 px (min-h-16),
// Trefferfläche über die ganze Breite, KEINE tippbare Zahl, KEIN
// Bestätigungsdialog – stattdessen die Quittung unten.
//
// RÜCKGÄNGIG OHNE STORNO-RECHT: Auf /buchungen ist update verboten und
// löschen darf nur das Büro – ein Monteur kann eine einmal geschriebene
// Buchung also NICHT zurücknehmen. Deshalb wird die Sammelmeldung erst NACH
// Ablauf der 10 Sekunden geschrieben (oder sofort, wenn die App in den
// Hintergrund geht/die Seite verlassen wird). Das Foto ist da bereits
// gesichert – vor dem Foto gibt es, wie überall in V2, keine Server-Kennung.
//
// FOTO-ÜBERGANGSWEG bis AP 6: Der Beleg landet als komprimierte Daten-URL in
// der V1-Sammlung 'photos' (lokale UUID, mit phase/kontext/rolle nach dem
// V2-Schema). AP 6 ersetzt das durch 'fotos' + Storage in drei Größen.

const KURZDATUM = { weekday: 'short', day: '2-digit', month: '2-digit' }

function uhrzeit(ms) {
  return new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
}

function lokaleUuid() {
  return crypto.randomUUID ? crypto.randomUUID() : `f-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// Zeile der HEUTE-Liste: Zeichen + Raum + Menge + Hinweis, rechts der
// [▸]-Knopf "angefangen" (Zwei-Knopf-Zeile aus Entwurf A).
function TagZeile({ zeile, gewaehlt, aufZeile, aufLang, aufStart }) {
  const a = zeile.aufgabe
  const halter = useRef({ uhr: null, lang: false })
  const start = () => {
    halter.current.lang = false
    halter.current.uhr = setTimeout(() => {
      halter.current.lang = true
      aufLang(a)
    }, 550)
  }
  const ende = () => clearTimeout(halter.current.uhr)
  const klick = () => {
    if (halter.current.lang) { halter.current.lang = false; return }
    aufZeile(zeile)
  }
  const waehlbar = zeile.zeichen === 'offen' || zeile.zeichen === 'laeuft'
  return (
    <div className="flex items-stretch border-b border-slate-100 last:border-b-0">
      <button
        onClick={klick}
        onPointerDown={start}
        onPointerUp={ende}
        onPointerLeave={ende}
        onPointerCancel={ende}
        onContextMenu={(e) => e.preventDefault()}
        className={`flex-1 min-h-16 flex items-center gap-3 px-3 text-start select-none active:bg-slate-50 ${zeile.zeichen === 'fertig' ? 'opacity-70' : ''}`}
      >
        <span className={`w-8 shrink-0 text-2xl leading-none text-center ${gewaehlt && waehlbar ? 'text-praxis-600' : 'text-slate-500'}`}>
          {waehlbar && gewaehlt ? ZEICHEN.gewaehlt : ZEICHEN[zeile.zeichen]}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-semibold text-slate-900 truncate">
            {a.raumNummer} {a.raumName}
          </span>
        </span>
        {Boolean(a.menge) && (
          <span className="text-sm text-slate-500 shrink-0" dir="ltr">{zahlText(a.menge)} {a.einheit}</span>
        )}
        <span className="w-20 shrink-0 text-end text-[12px] font-bold">
          {zeile.zeichen === 'fertig' && <span className="text-emerald-600">{a.fertigAm ? uhrzeit(a.fertigAm) : ''}</span>}
          {zeile.zeichen === 'laeuft' && <span className="text-sky-600">{ZEICHEN.laeuft} {t('mt.laeuft')}</span>}
          {zeile.zeichen === 'wartet' && <span className="text-amber-600">{t('mt.wartet')}</span>}
          {zeile.zeichen === 'kamera' && <span className="text-praxis-600">{t('mt.letzter')}</span>}
          {zeile.zeichen === 'offen' && zeile.vorherFehlt && (
            <span className="text-amber-600">{ZEICHEN.vorherFehlt} {t('mt.vorher')}</span>
          )}
        </span>
      </button>
      {zeile.zeichen === 'offen' && (
        <button
          onClick={() => aufStart(a)}
          aria-label={t('mt.angefangen')}
          className="w-14 min-h-16 shrink-0 border-s border-slate-100 text-xl text-slate-400 active:text-sky-600 active:bg-sky-50"
        >
          {ZEICHEN.laeuft}
        </button>
      )}
    </div>
  )
}

export default function Heute({ user, fallback = null }) {
  useLang()
  const navigate = useNavigate()
  const heute = heuteISO()

  const einsaetze = useContains('einsaetze', 'tage', heute)
  const einsatz = useMemo(
    () => einsatzFuerTag(einsaetze, user, heute, { alleSehen: !istMonteurRolle(user?.rolle) }),
    [einsaetze, user, heute]
  )
  const alleAufgaben = useWhere('aufgaben', 'projektId', einsatz?.projektId)
  const raeume = useWhere('raeume', 'projektId', einsatz?.projektId)
  const projekte = useCollection('projekte')
  const kunden = useCollection('patients')
  const projekt = projekte.find((p) => p.id === einsatz?.projektId)
  const kunde = kunden.find((k) => k.id === projekt?.kundeId)

  const einsatzAufgaben = useMemo(
    () => aufgabenZumEinsatz(alleAufgaben, einsatz, heute),
    [alleAufgaben, einsatz, heute]
  )
  const gruppen = useMemo(
    () => tagesgruppen(einsatzAufgaben, alleAufgaben, raeume, heute),
    [einsatzAufgaben, alleAufgaben, raeume, heute]
  )

  const [auswahl, setAuswahl] = useState(() => new Set())
  const [pending, setPending] = useState(null) // { schluessel, meldung, fotoId, anzahl, schritt, m2, uebrig }
  const [fehler, setFehler] = useState('')
  const [sheet, setSheet] = useState(null)     // { aufgabe, grund? } – langes Antippen
  const [info, setInfo] = useState(null)       // aufgabeId der aufgeklappten ✓/⏸-Zeile
  const kameraZiel = useRef(null)              // Aufgaben, die auf das Foto warten
  const kameraRef = useRef(null)
  const pendingRef = useRef(null)
  const erledigt = useRef(new Set())
  pendingRef.current = pending

  function zeigeAblehnung(e) {
    const text = String(e?.message || e || '')
    setFehler(text.startsWith('Bereits gemeldet') || e?.code === 'permission-denied'
      ? t('mt.bereitsGemeldet')
      : t('mt.meldungFehler'))
  }

  // Die eigentliche Schreibung – EIN Vorgang über store.meldeAufgaben.
  async function absenden(p) {
    if (!p || erledigt.current.has(p.schluessel)) return
    erledigt.current.add(p.schluessel)
    try {
      await withStore((s) => s.meldeAufgaben(p.meldung, { onFehler: zeigeAblehnung }))
    } catch (e) {
      zeigeAblehnung(e)
    }
  }

  // 10-Sekunden-Uhr der Quittung
  useEffect(() => {
    if (!pending) return undefined
    const uhr = setInterval(() => {
      setPending((p) => (p ? { ...p, uebrig: p.uebrig - 1 } : p))
    }, 1000)
    return () => clearInterval(uhr)
  }, [pending?.schluessel]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (pending && pending.uebrig <= 0) {
      const p = pending
      setPending(null)
      absenden(p)
    }
  }, [pending]) // eslint-disable-line react-hooks/exhaustive-deps

  // App geht in den Hintergrund / Seite wird verlassen: sofort schreiben,
  // sonst wäre die wartende Meldung weg (der Heimweg-Fall).
  useEffect(() => {
    const spuelen = () => { if (pendingRef.current) absenden(pendingRef.current) }
    const beiSicht = () => { if (document.visibilityState === 'hidden') spuelen() }
    window.addEventListener('pagehide', spuelen)
    document.addEventListener('visibilitychange', beiSicht)
    return () => {
      window.removeEventListener('pagehide', spuelen)
      document.removeEventListener('visibilitychange', beiSicht)
      spuelen()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function umschalten(aufgabeId) {
    setAuswahl((alt) => {
      const neu = new Set(alt)
      if (neu.has(aufgabeId)) neu.delete(aufgabeId)
      else neu.add(aufgabeId)
      return neu
    })
  }

  function aufZeile(zeile) {
    const a = zeile.aufgabe
    if (zeile.zeichen === 'kamera') {
      // Raumabschluss aus der Liste: Antippen öffnet DIREKT die Kamera.
      kameraZiel.current = [a]
      kameraRef.current?.click()
      return
    }
    if (zeile.zeichen === 'fertig' || zeile.zeichen === 'wartet') {
      setInfo((alt) => (alt === a.id ? null : a.id))
      return
    }
    umschalten(a.id)
  }

  function alleWaehlen(gruppe) {
    setAuswahl((alt) => {
      const neu = new Set(alt)
      for (const z of gruppe.zeilen) {
        if (z.zeichen === 'offen' || z.zeichen === 'laeuft') neu.add(z.aufgabe.id)
      }
      return neu
    })
  }

  function fertigMelden(gruppe) {
    const ziel = gruppe.zeilen
      .filter((z) => auswahl.has(z.aufgabe.id) && (z.zeichen === 'offen' || z.zeichen === 'laeuft'))
      .map((z) => z.aufgabe)
    if (!ziel.length) return
    kameraZiel.current = ziel
    kameraRef.current?.click()
  }

  // Kamera hat ausgelöst: Foto SOFORT sichern (lokale UUID), dann die
  // Sammelmeldung bauen und als Quittung mit Rückgängig anbieten.
  async function fotoDa(e) {
    const datei = e.target.files?.[0]
    e.target.value = ''
    const ziel = kameraZiel.current || []
    kameraZiel.current = null
    if (!datei || !ziel.length) return
    const ergebnis = await fotoAus(datei)
    if (!ergebnis.ok) { setFehler(t('mt.fotoFehler')) ; return }
    const fotoId = lokaleUuid()
    try {
      await withStore((s) => s.add('photos', {
        id: fotoId,
        projektId: ziel[0].projektId,
        raumId: ziel.length === 1 ? ziel[0].raumId : '',
        berichtId: '',
        phase: 'nachher',
        kontext: 'auftrag',
        rolle: 'meldebeleg',
        aufgabeIds: ziel.map((a) => a.id),
        dataUrl: ergebnis.dataUrl,
        von: user?.name || '',
        vonId: user?.userId || '',
        datum: heute,
        erstelltAm: Date.now(),
      }))
    } catch (fehlerFoto) {
      // Regel aus Plan 5.4: eine fehlgeschlagene Sicherung VERWEIGERT die
      // Meldung, statt still zu verlieren.
      setFehler(t('mt.fotoFehler'))
      return
    }
    let meldung
    try {
      meldung = meldungBauen(ziel, { userId: user?.userId || '', name: user?.name || '' }, heute, {
        fotoId,
        alleAufgaben,
      })
    } catch (fehlerBau) {
      zeigeAblehnung(fehlerBau)
      return
    }
    setAuswahl(new Set())
    const gruppe = gruppen.find((g) => g.schrittId === ziel[0].schrittId)
    setPending({
      schluessel: fotoId,
      meldung,
      fotoId,
      anzahl: ziel.length,
      schritt: gruppe ? tr({ de: gruppe.nameDe, ar: gruppe.nameAr }) : '',
      m2: summeM2(ziel),
      uebrig: 10,
    })
  }

  async function rueckgaengig() {
    const p = pending
    if (!p) return
    erledigt.current.add(p.schluessel)   // nie mehr absenden
    setPending(null)
    try {
      await withStore((s) => s.remove('photos', p.fotoId))
    } catch (e) { /* Foto bleibt liegen – AP 6 räumt verwaiste Belege auf */ }
  }

  // [▸] angefangen: 1 Tipp, nur status 'laeuft', kein Foto, keine Buchung.
  async function angefangen(aufgabe, anteil = null) {
    const vorgang = laeuftBauen(aufgabe, { anteil })
    if (!vorgang) return
    setSheet(null)
    try {
      await withStore((s) => s.meldeAufgaben(vorgang, { onFehler: zeigeAblehnung }))
    } catch (e) { zeigeAblehnung(e) }
  }

  async function raumWartet(aufgabe, grund, bis) {
    const desRaums = alleAufgaben.filter((a) => a.raumId === aufgabe.raumId)
    const vorgang = wartetBauen(desRaums, { grund, bis })
    setSheet(null)
    if (!vorgang) return
    try {
      await withStore((s) => s.meldeAufgaben(vorgang, { onFehler: zeigeAblehnung }))
    } catch (e) { zeigeAblehnung(e) }
  }

  async function raumWeiter(aufgabe) {
    const desRaums = alleAufgaben.filter((a) => a.raumId === aufgabe.raumId)
    const vorgang = weiterBauen(desRaums)
    setInfo(null)
    setSheet(null)
    if (!vorgang) return
    try {
      await withStore((s) => s.meldeAufgaben(vorgang, { onFehler: zeigeAblehnung }))
    } catch (e) { zeigeAblehnung(e) }
  }

  // Ohne Einsatz heute: die alte Terminliste (V1-Daten) als Rückfallebene.
  if (!einsatz) {
    return (
      <div>
        <p className="mx-4 mt-4 text-sm text-slate-500 bg-white border border-slate-200 rounded-2xl px-4 py-3">
          {t('mt.keinEinsatz')}
        </p>
        {fallback}
      </div>
    )
  }

  const adresse = [projekt?.anschrift?.strasse, projekt?.anschrift?.plzOrt].filter(Boolean).join(', ')

  return (
    <div className="pb-28">
      {/* Kopf: Tag · Kolonne · Baustelle · drei Wege */}
      <div className="bg-white border-b border-slate-200 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
          {datumLok(heute, KURZDATUM)}{einsatz.teamName ? ` · ${einsatz.teamName}` : ''}
          {einsatz.von ? <span dir="ltr"> · {einsatz.von}–{einsatz.bis}</span> : null}
        </p>
        <p className="mt-0.5 font-bold text-lg text-slate-900 leading-snug">{projekt?.name || einsatz.projektName}</p>
        {adresse && <p className="text-sm text-slate-500">{adresse}</p>}
        {einsatz.hinweis && (
          <p className="mt-1.5 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{einsatz.hinweis}</p>
        )}
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent(adresse || projekt?.name || '')}`}
            target="_blank" rel="noreferrer"
            className="min-h-12 inline-flex items-center justify-center gap-1.5 text-sm font-bold text-praxis-700 bg-praxis-50 rounded-2xl"
          >
            <Icon name="pin" className="w-4 h-4" /> {t('mt.navi')}
          </a>
          <a
            href={kunde?.telefon ? `tel:${kunde.telefon.replace(/\s/g, '')}` : undefined}
            className={`min-h-12 inline-flex items-center justify-center gap-1.5 text-sm font-bold rounded-2xl ${kunde?.telefon ? 'text-praxis-700 bg-praxis-50' : 'text-slate-300 bg-slate-50'}`}
          >
            <Icon name="phone" className="w-4 h-4" /> {t('mt.anrufen')}
          </a>
          <button
            onClick={() => navigate(`/monteur/regie?projekt=${einsatz.projektId}`)}
            className="min-h-12 inline-flex items-center justify-center gap-1.5 text-sm font-bold text-white bg-amber-500 rounded-2xl"
          >
            <Icon name="regie" className="w-4 h-4" /> {t('mt.regieMelden')}
          </button>
        </div>
      </div>

      {gruppen.length === 0 && (
        <p className="m-4 text-sm text-slate-500 bg-white border border-slate-200 rounded-2xl px-4 py-3">
          {t('mt.heuteKeineAufgaben')}
        </p>
      )}

      {/* Gruppen je Arbeitsschritt */}
      {gruppen.map((g) => {
        const gewaehltHier = g.zeilen.filter((z) => auswahl.has(z.aufgabe.id) && (z.zeichen === 'offen' || z.zeichen === 'laeuft')).length
        return (
          <section key={g.schrittId} className="mt-3 bg-white border-y border-slate-200">
            <header className="flex items-center justify-between px-4 pt-3 pb-1">
              <h2 className="font-black text-slate-800 uppercase tracking-wide text-sm">
                {tr({ de: g.nameDe, ar: g.nameAr })}
              </h2>
              <span className="text-xs font-bold text-slate-400">{t('mt.offenZaehler', { n: g.offen })}</span>
            </header>
            <div>
              {g.zeilen.map((z) => (
                <div key={z.aufgabe.id}>
                  <TagZeile
                    zeile={z}
                    gewaehlt={auswahl.has(z.aufgabe.id)}
                    aufZeile={aufZeile}
                    aufLang={(a) => setSheet({ aufgabe: a })}
                    aufStart={(a) => angefangen(a)}
                  />
                  {info === z.aufgabe.id && z.zeichen === 'fertig' && (
                    <p className="px-4 pb-3 text-sm text-emerald-700">
                      {ZEICHEN.fertig} {z.aufgabe.fertigAm ? uhrzeit(z.aufgabe.fertigAm) : ''}{z.aufgabe.fertigVonName ? ` · ${z.aufgabe.fertigVonName}` : ''}
                    </p>
                  )}
                  {info === z.aufgabe.id && z.zeichen === 'wartet' && (
                    <div className="px-4 pb-3 flex items-center gap-3">
                      <p className="flex-1 text-sm text-amber-700">
                        {ZEICHEN.wartet} {t(`mt.grund.${z.aufgabe.wartetGrund}`)}
                        {z.aufgabe.wartetBis ? ` · ${t('mt.wiedervorlage')} ${datumLok(z.aufgabe.wartetBis, KURZDATUM)}` : ''}
                      </p>
                      <button
                        onClick={() => raumWeiter(z.aufgabe)}
                        className="min-h-11 px-3 rounded-xl bg-emerald-600 text-white text-sm font-bold"
                      >
                        {t('mt.weiterArbeiten')}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {g.zeilen.some((z) => z.zeichen === 'offen' || z.zeichen === 'laeuft') && (
              <footer className="flex gap-2 p-3 border-t border-slate-100">
                <button
                  onClick={() => alleWaehlen(g)}
                  className="min-h-14 px-5 rounded-2xl border border-slate-200 font-bold text-slate-600 active:bg-slate-50"
                >
                  [ {t('mt.alle')} ]
                </button>
                <button
                  onClick={() => fertigMelden(g)}
                  disabled={gewaehltHier === 0}
                  className={`flex-1 min-h-14 rounded-2xl font-black text-base ${gewaehltHier > 0 ? 'bg-emerald-600 text-white active:scale-[0.99]' : 'bg-slate-100 text-slate-400'}`}
                >
                  {ZEICHEN.fertig} {t('mt.fertigKnopf', { n: gewaehltHier })}
                </button>
              </footer>
            )}
          </section>
        )
      })}

      {/* Versteckter Kamera-Auslöser (Systemkamera, Plan 14 #28) */}
      <input
        ref={kameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={fotoDa}
      />

      {/* Quittung mit 10 s Rückgängig – kein Bestätigungsdialog davor */}
      {pending && (
        <div className="fixed bottom-20 left-3 right-3 z-50 bg-slate-800 text-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-lg">
          <span className="text-emerald-400 text-xl shrink-0">{ZEICHEN.fertig}</span>
          <span className="flex-1 text-sm font-semibold">
            {t('mt.quittung', { anzahl: pending.anzahl, schritt: pending.schritt })}
            {pending.m2 > 0 && <span dir="ltr"> · {zahlText(pending.m2)} m²</span>}
          </span>
          <button
            onClick={rueckgaengig}
            className="min-h-11 px-3 rounded-xl text-sm font-black text-emerald-300 border border-emerald-300/40"
          >
            {t('melden.rueckgaengig')} {pending.uebrig}
          </button>
        </div>
      )}

      {/* Ablehnung / Fehler */}
      {fehler && (
        <div className="fixed bottom-20 left-3 right-3 z-50 bg-red-600 text-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-lg">
          <span className="flex-1 text-sm font-semibold">{fehler}</span>
          <button onClick={() => setFehler('')} aria-label={t('allg.schliessen')} className="min-h-11 px-2">
            <Icon name="x" className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Langes Antippen: Teilanteil in Zehnteln + Raum wartet (Grundliste) */}
      {sheet && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-end" onClick={() => setSheet(null)}>
          <div className="w-full bg-white rounded-t-3xl p-4 pb-8" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold text-slate-900 mb-3">
              {sheet.aufgabe.raumNummer} {sheet.aufgabe.raumName} · {tr({ de: sheet.aufgabe.schrittNameDe, ar: sheet.aufgabe.schrittNameAr })}
            </p>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">{t('mt.teilanteil')}</p>
            <div className="grid grid-cols-5 gap-2">
              {[0.1, 0.3, 0.5, 0.7, 0.9].map((wert) => (
                <button
                  key={wert}
                  onClick={() => angefangen(sheet.aufgabe, wert)}
                  className="min-h-12 rounded-xl border border-slate-200 font-bold text-slate-700 active:bg-sky-50"
                  dir="ltr"
                >
                  {Math.round(wert * 100)} %
                </button>
              ))}
            </div>
            <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">
              {ZEICHEN.wartet} {t('mt.raumWartet')}
            </p>
            {!sheet.grund ? (
              <div className="grid grid-cols-2 gap-2">
                {WARTET_GRUENDE.map((grund) => (
                  <button
                    key={grund}
                    onClick={() => setSheet({ ...sheet, grund })}
                    className="min-h-12 rounded-xl border border-amber-200 bg-amber-50 font-bold text-amber-800 active:bg-amber-100"
                  >
                    {t(`mt.grund.${grund}`)}
                  </button>
                ))}
              </div>
            ) : (
              <div>
                <p className="text-sm text-amber-800 mb-2">{t(`mt.grund.${sheet.grund}`)} – {t('mt.wiedervorlage')}:</p>
                <div className="grid grid-cols-4 gap-2">
                  {[[t('mt.tage3'), addTage(heute, 3)], [t('mt.woche1'), addTage(heute, 7)], [t('mt.woche2'), addTage(heute, 14)], [t('mt.ohneDatum'), '']].map(([beschriftung, bis]) => (
                    <button
                      key={beschriftung}
                      onClick={() => raumWartet(sheet.aufgabe, sheet.grund, bis)}
                      className="min-h-12 rounded-xl bg-amber-500 text-white font-bold text-sm active:scale-[0.98]"
                    >
                      {beschriftung}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
