import { Icon } from '@shared/ui.jsx'
import * as S from '../stil.js'

// Die drei Muster, die vorher auf JEDER Seite einzeln nachgebaut wurden.
// Jetzt einmal hier – dadurch sehen alle Bereiche gleich aus und jede Seite
// trägt ihr Icon.

/** Seitenkopf: Icon-Kachel + Titel + Untertitel, rechts die Aktionen. */
export function Seitenkopf({ icon, titel, sub, children }) {
  return (
    <div className={S.KOPF}>
      {icon && (
        <span className={S.KOPF_KACHEL}>
          <Icon name={icon} groesse="l" />
        </span>
      )}
      <div className="min-w-0">
        <h1 className={S.KOPF_TITEL}>{titel}</h1>
        {sub && <p className={S.KOPF_SUB}>{sub}</p>}
      </div>
      {children && <div className={S.KOPF_AKTION}>{children}</div>}
    </div>
  )
}

/** Leerzustand: das Icon zeigt, WAS fehlt (keine Projekte -> Ordner). */
export function Leer({ icon = 'info', titel, text, children }) {
  return (
    <div className={S.LEER}>
      <span className={S.LEER_KREIS}>
        <Icon name={icon} groesse="xl" />
      </span>
      {titel && <p className={S.LEER_TITEL}>{titel}</p>}
      {text && <p className={S.LEER_TEXT}>{text}</p>}
      {children && <div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  )
}

/**
 * Chip-Reihe für Filter/Status.
 * chips: [{ id, label, anzahl?, icon?, farbe? }] – farbe färbt den aktiven Chip.
 */
export function ChipReihe({ chips, aktiv, onWahl }) {
  return (
    <div className={S.FILTERLEISTE}>
      {chips.map((c) => {
        const an = aktiv === c.id
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onWahl(c.id)}
            className={`${S.FCHIP} ${an ? S.FCHIP_AN : S.FCHIP_AUS}`}
            style={an && c.farbe ? { backgroundColor: c.farbe, borderColor: c.farbe } : undefined}
          >
            {c.icon && <Icon name={c.icon} groesse="xs" />}
            {c.label}
            {c.anzahl !== undefined && (
              <span className={an ? S.FZAHL_AN : S.FZAHL_AUS}>{c.anzahl}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Segment-Umschalter (zwei bis drei Ansichten, z. B. Meine/Alle). */
export function Segment({ optionen, aktiv, onWahl }) {
  return (
    <div className={S.SEGMENT}>
      {optionen.map(([id, label, icon]) => (
        <button
          key={id}
          type="button"
          onClick={() => onWahl(id)}
          className={aktiv === id ? S.SEG_AN : S.SEG_AUS}
        >
          {icon && <Icon name={icon} groesse="xs" />}
          {label}
        </button>
      ))}
    </div>
  )
}

/** Meldungszeile mit passendem Signal-Icon. */
export function Meldung({ art = 'info', children }) {
  const stil = { ok: S.MELDUNG_OK, warnung: S.MELDUNG_WARN, gefahr: S.MELDUNG_GEFAHR, info: S.MELDUNG_INFO }[art] || S.MELDUNG_INFO
  const icon = { ok: 'erfolg', warnung: 'alert', gefahr: 'alert', info: 'info' }[art] || 'info'
  return (
    <div className={stil}>
      <Icon name={icon} groesse="s" className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/** Karte mit Kopfzeile (Icon + Titel + optionale Aktionen rechts). */
export function Karte({ icon, titel, aktionen, children, klasse = '' }) {
  return (
    <div className={`${S.KARTE} ${klasse}`}>
      {(titel || aktionen) && (
        <div className={S.KARTE_KOPF}>
          {icon && <Icon name={icon} groesse="s" className="w-4 h-4 text-praxis-600" />}
          {titel && <p className={S.KARTE_TITEL}>{titel}</p>}
          {aktionen && <div className="ml-auto flex flex-wrap items-center gap-2">{aktionen}</div>}
        </div>
      )}
      {children}
    </div>
  )
}
