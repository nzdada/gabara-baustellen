import { Icon } from '@shared/ui.jsx'
import { useLang, t, datumLok } from '@shared/i18n.js'

// Leiste über dem Formular, wenn eine ungespeicherte Eingabe gefunden wurde.
// Bewusst eine Entscheidung des Benutzers: automatisch überschreiben wäre
// schlimmer als der Verlust – ein alter Entwurf würde frische Eingaben löschen.
export default function EntwurfHinweis({ eintrag, onWiederherstellen, onVerwerfen }) {
  useLang()
  if (!eintrag) return null

  const d = new Date(eintrag.zeit)
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const wann = `${datumLok(iso, { day: '2-digit', month: '2-digit', year: 'numeric' })} · ${
    String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-feld px-4 py-3">
      <Icon name="alert" className="w-4 h-4 shrink-0" />
      <p className="flex-1 min-w-[200px] text-sm">
        <strong>{t('entwurf.gefunden')}</strong>{' '}
        <span className="text-amber-700">{t('entwurf.vom', { zeit: wann })}</span>
      </p>
      <div className="flex gap-2 shrink-0">
        <button
          type="button"
          onClick={onWiederherstellen}
          className="px-3.5 py-2 rounded-feld bg-amber-500 text-white text-xs font-bold hover:bg-amber-600"
        >
          {t('entwurf.wiederherstellen')}
        </button>
        <button
          type="button"
          onClick={onVerwerfen}
          className="px-3.5 py-2 rounded-feld bg-karte border border-amber-200 text-amber-800 text-xs font-semibold hover:bg-amber-100"
        >
          {t('entwurf.verwerfen')}
        </button>
      </div>
    </div>
  )
}
