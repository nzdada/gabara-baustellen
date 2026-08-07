import { Icon } from '@shared/ui.jsx'
import { t } from '@shared/i18n.js'
import * as S from '../stil.js'

// Einheitlicher Dialog der Verwaltung.
// - icon:  Kachel links im Kopf (jeder Dialog trägt sein Bereichs-Icon)
// - fuss:  fester Slot für die Knopfreihe – bleibt beim Scrollen sichtbar
// - ebene: Stapel-Ebene für verschachtelte Dialoge (z. B. „Neues Projekt"
//          innerhalb des Termin-Dialogs)
export default function Modal({ titel, icon, onClose, children, fuss, breite = 'max-w-lg', ebene = 50 }) {
  return (
    <div className={S.MODAL_HUELLE} style={{ zIndex: ebene }} onClick={onClose}>
      <div className={`${S.MODAL_KARTE} ${breite}`} onClick={(e) => e.stopPropagation()}>
        <div className={S.MODAL_KOPF}>
          {icon && (
            <span className={S.MODAL_KACHEL}>
              <Icon name={icon} groesse="m" />
            </span>
          )}
          <h2 className={S.MODAL_TITEL}>{titel}</h2>
          <button onClick={onClose} className={`${S.BTN_ICON} ml-auto`} aria-label={t('allg.schliessen')}>
            <Icon name="x" groesse="s" />
          </button>
        </div>
        <div className={S.MODAL_BODY}>{children}</div>
        {fuss && <div className={S.MODAL_FUSS}>{fuss}</div>}
      </div>
    </div>
  )
}
