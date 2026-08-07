import { useRef, useState } from 'react'
import { komprimiere } from '@shared/bild.js'
import Modal from './Modal.jsx'
import { Icon } from '@shared/ui.jsx'
import { berechneRoute } from '@shared/route.js'
import { euro } from '@shared/format.js'
import { heuteISO } from '@shared/slots.js'
import { useCollection, useEinstellungen, withStore } from '../hooks.js'
import { useLang, t } from '@shared/i18n.js'
import { useEntwurf } from '@shared/entwurf.js'
import EntwurfHinweis from './EntwurfHinweis.jsx'

// Spesen-Erfassung: Hotel/Übernachtung, Fahrtkosten (mit automatischem
// Km-Rechner via OpenStreetMap/OSRM – nur klick-getriggert, Fallback manuell).


export default function SpesenForm({ projektId = '', spesen = null, user, onClose }) {
  useLang()
  const projekte = useCollection('projekte')
  const users = useCollection('users')
  const einst = useEinstellungen()
  const belegRef = useRef(null)

  const [daten, setDaten] = useState(() => ({
    projektId: spesen?.projektId || projektId || '',
    typ: spesen?.typ || 'fahrt',
    datum: spesen?.datum || heuteISO(),
    mitarbeiterId: spesen?.mitarbeiterId || user?.userId || '',
    kommentar: spesen?.kommentar || '',
    betrag: spesen?.betrag ?? '',
    von: spesen?.fahrt?.von || einst.praxisAnschrift || '',
    bis: spesen?.fahrt?.bis || '',
    km: spesen?.fahrt?.km ?? '',
    kmSatz: spesen?.fahrt?.kmSatz ?? (einst.kmSatz || 0.5),
    automatisch: spesen?.fahrt?.automatisch || false,
    belegFotoId: spesen?.belegFotoId || '',
  }))
  const [rechnet, setRechnet] = useState(false)
  const [fehler, setFehler] = useState('')
  const [belegVorschau, setBelegVorschau] = useState('')

  const entwurf = useEntwurf(`spesen:${spesen?.id || projektId || 'neu'}`, daten)

  const projekt = projekte.find((p) => p.id === daten.projektId)
  const set = (feld) => (e) => setDaten((d) => ({ ...d, [feld]: e.target.value }))

  function projektGewaehlt(e) {
    const id = e.target.value
    const p = projekte.find((x) => x.id === id)
    setDaten((d) => ({
      ...d, projektId: id,
      bis: d.bis || (p ? `${p.anschrift?.strasse || ''}, ${p.anschrift?.plzOrt || ''}` : ''),
    }))
  }

  async function kmBerechnen() {
    setFehler('')
    setRechnet(true)
    try {
      const r = await berechneRoute(daten.von, daten.bis)
      setDaten((d) => ({
        ...d, km: r.km, automatisch: true,
        betrag: Math.round(r.km * (Number(d.kmSatz) || 0) * 100) / 100,
      }))
    } catch (e) {
      setFehler(t('spesenF.routeFehler', { text: e.message }))
    } finally {
      setRechnet(false)
    }
  }

  async function belegHinzu(e) {
    const datei = e.target.files?.[0]
    e.target.value = ''
    if (!datei) return
    try {
      const dataUrl = await komprimiere(datei)
      if (dataUrl.length > 950000) { setFehler(t('spesenF.belegZuGross')); return }
      const id = crypto.randomUUID ? crypto.randomUUID() : `ph-${Date.now()}`
      await withStore((s) => s.add('photos', {
        id, projektId: daten.projektId, berichtId: '', terminId: '',
        phase: 'beleg', dataUrl, name: datei.name,
        von: user?.name || '', vonId: user?.userId || '', createdAt: Date.now(),
      }))
      setDaten((d) => ({ ...d, belegFotoId: id }))
      setBelegVorschau(dataUrl)
    } catch (err) {
      setFehler(t('spesenF.belegFehler'))
    }
  }

  async function speichern(status) {
    if (!daten.projektId) { setFehler(t('spesenF.projektFehlt')); return }
    const betrag = daten.typ === 'fahrt'
      ? Math.round((Number(daten.km) || 0) * (Number(daten.kmSatz) || 0) * 100) / 100
      : Number(daten.betrag) || 0
    if (betrag <= 0) { setFehler(t('spesenF.betragFehlt')); return }
    const mitarbeiter = users.find((u) => u.id === daten.mitarbeiterId)
    try {
    await withStore((s) => s.add('spesen', {
      id: spesen?.id || (crypto.randomUUID ? crypto.randomUUID() : `s-${Date.now()}`),
      projektId: daten.projektId, mitarbeiterId: daten.mitarbeiterId,
      mitarbeiterName: mitarbeiter?.name || user?.name || '',
      typ: daten.typ, datum: daten.datum, betrag,
      belegFotoId: daten.belegFotoId, kommentar: daten.kommentar,
      fahrt: daten.typ === 'fahrt'
        ? { von: daten.von, bis: daten.bis, km: Number(daten.km) || 0, kmSatz: Number(daten.kmSatz) || 0, automatisch: daten.automatisch }
        : null,
      status, createdAt: spesen?.createdAt || Date.now(),
    }))
    entwurf.loeschen()
    onClose()
    } catch (e) {
      setFehler(e.message)
    }
  }

  const feld = 'w-full rounded-feld border border-rahmen px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-praxis-500'
  const label = 'block text-xs font-semibold text-schrift-leise mb-1'

  return (
    <Modal titel={t(spesen ? 'spesenF.titelBearbeiten' : 'spesenF.titelNeu')} onClose={onClose} breite="max-w-xl">
      <div className="space-y-4">
        <EntwurfHinweis
          eintrag={entwurf.gefunden}
          onWiederherstellen={() => { const alt = entwurf.wiederherstellen(); if (alt) setDaten((d) => ({ ...d, ...alt })) }}
          onVerwerfen={entwurf.verwerfen}
        />
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={label}>{t('berichte.projekt')} *</label>
            <select className={feld} value={daten.projektId} onChange={projektGewaehlt}>
              <option value="">{t('allg.waehlen')}</option>
              {projekte.map((p) => <option key={p.id} value={p.id}>{p.nummer} · {p.name}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>{t('kunden.typ')}</label>
            <select className={feld} value={daten.typ} onChange={set('typ')}>
              <option value="fahrt">{t('spesenF.typFahrt')}</option>
              <option value="hotel">{t('spesenF.typHotel')}</option>
              <option value="sonstig">{t('spesenF.typSonstig')}</option>
            </select>
          </div>
          <div>
            <label className={label}>{t('allg.datum')}</label>
            <input type="date" className={feld} value={daten.datum} onChange={set('datum')} />
          </div>
          <div>
            <label className={label}>{t('berichte.mitarbeiter')}</label>
            <select className={feld} value={daten.mitarbeiterId} onChange={set('mitarbeiterId')}>
              <option value="">{t('allg.waehlen')}</option>
              {users.filter((u) => u.aktiv !== false).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </div>

        {daten.typ === 'fahrt' ? (
          <div className="bg-gedeckt rounded-karte p-4 space-y-3">
            <div>
              <label className={label}>{t('spesenF.vonStart')}</label>
              <input type="text" className={feld} value={daten.von} onChange={set('von')} placeholder={t('spesenF.vonPlatz')} />
            </div>
            <div>
              <label className={label}>{t('spesenF.bisZiel')}</label>
              <input type="text" className={feld} value={daten.bis} onChange={set('bis')} placeholder={t('spesenF.bisPlatz')} />
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <button onClick={kmBerechnen} disabled={rechnet}
                className="px-4 py-2.5 rounded-feld bg-praxis-600 text-white text-sm font-medium disabled:opacity-50">
                {t(rechnet ? 'spesenF.rechnet' : 'spesenF.kmBerechnen')}
              </button>
              <div>
                <label className={label}>{t('spesenF.kilometer')}</label>
                <input type="number" step="0.1" min="0" className={`${feld} !w-28`} value={daten.km}
                  onChange={(e) => setDaten((d) => ({ ...d, km: e.target.value, automatisch: false }))} />
              </div>
              <div>
                <label className={label}>€/km</label>
                <input type="number" step="0.05" min="0" className={`${feld} !w-24`} value={daten.kmSatz} onChange={set('kmSatz')} />
              </div>
              <p className="text-sm font-bold pb-2.5">= {euro((Number(daten.km) || 0) * (Number(daten.kmSatz) || 0))}</p>
            </div>
            {daten.automatisch && <p className="text-xs text-emerald-600">{t('spesenF.kmAuto')}</p>}
          </div>
        ) : (
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className={label}>{t('spesenF.betrag')} *</label>
              <input type="number" step="0.01" min="0" className={feld} value={daten.betrag} onChange={set('betrag')} />
            </div>
            <div>
              <button onClick={() => belegRef.current?.click()} className="px-4 py-2.5 rounded-feld bg-karte border border-rahmen text-sm font-medium flex items-center gap-2">
                <Icon name="foto" className="w-4 h-4" /> {t('spesenF.belegFoto')}
              </button>
              <input ref={belegRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={belegHinzu} />
            </div>
          </div>
        )}

        {(belegVorschau || daten.belegFotoId) && daten.typ !== 'fahrt' && (
          <p className="text-xs text-emerald-600 flex items-center gap-1.5"><Icon name="check" className="w-3.5 h-3.5" /> {t('spesenF.belegOk')}</p>
        )}

        <div>
          <label className={label}>{t('allg.kommentar')}</label>
          <input type="text" className={feld} value={daten.kommentar} onChange={set('kommentar')} placeholder={t('spesenF.kommentarPlatz')} />
        </div>

        {fehler && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-feld px-3 py-2">{fehler}</p>}

        <div className="flex justify-end gap-2 pt-2 border-t border-rahmen">
          <button onClick={onClose} className="px-4 py-2.5 rounded-feld text-sm font-medium text-schrift-leise hover:bg-gedeckt-tief">{t('allg.abbrechen')}</button>
          <button onClick={() => speichern('entwurf')} className="px-4 py-2.5 rounded-feld text-sm font-medium bg-gedeckt-tief text-schrift hover:bg-gedeckt-tief">{t('status.entwurf')}</button>
          <button onClick={() => speichern('eingereicht')} className="px-4 py-2.5 rounded-feld text-sm font-bold bg-praxis-600 text-white hover:bg-praxis-700">{t('spesenF.einreichen')}</button>
        </div>
      </div>
    </Modal>
  )
}
