import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCollection } from '../hooks.js'
import { Icon } from '@shared/ui.jsx'
import { useLang, t, datumLok } from '@shared/i18n.js'
import TerminModal, { KATEGORIE_INFO } from '../components/TerminModal.jsx'
import NeuerTermin, { KATEGORIEN } from '../components/NeuerTermin.jsx'
import * as S from '../stil.js'
import { Seitenkopf, Leer, ChipReihe, Segment, Meldung } from '../components/Seite.jsx'

function fmtDatum(iso) {
  if (!iso) return '–'
  return new Date(iso + 'T12:00:00').toLocaleDateString('de-DE')
}

// "Erstellt/Erledigt am"-Text einer Zeile (createdAt gibt es nur bei neueren Terminen)
function erstelltText(a) {
  if (a.erledigt && a.erledigtAm) return t('termine.erledigtAm', { datum: fmtDatum(a.erledigtAm) })
  if (a.erledigt) return t('monteur.erledigt')
  if (a.createdAt) return t('termine.erstelltAm', { datum: new Date(a.createdAt).toLocaleDateString('de-DE') })
  return '–'
}

const FILTER_LEER = { start: '', ende: '', titel: '', kategorie: '', projekt: '', anschrift: '', mitarbeiter: '', erledigt: '' }

const SPALTEN = ['termine.start', 'termine.ende', 'termine.titelSpalte', 'termine.kategorie',
  'berichte.projekt', 'allg.anschrift', 'berichte.mitarbeiter', 'termine.erstelltErledigt']

export default function Termine({ user }) {
  const lang = useLang()
  const appointments = useCollection('appointments')
  const patients = useCollection('patients')
  const projekte = useCollection('projekte')
  const users = useCollection('users')

  const [tab, setTab] = useState(user?.rolle === 'admin' ? 'alle' : 'meine')
  const [filter, setFilter] = useState(FILTER_LEER)
  const [gewaehlt, setGewaehlt] = useState(null)
  const [neu, setNeu] = useState(false)

  function setzeFilter(key, wert) {
    setFilter((f) => ({ ...f, [key]: wert }))
  }

  // Zeilen mit aufgelöstem Projekt + Mitarbeitern, Datum absteigend
  const zeilen = useMemo(() => {
    return appointments
      .map((a) => {
        const projekt = projekte.find((p) => p.id === a.projektId) || null
        const mitarbeiter = (a.mitarbeiterIds || [])
          .map((id) => users.find((u) => u.id === id))
          .filter(Boolean)
        return { a, projekt, mitarbeiter }
      })
      .sort((x, y) => `${y.a.datum} ${y.a.start}`.localeCompare(`${x.a.datum} ${x.a.start}`))
  }, [appointments, projekte, users])

  const gefiltert = useMemo(() => {
    const c = (wert, q) => !q || (wert || '').toLowerCase().includes(q.trim().toLowerCase())
    return zeilen.filter(({ a, projekt, mitarbeiter }) => {
      // Tab "Meine Termine": zugewiesen über mitarbeiterIds oder Altfeld arzt
      if (tab === 'meine') {
        const meiner =
          (user?.userId && (a.mitarbeiterIds || []).includes(user.userId)) ||
          (user?.name && a.arzt === user.name)
        if (!meiner) return false
      }
      const namen = mitarbeiter.length > 0 ? mitarbeiter.map((u) => u.name).join(' ') : a.arzt || ''
      if (!c(`${fmtDatum(a.datum)} ${a.start}`, filter.start)) return false
      if (!c(a.ende, filter.ende)) return false
      if (!c(a.titel || a.behandlung, filter.titel)) return false
      if (filter.kategorie && a.kategorie !== filter.kategorie) return false
      if (!c(projekt ? `${projekt.nummer} ${projekt.name}` : '', filter.projekt)) return false
      if (!c(projekt ? `${projekt.anschrift?.strasse || ''} ${projekt.anschrift?.plzOrt || ''}` : '', filter.anschrift)) return false
      if (!c(namen, filter.mitarbeiter)) return false
      if (!c(erstelltText(a), filter.erledigt)) return false
      return true
    })
  }, [zeilen, tab, filter, user, lang])

  const filterInput = (key) => (
    <input
      value={filter[key]}
      onChange={(e) => setzeFilter(key, e.target.value)}
      placeholder={t('allg.filtern')}
      className={S.FELD_S}
    />
  )

  return (
    <div className={S.SEITE}>
      <Seitenkopf icon="list" titel={t('termine.titel')}>
        <Segment
          optionen={[['meine', t('termine.meine'), 'person'], ['alle', t('termine.alle'), 'list']]}
          aktiv={tab}
          onWahl={setTab}
        />
        <span className={S.ZAEHLER_STILL}>{gefiltert.length}</span>
        <button onClick={() => setNeu(true)} className={S.BTN_PRIMAER}>
          <Icon name="plus" groesse="s" /> {t('termine.neu')}
        </button>
      </Seitenkopf>

      <div className="bg-karte rounded-karte border border-rahmen shadow-karte overflow-x-auto">
        <table className="w-full min-w-[1080px] text-sm">
          <thead>
            <tr className="text-left text-xs text-schrift-leise border-b border-rahmen">
              {SPALTEN.map((s) => (
                <th key={s} className={S.TH}>{t(s)}</th>
              ))}
            </tr>
            {/* Filterzeile: Textsuche je Spalte + Kategorie-Auswahl */}
            <tr className="border-b border-rahmen bg-gedeckt/60">
              <th className={S.TH_FILTER}>{filterInput('start')}</th>
              <th className={S.TH_FILTER}>{filterInput('ende')}</th>
              <th className={S.TH_FILTER}>{filterInput('titel')}</th>
              <th className="px-3 py-2">
                <select
                  value={filter.kategorie}
                  onChange={(e) => setzeFilter('kategorie', e.target.value)}
                  className="w-full min-w-[110px] rounded-feld border border-rahmen px-2 py-1.5 text-xs font-normal bg-karte focus:outline-none focus:ring-2 focus:ring-praxis-500"
                >
                  <option value="">{t('allg.alle')}</option>
                  {KATEGORIEN.map(([id]) => <option key={id} value={id}>{t(`kat.${id}`)}</option>)}
                </select>
              </th>
              <th className={S.TH_FILTER}>{filterInput('projekt')}</th>
              <th className={S.TH_FILTER}>{filterInput('anschrift')}</th>
              <th className={S.TH_FILTER}>{filterInput('mitarbeiter')}</th>
              <th className={S.TH_FILTER}>{filterInput('erledigt')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rahmen">
            {gefiltert.map(({ a, projekt, mitarbeiter }) => {
              const kat = KATEGORIE_INFO[a.kategorie]
              return (
                <tr
                  key={a.id}
                  onClick={() => setGewaehlt(a)}
                  className={`cursor-pointer hover:bg-praxis-50/50 transition ${a.erledigt ? 'opacity-50' : ''}`}
                >
                  <td className="px-3 py-3 pl-4 whitespace-nowrap font-semibold text-schrift-stark">
                    {fmtDatum(a.datum)} <span className="text-schrift-zart font-normal">·</span> {a.start}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-schrift">{a.ende}</td>
                  <td className="px-3 py-3 max-w-[240px]">
                    <p className="font-medium text-schrift-stark truncate">{a.titel || a.behandlung || '–'}</p>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {kat ? (
                      <span className={`text-[12px] font-bold rounded-full px-2.5 py-1 ${kat.farbe}`}>{t(kat.schluessel)}</span>
                    ) : (
                      <span className="text-schrift-zart">–</span>
                    )}
                  </td>
                  <td className="px-3 py-3 max-w-[240px]">
                    {projekt ? (
                      <Link
                        to={`/projekte/${projekt.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-praxis-700 font-medium hover:underline block truncate"
                      >
                        {projekt.nummer} · {projekt.name}
                      </Link>
                    ) : (
                      <span className="text-schrift-zart">–</span>
                    )}
                  </td>
                  <td className="px-3 py-3 max-w-[200px] text-schrift">
                    <p className="truncate">
                      {projekt?.anschrift
                        ? [projekt.anschrift.strasse, projekt.anschrift.plzOrt].filter(Boolean).join(', ') || '–'
                        : '–'}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    {mitarbeiter.length > 0 ? (
                      <span className="flex flex-wrap gap-x-3 gap-y-1">
                        {mitarbeiter.map((u) => (
                          <span key={u.id} className="inline-flex items-center gap-1.5 whitespace-nowrap text-schrift">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: u.farbe || '#94a3b8' }} />
                            {u.name}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="text-schrift-leise">{a.arzt || '–'}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 pr-4 whitespace-nowrap text-xs text-schrift-leise">{erstelltText(a)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {gefiltert.length === 0 && (
          <p className="text-sm text-schrift-zart text-center px-4 py-10">
            {t(tab === 'meine' ? 'termine.keineMeine' : 'termine.keineAlle')}
          </p>
        )}
      </div>

      <p className="mt-3 text-xs text-schrift-zart">
        {t('termine.hinweis')}
      </p>

      {gewaehlt && (
        <TerminModal
          termin={gewaehlt}
          patient={patients.find((p) => p.id === gewaehlt.patientId)}
          user={user}
          onClose={() => setGewaehlt(null)}
        />
      )}
      {neu && (
        <NeuerTermin
          patients={patients}
          appointments={appointments}
          vorbelegt={{}}
          bearbeiten={null}
          onClose={() => setNeu(false)}
        />
      )}
    </div>
  )
}
