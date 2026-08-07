import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCollection, withStore } from '../hooks.js'
import { Icon } from '@shared/ui.jsx'
import Modal from '../components/Modal.jsx'
import * as S from '../stil.js'
import { Seitenkopf, Leer, ChipReihe, Segment, Meldung } from '../components/Seite.jsx'
import { FarbPalette } from '../components/NeuerTermin.jsx'
import { FeldLabel } from '../components/InfoHinweis.jsx'
import { HINWEIS } from '../hinweise.js'
import { euro } from '@shared/format.js'
import { useLang, t, datumLok } from '@shared/i18n.js'
import { TEAM_FARBEN } from '@shared/teams.js'
import { PROJEKT_STATUS, istOffen, normalisiereStatus, statusInfo, istUeberfaellig } from '@shared/projektstatus.js'

const FARBE_OFFEN = '#8b1a1a'
const FARBE_UEBERFAELLIG = '#dc2626'

const SPALTEN = [
  { key: 'nummer', schluessel: 'projekt.nummer' },
  { key: 'name', schluessel: 'projekt.name' },
  { key: 'kunde', schluessel: 'projekt.kunde' },
  { key: 'anschrift', schluessel: 'allg.anschrift' },
  { key: 'gewerk', schluessel: 'projekt.gewerk' },
  { key: 'status', schluessel: 'allg.status' },
  { key: 'zeitraum', schluessel: 'projekt.zeitraum' },
  { key: 'volumen', schluessel: 'projekt.volumenKurz' },
  { key: 'aktion', schluessel: '', ohneFilter: true },
]

// Anhänge eines Projekts – werden beim Löschen mit entfernt (sonst Datenleichen)
const ANHAENGE = ['lvpositionen', 'berichte', 'photos', 'appointments', 'spesen', 'rechnungen', 'leistungen', 'raeume', 'raumsoll']

function fmtDatum(iso) {
  if (!iso) return '–'
  return new Date(iso + 'T12:00:00').toLocaleDateString('de-DE')
}

function heuteIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function kundenName(kunde) {
  if (!kunde) return '–'
  return kunde.firma || `${kunde.vorname || ''} ${kunde.nachname || ''}`.trim() || '–'
}

// Nächste freie Nummer 'P-<Jahr>-<lfd 3-stellig>' aus der höchsten vorhandenen Nummer
function naechsteNummer(projekte) {
  const jahr = new Date().getFullYear()
  let max = 0
  for (const p of projekte) {
    const m = /^P-(\d{4})-(\d+)$/.exec(p.nummer || '')
    if (m && Number(m[1]) === jahr) max = Math.max(max, Number(m[2]))
  }
  return `P-${jahr}-${String(max + 1).padStart(3, '0')}`
}

export default function Projekte() {
  // Sprache als Abhaengigkeit: sonst behalten die useMemo-Labels die alte Sprache
  const lang = useLang()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const projekte = useCollection('projekte')
  const kunden = useCollection('patients')
  // ?neu=1 (z. B. von der Übersicht) öffnet direkt den Anlege-Dialog
  const [neuOffen, setNeuOffen] = useState(() => searchParams.get('neu') === '1')
  const [filter, setFilter] = useState({})
  const [loeschen, setLoeschen] = useState(null)

  const heute = heuteIso()
  // 'laufend' = Sammel-Chip (alles außer abgeschlossen); daneben die 5 echten Stufen
  const aktiv = searchParams.get('status') || 'laufend'

  const chips = useMemo(() => {
    const zaehl = (fn) => projekte.filter(fn).length
    return [
      { id: 'laufend', label: t('projekt.alleLaufenden'), icon: 'baustelle', farbe: FARBE_OFFEN, anzahl: zaehl((p) => istOffen(p.status)) },
      { id: 'ueberfaellig', label: t('projekt.ueberfaellig'), icon: 'alert', farbe: FARBE_UEBERFAELLIG, anzahl: zaehl((p) => istUeberfaellig(p, heute)) },
      ...PROJEKT_STATUS.map((s) => ({ id: s.id, label: t(`projektstatus.${s.id}`), icon: s.icon, farbe: s.farbe, anzahl: zaehl((p) => normalisiereStatus(p.status) === s.id) })),
      { id: 'alle', label: t('allg.alle'), icon: 'list', farbe: '#334155', anzahl: projekte.length },
    ]
  }, [projekte, heute, lang])

  // Zeilen mit Filter-Texten je Spalte
  const zeilen = useMemo(() => {
    const vorgefiltert = projekte.filter((p) => {
      if (aktiv === 'laufend') return istOffen(p.status)
      if (aktiv === 'alle') return true
      if (aktiv === 'ueberfaellig') return istUeberfaellig(p, heute)
      return normalisiereStatus(p.status) === aktiv
    })
    const mitText = vorgefiltert.map((p) => {
      const kunde = kunden.find((k) => k.id === p.kundeId)
      const texte = {
        nummer: p.nummer || '',
        name: p.name || '',
        kunde: kundenName(kunde),
        anschrift: `${p.anschrift?.strasse || ''} ${p.anschrift?.plzOrt || ''}`.trim(),
        gewerk: p.gewerk || '',
        status: t(`projektstatus.${statusInfo(p.status).id}`),
        zeitraum: `${fmtDatum(p.startDatum)} – ${fmtDatum(p.endeDatum)}`,
        volumen: p.projektvolumen ? euro(p.projektvolumen) : '',
      }
      return { projekt: p, texte }
    })
    return mitText
      .filter((z) =>
        SPALTEN.every((sp) => {
          if (sp.ohneFilter) return true
          const q = (filter[sp.key] || '').trim().toLowerCase()
          return !q || (z.texte[sp.key] || '').toLowerCase().includes(q)
        })
      )
      .sort((a, b) => (b.texte.nummer || '').localeCompare(a.texte.nummer || ''))
  }, [projekte, kunden, aktiv, heute, filter, lang])

  function chipWaehlen(id) {
    if (id === 'laufend') setSearchParams({})
    else setSearchParams({ status: id })
  }

  // Status direkt aus der Tabelle ändern
  function statusSetzen(projektId, status) {
    withStore((s) => s.update('projekte', projektId, { status }))
  }

  return (
    <div className={S.SEITE}>
      <Seitenkopf icon="folder" titel={t('projekt.titel')} sub={t('projekt.sub')}>
        <button onClick={() => setNeuOffen(true)} className={S.BTN_PRIMAER}>
          <Icon name="plus" groesse="s" /> {t('projekt.neu')}
        </button>
      </Seitenkopf>

      <ChipReihe chips={chips} aktiv={aktiv} onWahl={chipWaehlen} />

      {/* Tabelle */}
      <div className={`${S.TAB_HUELLE} ${S.TAB_SCROLL}`}>
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="text-left text-xs text-schrift-leise border-b border-rahmen">
              {SPALTEN.map((sp) => (
                <th key={sp.key} className={S.TH}>{sp.schluessel ? t(sp.schluessel) : ''}</th>
              ))}
            </tr>
            <tr className="border-b border-rahmen bg-gedeckt/60">
              {SPALTEN.map((sp) => (
                <th key={sp.key} className={S.TH_FILTER}>
                  {!sp.ohneFilter && (
                    <input
                      value={filter[sp.key] || ''}
                      onChange={(e) => setFilter({ ...filter, [sp.key]: e.target.value })}
                      placeholder={t('allg.filtern')}
                      className={S.FELD_S}
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-rahmen">
            {zeilen.map(({ projekt: p, texte }) => {
              const st = statusInfo(p.status)
              return (
                <tr
                  key={p.id}
                  onClick={() => navigate('/projekte/' + p.id)}
                  className={S.TR}
                >
                  <td className="px-4 py-3.5 font-mono text-xs text-schrift-leise whitespace-nowrap align-middle">{texte.nummer || '–'}</td>
                  <td className={S.TD_STARK}>
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.farbe || FARBE_OFFEN }} />
                      <Icon name="baustelle" groesse="s" className="w-4 h-4 text-schrift-zart shrink-0" />
                      {texte.name}
                    </span>
                  </td>
                  <td className={S.TD}>
                    <span className="inline-flex items-center gap-1.5">
                      <Icon name="firma" groesse="xs" className="w-3.5 h-3.5 text-schrift-zart shrink-0" />
                      {texte.kunde}
                    </span>
                  </td>
                  <td className={S.TD_LEISE}>
                    {p.anschrift?.strasse || '–'}
                    {p.anschrift?.plzOrt && <span className="block text-schrift-zart">{p.anschrift.plzOrt}</span>}
                  </td>
                  <td className={`${S.TD} whitespace-nowrap`}>{texte.gewerk || '–'}</td>
                  {/* Status direkt hier änderbar (Quick-Select) */}
                  <td className="px-4 py-3.5 whitespace-nowrap align-middle" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={normalisiereStatus(p.status)}
                      onChange={(e) => statusSetzen(p.id, e.target.value)}
                      className="text-[12px] font-bold rounded-full pl-2.5 pr-7 py-1.5 border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-praxis-500 select-pfeil"
                      style={{ backgroundColor: st.farbe + '1f', color: st.farbe }}
                      title={t('projekt.statusAendern')}
                    >
                      {PROJEKT_STATUS.map((s) => (
                        <option key={s.id} value={s.id} style={{ color: '#0f172a', backgroundColor: '#fff' }}>{t(`projektstatus.${s.id}`)}</option>
                      ))}
                    </select>
                    {istUeberfaellig(p, heute) && (
                      <span className="ml-1.5 inline-flex items-center gap-1 text-[12px] font-bold text-red-600">
                        <Icon name="alert" className="w-3.5 h-3.5" /> überfällig
                      </span>
                    )}
                  </td>
                  <td className={`${S.TD_LEISE} whitespace-nowrap`}>{texte.zeitraum}</td>
                  <td className={S.TD_ZAHL}>{texte.volumen || '–'}</td>
                  <td className={S.TD_ICON} onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => setLoeschen(p)} title={t('projekt.loeschen')} className={S.BTN_ICON_GEFAHR}>
                      <Icon name="muell" groesse="s" />
                    </button>
                  </td>
                </tr>
              )
            })}
            {zeilen.length === 0 && (
              <tr>
                <td colSpan={SPALTEN.length}>
                  <Leer icon="folder" titel={t('projekt.keineGefunden')} text={t('projekt.keineGefundenText')} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {neuOffen && (
        <NeuesProjekt
          projekte={projekte}
          kunden={kunden}
          onClose={() => { setNeuOffen(false); if (searchParams.get('neu')) setSearchParams({}) }}
          onAngelegt={(id) => navigate('/projekte/' + id)}
        />
      )}
      {loeschen && <ProjektLoeschen projekt={loeschen} onClose={() => setLoeschen(null)} />}
    </div>
  )
}

// ---------- Projekt löschen (mit Übersicht der betroffenen Daten) ----------

function ProjektLoeschen({ projekt, onClose }) {
  const [bestaetigung, setBestaetigung] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState('')
  const [anhaenge, setAnhaenge] = useState(null)

  // Betroffene Daten EINMAL zählen (kein Live-Abo nötig).
  // listWhere statt list: im Firebase-Modus ist das eine echte where-Abfrage,
  // die nur die Dokumente DIESER Baustelle holt. Mit list() käme unter anderem
  // die komplette photos-Sammlung über die Leitung – dort steckt jedes Bild als
  // Base64 im Dokument, also schnell hunderte Megabyte für eine Zählung.
  useEffect(() => {
    let abgebrochen = false
    withStore(async (s) => {
      const gezaehlt = {}
      for (const coll of ANHAENGE) {
        const treffer = s.listWhere
          ? await s.listWhere(coll, 'projektId', projekt.id)
          : (await s.list(coll)).filter((d) => d.projektId === projekt.id)
        gezaehlt[coll] = treffer.map((d) => d.id)
      }
      if (!abgebrochen) setAnhaenge(gezaehlt)
    })
    return () => { abgebrochen = true }
  }, [projekt.id])

  const gesamt = anhaenge ? Object.values(anhaenge).reduce((s, ids) => s + ids.length, 0) : 0

  async function ausfuehren() {
    if (bestaetigung.trim().toUpperCase() !== 'LÖSCHEN') {
      setFehler(t('projekt.loeschBestaetige'))
      return
    }
    setLaeuft(true)
    setFehler('')
    try {
      await withStore(async (s) => {
        for (const coll of ANHAENGE) {
          const ids = anhaenge?.[coll] || []
          if (!ids.length) continue
          if (s.removeMany) await s.removeMany(coll, ids)
          else for (const id of ids) await s.remove(coll, id)
        }
        await s.remove('projekte', projekt.id)
      })
      onClose()
    } catch (e) {
      setFehler(e.message || 'Löschen fehlgeschlagen.')
      setLaeuft(false)
    }
  }

  return (
    <Modal titel={t('projekt.loeschTitel')} icon="muell" onClose={onClose} breite="max-w-lg">
      <div className="space-y-4">
        <p className="text-sm text-schrift">
          {t('projekt.loeschFrage', { name: `${projekt.nummer} · ${projekt.name}` })}
        </p>

        {anhaenge === null ? (
          <p className="text-sm text-schrift-zart">{t('projekt.loeschPruefe')}</p>
        ) : gesamt === 0 ? (
          <p className="text-sm text-schrift-leise bg-gedeckt rounded-feld px-4 py-3">
            {t('projekt.loeschNichts')}
          </p>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-feld px-4 py-3">
            <p className="text-sm font-semibold text-amber-800 mb-1.5">
              {t('projekt.loeschMit', { n: gesamt })}
            </p>
            <ul className="text-sm text-amber-700 space-y-0.5">
              {ANHAENGE.filter((coll) => (anhaenge[coll] || []).length > 0).map((coll) => (
                <li key={coll}>• {anhaenge[coll].length} × {t(`anhang.${coll}`)}</li>
              ))}
            </ul>
          </div>
        )}

        <label className="block">
          <span className="text-sm font-medium text-schrift">{t('projekt.loeschTippen')}</span>
          <input
            value={bestaetigung}
            onChange={(e) => setBestaetigung(e.target.value)}
            placeholder="LÖSCHEN"
            className="mt-1.5 w-full rounded-feld border border-rahmen px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </label>

        {fehler && <p className="text-sm text-red-600 bg-red-50 rounded-feld px-4 py-3">{fehler}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 bg-karte border border-rahmen text-schrift font-semibold py-3 rounded-feld">
            {t('allg.abbrechen')}
          </button>
          <button
            onClick={ausfuehren}
            disabled={laeuft || anhaenge === null}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-3 rounded-feld"
          >
            {laeuft ? t('projekt.loeschLaeuft') : t('projekt.loeschEndgueltig')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function NeuesProjekt({ projekte, kunden, onClose, onAngelegt }) {
  const [form, setForm] = useState({
    name: '', kundeId: '', nummer: naechsteNummer(projekte),
    strasse: '', plzOrt: '', gewerk: 'Malerarbeiten', status: 'offen',
    startDatum: '', endeDatum: '', projektvolumen: '', farbe: TEAM_FARBEN[0].wert, beschreibung: '',
  })
  const [fehler, setFehler] = useState('')

  const setze = (key) => (e) => setForm({ ...form, [key]: e.target.value })
  const feldKlasse = 'mt-1.5 w-full rounded-feld border border-rahmen px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500'

  async function speichern(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.kundeId) return setFehler(t('projekt.pflichtFehlt'))
    const nummer = form.nummer.trim()
    if (nummer && projekte.some((p) => (p.nummer || '').trim() === nummer)) {
      return setFehler(t('projekt.nummerDoppelt', { nummer }))
    }
    if (form.startDatum && form.endeDatum && form.endeDatum < form.startDatum) {
      return setFehler(t('projekt.endeVorStart'))
    }
    const id = await withStore((s) =>
      s.add('projekte', {
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
      })
    )
    onAngelegt?.(id)
    onClose()
  }

  return (
    <Modal titel={t('projekt.neu')} icon="folder" onClose={onClose} breite="max-w-xl">
      <form onSubmit={speichern} className="space-y-3.5">
        <label className="block">
          <span className="text-sm font-medium text-schrift">{t('projekt.namePflicht')}</span>
          <input value={form.name} onChange={setze('name')} className={feldKlasse} placeholder={t('projekt.namePlatzhalter')} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium text-schrift">{t('projekt.kundePflicht')}</span>
            <select value={form.kundeId} onChange={setze('kundeId')} className={feldKlasse}>
              <option value="">{t('projekt.kundeWaehlen')}</option>
              {[...kunden]
                .sort((a, b) => kundenName(a).localeCompare(kundenName(b)))
                .map((k) => (
                  <option key={k.id} value={k.id}>{kundenName(k)}</option>
                ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-schrift"><FeldLabel info={HINWEIS.projektNummer}>{t('projekt.nummer')}</FeldLabel></span>
            <input value={form.nummer} onChange={setze('nummer')} className={feldKlasse} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-schrift">{t('projekt.strasse')}</span>
            <input value={form.strasse} onChange={setze('strasse')} className={feldKlasse} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-schrift">{t('projekt.plzOrt')}</span>
            <input value={form.plzOrt} onChange={setze('plzOrt')} className={feldKlasse} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-schrift"><FeldLabel info={HINWEIS.projektGewerk}>{t('projekt.gewerk')}</FeldLabel></span>
            <input value={form.gewerk} onChange={setze('gewerk')} className={feldKlasse} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-schrift">{t('allg.status')}</span>
            <select value={form.status} onChange={setze('status')} className={feldKlasse}>
              {PROJEKT_STATUS.map((s) => (
                <option key={s.id} value={s.id}>{t(`projektstatus.${s.id}`)}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-schrift">{t('projekt.start')}</span>
            <input type="date" value={form.startDatum} onChange={setze('startDatum')} className={feldKlasse} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-schrift"><FeldLabel info={HINWEIS.projektEnde}>{t('projekt.ende')}</FeldLabel></span>
            <input type="date" min={form.startDatum || undefined} value={form.endeDatum} onChange={setze('endeDatum')} className={feldKlasse} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-schrift"><FeldLabel info={HINWEIS.projektVolumen}>{t('projekt.volumen')}</FeldLabel></span>
            <input type="number" min="0" step="0.01" value={form.projektvolumen} onChange={setze('projektvolumen')} className={feldKlasse} />
          </label>
        </div>
        <div>
          <span className="text-sm font-medium text-schrift">{t('projekt.farbe')}</span>
          <FarbPalette wert={form.farbe} onWert={(wert) => setForm({ ...form, farbe: wert })} />
        </div>
        <label className="block">
          <span className="text-sm font-medium text-schrift">{t('allg.beschreibung')}</span>
          <textarea value={form.beschreibung} onChange={setze('beschreibung')} rows={3} className={feldKlasse} />
        </label>
        {fehler && <p className="text-sm text-red-600 bg-red-50 rounded-feld px-4 py-3">{fehler}</p>}
        <button type="submit" className="w-full bg-praxis-600 hover:bg-praxis-700 text-white font-bold py-3.5 rounded-feld">
          Projekt anlegen
        </button>
      </form>
    </Modal>
  )
}
