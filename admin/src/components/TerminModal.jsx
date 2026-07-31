import { useState } from 'react'
import { Link } from 'react-router-dom'
import Modal from './Modal.jsx'
import TerminBilder from './TerminBilder.jsx'
import { Icon } from '@shared/ui.jsx'
import { withStore, useCollection } from '../hooks.js'
import { heuteISO, addTage } from '@shared/slots.js'
import { kalenderVerbunden, eventLoeschen } from '@shared/googleCalendar.js'

const STATUS_INFO = {
  bestaetigt: { label: 'Geplant', farbe: 'bg-praxis-100 text-praxis-800' },
  abgeschlossen: { label: 'Abgeschlossen', farbe: 'bg-slate-200 text-slate-600' },
  abgesagt: { label: 'Abgesagt', farbe: 'bg-red-100 text-red-700' },
}

export const KATEGORIE_INFO = {
  umsetzung: { label: 'Umsetzung', farbe: 'bg-praxis-100 text-praxis-800' },
  fertigstellung: { label: 'Fertigstellung', farbe: 'bg-emerald-100 text-emerald-700' },
  reklamation: { label: 'Reklamationsarbeit', farbe: 'bg-red-100 text-red-700' },
  krank: { label: 'Krank/Abwesend', farbe: 'bg-amber-100 text-amber-800' },
  privat: { label: 'Privater Termin', farbe: 'bg-slate-200 text-slate-600' },
}

function fmtDatum(iso) {
  if (!iso) return '–'
  return new Date(iso + 'T12:00:00').toLocaleDateString('de-DE')
}

export default function TerminModal({ termin, patient, user, onClose }) {
  const projekte = useCollection('projekte')
  const users = useCollection('users')
  // Lokaler Spiegel, damit der Schalter sofort reagiert (termin-Prop ist ein Schnappschuss)
  const [erledigt, setErledigt] = useState(!!termin.erledigt)
  const [erledigtAm, setErledigtAm] = useState(termin.erledigtAm || '')
  const [status, setStatus] = useState(termin.status || 'bestaetigt')
  const [kopiertFuer, setKopiertFuer] = useState('')
  const [mitarbeiterIds, setMitarbeiterIds] = useState(termin.mitarbeiterIds || [])

  const projekt = projekte.find((p) => p.id === termin.projektId)
  const monteure = users.filter((u) => u.rolle === 'mitarbeiter' && u.aktiv !== false)

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
      if (s.mode === 'firebase') await s.schreibeSlot({ ...termin, status: neu })
    })
    if (neu === 'abgesagt' && termin.googleEventId && kalenderVerbunden()) {
      try { await eventLoeschen(termin.googleEventId) } catch (e) { /* Kalender nicht erreichbar */ }
    }
  }

  return (
    <Modal titel="Termin" onClose={onClose} breite="max-w-xl">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-bold text-slate-900">{termin.titel || termin.behandlung}</p>
            {termin.patientName && (
              <p className="text-sm text-slate-500">
                {termin.patientName}
                {patient?.telefon && <span dir="ltr"> · {patient.telefon}</span>}
              </p>
            )}
            {patient?.notizen && (
              <p className="mt-1.5 text-sm font-semibold text-red-700 bg-red-50 rounded-lg px-3 py-1.5 inline-flex items-center gap-1.5">
                <Icon name="alert" className="w-4 h-4" /> {patient.notizen}
              </p>
            )}
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1.5">
            {kat && <span className={`text-xs font-bold rounded-full px-3 py-1.5 ${kat.farbe}`}>{kat.label}</span>}
            {erledigt ? (
              <span className="text-xs font-bold rounded-full px-3 py-1.5 bg-emerald-100 text-emerald-700">
                Erledigt{erledigtAm ? ` am ${fmtDatum(erledigtAm)}` : ''}
              </span>
            ) : (
              <span className={`text-xs font-bold rounded-full px-3 py-1.5 ${statusInfo.farbe}`}>{statusInfo.label}</span>
            )}
          </div>
        </div>

        <div className="bg-praxis-50 rounded-2xl p-4 text-sm grid grid-cols-2 gap-2.5">
          <p><span className="text-slate-500">Datum:</span> <span className="font-semibold">{fmtDatum(termin.datum)}</span></p>
          <p><span className="text-slate-500">Zeit:</span> <span className="font-semibold" dir="ltr">{termin.start} – {termin.ende}</span> Uhr</p>
          <p className="col-span-2">
            <span className="text-slate-500">Projekt:</span>{' '}
            {projekt ? (
              <Link
                to={`/projekte/${projekt.id}`}
                onClick={onClose}
                className="font-semibold text-praxis-700 hover:underline"
              >
                {projekt.nummer} · {projekt.name}
              </Link>
            ) : (
              <span className="text-slate-400">kein Projekt</span>
            )}
          </p>
          {projekt?.anschrift && (
            <p className="col-span-2 flex items-center gap-1.5">
              <Icon name="pin" className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="font-medium text-slate-700">
                {[projekt.anschrift.strasse, projekt.anschrift.plzOrt].filter(Boolean).join(', ')}
              </span>
            </p>
          )}
          <div className="col-span-2">
            <p className="text-slate-500 mb-1.5">Zugewiesene Mitarbeiter <span className="text-slate-400">(antippen zum Ändern)</span>:</p>
            <div className="flex flex-wrap gap-2">
              {monteure.length === 0 && <span className="text-slate-400">Keine Monteure angelegt (Einstellungen → Mitarbeiter).</span>}
              {monteure.map((u) => {
                const an = mitarbeiterIds.includes(u.id)
                return (
                  <button
                    key={u.id}
                    onClick={() => zuweisungToggle(u.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition ${
                      an ? 'bg-praxis-600 border-praxis-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-praxis-400'
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
            <p className="font-semibold text-slate-800 text-sm">Beschreibung</p>
            <p className="mt-1.5 text-sm text-slate-600 bg-slate-50 rounded-xl px-4 py-3 whitespace-pre-wrap">
              {termin.beschreibung}
            </p>
          </div>
        )}

        {/* Fotos zum Termin (vorher/nachher/Beleg) */}
        <TerminBilder termin={termin} user={user} />

        {kopiertFuer && (
          <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-3">
            Termin wurde für den {kopiertFuer} kopiert.
          </p>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={erledigtToggle}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 font-semibold py-3 rounded-xl text-sm ${
              erledigt
                ? 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                : 'bg-praxis-600 hover:bg-praxis-700 text-white'
            }`}
          >
            <Icon name="check" className="w-4 h-4" />
            {erledigt ? 'Erledigt zurücknehmen' : 'Als erledigt markieren'}
          </button>
          <button
            onClick={kopieren}
            className="flex-1 inline-flex items-center justify-center gap-1.5 bg-white border border-praxis-300 text-praxis-700 hover:bg-praxis-50 font-semibold py-3 rounded-xl text-sm"
          >
            <Icon name="plus" className="w-4 h-4" />
            Kopieren (+1 Tag)
          </button>
          {status !== 'abgesagt' ? (
            <button
              onClick={() => statusSetzen('abgesagt')}
              className="flex-1 bg-white border border-red-200 text-red-600 hover:bg-red-50 font-semibold py-3 rounded-xl text-sm"
            >
              Termin absagen
            </button>
          ) : (
            <button
              onClick={() => statusSetzen('bestaetigt')}
              className="flex-1 bg-white border border-praxis-300 text-praxis-700 hover:bg-praxis-50 font-semibold py-3 rounded-xl text-sm"
            >
              Wieder aktivieren
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
