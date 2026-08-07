import { Component } from 'react'
import { tr } from '@shared/i18n.js'

const T = {
  titel: { de: 'Diese Ansicht konnte nicht geladen werden', en: 'This view could not be loaded', ar: 'تعذّر تحميل هذه الصفحة' },
  text: {
    de: 'Es ist ein Fehler in der Anzeige aufgetreten. Ihre Daten sind davon nicht betroffen – es wurde nichts gelöscht oder verändert. Bitte die Seite neu laden oder eine andere Ansicht öffnen.',
    en: 'A display error occurred. Your data is not affected – nothing was deleted or changed. Please reload the page or open another view.',
    ar: 'حدث خطأ في العرض. بياناتك غير متأثرة – لم يُحذف أو يُغيَّر أي شيء. يرجى إعادة تحميل الصفحة أو فتح صفحة أخرى.',
  },
  neu: { de: 'Seite neu laden', en: 'Reload page', ar: 'إعادة تحميل الصفحة' },
  details: { de: 'Technische Einzelheiten', en: 'Technical details', ar: 'تفاصيل تقنية' },
}

// Fängt Fehler beim Aufbau einer Ansicht ab. Ohne diesen Schutz nimmt ein
// einzelner Fehler die GESAMTE Oberfläche mit – der Bildschirm wird weiß und
// selbst das Menü ist weg. Hier bleibt alles außerhalb bedienbar.
export default class Fehlerschutz extends Component {
  constructor(props) {
    super(props)
    this.state = { fehler: null }
  }

  static getDerivedStateFromError(fehler) {
    return { fehler }
  }

  componentDidCatch(fehler, info) {
    // In der Konsole bleibt die volle Spur für die Fehlersuche stehen
    console.error('Ansicht abgestürzt:', fehler, info?.componentStack)
  }

  // Beim Seitenwechsel den Fehler vergessen, sonst bliebe die Meldung stehen
  componentDidUpdate(vorher) {
    if (this.state.fehler && vorher.schluessel !== this.props.schluessel) {
      this.setState({ fehler: null })
    }
  }

  render() {
    if (!this.state.fehler) return this.props.children
    return (
      <div className="max-w-2xl mx-auto mt-10 bg-karte rounded-karte border border-amber-200 p-8">
        <h1 className="text-lg font-bold text-schrift-stark mb-2">{tr(T.titel)}</h1>
        <p className="text-sm text-schrift-leise">{tr(T.text)}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-5 px-4 py-2.5 rounded-feld bg-praxis-600 text-white text-sm font-bold hover:bg-praxis-700"
        >
          {tr(T.neu)}
        </button>
        <details className="mt-5">
          <summary className="text-xs text-schrift-zart cursor-pointer">{tr(T.details)}</summary>
          <pre className="mt-2 text-[11px] text-schrift-zart whitespace-pre-wrap break-words" dir="ltr">
            {String(this.state.fehler?.message || this.state.fehler)}
          </pre>
        </details>
      </div>
    )
  }
}
