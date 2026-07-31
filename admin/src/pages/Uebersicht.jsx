import { Link } from 'react-router-dom'
import { Icon } from '@shared/ui.jsx'
import { useCollection } from '../hooks.js'
import { istOffen } from '@shared/projektstatus.js'

// Startseite der Verwaltung: Karten-Grid nach HERO-Vorbild –
// je Bereich eine Karte mit Kurzbeschreibung, Kennzahl und Absprung.

function Karte({ icon, titel, text, kennzahl, kennzahlLabel, links }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col items-center text-center">
      <div className="w-12 h-12 rounded-2xl bg-praxis-50 text-praxis-600 flex items-center justify-center">
        <Icon name={icon} className="w-6 h-6" />
      </div>
      <h2 className="mt-3 font-bold text-lg text-slate-900">{titel}</h2>
      <div className="w-16 border-t border-slate-200 my-3" />
      <p className="text-sm text-slate-500 flex-1">{text}</p>
      {kennzahl !== undefined && (
        <p className="mt-3 text-sm">
          <span className="font-bold text-2xl text-praxis-600">{kennzahl}</span>
          <span className="text-slate-400 ml-1.5">{kennzahlLabel}</span>
        </p>
      )}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium ${
              l.primaer
                ? 'bg-praxis-600 text-white hover:bg-praxis-700'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

export default function Uebersicht({ user }) {
  const projekte = useCollection('projekte')
  const appointments = useCollection('appointments')
  const patients = useCollection('patients')
  const berichte = useCollection('berichte')
  const rechnungen = useCollection('rechnungen')
  const requests = useCollection('requests')

  const heute = new Date().toISOString().slice(0, 10)
  const offeneProjekte = projekte.filter((p) => istOffen(p.status)).length
  const termineHeute = appointments.filter((t) => t.datum === heute && !t.erledigt).length
  const eingereicht = berichte.filter((b) => b.status === 'eingereicht').length
  const offeneRechnungen = rechnungen.filter((r) => r.status !== 'bezahlt' && r.status !== 'storniert').length
  const neueAnfragen = requests.filter((r) => r.status === 'neu').length

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Übersicht</h1>
        <p className="text-sm text-slate-500">
          Willkommen{user?.name ? `, ${user.name}` : ''} – der Schreibtisch der Gabara-Baustellenverwaltung.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <Karte
          icon="folder"
          titel="Projekte"
          text="Baustellen vom Erstkontakt über die Umsetzung bis zur Abrechnung verwalten – mit Leistungsverzeichnis, Fotos und Berichten je Projekt."
          kennzahl={offeneProjekte}
          kennzahlLabel="offen"
          links={[
            { to: '/projekte', label: 'Projekte anzeigen', primaer: true },
            { to: '/projekte?neu=1', label: '+ Neu' },
          ]}
        />
        <Karte
          icon="calendar"
          titel="Einsatzplanung"
          text="Termine und Arbeitsaufträge planen und den Monteuren zuweisen – im Wochenkalender oder in der Terminliste."
          kennzahl={termineHeute}
          kennzahlLabel="heute"
          links={[
            { to: '/kalender', label: 'Kalender', primaer: true },
            { to: '/termine', label: 'Terminliste' },
          ]}
        />
        <Karte
          icon="bericht"
          titel="Berichte"
          text="Regieberichte, Reklamationen und Abnahmen von der Baustelle prüfen, freigeben und als PDF drucken."
          kennzahl={eingereicht}
          kennzahlLabel="eingereicht"
          links={[{ to: '/berichte', label: 'Berichte anzeigen', primaer: true }]}
        />
        <Karte
          icon="users"
          titel="Kunden"
          text="Auftraggeber und Privatkunden – FastBill ist das führende System, hier liegt der Arbeits-Spiegel für die Projekte."
          kennzahl={patients.length}
          kennzahlLabel="Kunden"
          links={[{ to: '/kunden', label: 'Kunden anzeigen', primaer: true }]}
        />
        <Karte
          icon="euro"
          titel="Abrechnung"
          text="Rechnungen aus LV-Mengen und Regieberichten zusammenstellen und an FastBill übertragen – dort laufen Versand, E-Rechnung und Mahnwesen."
          kennzahl={offeneRechnungen}
          kennzahlLabel="offen"
          links={[{ to: '/abrechnung', label: 'Abrechnung öffnen', primaer: true }]}
        />
        <Karte
          icon="inbox"
          titel="Anfragen"
          text="Anfragen von der Gabara-Webseite – sichten, Kunde anlegen und als Projekt weiterführen."
          kennzahl={neueAnfragen}
          kennzahlLabel="neu"
          links={[{ to: '/anfragen', label: 'Anfragen anzeigen', primaer: true }]}
        />
      </div>
    </div>
  )
}
