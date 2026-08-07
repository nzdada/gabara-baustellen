import { Link } from 'react-router-dom'
import { Icon } from '@shared/ui.jsx'
import { useCollection } from '../hooks.js'
import { istOffen } from '@shared/projektstatus.js'
import { useLang, t, datumLok } from '@shared/i18n.js'
import * as S from '../stil.js'
import { Seitenkopf, Leer, ChipReihe, Segment, Meldung } from '../components/Seite.jsx'
import { heuteISO } from '@shared/slots.js'
import { schritteBuero, DRINGEND, OFFEN } from '@shared/naechsterSchritt.js'
import { tr } from '@shared/i18n.js'

// Startseite der Verwaltung: Karten-Grid nach HERO-Vorbild –
// je Bereich eine Karte mit Kurzbeschreibung, Kennzahl und Absprung.

function Karte({ icon, titel, text, kennzahl, kennzahlLabel, links }) {
  return (
    <div className="bg-karte rounded-karte border border-rahmen shadow-karte p-6 flex flex-col items-center text-center">
      <div className="w-12 h-12 rounded-karte bg-praxis-50 text-praxis-600 flex items-center justify-center">
        <Icon name={icon} className="w-6 h-6" />
      </div>
      <h2 className="mt-3 font-bold text-lg text-schrift-stark">{titel}</h2>
      <div className="w-16 border-t border-rahmen my-3" />
      <p className="text-sm text-schrift-leise flex-1">{text}</p>
      {kennzahl !== undefined && (
        <p className="mt-3 text-sm">
          <span className="font-bold text-2xl text-praxis-600">{kennzahl}</span>
          <span className="text-schrift-zart ml-1.5">{kennzahlLabel}</span>
        </p>
      )}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className={`px-3.5 py-1.5 rounded-feld text-sm font-medium ${
              l.primaer
                ? 'bg-praxis-600 text-white hover:bg-praxis-700'
                : 'bg-gedeckt-tief text-schrift hover:bg-gedeckt-tief'
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

// Eine Handlung. Ein Satz, eine Begruendung, ein Knopf mit Ziel.
// Bewusst NICHT als Kachel: Kacheln laden zum Stoebern ein, hier geht es um
// Abarbeiten – deshalb eine Liste von oben nach unten.
function Handlung({ h }) {
  const farbe = h.stufe === DRINGEND
    ? 'border-l-red-500 bg-red-50/50'
    : h.stufe === OFFEN ? 'border-l-amber-400 bg-amber-50/40' : 'border-l-rahmen-stark'
  return (
    <div className={`flex items-start gap-3 border border-rahmen border-l-4 ${farbe} rounded-feld px-4 py-3`}>
      <Icon name={h.icon} className="w-5 h-5 mt-0.5 text-schrift-leise shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-schrift-stark">{tr(h.text)}</p>
        {h.detail && <p className="text-[12px] text-schrift mt-0.5">{tr(h.detail)}</p>}
      </div>
      {h.ziel && (
        <Link
          to={h.ziel}
          className="shrink-0 px-3.5 min-h-11 flex items-center rounded-feld bg-praxis-600 text-white text-xs font-bold hover:bg-praxis-700 whitespace-nowrap"
        >
          {tr(h.knopf)}
        </Link>
      )}
    </div>
  )
}

export default function Uebersicht({ user }) {
  useLang()
  const projekte = useCollection('projekte')
  const appointments = useCollection('appointments')
  const patients = useCollection('patients')
  const berichte = useCollection('berichte')
  const rechnungen = useCollection('rechnungen')
  const requests = useCollection('requests')
  const lvpositionen = useCollection('lvpositionen')
  const users = useCollection('users')
  const spesen = useCollection('spesen')
  const raeume = useCollection('raeume')

  const heute = heuteISO()
  const offeneProjekte = projekte.filter((p) => istOffen(p.status)).length
  const termineHeute = appointments.filter((t) => t.datum === heute && !t.erledigt).length
  const eingereicht = berichte.filter((b) => b.status === 'eingereicht').length
  const offeneRechnungen = rechnungen.filter((r) => r.status !== 'bezahlt' && r.status !== 'storniert').length
  const neueAnfragen = requests.filter((r) => r.status === 'neu').length

  // Die eigentliche Antwort auf "was ist als Naechstes zu tun". Die Kacheln
  // darunter bleiben als Schnellzugriff – sie sind nicht falsch, sie
  // beantworten nur eine andere Frage.
  const handlungen = schritteBuero({
    projekte, lvpositionen, berichte, appointments, requests, users, rechnungen, spesen, raeume,
  })

  return (
    <div className={S.SEITE}>
      <Seitenkopf icon="home" titel="Übersicht"
        sub={t('ueb.sub', { name: user?.name ? `, ${user.name}` : '' })} />

      {handlungen.length > 0 ? (
        <div className="mb-6">
          <p className="text-sm font-bold text-schrift-stark mb-2">{t('ueb.zuTun')}</p>
          <div className="space-y-2">
            {handlungen.map((h) => <Handlung key={h.id} h={h} />)}
          </div>
        </div>
      ) : (
        <div className="mb-6 flex items-center gap-3 border border-emerald-200 bg-emerald-50 rounded-feld px-4 py-3">
          <Icon name="erfolg" className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-sm font-semibold text-emerald-800">{t('ueb.nichtsZuTun')}</p>
        </div>
      )}

      <p className="text-sm font-bold text-schrift-stark mb-2">{t('ueb.bereiche')}</p>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <Karte
          icon="folder"
          titel={t('nav.projekte')}
          text={t('ueb.projekteText')}
          kennzahl={offeneProjekte}
          kennzahlLabel={t('ueb.offen')}
          links={[
            { to: '/projekte', label: t('ueb.projekteZeigen'), primaer: true },
            { to: '/projekte?neu=1', label: `+ ${t('allg.neu')}` },
          ]}
        />
        <Karte
          icon="calendar"
          titel={t('ueb.einsatzplanung')}
          text={t('ueb.einsatzText')}
          kennzahl={termineHeute}
          kennzahlLabel={t('ueb.heute')}
          links={[
            { to: '/', label: t('nav.kalender'), primaer: true },
            { to: '/termine', label: t('ueb.terminliste') },
          ]}
        />
        <Karte
          icon="bericht"
          titel={t('nav.berichte')}
          text={t('ueb.berichteText')}
          kennzahl={eingereicht}
          kennzahlLabel={t('ueb.eingereicht')}
          links={[{ to: '/berichte', label: t('ueb.berichteZeigen'), primaer: true }]}
        />
        <Karte
          icon="firma"
          titel={t('nav.kunden')}
          text={t('ueb.kundenText')}
          kennzahl={patients.length}
          kennzahlLabel={t('nav.kunden')}
          links={[{ to: '/kunden', label: t('ueb.kundenZeigen'), primaer: true }]}
        />
        <Karte
          icon="euro"
          titel={t('nav.abrechnung')}
          text={t('ueb.abrText')}
          kennzahl={offeneRechnungen}
          kennzahlLabel={t('ueb.offen')}
          links={[{ to: '/abrechnung', label: t('ueb.abrOeffnen'), primaer: true }]}
        />
        <Karte
          icon="inbox"
          titel={t('nav.anfragen')}
          text={t('ueb.anfragenText')}
          kennzahl={neueAnfragen}
          kennzahlLabel={t('ueb.neuKlein')}
          links={[{ to: '/anfragen', label: t('ueb.anfragenZeigen'), primaer: true }]}
        />
      </div>
    </div>
  )
}
