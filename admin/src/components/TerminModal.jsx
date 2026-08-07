import { useState } from 'react'
import { Link } from 'react-router-dom'
import { istMonteurRolle } from '@shared/auth.js'
import Modal from './Modal.jsx'
import TerminBilder from './TerminBilder.jsx'
import { Icon } from '@shared/ui.jsx'
import { useLang, t, datumLok } from '@shared/i18n.js'
import { withStore, useCollection, useEinstellungen, useWhere } from '../hooks.js'
import { heuteISO, addTage } from '@shared/slots.js'
import { kalenderVerbunden, eventLoeschen } from '@shared/googleCalendar.js'
import { druckeArbeitsauftrag } from '../drucken.js'

const STATUS_INFO = {
  bestaetigt: { schluessel: 'terminstatus.bestaetigt', farbe: 'bg-praxis-100 text-praxis-800' },
  abgeschlossen: { schluessel: 'terminstatus.abgeschlossen', farbe: 'bg-gedeckt-tief text-schrift' },
  abgesagt: { schluessel: 'terminstatus.abgesagt', farbe: 'bg-red-100 text-red-700' },
}

export const KATEGORIE_INFO = {
  umsetzung: { schluessel: 'kat.umsetzung', farbe: 'bg-praxis-100 text-praxis-800' },
  fertigstellung: { schluessel: 'kat.fertigstellung', farbe: 'bg-emerald-100 text-emerald-700' },
  reklamation: { schluessel: 'kat.reklamation', farbe: 'bg-red-100 text-red-700' },
  krank: { schluessel: 'kat.krank', farbe: 'bg-amber-100 text-amber-800' },
  privat: { schluessel: 'kat.privat', farbe: 'bg-gedeckt-tief text-schrift' },
}

function fmtDatum(iso) {
  if (!iso) return '–'
  return new Date(iso + 'T12:00:00').toLocaleDateString('de-DE')
}

export default function TerminModal({ termin, patient, user, onClose }) {
  useLang()
  const projekte = useCollection('projekte')
  const users = useCollection('users')
  const einst = useEinstellungen()
  const lvPositionen = useWhere('lvpositionen', 'projektId', termin.projektId || '')
  // Lokaler Spiegel, damit der Schalter sofort reagiert (termin-Prop ist ein Schnappschuss)
  const [erledigt, setErledigt] = useState(!!termin.erledigt)
  const [erledigtAm, setErledigtAm] = useState(termin.erledigtAm || '')
  const [status, setStatus] = useState(termin.status || 'bestaetigt')
  const [kopiertFuer, setKopiertFuer] = useState('')
  const [mitarbeiterIds, setMitarbeiterIds] = useState(termin.mitarbeiterIds || [])

  const projekt = projekte.find((p) => p.id === termin.projektId)
  const monteure = users.filter((u) => istMonteurRolle(u.rolle) && u.aktiv !== false)

  // Zuweisung direkt im Modal ändern (Chips an-/abwählen)
  async function zuweisungToggle(id) {
    const neu = mitarbeiterIds.includes(id)
      ? mitarbeiterIds.filter((x) => x !== id)
      : [...mitarbeiterIds, id]
    setMitarbeiterIds(neu)
    const ersterName = users.find((u) => u.id === neu[0])?.name || ''
    await withStore((s) => s.update('appointments', termin.id, { mitarbeiterIds: neu, arzt: ersterName }))
  }
  const kat = KATEGORIE_INFO[termin.kategorie]
  const statusInfo = STATUS_INFO[status] || STATUS_INFO.bestaetigt

  // Arbeitsauftrag als PDF: gewählte LV-Positionen des Termins als Aufgabenliste
  function arbeitsauftragDrucken() {
    const ids = termin.positionsIds || []
    const gewaehlte = ids.length
      ? lvPositionen.filter((p) => ids.includes(p.id))
      : lvPositionen.filter((p) => p.typ === 'position')
    druckeArbeitsauftrag({
      termin,
      projekt,
      kunde: patient,
      positionen: [...gewaehlte].sort((a, b) => (a.sort || 0) - (b.sort || 0)),
      mitarbeiter: mitarbeiterIds.map((id) => users.find((u) => u.id === id)?.name).filter(Boolean),
      einst,
    })
  }

  async function erledigtToggle() {
    const neu = !erledigt
    const am = neu ? heuteISO() : ''
    setErledigt(neu)
    setErledigtAm(am)
    await withStore((s) => s.update('appointments', termin.id, { erledigt: neu, erledigtAm: am }))
  }

  // Dupliziert den Termin auf den Folgetag (ohne erledigt, ohne alte IDs/Tokens)
  async function kopieren() {
    const { id, ...rest } = termin
    const kopie = {
      ...rest,
      datum: addTage(termin.datum, 1),
      erledigt: false,
      erledigtAm: '',
      status: 'bestaetigt',
      googleEventId: null,
      stornoToken: crypto.randomUUID(),
      feedbackToken: rest.feedbackToken ? crypto.randomUUID() : '',
    }
    delete kopie.abgeschlossenAm
    await withStore(async (s) => {
      const neueId = await s.add('appointments', kopie)
      if (s.mode === 'firebase') await s.schreibeSlot({ ...kopie, id: neueId })
    })
    setKopiertFuer(fmtDatum(kopie.datum))
  }

  async function statusSetzen(neu) {
    setStatus(neu)
    await withStore(async (s) => {
      await s.update('appointments', termin.id, { status: neu })
      if (s.mode !== 'firebase') return
      // Abgesagt = Zeitfenster wieder freigeben (früher blieb der Slot belegt)
      if (neu === 'abgesagt') await s.loescheSlot(termin.id)
      else await s.schreibeSlot({ ...termin, status: neu })
    })
    if (neu === 'abgesagt' && termin.googleEventId && kalenderVerbunden()) {
      try { await eventLoeschen(termin.googleEventId) } catch (e) { /* Kalender nicht erreichbar */ }
    }
  }

  return (
    <Modal titel={t('termine.neu')} onClose={onClose} breite="max-w-xl">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-bold text-schrift-stark">{termin.titel || termin.behandlung}</p>
            {termin.patientName && (
              <p className="text-sm text-schrift-leise">
                {termin.patientName}
                {patient?.telefon && <span dir="ltr"> · {patient.telefon}</span>}
              </p>
            )}
            {patient?.notizen && (
              <p className="mt-1.5 text-sm font-semibold text-red-700 bg-red-50 rounded-feld px-3 py-1.5 inline-flex items-center gap-1.5">
                <Icon name="alert" className="w-4 h-4" /> {patient.notizen}
              </p>
            )}
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1.5">
            {kat && <span className={`text-xs font-bold rounded-full px-3 py-1.5 ${kat.farbe}`}>{t(kat.schluessel)}</span>}
            {erledigt ? (
              <span className="text-xs font-bold rounded-full px-3 py-1.5 bg-emerald-100 text-emerald-700">
                {erledigtAm ? t('termine.erledigtAm', { datum: fmtDatum(erledigtAm) }) : t('monteur.erledigt')}
              </span>
            ) : (
              <span className={`text-xs font-bold rounded-full px-3 py-1.5 ${statusInfo.farbe}`}>{t(statusInfo.schluessel)}</span>
            )}
          </div>
        </div>

        <div className="bg-praxis-50 rounded-karte p-4 text-sm grid grid-cols-2 gap-2.5">
          <p><span className="text-schrift-leise">{t('allg.datum')}:</span> <span className="font-semibold">{fmtDatum(termin.datum)}</span></p>
          <p><span className="text-schrift-leise">{t('tm.zeit')}:</span> <span className="font-semibold" dir="ltr">{termin.start} – {termin.ende}</span> {t('allg.uhr')}</p>
          <p className="col-span-2">
            <span className="text-schrift-leise">{t('berichte.projekt')}:</span>{' '}
            {projekt ? (
              <Link
                to={`/projekte/${projekt.id}`}
                onClick={onClose}
                className="font-semibold text-praxis-700 hover:underline"
              >
                {projekt.nummer} · {projekt.name}
              </Link>
            ) : (
              <span className="text-schrift-zart">{t('tm.keinProjekt')}</span>
            )}
          </p>
          {projekt?.anschrift && (
            <p className="col-span-2 flex items-center gap-1.5">
              <Icon name="pin" className="w-4 h-4 text-schrift-zart shrink-0" />
              <span className="font-medium text-schrift">
                {[projekt.anschrift.strasse, projekt.anschrift.plzOrt].filter(Boolean).join(', ')}
              </span>
            </p>
          )}
          <div className="col-span-2">
            <p className="text-schrift-leise mb-1.5">{t('tm.zugewiesen')} <span className="text-schrift-zart">{t('tm.antippen')}</span>:</p>
            <div className="flex flex-wrap gap-2">
              {monteure.length === 0 && <span className="text-schrift-zart">{t('tm.keineMonteure')}</span>}
              {monteure.map((u) => {
                const an = mitarbeiterIds.includes(u.id)
                return (
                  <button
                    key={u.id}
                    onClick={() => zuweisungToggle(u.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition ${
                      an ? 'bg-praxis-600 border-praxis-600 text-white' : 'bg-karte border-rahmen text-schrift hover:border-praxis-400'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: u.farbe || '#94a3b8' }} />
                    {u.name}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {termin.beschreibung && (
          <div>
            <p className="font-semibold text-schrift-stark text-sm">{t('allg.beschreibung')}</p>
            <p className="mt-1.5 text-sm text-schrift bg-gedeckt rounded-feld px-4 py-3 whitespace-pre-wrap">
              {termin.beschreibung}
            </p>
          </div>
        )}

        {/* Fotos zum Termin (vorher/nachher/Beleg) */}
        <TerminBilder termin={termin} user={user} />

        {kopiertFuer && (
          <p className="text-sm text-emerald-700 bg-emerald-50 rounded-feld px-4 py-3">
            {t('tm.kopiert', { datum: kopiertFuer })}
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={erledigtToggle}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 font-semibold py-3 rounded-feld text-sm ${
              erledigt
                ? 'bg-karte border border-rahmen text-schrift hover:bg-gedeckt'
                : 'bg-praxis-600 hover:bg-praxis-700 text-white'
            }`}
          >
            <Icon name="check" className="w-4 h-4" />
            {t(erledigt ? 'tm.erledigtZurueck' : 'tm.erledigtSetzen')}
          </button>
          <button
            onClick={kopieren}
            className="flex-1 inline-flex items-center justify-center gap-1.5 bg-karte border border-praxis-300 text-praxis-700 hover:bg-praxis-50 font-semibold py-3 rounded-feld text-sm"
          >
            <Icon name="plus" className="w-4 h-4" />
            {t('tm.kopieren')}
          </button>
          <button
            onClick={arbeitsauftragDrucken}
            className="flex-1 inline-flex items-center justify-center gap-1.5 bg-gedeckt-tief hover:bg-gedeckt-tief text-schrift font-semibold py-3 rounded-feld text-sm"
          >
            <Icon name="doc" className="w-4 h-4" />
            {t('tm.arbeitsauftrag')}
          </button>
          {status !== 'abgesagt' ? (
            <button
              onClick={() => statusSetzen('abgesagt')}
              className="flex-1 bg-karte border border-red-200 text-red-600 hover:bg-red-50 font-semibold py-3 rounded-feld text-sm"
            >
              {t('tm.absagen')}
            </button>
          ) : (
            <button
              onClick={() => statusSetzen('bestaetigt')}
              className="flex-1 bg-karte border border-praxis-300 text-praxis-700 hover:bg-praxis-50 font-semibold py-3 rounded-feld text-sm"
            >
              {t('tm.reaktivieren')}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
