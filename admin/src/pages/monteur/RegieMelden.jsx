import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '@shared/ui.jsx'
import { t, tr, useLang } from '@shared/i18n.js'
import { heuteISO } from '@shared/slots.js'
import { istMonteurRolle, istVorarbeiterRolle } from '@shared/auth.js'
import { istOffen } from '@shared/projektstatus.js'
import { fotoAufnehmen, vorschauAusAblage } from '@shared/fotoablage.js'
import { zahlText } from '@shared/aufmass.js'
import { useEntwurf } from '@shared/entwurf.js'
import {
  REGIE_BAUSTEINE, einsatzFuerTag, minutenVon, zeitText, stundenAus, stundenZeile,
} from '@shared/monteurtag.js'
import { useCollection, useContains, withStore } from '../../hooks.js'
import EntwurfHinweis from '../../components/EntwurfHinweis.jsx'
import { useKameraFrei, KameraGesperrt } from './FotoLeiste.jsx'

// REGIE MELDEN (Plan Kapitel 3.1, Bildschirm 5) – der Weg, an dem ein Drittel
// des Umsatzes hängt. Die Reihenfolge ist Absicht: WER HAT DAS ANGEORDNET
// steht ZUERST, nicht zuletzt – ohne Anordnung besteht nach § 2 Abs. 8 VOB/B
// grundsätzlich gar kein Vergütungsanspruch.
//
// Die Art der Anordnung sind drei SYMBOLKNÖPFE (💬 📄 ✉), keine deutschen
// Wörter – ein arabischsprachiger Monteur trifft sie ohne Übersetzung.
//
// Das Sechs-Punkte-Gate von V1 bleibt: EINREICHEN ist gesperrt, solange nicht
// alles steht, und darüber steht immer, was noch fehlt.
//
// Fotos werden beim AUSLÖSEN gesichert (lokale UUID, niemals eine
// Server-Kennung davor) – seit AP 6 über shared/fotoablage.js: drei Größen
// nach IndexedDB, fotos-Dokument 'lokal', Warteschlange lädt nach.

function lokaleUuid() {
  return crypto.randomUUID ? crypto.randomUUID() : `f-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const ANZEIGE_ARTEN = [
  ['muendlich', '💬', 'mt.anzeige.muendlich'],
  ['schriftlich', '📄', 'mt.anzeige.schriftlich'],
  ['mail', '✉', 'mt.anzeige.mail'],
]

function Stufe({ nummer, titel, fertig, children }) {
  return (
    <section className={`bg-white rounded-3xl border p-4 ${fertig ? 'border-emerald-300' : 'border-slate-200'}`}>
      <p className="flex items-center gap-2 font-bold text-slate-800 mb-3">
        <span className={`w-7 h-7 rounded-full inline-flex items-center justify-center text-sm font-black ${fertig ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
          {fertig ? '✓' : nummer}
        </span>
        {titel}
      </p>
      {children}
    </section>
  )
}

// Foto-Kachel: ein Tipp öffnet die Kamera, das Bild erscheint sofort.
// `aufGesperrt`: das Standalone-Gate fängt den Tipp VOR der Kamera ab.
function FotoKachel({ beschriftung, bild, aufFoto, aufGesperrt = null }) {
  const ref = useRef(null)
  return (
    <div>
      <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { const d = e.target.files?.[0]; e.target.value = ''; if (d) aufFoto(d) }} />
      <button
        onClick={() => (aufGesperrt ? aufGesperrt() : ref.current?.click())}
        className={`w-full min-h-28 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden ${bild ? 'border-emerald-300' : 'border-slate-300'}`}
      >
        {bild ? (
          <img src={bild} alt={beschriftung} className="w-full h-40 object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-slate-400 font-bold text-sm">
            <Icon name="foto" className="w-7 h-7" /> {beschriftung}
          </span>
        )}
      </button>
    </div>
  )
}

export default function RegieMelden({ user }) {
  useLang()
  const navigate = useNavigate()
  const { search } = useLocation()
  const heute = heuteISO()
  const projektAusLink = new URLSearchParams(search).get('projekt') || ''

  const projekte = useCollection('projekte')
  const users = useCollection('users')
  const einsaetze = useContains('einsaetze', 'tage', heute)
  const [projektWahl, setProjektWahl] = useState('')
  const projektId = projektAusLink || projektWahl
  const projekt = projekte.find((p) => p.id === projektId)
  const einsatz = useMemo(() => {
    const e = einsatzFuerTag(einsaetze, user, heute, { alleSehen: !istMonteurRolle(user?.rolle) })
    return e && e.projektId === projektId ? e : null
  }, [einsaetze, user, heute, projektId])

  // Die Kennung der Anordnung entsteht LOKAL beim Öffnen – Fotos hängen sich
  // sofort daran, ganz ohne Server.
  const anordnungId = useRef(lokaleUuid())

  const [angeordnetDurch, setAngeordnetDurch] = useState('')
  const [angeordnetAm, setAngeordnetAm] = useState(heute)
  const [anzeigeArt, setAnzeigeArt] = useState('')
  const [baustein, setBaustein] = useState(null)
  const [freitext, setFreitext] = useState('')
  const [vorherFoto, setVorherFoto] = useState(null)   // { id, dataUrl }
  const [nachherFoto, setNachherFoto] = useState(null)
  const [von, setVon] = useState(einsatz?.von || '07:00')
  const [bis, setBis] = useState(einsatz?.bis || '16:00')
  const [pauseMin, setPauseMin] = useState(30)
  const [gewaehlt, setGewaehlt] = useState(() => new Set([user?.userId].filter(Boolean)))
  const [fehler, setFehler] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const kamera = useKameraFrei(user)           // Standalone-Gate (AP 6)
  const [gateOffen, setGateOffen] = useState(false)

  // Kolonnen-Gate wie StundenKachel (Plan Bildschirm 4: „Wer darf absenden:
  // nur der Vorarbeiter"): ein einfacher Monteur meldet NUR die eigene Zeile –
  // die Firestore-Regel /stunden würde fremde Zeilen ohnehin ablehnen, und
  // ein serverseitig halb geschriebener Vorgang wäre schlimmer als das Gate.
  const darfKolonne = !istMonteurRolle(user?.rolle) || istVorarbeiterRolle(user?.rolle)

  // Entwurfs-Sicherung (Kernwunsch „Zwischendinge sollen nicht weg sein"):
  // ALLE fünf Pflichtschritte + die LOKALE Anordnungs-Kennung wandern in den
  // localStorage. Ohne die Kennung würden die bereits gesicherten Fotos beim
  // Neuöffnen zu Waisen (anordnungId würde neu gewürfelt).
  const entwurfDaten = {
    projektId,
    anordnungId: anordnungId.current,
    angeordnetDurch,
    angeordnetAm,
    anzeigeArt,
    bausteinId: baustein?.id || '',
    freitext,
    von,
    bis,
    pauseMin,
    gewaehlt: [...gewaehlt],
    vorherFotoId: vorherFoto?.id || '',
    nachherFotoId: nachherFoto?.id || '',
  }
  const entwurf = useEntwurf('regie-meldung', entwurfDaten, true)

  function entwurfZurueckholen() {
    const alt = entwurf.wiederherstellen()
    if (!alt) return
    if (alt.anordnungId) anordnungId.current = alt.anordnungId
    if (!projektAusLink && alt.projektId) setProjektWahl(alt.projektId)
    setAngeordnetDurch(alt.angeordnetDurch || '')
    if (alt.angeordnetAm) setAngeordnetAm(alt.angeordnetAm)
    setAnzeigeArt(alt.anzeigeArt || '')
    setBaustein(REGIE_BAUSTEINE.find((b) => b.id === alt.bausteinId) || null)
    setFreitext(alt.freitext || '')
    if (alt.von) setVon(alt.von)
    if (alt.bis) setBis(alt.bis)
    if (alt.pauseMin !== undefined) setPauseMin(alt.pauseMin)
    if (Array.isArray(alt.gewaehlt) && alt.gewaehlt.length) setGewaehlt(new Set(alt.gewaehlt))
    // Fotos liegen sicher in IndexedDB – die Vorschau wird daraus neu gebaut.
    for (const [fotoId, setzer] of [[alt.vorherFotoId, setVorherFoto], [alt.nachherFotoId, setNachherFoto]]) {
      if (!fotoId) continue
      vorschauAusAblage(fotoId).then((url) => setzer({ id: fotoId, dataUrl: url }))
    }
  }

  // Der Einsatz kommt aus dem Live-Abo NACH dem ersten Aufbau – Von/Bis
  // dann nachziehen (Vorbelegung aus dem Einsatz, Plan Bildschirm 5).
  useEffect(() => {
    if (einsatz?.von) setVon(einsatz.von)
    if (einsatz?.bis) setBis(einsatz.bis)
  }, [einsatz?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const mannschaft = useMemo(() => {
    const ids = einsatz?.mitarbeiterIds?.length ? einsatz.mitarbeiterIds : [user?.userId].filter(Boolean)
    return ids
      .map((id) => users.find((u) => u.id === id) || (id === user?.userId ? { id, name: user?.name || '' } : null))
      .filter(Boolean)
  }, [einsatz, users, user])

  const stunden = stundenAus(von, bis, pauseMin)

  // AP 6: über die Foto-Ablage – IndexedDB zuerst, Warteschlange lädt nach.
  // Ein Vorher-Foto der Regie geht als 'vorher' sofort raus (Verfallsregel).
  async function fotoSichern(datei, phase) {
    let ergebnis
    try {
      ergebnis = await withStore((s) => fotoAufnehmen(datei, {
        projektId,
        raumId: '',
        anordnungId: anordnungId.current,
        phase,
        kontext: 'regie',
        rolle: 'meldebeleg',
        datum: heute,
        von: user?.name || '',
        vonId: user?.userId || '',
      }, s))
    } catch (e) {
      ergebnis = { ok: false }
    }
    if (!ergebnis.ok) {
      setFehler(t(ergebnis.grund === 'ablage' ? 'ft.ablageFehler' : 'mt.fotoFehler'))
      return
    }
    if (ergebnis.speicherWarnung) setFehler(t('ft.speicherVoll'))
    const eintrag = { id: ergebnis.id, dataUrl: ergebnis.vorschauUrl }
    if (phase === 'vorher') setVorherFoto(eintrag)
    else setNachherFoto(eintrag)
  }

  const titel = baustein ? baustein.de : ''
  const fehlt = []
  if (!angeordnetDurch.trim() || !anzeigeArt) fehlt.push(t('mt.schritt1'))
  if (!titel && !freitext.trim()) fehlt.push(t('mt.schritt2'))
  if (!vorherFoto) fehlt.push(t('mt.schritt3'))
  if (stunden <= 0 || gewaehlt.size === 0) fehlt.push(t('mt.schritt4'))
  if (!nachherFoto) fehlt.push(t('mt.schritt5'))

  async function einreichen() {
    if (fehlt.length || laeuft) return
    setLaeuft(true)
    try {
      // EIN Vorgang (writeBatch) statt await-Schleife: Anordnung + alle
      // Regiestunden-Zeilen zusammen. Offline quittiert schreibeVorgang nach
      // spätestens 2500 ms (Muster meldeAufgaben) – nichts hängt, und es
      // bleibt nie ein Teilzustand (Anordnung ohne Stunden) stehen.
      const beschreibung = [titel, freitext.trim()].filter(Boolean).join(' – ')
      const ziel = mannschaft.filter((m) => gewaehlt.has(m.id) && (darfKolonne || m.id === user?.userId))
      const sets = [
        // 1. Die Anordnung – das Dokument, an dem der Vergütungsanspruch hängt.
        {
          coll: 'regieanordnungen',
          daten: {
            id: anordnungId.current,
            projektId,
            raumIds: [],
            titel: titel || freitext.trim().slice(0, 80),
            beschreibung: freitext.trim(),
            angeordnetDurch: angeordnetDurch.trim(),
            angeordnetAm,
            anzeigeArt,
            belegFotoId: '',
            vorherFotoId: vorherFoto.id,
            nachherFotoId: nachherFoto.id,
            vorgelegtAm: '',
            zugangsnachweis: 'unbekannt',
            status: 'ausgefuehrt',
            erstelltAm: Date.now(),
            vonId: user?.userId || '',
            vonName: user?.name || '',
          },
        },
        // 2. Die Regiestunden – deterministische Kennungen, Wiederholen ersetzt.
        ...ziel.map((mitglied) => ({
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
            art: 'regie',
            taetigkeit: beschreibung,
            anordnungId: anordnungId.current,
            geaendertVon: user?.name || '',
          }),
        })),
      ]
      await withStore((s) => s.schreibeVorgang({ sets }, { onFehler: () => setFehler(t('mt.meldungFehler')) }))
      entwurf.loeschen()
      navigate('/monteur')
    } catch (e) {
      setFehler(t('mt.meldungFehler'))
    } finally {
      setLaeuft(false)
    }
  }

  // Ohne Baustelle zuerst wählen (kommt man ohne HEUTE-Einsatz hierher).
  // Der Entwurfs-Hinweis steht auch HIER: die Wiederherstellung setzt die
  // gesicherte Baustelle gleich mit.
  if (!projektId) {
    const offene = projekte.filter((p) => istOffen(p.status))
    return (
      <div className="p-4 space-y-3 pb-24">
        <EntwurfHinweis eintrag={entwurf.gefunden} onWiederherstellen={entwurfZurueckholen} onVerwerfen={entwurf.verwerfen} />
        <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-2xl px-4 py-3">{t('mt.baustelleWaehlen')}</p>
        {offene.map((p) => (
          <button key={p.id} onClick={() => setProjektWahl(p.id)}
            className="w-full min-h-16 text-start bg-white rounded-2xl border border-slate-200 px-4 font-bold text-slate-800 active:bg-slate-50">
            {p.name}
            <span className="block text-xs font-normal text-slate-400">{p.nummer}</span>
          </button>
        ))}
      </div>
    )
  }

  const zeitStufe = (beschriftung, wert, setzer) => (
    <div className="flex items-center gap-1">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-400 w-10">{beschriftung}</span>
      <button onClick={() => setzer(zeitText(Math.max(0, minutenVon(wert) - 15)))} className="w-11 min-h-11 rounded-xl border border-slate-200 font-black text-slate-600">−</button>
      <span className="w-16 text-center font-bold text-slate-900" dir="ltr">{wert}</span>
      <button onClick={() => setzer(zeitText(Math.min(24 * 60, minutenVon(wert) + 15)))} className="w-11 min-h-11 rounded-xl border border-slate-200 font-black text-slate-600">+</button>
    </div>
  )

  return (
    <div className="p-4 space-y-3 pb-28">
      <EntwurfHinweis eintrag={entwurf.gefunden} onWiederherstellen={entwurfZurueckholen} onVerwerfen={entwurf.verwerfen} />
      <div className="flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="min-h-11 px-2 text-slate-400">
          <Icon name="arrowLeft" className="w-5 h-5" />
        </button>
        <div>
          <p className="font-bold text-lg text-slate-900 leading-tight">{t('mt.regieMelden')}</p>
          <p className="text-sm text-slate-500">{projekt?.name}</p>
        </div>
      </div>

      {/* Schritt 1 – ZUERST: Wer hat das angeordnet? */}
      <Stufe nummer={1} titel={t('mt.schritt1')} fertig={Boolean(angeordnetDurch.trim() && anzeigeArt)}>
        <input
          value={angeordnetDurch}
          onChange={(e) => setAngeordnetDurch(e.target.value)}
          placeholder={t('mt.angeordnetDurch')}
          className="w-full min-h-12 rounded-xl border border-slate-200 px-3 text-sm mb-2"
        />
        <input
          type="date"
          value={angeordnetAm}
          onChange={(e) => setAngeordnetAm(e.target.value)}
          className="w-full min-h-12 rounded-xl border border-slate-200 px-3 text-sm mb-2"
          dir="ltr"
        />
        <div className="grid grid-cols-3 gap-2">
          {ANZEIGE_ARTEN.map(([id, symbol, schluessel]) => (
            <button
              key={id}
              onClick={() => setAnzeigeArt(id)}
              className={`min-h-14 rounded-2xl border-2 flex flex-col items-center justify-center gap-0.5 ${anzeigeArt === id ? 'border-amber-400 bg-amber-50' : 'border-slate-200'}`}
            >
              <span className="text-2xl leading-none">{symbol}</span>
              <span className="text-[11px] font-bold text-slate-500">{t(schluessel)}</span>
            </button>
          ))}
        </div>
      </Stufe>

      {/* Schritt 2: Was? – zweisprachige Bausteine + Freitext */}
      <Stufe nummer={2} titel={t('mt.schritt2')} fertig={Boolean(titel || freitext.trim())}>
        <div className="grid grid-cols-2 gap-2 mb-2">
          {REGIE_BAUSTEINE.map((b) => (
            <button
              key={b.id}
              onClick={() => setBaustein(baustein?.id === b.id ? null : b)}
              className={`min-h-12 rounded-xl border px-2 text-sm font-semibold ${baustein?.id === b.id ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-slate-200 text-slate-600'}`}
            >
              {tr(b)}
            </button>
          ))}
        </div>
        <textarea
          value={freitext}
          onChange={(e) => setFreitext(e.target.value)}
          placeholder={t('mt.freitext')}
          rows={2}
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        />
      </Stufe>

      {/* Schritt 3: Vorher-Foto (Pflicht) */}
      <Stufe nummer={3} titel={t('mt.schritt3')} fertig={Boolean(vorherFoto)}>
        <FotoKachel
          beschriftung={t('mt.fotoAufnehmen')} bild={vorherFoto?.dataUrl}
          aufFoto={(d) => fotoSichern(d, 'vorher')}
          aufGesperrt={kamera.geprueft && !kamera.frei ? () => setGateOffen(true) : null}
        />
      </Stufe>

      {/* Schritt 4: Stunden (vorbelegt aus dem Einsatz) */}
      <Stufe nummer={4} titel={t('mt.schritt4')} fertig={stunden > 0 && gewaehlt.size > 0}>
        <div className="space-y-2 mb-2">
          {zeitStufe(t('mt.von'), von, setVon)}
          {zeitStufe(t('mt.bisZeit'), bis, setBis)}
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-400 w-10">{t('mt.pause')}</span>
            <button onClick={() => setPauseMin((p) => Math.max(0, p - 15))} className="w-11 min-h-11 rounded-xl border border-slate-200 font-black text-slate-600">−</button>
            <span className="w-16 text-center font-bold text-slate-900" dir="ltr">{pauseMin} {t('mt.minKurz')}</span>
            <button onClick={() => setPauseMin((p) => p + 15)} className="w-11 min-h-11 rounded-xl border border-slate-200 font-black text-slate-600">+</button>
          </div>
        </div>
        {mannschaft.map((m) => {
          const an = gewaehlt.has(m.id)
          // Kolonnen-Gate: fremde Zeilen setzt nur Vorarbeiter/Büro ab –
          // die Firestore-Regel /stunden lehnt sie sonst serverseitig ab.
          const sperrig = !darfKolonne && m.id !== user?.userId
          return (
            <button
              key={m.id}
              disabled={sperrig}
              onClick={() => {
                if (sperrig) return
                setGewaehlt((alt) => {
                  const neu = new Set(alt)
                  if (neu.has(m.id)) neu.delete(m.id)
                  else neu.add(m.id)
                  return neu
                })
              }}
              className={`w-full min-h-12 flex items-center gap-3 border-b border-slate-100 last:border-b-0 px-1 text-start ${sperrig ? 'opacity-40' : ''}`}
            >
              <span className={`text-2xl leading-none ${an ? 'text-praxis-600' : 'text-slate-300'}`}>{an ? '☑' : '☐'}</span>
              <span className="flex-1 font-semibold text-slate-800">{m.name}</span>
              <span className="font-bold text-slate-900" dir="ltr">{an ? `${zahlText(stunden)} ${t('mt.stdKurz')}` : ''}</span>
            </button>
          )
        })}
        {!darfKolonne && mannschaft.length > 1 && (
          <p className="mt-2 text-[12px] text-slate-400">{t('mt.nurEigeneZeile')}</p>
        )}
      </Stufe>

      {/* Schritt 5: Nachher-Foto (Pflicht) */}
      <Stufe nummer={5} titel={t('mt.schritt5')} fertig={Boolean(nachherFoto)}>
        <FotoKachel
          beschriftung={t('mt.fotoAufnehmen')} bild={nachherFoto?.dataUrl}
          aufFoto={(d) => fotoSichern(d, 'nachher')}
          aufGesperrt={kamera.geprueft && !kamera.frei ? () => setGateOffen(true) : null}
        />
      </Stufe>

      {/* Das Gate: darüber steht immer, was noch fehlt */}
      {fehlt.length > 0 && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          {t('mt.fehltNoch')} {fehlt.join(' · ')}
        </p>
      )}
      <button
        onClick={einreichen}
        disabled={fehlt.length > 0 || laeuft}
        className={`w-full min-h-14 rounded-2xl font-black text-base ${fehlt.length === 0 && !laeuft ? 'bg-amber-500 text-white active:scale-[0.99]' : 'bg-slate-100 text-slate-400'}`}
      >
        {t('mt.einreichen')}
      </button>

      {fehler && (
        <div className="fixed bottom-20 left-3 right-3 z-50 bg-red-600 text-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-lg">
          <span className="flex-1 text-sm font-semibold">{fehler}</span>
          <button onClick={() => setFehler('')} aria-label={t('allg.schliessen')} className="min-h-11 px-2">
            <Icon name="x" className="w-4 h-4" />
          </button>
        </div>
      )}

      {gateOffen && <KameraGesperrt grund={kamera.grund} onClose={() => setGateOffen(false)} />}
    </div>
  )
}
