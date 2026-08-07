import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCollection, useEinstellungen, withStore } from '../hooks.js'
import { Icon } from '@shared/ui.jsx'
import { useLang, t, datumLok } from '@shared/i18n.js'
import { euro } from '@shared/format.js'
import { statusInfo } from '@shared/projektstatus.js'
import Modal from '../components/Modal.jsx'
import * as S from '../stil.js'
import { Seitenkopf, Leer, ChipReihe, Segment, Meldung } from '../components/Seite.jsx'

// Kunden-Spiegel: FastBill ist das führende System, diese Liste ist der Arbeits-Spiegel.
// Collection heißt aus Vorlagen-Gründen weiterhin 'patients'.

const LEER = {
  firma: '',
  vorname: '',
  nachname: '',
  ansprechpartner: '',
  telefon: '',
  email: '',
  strasse: '',
  plzOrt: '',
  typ: 'gu',
  ustModus: '13b',
  zahlungszielTage: 16,
  sicherheitseinbehaltProzent: 10,
  notizen: '',
  fastbillCustomerId: null,
}

function kundenName(k) {
  return k.firma?.trim() || `${k.vorname || ''} ${k.nachname || ''}`.trim() || '(ohne Name)'
}

function datumDe(iso) {
  if (!iso) return '–'
  return new Date(iso + 'T12:00:00').toLocaleDateString('de-DE')
}

export default function Kunden() {
  const lang = useLang()
  const kunden = useCollection('patients')
  const projekte = useCollection('projekte')
  const [suche, setSuche] = useState('')
  const [bearbeite, setBearbeite] = useState(null) // null | 'neu' | kunde
  const [syncHinweis, setSyncHinweis] = useState(false)

  const projekteJeKunde = useMemo(() => {
    const map = {}
    for (const p of projekte) {
      if (!p.kundeId) continue
      if (!map[p.kundeId]) map[p.kundeId] = []
      map[p.kundeId].push(p)
    }
    return map
  }, [projekte])

  const liste = useMemo(() => {
    const q = suche.trim().toLowerCase()
    return kunden
      .filter(
        (k) =>
          !q ||
          (k.firma || '').toLowerCase().includes(q) ||
          (k.ansprechpartner || '').toLowerCase().includes(q) ||
          `${k.vorname || ''} ${k.nachname || ''}`.toLowerCase().includes(q) ||
          (k.telefon || '').toLowerCase().includes(q) ||
          (k.email || '').toLowerCase().includes(q) ||
          (k.plzOrt || '').toLowerCase().includes(q)
      )
      .sort((a, b) => kundenName(a).localeCompare(kundenName(b), 'de'))
  }, [kunden, suche, lang])

  return (
    <div className={S.SEITE}>
      {/* Kopf */}
      <div className="flex flex-wrap items-start gap-3 mb-4">
        <div className="mr-auto">
          <h1 className="text-xl font-bold text-schrift-stark">{t('kunden.titel')}</h1>
          <p className="text-sm text-schrift-leise mt-0.5">{t('kunden.sub')}</p>
        </div>
        <button
          onClick={() => setSyncHinweis(true)}
          className="inline-flex items-center gap-1.5 bg-karte border border-rahmen hover:border-praxis-400 text-schrift text-sm font-semibold px-4 py-2 rounded-full"
        >
          <Icon name="inbox" className="w-4 h-4" /> {t('einst.ausFastbill')}
        </button>
        <button
          onClick={() => setBearbeite('neu')}
          className="inline-flex items-center gap-1.5 bg-praxis-600 hover:bg-praxis-700 text-white text-sm font-semibold px-4 py-2 rounded-full"
        >
          <Icon name="plus" className="w-4 h-4" /> {t('kunden.neu')}
        </button>
      </div>

      {syncHinweis && (
        <div className="mb-4 flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-karte px-4 py-3 text-sm">
          <Icon name="alert" className="w-4 h-4 mt-0.5 shrink-0" />
          <p className="flex-1">
            {t('kunden.syncHinweis')}
          </p>
          <button onClick={() => setSyncHinweis(false)} className="text-amber-500 hover:text-amber-800 shrink-0">
            <Icon name="x" className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Suche */}
      <input
        value={suche}
        onChange={(e) => setSuche(e.target.value)}
        placeholder={t('kunden.suchen')}
        className="w-full rounded-feld border border-rahmen bg-karte px-4 py-3 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-praxis-500"
      />

      {/* Tabelle */}
      <div className="bg-karte rounded-karte border border-rahmen shadow-karte overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-left text-xs text-schrift-zart uppercase tracking-wide border-b border-rahmen">
              <th className="px-4 py-3 font-semibold">{t('kunden.kunde')}</th>
              <th className="px-4 py-3 font-semibold">{t('allg.telefon')}</th>
              <th className="px-4 py-3 font-semibold">{t('allg.email')}</th>
              <th className="px-4 py-3 font-semibold">{t('kunden.ort')}</th>
              <th className="px-4 py-3 font-semibold">{t('kunden.typ')}</th>
              <th className="px-4 py-3 font-semibold">{t('kunden.ust')}</th>
              <th className="px-4 py-3 font-semibold">FastBill</th>
              <th className="px-4 py-3 font-semibold text-right">{t('nav.projekte')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rahmen">
            {liste.map((k) => {
              const anzahl = (projekteJeKunde[k.id] || []).length
              return (
                <tr
                  key={k.id}
                  onClick={() => setBearbeite(k)}
                  className="cursor-pointer hover:bg-praxis-50/60 transition"
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold text-schrift-stark">{kundenName(k)}</p>
                    {k.firma && k.ansprechpartner && (
                      <p className="text-xs text-schrift-zart mt-0.5">{k.ansprechpartner}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-schrift whitespace-nowrap">{k.telefon || '–'}</td>
                  <td className="px-4 py-3 text-schrift">{k.email || '–'}</td>
                  <td className="px-4 py-3 text-schrift whitespace-nowrap">{k.plzOrt || '–'}</td>
                  <td className="px-4 py-3">
                    {k.typ === 'privat' ? (
                      <span className="text-[11px] font-bold rounded-full px-2.5 py-1 bg-sky-100 text-sky-700">{t('kunden.privatKurz')}</span>
                    ) : (
                      <span className="text-[11px] font-bold rounded-full px-2.5 py-1 bg-gedeckt-tief text-schrift">GU</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {k.ustModus === 'ust19' ? (
                      <span className="text-[11px] font-bold rounded-full px-2.5 py-1 bg-emerald-100 text-emerald-700">{t('kunden.ust19')}</span>
                    ) : (
                      <span className="text-[11px] font-bold rounded-full px-2.5 py-1 bg-amber-100 text-amber-700">{t('kunden.ust13b')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {k.fastbillCustomerId ? (
                      <span className="text-[11px] font-bold rounded-full px-2.5 py-1 bg-emerald-100 text-emerald-700 inline-flex items-center gap-1">
                        <Icon name="check" className="w-3 h-3" /> {t('einst.verknuepft')}
                      </span>
                    ) : (
                      <span className="text-schrift-zart">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-xs font-bold rounded-full px-2.5 py-1 ${anzahl > 0 ? 'bg-praxis-100 text-praxis-800' : 'bg-gedeckt-tief text-schrift-zart'}`}>
                      {anzahl}
                    </span>
                  </td>
                </tr>
              )
            })}
            {liste.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-schrift-zart">
                  {t(kunden.length === 0 ? 'kunden.nochKeine' : 'kunden.keineTreffer')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {bearbeite && (
        <KundenForm
          kunde={bearbeite === 'neu' ? null : bearbeite}
          projekteDesKunden={bearbeite === 'neu' ? [] : projekteJeKunde[bearbeite.id] || []}
          onClose={() => setBearbeite(null)}
        />
      )}
    </div>
  )
}

// Typ-abhängige Vorbelegung (nur beim Neu-Anlegen), GU-Werte aus den Einstellungen
function typVorgaben(typ, einstellungen) {
  if (typ === 'privat') {
    return { ustModus: 'ust19', zahlungszielTage: 14, sicherheitseinbehaltProzent: 0 }
  }
  return {
    ustModus: einstellungen.ustModusStandard || '13b',
    zahlungszielTage: einstellungen.zahlungszielTage ?? 16,
    sicherheitseinbehaltProzent: einstellungen.sicherheitseinbehaltProzent ?? 10,
  }
}

function KundenForm({ kunde, projekteDesKunden, onClose }) {
  useLang()
  const einstellungen = useEinstellungen()
  const [form, setForm] = useState(() =>
    kunde ? { ...LEER, ...kunde } : { ...LEER, typ: 'gu', ...typVorgaben('gu', einstellungen) }
  )
  const [fehler, setFehler] = useState('')

  const feldKlasse =
    'mt-1.5 w-full rounded-feld border border-rahmen px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500'

  function setzeFeld(key, wert) {
    setForm((f) => ({ ...f, [key]: wert }))
  }

  function setzeTyp(typ) {
    setForm((f) => ({
      ...f,
      typ,
      // Nur beim Neu-Anlegen die Abrechnungs-Defaults mitziehen
      ...(kunde ? {} : typVorgaben(typ, einstellungen)),
    }))
  }

  async function speichern(e) {
    e.preventDefault()
    const ansprechpartner = (form.ansprechpartner || '').trim()
    if (!form.firma.trim() && !ansprechpartner) {
      setFehler(t('kunden.fehlerName'))
      return
    }
    // Ansprechpartner intern in vorname/nachname spiegeln (erstes Wort / Rest)
    const [vorname, ...rest] = ansprechpartner.split(/\s+/).filter(Boolean)
    const daten = {
      ...form,
      firma: form.firma.trim(),
      ansprechpartner,
      vorname: vorname || '',
      nachname: rest.join(' '),
      zahlungszielTage: Number(form.zahlungszielTage) || 0,
      sicherheitseinbehaltProzent: Number(form.sicherheitseinbehaltProzent) || 0,
    }
    await withStore(async (s) => {
      if (kunde) await s.update('patients', kunde.id, daten)
      else await s.add('patients', { ...daten, createdAt: Date.now() })
    })
    onClose()
  }

  async function loeschen() {
    if (projekteDesKunden.length > 0) {
      setFehler(t('kunden.fehlerLoeschen'))
      return
    }
    if (!confirm(t('kunden.loeschenFrage', { name: kundenName(form) }))) return
    await withStore((s) => s.remove('patients', kunde.id))
    onClose()
  }

  return (
    <Modal titel={kunde ? t('kunden.bearbeiten', { name: kundenName(kunde) }) : t('kunden.neu')} onClose={onClose} breite="max-w-2xl">
      <form onSubmit={speichern} className="space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block sm:col-span-2">
            <span className="text-sm font-medium text-schrift">{t('kunden.firma')}</span>
            <input value={form.firma || ''} onChange={(e) => setzeFeld('firma', e.target.value)} className={feldKlasse} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-schrift">{t('kunden.ansprechpartner')}</span>
            <input value={form.ansprechpartner || ''} onChange={(e) => setzeFeld('ansprechpartner', e.target.value)} className={feldKlasse} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-schrift">{t('allg.telefon')}</span>
            <input type="tel" value={form.telefon || ''} onChange={(e) => setzeFeld('telefon', e.target.value)} className={feldKlasse} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-schrift">{t('allg.email')}</span>
            <input type="email" value={form.email || ''} onChange={(e) => setzeFeld('email', e.target.value)} className={feldKlasse} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-schrift">{t('allg.strasse')}</span>
            <input value={form.strasse || ''} onChange={(e) => setzeFeld('strasse', e.target.value)} className={feldKlasse} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-schrift">{t('allg.plzOrt')}</span>
            <input value={form.plzOrt || ''} onChange={(e) => setzeFeld('plzOrt', e.target.value)} className={feldKlasse} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-schrift">{t('kunden.typ')}</span>
            <select value={form.typ || 'gu'} onChange={(e) => setzeTyp(e.target.value)} className={feldKlasse}>
              <option value="gu">{t('kunden.gu')}</option>
              <option value="privat">{t('kunden.privat')}</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-schrift">{t('kunden.ustModus')}</span>
            <select value={form.ustModus || '13b'} onChange={(e) => setzeFeld('ustModus', e.target.value)} className={feldKlasse}>
              <option value="13b">{t('kunden.ust13bLang')}</option>
              <option value="ust19">{t('kunden.ust19')}</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-schrift">{t('kunden.zahlungsziel')}</span>
            <input
              type="number"
              min="0"
              value={form.zahlungszielTage ?? ''}
              onChange={(e) => setzeFeld('zahlungszielTage', e.target.value)}
              className={feldKlasse}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-schrift">{t('kunden.einbehalt')}</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={form.sicherheitseinbehaltProzent ?? ''}
              onChange={(e) => setzeFeld('sicherheitseinbehaltProzent', e.target.value)}
              className={feldKlasse}
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-schrift">{t('kunden.notizen')}</span>
          <textarea
            value={form.notizen || ''}
            onChange={(e) => setzeFeld('notizen', e.target.value)}
            rows={3}
            className={feldKlasse}
          />
        </label>

        {kunde && (
          <div className="bg-gedeckt border border-rahmen rounded-feld px-4 py-3 space-y-3">
            <p className="text-xs text-schrift-leise flex items-center gap-1.5">
              <Icon name="doc" className="w-3.5 h-3.5 shrink-0" />
              {t('kunden.fbNummer')}:{' '}
              {kunde.fastbillCustomerId ? (
                <span className="font-mono font-semibold text-emerald-700">{kunde.fastbillCustomerId}</span>
              ) : (
                <span className="text-schrift-zart">{t('kunden.nichtVerknuepft')}</span>
              )}
            </p>
            <div>
              <p className="text-xs font-bold text-schrift uppercase tracking-wide mb-1.5">
                {t('nav.projekte')} ({projekteDesKunden.length})
              </p>
              {projekteDesKunden.length === 0 ? (
                <p className="text-xs text-schrift-zart">{t('kunden.keineProjekte')}</p>
              ) : (
                <div className="space-y-1.5">
                  {[...projekteDesKunden]
                    .sort((a, b) => (b.startDatum || '').localeCompare(a.startDatum || ''))
                    .map((p) => {
                      const st = statusInfo(p.status)
                      return (
                        <Link
                          key={p.id}
                          to={`/projekte/${p.id}`}
                          className="flex items-center gap-2 bg-karte border border-rahmen rounded-feld px-3 py-2 text-sm hover:border-praxis-400 transition"
                        >
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: st.farbe }} />
                          <span className="font-mono text-xs text-schrift-zart shrink-0">{p.nummer}</span>
                          <span className="flex-1 min-w-0 truncate font-medium text-schrift-stark">{p.name}</span>
                          <span className="text-xs text-schrift-zart whitespace-nowrap hidden sm:inline">
                            {t(`projektstatus.${st.id}`)} · {t('kunden.ab')} {datumDe(p.startDatum)}
                          </span>
                          {p.projektvolumen > 0 && (
                            <span className="text-xs font-semibold text-schrift whitespace-nowrap">{euro(p.projektvolumen)}</span>
                          )}
                          <Icon name="arrowRight" className="w-3.5 h-3.5 text-schrift-zart shrink-0" />
                        </Link>
                      )
                    })}
                </div>
              )}
            </div>
          </div>
        )}

        {fehler && <p className="text-sm text-red-600 bg-red-50 rounded-feld px-4 py-3">{fehler}</p>}

        <div className="flex gap-2">
          <button type="submit" className="flex-1 bg-praxis-600 hover:bg-praxis-700 text-white font-bold py-3 rounded-feld">
            {t('allg.speichern')}
          </button>
          {kunde && (
            <button
              type="button"
              onClick={loeschen}
              title={t('kunden.loeschen')}
              className="bg-karte border border-red-200 text-red-600 hover:bg-red-50 font-semibold px-4 rounded-feld text-sm"
            >
              {t('allg.loeschen')}
            </button>
          )}
        </div>
      </form>
    </Modal>
  )
}
