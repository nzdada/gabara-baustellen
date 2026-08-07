import { useEffect, useMemo, useState } from 'react'
import { istMonteurRolle } from '@shared/auth.js'
import Modal from './Modal.jsx'
import DatumWahl from './DatumWahl.jsx'
import { Icon } from '@shared/ui.jsx'
import { FeldLabel } from './InfoHinweis.jsx'
import { HINWEIS } from '../hinweise.js'
import { heuteISO, addTage, endeZeit, zuMinuten } from '@shared/slots.js'
import { withStore, useCollection, useWhere } from '../hooks.js'
import { kalenderVerbunden, eventAnlegen } from '@shared/googleCalendar.js'
import { istOffen, PROJEKT_STATUS } from '@shared/projektstatus.js'
import { TEAM_FARBEN } from '@shared/teams.js'
import { useLang, t } from '@shared/i18n.js'
import { useEntwurf } from '@shared/entwurf.js'
import EntwurfHinweis from './EntwurfHinweis.jsx'

// Termin-Kategorien der Baustellen-Planung (Reihenfolge = Anzeige im Select)
export const KATEGORIEN = [
  ['umsetzung', 'kat.umsetzung'],
  ['fertigstellung', 'kat.fertigstellung'],
  ['reklamation', 'kat.reklamation'],
  ['krank', 'kat.krank'],
  ['privat', 'kat.privat'],
]

// Der Anzeigename einer Kategorie. WICHTIG: KATEGORIEN trägt seit der
// Zweisprachigkeit nur noch SCHLÜSSEL – wer den zweiten Eintrag direkt als Text
// verwendet, schreibt „kat.umsetzung" in den Termin-Titel und damit in die
// Datenbank. Immer über diese Funktion gehen.
export function katName(id) {
  const treffer = KATEGORIEN.find(([k]) => k === id)
  return treffer ? t(treffer[1]) : t('kat.umsetzung')
}

// Häufige Einsatzlängen als Schnellwahl (setzt „Bis" relativ zu „Von")
const DAUER_CHIPS = [60, 120, 240, 480, 600]

function kundeName(k) {
  if (!k) return ''
  return k.firma || `${k.vorname || ''} ${k.nachname || ''}`.trim()
}

function dauerText(von, bis) {
  const a = zuMinuten(von || '00:00')
  const b = zuMinuten(bis || '00:00')
  const diff = b - a
  if (diff <= 0) return ''
  const std = Math.floor(diff / 60)
  const rest = diff % 60
  return `${std > 0 ? `${std} ${t('allg.stunden')}` : ''}${rest ? ` ${rest} ${t('nt.minuten')}` : ''}`.trim()
}

function naechsteProjektNummer(projekte) {
  const jahr = new Date().getFullYear()
  let max = 0
  for (const p of projekte) {
    const m = /^P-(\d{4})-(\d+)$/.exec(p.nummer || '')
    if (m && Number(m[1]) === jahr) max = Math.max(max, Number(m[2]))
  }
  return `P-${jahr}-${String(max + 1).padStart(3, '0')}`
}

// bearbeiten: vorhandener INTERNER Termin -> Dialog wird zum Editor (Zeiten ändern, löschen)
export default function NeuerTermin({ patients, appointments, vorbelegt = {}, bearbeiten = null, onClose, onAngelegt }) {
  useLang()
  const [typ, setTyp] = useState(bearbeiten ? 'intern' : 'einsatz') // einsatz | intern (Blocker)
  const [grund, setGrund] = useState(bearbeiten?.behandlung || '')
  const [datum, setDatum] = useState(bearbeiten?.datum || vorbelegt.datum || heuteISO())
  const [von, setVon] = useState(bearbeiten?.start || vorbelegt.start || '07:00')
  const [bis, setBis] = useState(
    bearbeiten?.ende || (vorbelegt.start ? endeZeit(vorbelegt.start, 480) : '16:00')
  )
  const [zeigeKalender, setZeigeKalender] = useState(false)
  const [suche, setSuche] = useState('')
  const [patientId, setPatientId] = useState(vorbelegt.patientId || null)
  const [titel, setTitel] = useState(vorbelegt.titel || vorbelegt.behandlung || '')
  const [kategorie, setKategorie] = useState(vorbelegt.kategorie || 'umsetzung')
  const [projektId, setProjektId] = useState(vorbelegt.projektId || '')
  const [beschreibung, setBeschreibung] = useState(vorbelegt.beschreibung || '')
  const [mitarbeiterIds, setMitarbeiterIds] = useState(bearbeiten?.mitarbeiterIds || vorbelegt.mitarbeiterIds || [])
  const [positionsIds, setPositionsIds] = useState([])
  const [neuesProjekt, setNeuesProjekt] = useState(false)
  const [fehler, setFehler] = useState('')
  const [laedt, setLaedt] = useState(false)

  // Entwurfs-Sicherung: der Dialog hat viele Einzelfelder, deshalb erst
  // zu EINEM Objekt bündeln. useMemo hält die Referenz stabil, sonst würde
  // der Sicherungs-Effekt bei jedem Tastendruck neu aufgesetzt.
  const entwurfsDaten = useMemo(
    () => ({ typ, grund, datum, von, bis, titel, kategorie, projektId, beschreibung, patientId, mitarbeiterIds, positionsIds }),
    [typ, grund, datum, von, bis, titel, kategorie, projektId, beschreibung, patientId, mitarbeiterIds, positionsIds],
  )
  const entwurf = useEntwurf(`termin:${bearbeiten?.id || 'neu'}`, entwurfsDaten)

  function entwurfUebernehmen() {
    const alt = entwurf.wiederherstellen()
    if (!alt) return
    if (alt.typ) setTyp(alt.typ)
    if (alt.grund !== undefined) setGrund(alt.grund)
    if (alt.datum) setDatum(alt.datum)
    if (alt.von) setVon(alt.von)
    if (alt.bis) setBis(alt.bis)
    if (alt.titel !== undefined) setTitel(alt.titel)
    if (alt.kategorie) setKategorie(alt.kategorie)
    if (alt.projektId !== undefined) setProjektId(alt.projektId)
    if (alt.beschreibung !== undefined) setBeschreibung(alt.beschreibung)
    if (alt.patientId !== undefined) setPatientId(alt.patientId)
    if (Array.isArray(alt.mitarbeiterIds)) setMitarbeiterIds(alt.mitarbeiterIds)
    if (Array.isArray(alt.positionsIds)) setPositionsIds(alt.positionsIds)
  }

  const alleUsers = useCollection('users')
  const monteure = useMemo(() => alleUsers.filter((u) => istMonteurRolle(u.rolle) && u.aktiv !== false), [alleUsers])
  const gewaehlteNamen = mitarbeiterIds.map((id) => alleUsers.find((u) => u.id === id)?.name).filter(Boolean)

  const projekte = useCollection('projekte')
  const projektAuswahl = useMemo(
    () => projekte
      .filter((p) => istOffen(p.status) || p.id === projektId)
      .sort((a, b) => (a.nummer || '').localeCompare(b.nummer || '')),
    [projekte, projektId]
  )
  // LV-Positionen des gewählten Projekts = auswählbare Aufgaben für diesen Einsatz
  const lvPositionen = useWhere('lvpositionen', 'projektId', projektId || '')
  const aufgaben = useMemo(
    () => lvPositionen.filter((p) => p.typ === 'position').sort((a, b) => (a.sort || 0) - (b.sort || 0)),
    [lvPositionen]
  )

  // Terminanzahl je Tag für die Punkte im Datepicker
  const marker = useMemo(() => {
    const m = {}
    for (const a of appointments || []) {
      if (a.status === 'abgesagt') continue
      m[a.datum] = (m[a.datum] || 0) + 1
    }
    return m
  }, [appointments])

  // Kommt der Dialog mit vorbelegter Baustelle (Button „Aufgabe" im Baustellen-Panel),
  // Kunde und Titelvorschlag nachziehen, sobald die Projekte geladen sind.
  useEffect(() => {
    if (!vorbelegt.projektId || patientId) return
    const p = projekte.find((x) => x.id === vorbelegt.projektId)
    if (!p) return
    if (p.kundeId && patients.some((k) => k.id === p.kundeId)) setPatientId(p.kundeId)
    setTitel((alt) => alt.trim() || `${katName(kategorie)} – ${p.name}`)
    // Nur beim Laden der Projekte – danach entscheidet der Benutzer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projekte, vorbelegt.projektId])

  function toggleMitarbeiter(id) {
    setMitarbeiterIds((alt) => (alt.includes(id) ? alt.filter((x) => x !== id) : [...alt, id]))
  }

  function toggleAufgabe(id) {
    setPositionsIds((alt) => (alt.includes(id) ? alt.filter((x) => x !== id) : [...alt, id]))
  }

  function projektWaehlen(id) {
    setProjektId(id)
    setPositionsIds([])
    const p = projekte.find((x) => x.id === id)
    if (!p) return
    if (p.kundeId && patients.some((k) => k.id === p.kundeId)) {
      setPatientId(p.kundeId)
      setSuche('')
    }
    if (!titel.trim()) {
      setTitel(`${katName(kategorie)} – ${p.name}`)
    }
  }

  function vonSetzen(neuVon) {
    const alteDauer = Math.max(30, zuMinuten(bis || '00:00') - zuMinuten(von || '00:00'))
    setVon(neuVon)
    if (zuMinuten(bis || '00:00') <= zuMinuten(neuVon)) setBis(endeZeit(neuVon, alteDauer))
  }

  async function internLoeschen() {
    if (!bearbeiten || !confirm(t('nt.internLoeschenFrage'))) return
    await withStore(async (s) => {
      await s.remove('appointments', bearbeiten.id)
      if (s.mode === 'firebase') await s.loescheSlot(bearbeiten.id)
    })
    onClose()
  }

  const treffer = useMemo(() => {
    const q = suche.trim().toLowerCase()
    const sortiert = [...patients].sort((a, b) => kundeName(a).localeCompare(kundeName(b), 'de'))
    if (!q) return sortiert.slice(0, 8)
    return sortiert
      .filter((p) =>
        `${p.firma || ''} ${p.vorname || ''} ${p.nachname || ''} ${p.ansprechpartner || ''}`.toLowerCase().includes(q) ||
        (p.telefon || '').includes(q) ||
        (p.plzOrt || '').toLowerCase().includes(q)
      )
      .slice(0, 8)
  }, [suche, patients])

  const gewaehlt = patients.find((p) => p.id === patientId)
  const dauerHinweis = dauerText(von, bis)

  async function anlegen() {
    setFehler('')
    const intern = typ === 'intern'
    const ohneKunde = kategorie === 'krank' || kategorie === 'privat'
    if (!datum) return setFehler(t('nt.datumFehlt'))
    if (!von || !bis) return setFehler(t('nt.zeitFehlt'))
    if (zuMinuten(bis) <= zuMinuten(von)) return setFehler(t('nt.bisVorVon'))
    if (!intern && !ohneKunde && !gewaehlt && !projektId) {
      return setFehler(t('nt.kundeFehlt'))
    }
    // Ohne Zuweisung taucht der Einsatz bei keinem Monteur auf dem Handy auf
    if (!intern && mitarbeiterIds.length === 0
      && !confirm(t('nt.ohneMitarbeiter'))) {
      return
    }
    setLaedt(true)
    try {
      // BEARBEITEN eines bestehenden internen Termins
      if (bearbeiten) {
        await withStore(async (s) => {
          const patch = {
            behandlung: grund.trim() || 'Intern',
            titel: grund.trim() || 'Intern',
            patientName: `Intern: ${grund.trim() || 'Blockiert'}`,
            arzt: gewaehlteNamen[0] || '',
            mitarbeiterIds,
            datum, start: von, ende: bis,
          }
          await s.update('appointments', bearbeiten.id, patch)
          if (s.mode === 'firebase') await s.schreibeSlot({ ...bearbeiten, ...patch })
        })
        entwurf.loeschen()
        onAngelegt?.()
        onClose()
        return
      }
      const basis = {
        datum,
        start: von,
        ende: bis,
        mitarbeiterIds,
        erledigt: false,
        erledigtAm: '',
        status: 'bestaetigt',
        arzt: gewaehlteNamen[0] || '',
        summary: { text: '', checks: [], updatedAt: null, updatedBy: '' },
        googleEventId: null,
        sprache: 'de',
        createdAt: Date.now(),
        stornoToken: crypto.randomUUID(),
      }
      const termin = intern
        ? {
            ...basis,
            intern: true,
            patientId: '',
            patientName: `Intern: ${grund.trim() || 'Blockiert'}`,
            behandlung: grund.trim() || 'Intern',
            titel: grund.trim() || 'Intern',
            kategorie: 'privat',
            projektId: '',
            beschreibung: '',
            positionsIds: [],
            erinnerung: 'gesendet',
            patientEmail: '',
            feedbackToken: '',
          }
        : {
            ...basis,
            patientId: gewaehlt?.id || '',
            patientName: kundeName(gewaehlt),
            behandlung: titel.trim() || 'Einsatz',
            titel: titel.trim() || 'Einsatz',
            kategorie,
            projektId: projektId || '',
            beschreibung: beschreibung.trim(),
            positionsIds,
            erinnerung: 'offen',
            befunde: [],
            leistungen: [],
            rechnung: 'offen',
            patientEmail: gewaehlt?.email || '',
            feedbackToken: crypto.randomUUID(),
          }
      await withStore(async (s) => {
        const id = await s.add('appointments', termin)
        termin.id = id
        if (s.mode === 'firebase') await s.schreibeSlot(termin)
        if (!intern && kalenderVerbunden()) {
          try {
            const eventId = await eventAnlegen(termin, gewaehlt?.email || '')
            if (eventId) await s.update('appointments', id, { googleEventId: eventId })
          } catch (e) { /* Google nicht erreichbar – Termin bleibt trotzdem bestehen */ }
        }
      })
      entwurf.loeschen()
      onAngelegt?.()
      onClose()
    } catch (e) {
      setFehler(e.message || t('nt.fehlerAnlegen'))
    } finally {
      setLaedt(false)
    }
  }

  const feld = 'w-full rounded-feld border border-rahmen px-3.5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500'
  const beschriftung = 'text-sm font-medium text-schrift'

  return (
    <Modal titel={t(bearbeiten ? 'nt.titelBearbeiten' : 'nt.titelNeu')} onClose={onClose} breite="max-w-2xl">
      <div className="space-y-4">
        <EntwurfHinweis
          eintrag={entwurf.gefunden}
          onWiederherstellen={entwurfUebernehmen}
          onVerwerfen={entwurf.verwerfen}
        />
        {/* Termin-Art */}
        <div className={`flex gap-2 ${bearbeiten ? 'hidden' : ''}`}>
          {[['einsatz', t('nt.artEinsatz')], ['intern', t('nt.artIntern')]].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTyp(key)}
              className={`flex-1 text-sm font-semibold rounded-feld px-3 py-2.5 border-2 transition ${
                typ === key
                  ? key === 'intern' ? 'bg-schrift border-schrift text-white' : 'bg-praxis-600 border-praxis-600 text-white'
                  : 'border-rahmen text-schrift-leise hover:border-praxis-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {typ === 'intern' && (
          <label className="block">
            <span className={beschriftung}>{t('nt.bezeichnung')}</span>
            <input
              autoFocus
              value={grund}
              onChange={(e) => setGrund(e.target.value)}
              placeholder={t('nt.bezeichnungPlatz')}
              className={`mt-1.5 ${feld}`}
            />
          </label>
        )}

        {/* ---------- Datum + Zeit ---------- */}
        <div className="rounded-karte border border-rahmen bg-gedeckt/60 p-3.5 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block flex-1 min-w-[190px]">
              <span className={beschriftung}>{t('allg.datum')}</span>
              <div className="mt-1.5 flex gap-2">
                <input
                  type="date"
                  value={datum}
                  onChange={(e) => setDatum(e.target.value)}
                  className={`${feld} bg-karte`}
                />
                <button
                  type="button"
                  onClick={() => setZeigeKalender(!zeigeKalender)}
                  title={t('nt.kalenderZeigen')}
                  className={`shrink-0 px-3.5 rounded-feld border transition ${
                    zeigeKalender ? 'bg-praxis-600 border-praxis-600 text-white' : 'bg-karte border-rahmen text-schrift-leise hover:border-praxis-400'
                  }`}
                >
                  <Icon name="calendar" className="w-5 h-5" />
                </button>
              </div>
            </label>
            <div className="flex gap-1.5">
              {[[t('kalender.heute'), 0], [t('nt.morgen'), 1], [t('nt.plus7'), 7]].map(([label, versatz]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setDatum(addTage(heuteISO(), versatz))}
                  className="text-xs font-semibold rounded-full px-3 py-2 bg-karte border border-rahmen text-schrift hover:border-praxis-400"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {zeigeKalender && (
            <DatumWahl wert={datum} onWert={(iso) => { setDatum(iso); setZeigeKalender(false) }} marker={marker} />
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={beschriftung}>{t('allg.von')}</span>
              <input
                type="time"
                step="300"
                value={von}
                onChange={(e) => vonSetzen(e.target.value)}
                className={`mt-1.5 ${feld} bg-karte text-base font-semibold`}
              />
            </label>
            <label className="block">
              <span className={beschriftung}>{t('allg.bis')}</span>
              <input
                type="time"
                step="300"
                value={bis}
                onChange={(e) => setBis(e.target.value)}
                className={`mt-1.5 ${feld} bg-karte text-base font-semibold`}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-schrift-zart mr-1">{t('nt.dauer')}:</span>
            {DAUER_CHIPS.map((minuten) => (
              <button
                key={minuten}
                type="button"
                onClick={() => setBis(endeZeit(von || '07:00', minuten))}
                className="text-xs font-semibold rounded-full px-3 py-1.5 bg-karte border border-rahmen text-schrift hover:border-praxis-400"
              >
                {minuten / 60} {t('allg.stunden')}
              </button>
            ))}
            {dauerHinweis && (
              <span className="ml-auto text-xs font-bold text-praxis-700 bg-praxis-50 rounded-full px-3 py-1.5">
                {dauerHinweis}
              </span>
            )}
          </div>
          <p className="text-[12px] text-schrift-zart">
            {t('nt.zeitenFrei')}
          </p>
        </div>

        {typ === 'einsatz' && (
          <>
            {/* ---------- Baustelle / Projekt ---------- */}
            <div>
              <div className="flex items-center justify-between">
                <span className={beschriftung}>{t('nt.baustelle')}</span>
                <button
                  type="button"
                  onClick={() => setNeuesProjekt(true)}
                  className="text-xs font-semibold text-praxis-700 hover:underline"
                >
                  {t('nt.neuesProjekt')}
                </button>
              </div>
              <select
                value={projektId}
                onChange={(e) => projektWaehlen(e.target.value)}
                className={`mt-1.5 ${feld} bg-karte`}
              >
                <option value="">{t('nt.keineBaustelle')}</option>
                {projektAuswahl.map((p) => (
                  <option key={p.id} value={p.id}>{p.nummer} · {p.name}</option>
                ))}
              </select>

              {/* Aufgaben aus dem LV der gewählten Baustelle */}
              {projektId && (
                <div className="mt-2 rounded-karte border border-rahmen bg-karte p-3">
                  <p className="text-xs font-bold text-schrift mb-2">
                    <FeldLabel info={HINWEIS.terminAufgaben}>{t('nt.aufgaben')}</FeldLabel>
                    {positionsIds.length > 0 && (
                      <span className="ml-2 text-[11px] font-bold bg-praxis-600 text-white rounded-full px-2 py-0.5">
                        {positionsIds.length}
                      </span>
                    )}
                  </p>
                  {aufgaben.length === 0 ? (
                    <p className="text-xs text-schrift-zart">
                      {t('nt.keineLvPositionen')}
                    </p>
                  ) : (
                    <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
                      {aufgaben.map((p) => {
                        const an = positionsIds.includes(p.id)
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => toggleAufgabe(p.id)}
                            className={`w-full text-left flex items-start gap-2 rounded-feld px-2.5 py-2 border transition ${
                              an ? 'bg-praxis-50 border-praxis-300' : 'bg-karte border-rahmen hover:border-rahmen-stark'
                            }`}
                          >
                            <span className={`mt-0.5 w-4 h-4 rounded shrink-0 border flex items-center justify-center ${
                              an ? 'bg-praxis-600 border-praxis-600 text-white' : 'border-rahmen-stark'
                            }`}>
                              {an && <Icon name="check" className="w-3 h-3" strokeWidth={3} />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-xs text-schrift-zart font-mono">{p.oz}</span>
                              <span className="block text-sm text-schrift leading-snug">{p.kurztext}</span>
                            </span>
                            <span className="text-xs text-schrift-zart whitespace-nowrap shrink-0">
                              {p.menge} {p.einheit}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ---------- Kunde ---------- */}
            <div>
              <span className={beschriftung}>
                {t('kunden.kunde')} {kategorie === 'krank' || kategorie === 'privat' ? t('nt.optional') : ''}
              </span>
              {gewaehlt ? (
                <div className="mt-1.5 flex items-center justify-between bg-praxis-50 border border-praxis-200 rounded-feld px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-schrift-stark text-sm truncate">{kundeName(gewaehlt)}</p>
                    <p className="text-xs text-schrift-leise truncate">
                      {[gewaehlt.ansprechpartner, gewaehlt.telefon, gewaehlt.plzOrt].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setPatientId(null); setSuche('') }}
                    className="shrink-0 text-xs text-praxis-700 font-medium hover:underline"
                  >
                    {t('allg.bearbeiten')}
                  </button>
                </div>
              ) : (
                <div className="mt-1.5">
                  <input
                    value={suche}
                    onChange={(e) => setSuche(e.target.value)}
                    placeholder={t('nt.kundeSuchen')}
                    className={feld}
                  />
                  <div className="mt-1.5 max-h-44 overflow-y-auto rounded-feld border border-rahmen divide-y divide-rahmen">
                    {treffer.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-schrift-zart">{t('nt.keinKunde')}</p>
                    ) : (
                      treffer.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPatientId(p.id)}
                          className="w-full text-left px-4 py-2.5 hover:bg-praxis-50 text-sm flex items-center justify-between gap-3"
                        >
                          <span className="font-medium text-schrift-stark truncate">{kundeName(p)}</span>
                          <span className="text-schrift-zart text-xs shrink-0">{p.telefon || p.plzOrt || ''}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ---------- Aufgabe / Titel / Kategorie ---------- */}
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <span className={beschriftung}><FeldLabel info={HINWEIS.terminKategorie}>{t('termine.kategorie')}</FeldLabel></span>
                <select value={kategorie} onChange={(e) => setKategorie(e.target.value)} className={`mt-1.5 ${feld} bg-karte`}>
                  {KATEGORIEN.map(([id, schluessel]) => <option key={id} value={id}>{t(schluessel)}</option>)}
                </select>
              </label>
              <label className="block">
                <span className={beschriftung}>{t('nt.titelAufgabe')}</span>
                <input
                  value={titel}
                  onChange={(e) => setTitel(e.target.value)}
                  placeholder={t('nt.titelPlatz')}
                  className={`mt-1.5 ${feld}`}
                />
              </label>
            </div>
          </>
        )}

        {/* ---------- Mitarbeiter / Team ---------- */}
        <div>
          <span className={beschriftung}><FeldLabel info={HINWEIS.terminMitarbeiter}>{t('nt.mitarbeiterTeam')}</FeldLabel></span>
          {monteure.length === 0 ? (
            <p className="mt-1.5 text-xs text-schrift-zart bg-gedeckt rounded-feld px-4 py-2.5">
              {t('nt.keineMitarbeiter')}
            </p>
          ) : (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {monteure.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggleMitarbeiter(u.id)}
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-2 border-2 transition ${
                    mitarbeiterIds.includes(u.id)
                      ? 'text-white border-transparent'
                      : 'border-rahmen text-schrift hover:border-praxis-400'
                  }`}
                  style={mitarbeiterIds.includes(u.id) ? { backgroundColor: u.farbe || '#94a3b8' } : undefined}
                >
                  <span className="w-2 h-2 rounded-full shrink-0 ring-1 ring-black/10" style={{ background: u.farbe || '#94a3b8' }} />
                  {u.name}
                  {u.team && <span className="opacity-70">· {u.team}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {typ === 'einsatz' && (
          <label className="block">
            <span className={beschriftung}>{t('nt.aufgabenText')}</span>
            <textarea
              value={beschreibung}
              onChange={(e) => setBeschreibung(e.target.value)}
              rows={3}
              placeholder={t('nt.aufgabenPlatz')}
              className={`mt-1.5 ${feld}`}
            />
          </label>
        )}

        {fehler && <p className="text-sm text-red-600 bg-red-50 rounded-feld px-4 py-3">{fehler}</p>}
        <div className="flex gap-2">
          <button
            onClick={anlegen}
            disabled={laedt}
            className="flex-1 bg-praxis-600 hover:bg-praxis-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-feld"
          >
            {laedt ? t('nt.wirdAngelegt') : t(bearbeiten ? 'nt.aenderungenSpeichern' : typ === 'intern' ? 'nt.blockieren' : 'nt.anlegen')}
          </button>
          {bearbeiten && (
            <button
              onClick={internLoeschen}
              className="bg-karte border border-red-200 text-red-600 hover:bg-red-50 font-semibold px-4 rounded-feld text-sm"
            >
              {t('allg.loeschen')}
            </button>
          )}
        </div>
      </div>

      {neuesProjekt && (
        <SchnellProjekt
          projekte={projekte}
          kunden={patients}
          kundeVorbelegt={patientId || ''}
          onClose={() => setNeuesProjekt(false)}
          onAngelegt={(id) => { setNeuesProjekt(false); projektWaehlen(id) }}
        />
      )}
    </Modal>
  )
}

// ---------- Projekt direkt aus dem Termin-Dialog anlegen ----------

function SchnellProjekt({ projekte, kunden, kundeVorbelegt, onClose, onAngelegt }) {
  useLang()
  const [form, setForm] = useState({
    name: '', kundeId: kundeVorbelegt, nummer: naechsteProjektNummer(projekte),
    strasse: '', plzOrt: '', gewerk: 'Malerarbeiten', status: 'offen',
    startDatum: '', endeDatum: '', projektvolumen: '', farbe: TEAM_FARBEN[0].wert, beschreibung: '',
  })
  const [fehler, setFehler] = useState('')
  const [laedt, setLaedt] = useState(false)

  const setze = (key) => (e) => setForm({ ...form, [key]: e.target.value })
  const feld = 'mt-1.5 w-full rounded-feld border border-rahmen px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500'

  async function speichern(e) {
    e.preventDefault()
    if (!form.name.trim()) return setFehler(t('nt.nameFehlt'))
    if (!form.kundeId) return setFehler(t('nt.kundeWaehlen'))
    setLaedt(true)
    try {
      const id = await withStore((s) => s.add('projekte', {
        nummer: form.nummer.trim(),
        name: form.name.trim(),
        kundeId: form.kundeId,
        anschrift: { strasse: form.strasse.trim(), plzOrt: form.plzOrt.trim() },
        gewerk: form.gewerk.trim() || 'Malerarbeiten',
        status: form.status,
        startDatum: form.startDatum,
        endeDatum: form.endeDatum,
        projektvolumen: Number(form.projektvolumen) || 0,
        farbe: form.farbe,
        beschreibung: form.beschreibung.trim(),
        createdAt: Date.now(),
      }))
      onAngelegt?.(id)
    } catch (err) {
      setFehler(err.message || t('nt.projektFehler'))
    } finally {
      setLaedt(false)
    }
  }

  return (
    <Modal titel={t('nt.projektTitel')} onClose={onClose} breite="max-w-xl" ebene={80}>
      <form onSubmit={speichern} className="space-y-3.5">
        <label className="block">
          <span className="text-sm font-medium text-schrift">{t('nt.projektname')} *</span>
          <input autoFocus value={form.name} onChange={setze('name')} className={feld} placeholder={t('nt.projektnamePlatz')} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium text-schrift">{t('kunden.kunde')} *</span>
            <select value={form.kundeId} onChange={setze('kundeId')} className={feld}>
              <option value="">{t('nt.kundeWaehlenOption')}</option>
              {[...kunden]
                .sort((a, b) => kundeName(a).localeCompare(kundeName(b), 'de'))
                .map((k) => <option key={k.id} value={k.id}>{kundeName(k)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-schrift">{t('rechnung.nummer')}</span>
            <input value={form.nummer} onChange={setze('nummer')} className={feld} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-schrift">{t('allg.strasse')}</span>
            <input value={form.strasse} onChange={setze('strasse')} className={feld} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-schrift">{t('allg.plzOrt')}</span>
            <input value={form.plzOrt} onChange={setze('plzOrt')} className={feld} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-schrift">{t('projekte.gewerk')}</span>
            <input value={form.gewerk} onChange={setze('gewerk')} className={feld} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-schrift">{t('allg.status')}</span>
            <select value={form.status} onChange={setze('status')} className={feld}>
              {PROJEKT_STATUS.map((s) => <option key={s.id} value={s.id}>{t(`projektstatus.${s.id}`)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-schrift">{t('nt.startDatum')}</span>
            <input type="date" value={form.startDatum} onChange={setze('startDatum')} className={feld} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-schrift">{t('nt.endeDatum')}</span>
            <input type="date" value={form.endeDatum} onChange={setze('endeDatum')} className={feld} />
          </label>
          <label className="block col-span-2">
            <span className="text-sm font-medium text-schrift"><FeldLabel info={HINWEIS.projektVolumen}>{t('nt.volumen')}</FeldLabel></span>
            <input type="number" min="0" step="0.01" value={form.projektvolumen} onChange={setze('projektvolumen')} className={feld} />
          </label>
        </div>
        <div>
          <span className="text-sm font-medium text-schrift">{t('einst.farbe')}</span>
          <FarbPalette wert={form.farbe} onWert={(wert) => setForm({ ...form, farbe: wert })} />
        </div>
        <label className="block">
          <span className="text-sm font-medium text-schrift">{t('allg.beschreibung')}</span>
          <textarea value={form.beschreibung} onChange={setze('beschreibung')} rows={2} className={feld} />
        </label>
        {fehler && <p className="text-sm text-red-600 bg-red-50 rounded-feld px-4 py-3">{fehler}</p>}
        <button type="submit" disabled={laedt} className="w-full bg-praxis-600 hover:bg-praxis-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-feld">
          {t(laedt ? 'nt.wirdAngelegt' : 'nt.projektAnlegen')}
        </button>
      </form>
    </Modal>
  )
}

// Farbauswahl als Kacheln (ersetzt den sperrigen RGB-Picker) – auch von Projekte.jsx genutzt
export function FarbPalette({ wert, onWert }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-2">
      {TEAM_FARBEN.map((f) => (
        <button
          key={f.id}
          type="button"
          title={f.label}
          onClick={() => onWert(f.wert)}
          className={`w-9 h-9 rounded-full transition flex items-center justify-center ${
            wert === f.wert ? 'ring-2 ring-offset-2 ring-schrift-stark scale-105' : 'ring-1 ring-black/10 hover:scale-105'
          }`}
          style={{ backgroundColor: f.wert }}
        >
          {wert === f.wert && <Icon name="check" className="w-4 h-4 text-white" strokeWidth={3} />}
        </button>
      ))}
    </div>
  )
}
