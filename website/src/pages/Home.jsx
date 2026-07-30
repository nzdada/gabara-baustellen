import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PRAXIS, TEAM, LEISTUNGEN, OEFFNUNGSZEITEN_TEXT, BILDER, RUNDGANG, FAQ, KARRIERE, BILD_QUELLE } from '@shared/praxis.js'
import { getStore } from '@shared/store.js'
import { ZahnLogo, Icon, SprachSchalter } from '@shared/ui.jsx'
import { useLang, tr, WOCHENTAGE, T_GESCHLOSSEN, T_NUR_TELEFON } from '@shared/i18n.js'

// Sanftes Scrollen zu einer Sektion – bewusst per Handler statt <a href="#id">,
// weil der HashRouter sonst die Anker als Routen interpretiert.
function scrollZu(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const T = {
  nav: [
    ['leistungen', { de: 'Leistungen', en: 'Services', ar: 'خدماتنا' }],
    ['praxis', { de: 'Praxis', en: 'Practice', ar: 'العيادة' }],
    ['team', { de: 'Team', en: 'Team', ar: 'الفريق' }],
    ['fragen', { de: 'Fragen', en: 'FAQ', ar: 'أسئلة' }],
    ['kontakt', { de: 'Kontakt', en: 'Contact', ar: 'اتصل بنا' }],
    ['karriere', { de: 'Karriere', en: 'Careers', ar: 'وظائف' }],
  ],
  buchen: { de: 'Termin buchen', en: 'Book appointment', ar: 'احجز موعدًا' },
  buchenKurz: { de: 'Termin', en: 'Book', ar: 'موعد' },
  ort: { de: 'Augsburg-Oberhausen', en: 'Augsburg-Oberhausen', ar: 'أوغسبورغ - أوبرهاوزن' },
  heroTitel1: { de: 'Ihr Lächeln in', en: 'Your smile in', ar: 'ابتسامتك في' },
  heroTitel2: { de: 'guten Händen', en: 'good hands', ar: 'أيدٍ أمينة' },
  heroText: {
    de: 'Moderne Zahnmedizin mit Herz – von Prophylaxe bis Implantat. Wir sprechen Ihre Sprache:',
    en: 'Modern dentistry with heart – from prophylaxis to implants. We speak your language:',
    ar: 'طب أسنان حديث بقلب دافئ – من الوقاية إلى الزراعة. نتحدث لغتك:',
  },
  heroBuchen: { de: 'Online Termin buchen', en: 'Book online', ar: 'احجز موعدًا عبر الإنترنت' },
  schmerzHinweis: { de: 'Bei akuten Schmerzen rufen Sie uns bitte direkt an.', en: 'For acute pain, please call us directly.', ar: 'عند الألم الحاد يرجى الاتصال بنا مباشرة.' },
  heroBild: { de: 'Unsere Praxis in der Schöpplerstraße 4 – direkt an der Wertachbrücke', en: 'Our practice at Schöpplerstraße 4 – right by the Wertach bridge', ar: 'عيادتنا في شارع Schöpplerstraße 4 – مباشرة عند جسر فيرتاخ' },
  statZahnaerzte: { de: 'Zahnärzte', en: 'Dentists', ar: 'أطباء أسنان' },
  statLeistungen: { de: 'Leistungen', en: 'Services', ar: 'خدمات' },
  statSprachen: { de: 'Sprachen', en: 'Languages', ar: 'لغات' },
  leistungenTitel: { de: 'Unsere Leistungen', en: 'Our services', ar: 'خدماتنا' },
  leistungenText: {
    de: 'Digitale Abdrücke mit 3Shape Trios, Champions-Implantate und zahnärztliche Schlafmedizin (DGZS).',
    en: 'Digital impressions with 3Shape Trios, Champions implants and dental sleep medicine (DGZS).',
    ar: 'طبعات رقمية بجهاز 3Shape Trios، وزرعات Champions، وطب النوم السني (DGZS).',
  },
  leistungenLink: { de: 'Passenden Termin direkt online buchen', en: 'Book the right appointment online', ar: 'احجز الموعد المناسب عبر الإنترنت' },
  mehrErfahren: { de: 'Mehr erfahren', en: 'Learn more', ar: 'اعرف المزيد' },
  vorherNachher: { de: 'Vorher / Nachher', en: 'Before / after', ar: 'قبل / بعد' },
  rundgangTitel: { de: 'Ein Rundgang durch unsere Praxis', en: 'A tour of our practice', ar: 'جولة في عيادتنا' },
  rundgangText: {
    de: 'Helle Räume, moderne Technik und eine Atmosphäre, in der man sich wohlfühlt – klicken Sie sich durch die Bilder.',
    en: 'Bright rooms, modern technology and an atmosphere to feel at home – click through the pictures.',
    ar: 'غرف مضيئة وتقنيات حديثة وأجواء مريحة – تصفح الصور بالنقر عليها.',
  },
  teamTitel: { de: 'Ihr Team', en: 'Your team', ar: 'فريقك' },
  besuchTitel: { de: 'Ihr erster Besuch bei uns', en: 'Your first visit', ar: 'زيارتك الأولى لدينا' },
  besuchText: { de: 'So einfach läuft es ab – auch für Angstpatienten.', en: 'This is how easy it is – also for anxious patients.', ar: 'هكذا تسير الأمور ببساطة – حتى للمرضى القلقين.' },
  besuchSchritte: [
    { icon: 'calendar', titel: { de: 'Termin buchen', en: 'Book an appointment', ar: 'احجز موعدًا' }, text: { de: 'Online in 3 Schritten oder telefonisch – Sie bekommen sofort eine Bestätigung und einen Tag vorher eine Erinnerung.', en: 'Online in 3 steps or by phone – you get an instant confirmation and a reminder one day before.', ar: 'عبر الإنترنت بثلاث خطوات أو هاتفيًا – تصلك رسالة تأكيد فورًا وتذكير قبل الموعد بيوم.' } },
    { icon: 'inbox', titel: { de: 'Unterlagen mitbringen', en: 'Bring your documents', ar: 'أحضر مستنداتك' }, text: { de: 'Gesundheitskarte, Bonusheft, Medikamentenliste und falls vorhanden Röntgenbilder vom Vorbehandler.', en: 'Health card, bonus booklet, medication list and any X-rays from your previous dentist.', ar: 'بطاقة التأمين، دفتر المكافآت، قائمة الأدوية، وصور الأشعة من طبيبك السابق إن وجدت.' } },
    { icon: 'chat', titel: { de: 'Kennenlernen & Untersuchung', en: 'Getting to know you & exam', ar: 'التعارف والفحص' }, text: { de: 'Wir nehmen uns Zeit: gründliche Untersuchung, verständliche Erklärung, keine Behandlung ohne Ihr Okay.', en: 'We take our time: thorough examination, clear explanations, no treatment without your okay.', ar: 'نأخذ وقتنا: فحص شامل وشرح واضح، ولا علاج دون موافقتك.' } },
    { icon: 'check', titel: { de: 'Ihr Behandlungsplan', en: 'Your treatment plan', ar: 'خطة علاجك' }, text: { de: 'Sie erhalten einen klaren Plan mit Kosten – und entscheiden in Ruhe, wie es weitergeht.', en: 'You receive a clear plan with costs – and decide at your own pace how to proceed.', ar: 'تحصل على خطة واضحة مع التكاليف – وتقرر بهدوء كيف تكمل.' } },
  ],
  faqTitel: { de: 'Häufige Fragen', en: 'Frequently asked questions', ar: 'الأسئلة الشائعة' },
  zeitenTitel: { de: 'Öffnungszeiten', en: 'Opening hours', ar: 'ساعات العمل' },
  schritteTitel: { de: 'Termin in 3 Schritten', en: 'Appointment in 3 steps', ar: 'موعد في ثلاث خطوات' },
  schritte: [
    { de: 'Anliegen auswählen – von Kontrolle bis Zahnersatz, oder einfach selbst beschreiben', en: 'Choose your concern – from check-up to dentures, or simply describe it yourself', ar: 'اختر طلبك – من الفحص إلى التركيبات، أو صفه بنفسك ببساطة' },
    { de: 'Freien Termin antippen – Sie sehen nur wirklich freie Zeiten', en: 'Tap a free slot – you only see genuinely available times', ar: 'اضغط على موعد متاح – لا تظهر إلا الأوقات المتاحة فعلًا' },
    { de: 'Name, Telefon und E-Mail eingeben – fertig!', en: 'Enter your name, phone and e-mail – done!', ar: 'أدخل الاسم والهاتف والبريد الإلكتروني – وانتهيت!' },
  ],
  jetztBuchen: { de: 'Jetzt Termin buchen', en: 'Book now', ar: 'احجز الآن' },
  bewerben: { de: 'Jetzt bewerben', en: 'Apply now', ar: 'قدّم الآن' },
  kontaktTitel: { de: 'So finden Sie uns', en: 'How to find us', ar: 'كيف تجدنا' },
  wohlTitel: { de: 'Wohlfühlen von der ersten Minute', en: 'Feel at ease from the very first minute', ar: 'الشعور بالراحة من الدقيقة الأولى' },
  wohlText: {
    de: 'Freundliches Team, helle Räume und Zeit für Ihre Fragen – damit Ihr Besuch bei uns so angenehm wie möglich wird.',
    en: 'A friendly team, bright rooms and time for your questions – so your visit is as pleasant as possible.',
    ar: 'فريق ودود وغرف مشرقة ووقت كافٍ لأسئلتك – لتكون زيارتك لنا مريحة قدر الإمكان.',
  },
  wohlKnopf: { de: 'Jetzt Termin buchen', en: 'Book an appointment', ar: 'احجز موعدًا الآن' },
  karteLaden: { de: 'Karte anzeigen', en: 'Show map', ar: 'عرض الخريطة' },
  karteHinweis: {
    de: 'Erst beim Anzeigen der Karte werden Daten an Google übertragen (Google Maps).',
    en: 'Data is only transferred to Google (Google Maps) once you show the map.',
    ar: 'لا تُنقل بيانات إلى Google (خرائط Google) إلا عند عرض الخريطة.',
  },
  adresse: { de: 'Adresse', en: 'Address', ar: 'العنوان' },
  parken: { de: 'Straßenparkplätze in der Nähe', en: 'Street parking nearby', ar: 'مواقف سيارات قريبة في الشارع' },
  route: { de: 'Route in Google Maps', en: 'Route in Google Maps', ar: 'المسار في خرائط جوجل' },
  telefon: { de: 'Telefon', en: 'Phone', ar: 'الهاتف' },
  freitagTel: { de: 'Fr: nur telefonisch erreichbar', en: 'Fri: reachable by phone only', ar: 'الجمعة: متاحون هاتفيًا فقط' },
  anrufen: { de: 'Jetzt anrufen', en: 'Call now', ar: 'اتصل الآن' },
  schreiben: { de: 'E-Mail schreiben', en: 'Write an e-mail', ar: 'أرسل بريدًا إلكترونيًا' },
  fussnote: { de: 'Demo-Neuentwurf · Impressum · Datenschutz', en: 'Demo redesign · Legal notice · Privacy', ar: 'تصميم تجريبي · بيانات الناشر · حماية البيانات' },
}

function Header() {
  useLang()
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-praxis-100">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
        <button onClick={() => scrollZu('top')} className="flex items-center gap-2.5 text-praxis-700 min-w-0">
          <ZahnLogo className="w-8 h-8 shrink-0" />
          <span className="leading-tight min-w-0 text-left rtl:text-right">
            <span className="block font-bold text-[15px] truncate">Praxis an der Wertachbrücke</span>
            <span className="block text-xs text-praxis-600/80 truncate">{PRAXIS.untertitel}</span>
          </span>
        </button>
        <nav className="hidden lg:flex items-center gap-5 text-sm font-medium text-slate-600">
          {T.nav.map(([id, label]) => (
            <button key={id} onClick={() => scrollZu(id)} className="hover:text-praxis-700">{tr(label)}</button>
          ))}
        </nav>
        <div className="flex items-center gap-2 shrink-0">
          <SprachSchalter />
          <Link
            to="/termin"
            className="inline-flex items-center gap-2 bg-praxis-600 hover:bg-praxis-700 text-white text-sm font-semibold px-4 py-2.5 rounded-full shadow-sm"
          >
            <Icon name="calendar" className="w-4 h-4" />
            <span className="hidden sm:inline">{tr(T.buchen)}</span>
            <span className="sm:hidden">{tr(T.buchenKurz)}</span>
          </Link>
        </div>
      </div>
    </header>
  )
}

function Hero() {
  return (
    <section id="top" className="bg-gradient-to-b from-praxis-50 to-white">
      <div className="max-w-6xl mx-auto px-4 py-14 md:py-20 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <p className="inline-flex items-center gap-2 text-praxis-700 bg-praxis-100 rounded-full px-3 py-1 text-xs font-semibold mb-5">
            <Icon name="pin" className="w-3.5 h-3.5" /> {tr(T.ort)} · {PRAXIS.strasse}
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 leading-tight">
            {tr(T.heroTitel1)} <span className="text-praxis-600">{tr(T.heroTitel2)}</span>
          </h1>
          <p className="mt-5 text-lg text-slate-600 max-w-xl">
            {tr(T.heroText)} {tr(PRAXIS.sprachen)}.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/termin"
              className="inline-flex items-center gap-2 bg-praxis-600 hover:bg-praxis-700 text-white font-semibold px-6 py-3.5 rounded-full shadow-lg shadow-praxis-600/20 text-base"
            >
              <Icon name="calendar" className="w-5 h-5" /> {tr(T.heroBuchen)}
            </Link>
            <a
              href={PRAXIS.telefonLink}
              className="inline-flex items-center gap-2 bg-white border border-praxis-200 hover:border-praxis-500 text-praxis-700 font-semibold px-6 py-3.5 rounded-full text-base"
            >
              <Icon name="phone" className="w-5 h-5" /> <span dir="ltr">{PRAXIS.telefon}</span>
            </a>
          </div>
          <p className="mt-4 text-sm text-slate-500 flex items-center gap-1.5">
            <Icon name="alert" className="w-4 h-4 text-amber-500" /> {tr(T.schmerzHinweis)}
          </p>
        </div>
        <div className="relative">
          <div className="absolute -inset-4 bg-praxis-100/60 rounded-[2.5rem] rotate-2 hidden md:block" />
          <figure className="relative rounded-[2rem] overflow-hidden shadow-xl border border-praxis-100">
            <img src={BILDER.aussen} alt="Praxis an der Wertachbrücke" className="w-full h-64 md:h-80 object-cover" />
            <figcaption className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent text-white text-sm font-medium px-5 py-3">
              {tr(T.heroBild)}
            </figcaption>
          </figure>
          <div className="relative mt-4 grid grid-cols-3 gap-3 text-center">
            {[['3', T.statZahnaerzte], ['9+', T.statLeistungen], ['5', T.statSprachen]].map(([z, l]) => (
              <div key={z} className="bg-white border border-praxis-100 rounded-2xl py-3 shadow-sm">
                <p className="text-xl font-bold text-praxis-700">{z}</p>
                <p className="text-xs text-slate-500">{tr(l)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function Leistungen() {
  const [offen, setOffen] = useState(null) // Leistung im Detail-Dialog

  return (
    <section id="leistungen" className="max-w-6xl mx-auto px-4 py-16 scroll-mt-16">
      <h2 className="text-3xl font-bold text-slate-900 text-center">{tr(T.leistungenTitel)}</h2>
      <p className="text-slate-500 text-center mt-2 max-w-2xl mx-auto">{tr(T.leistungenText)}</p>
      <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {LEISTUNGEN.map((l) => (
          <button
            key={l.id}
            onClick={() => setOffen(l)}
            className="group text-left rtl:text-right bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-praxis-300 transition"
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-praxis-50 text-praxis-600 flex items-center justify-center group-hover:bg-praxis-600 group-hover:text-white transition">
                <Icon name={l.icon} className="w-6 h-6" />
              </div>
              {l.vorherNachher && (
                <span className="text-[10px] font-bold bg-praxis-100 text-praxis-700 rounded-full px-2.5 py-1">{tr(T.vorherNachher)}</span>
              )}
            </div>
            <h3 className="mt-4 font-semibold text-slate-900">{tr(l.titel)}</h3>
            <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{tr(l.text)}</p>
            <p className="mt-3 text-sm font-semibold text-praxis-700 inline-flex items-center gap-1.5">
              {tr(T.mehrErfahren)} <Icon name="arrowRight" className="w-4 h-4 rtl:rotate-180 group-hover:translate-x-0.5 transition" />
            </p>
          </button>
        ))}
      </div>
      <div className="mt-8 text-center">
        <Link to="/termin" className="inline-flex items-center gap-2 text-praxis-700 font-semibold hover:underline">
          {tr(T.leistungenLink)} <Icon name="arrowRight" className="w-4 h-4 rtl:rotate-180" />
        </Link>
      </div>

      {offen && <LeistungDialog leistung={offen} onClose={() => setOffen(null)} />}
    </section>
  )
}

// Detail-Dialog einer Leistung: ausführliche Beschreibung + Bilder (u. a. Vorher/Nachher)
function LeistungDialog({ leistung, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-praxis-100 px-6 py-4 flex items-center justify-between gap-3 rounded-t-3xl">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0 w-10 h-10 rounded-xl bg-praxis-600 text-white flex items-center justify-center">
              <Icon name={leistung.icon} className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 truncate">{tr(leistung.titel)}</h3>
          </div>
          <button onClick={onClose} className="shrink-0 text-slate-400 hover:text-slate-700 p-1">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="text-slate-600 leading-relaxed">{tr(leistung.details || leistung.text)}</p>

          {leistung.bilder?.length > 0 && (
            <div className={`mt-5 grid gap-3 ${leistung.bilder.length > 1 ? 'sm:grid-cols-2' : ''}`}>
              {leistung.bilder.map((src, i) => (
                <figure key={src} className="relative rounded-2xl overflow-hidden border border-praxis-100">
                  <img src={src} alt={tr(leistung.titel)} className="w-full h-56 object-cover" loading="lazy" />
                  {leistung.vorherNachher && i === 0 && (
                    <figcaption className="absolute top-2 left-2 rtl:left-auto rtl:right-2 bg-praxis-600 text-white text-[10px] font-bold rounded-full px-2.5 py-1">
                      {tr(T.vorherNachher)}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          )}

          <Link
            to="/termin"
            className="mt-6 w-full inline-flex items-center justify-center gap-2 bg-praxis-600 hover:bg-praxis-700 text-white font-bold py-3.5 rounded-xl"
          >
            <Icon name="calendar" className="w-5 h-5" /> {tr(T.buchen)}
          </Link>
          <p className="mt-3 text-[10px] text-slate-400 text-center">{tr(BILD_QUELLE)}</p>
        </div>
      </div>
    </div>
  )
}

function Rundgang() {
  const [gross, setGross] = useState(null) // Index des groß angezeigten Bildes
  return (
    <section id="praxis" className="bg-praxis-50/60 py-16 scroll-mt-16">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-slate-900 text-center">{tr(T.rundgangTitel)}</h2>
        <p className="text-slate-500 text-center mt-2 max-w-2xl mx-auto">{tr(T.rundgangText)}</p>
        <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {RUNDGANG.map((src, i) => (
            <button key={src} onClick={() => setGross(i)} className="group relative rounded-2xl overflow-hidden shadow-sm border border-praxis-100 bg-white">
              <img src={src} alt="" className="w-full h-44 md:h-52 object-cover group-hover:scale-105 transition duration-300" />
            </button>
          ))}
        </div>
      </div>

      {/* Großansicht: nur das Bild, ohne Text; Pfeile zum Blättern */}
      {gross !== null && (
        <div className="fixed inset-0 z-[60] bg-black/92 flex items-center justify-center p-4" onClick={() => setGross(null)}>
          <button
            onClick={(e) => { e.stopPropagation(); setGross((gross + RUNDGANG.length - 1) % RUNDGANG.length) }}
            className="absolute left-3 md:left-8 bg-white/10 hover:bg-white/25 text-white rounded-full p-3"
          >
            <Icon name="arrowLeft" className="w-6 h-6" />
          </button>
          <img src={RUNDGANG[gross]} alt="" className="max-h-[88vh] max-w-[88vw] rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <button
            onClick={(e) => { e.stopPropagation(); setGross((gross + 1) % RUNDGANG.length) }}
            className="absolute right-3 md:right-8 bg-white/10 hover:bg-white/25 text-white rounded-full p-3"
          >
            <Icon name="arrowRight" className="w-6 h-6" />
          </button>
          <button onClick={() => setGross(null)} className="absolute top-4 right-4 bg-white/10 hover:bg-white/25 text-white rounded-full p-2.5">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>
      )}
    </section>
  )
}

// Großes Stimmungsbild: zufriedene Patientin am Empfang (volle Breite, Text-Overlay)
function ZufriedenBild() {
  return (
    <section className="max-w-6xl mx-auto px-4 pb-16">
      <div className="relative rounded-3xl overflow-hidden shadow-lg">
        <img
          src="/bilder/zufriedener-patient.webp"
          alt="Zufriedene Patientin am Empfang der Zahnarztpraxis an der Wertachbrücke in Augsburg"
          width="1376"
          height="768"
          loading="lazy"
          className="w-full h-auto object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/10 to-transparent" />
        <div className="absolute bottom-0 inset-x-0 p-6 md:p-10 text-white">
          <h2 className="text-2xl md:text-4xl font-bold drop-shadow">{tr(T.wohlTitel)}</h2>
          <p className="mt-2 max-w-2xl text-sm md:text-base text-white/85 leading-relaxed">{tr(T.wohlText)}</p>
          <Link
            to="/termin"
            className="mt-5 inline-flex items-center gap-2 bg-white text-praxis-800 hover:bg-praxis-50 font-bold px-6 py-3 rounded-full shadow-lg"
          >
            <Icon name="calendar" className="w-5 h-5" /> {tr(T.wohlKnopf)}
          </Link>
        </div>
      </div>
    </section>
  )
}

function Team() {
  return (
    <section id="team" className="max-w-6xl mx-auto px-4 py-16 scroll-mt-16">
      <h2 className="text-3xl font-bold text-slate-900 text-center">{tr(T.teamTitel)}</h2>
      <p className="text-slate-500 text-center mt-2">{tr(PRAXIS.hinweisNachfolge)}</p>
      <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {TEAM.map((m) => (
          <div key={m.name} className="bg-white rounded-2xl border border-praxis-100 p-7 text-center shadow-sm">
            {m.foto || m.name === 'Martha' ? (
              <img
                src={m.foto || BILDER.martha}
                alt={m.name}
                className="w-36 h-36 mx-auto rounded-full object-cover border-4 border-praxis-100"
              />
            ) : (
              <div className="w-36 h-36 mx-auto rounded-full bg-gradient-to-br from-praxis-500 to-praxis-700 text-white flex items-center justify-center text-4xl font-bold">
                {m.kuerzel}
              </div>
            )}
            <h3 className="mt-5 font-semibold text-slate-900 text-lg">{m.name}</h3>
            <p className="text-praxis-700 text-sm font-medium">{tr(m.rolle)}</p>
            <p className="mt-2 text-sm text-slate-500">{tr(m.info)}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function ErsterBesuch() {
  return (
    <section className="bg-praxis-900 text-white py-16">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-center">{tr(T.besuchTitel)}</h2>
        <p className="text-praxis-100/70 text-center mt-2">{tr(T.besuchText)}</p>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {T.besuchSchritte.map((s, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 relative">
              <span className="absolute -top-3.5 left-6 rtl:left-auto rtl:right-6 w-7 h-7 rounded-full bg-praxis-500 flex items-center justify-center font-bold text-sm">{i + 1}</span>
              <Icon name={s.icon} className="w-7 h-7 text-praxis-300" />
              <h3 className="mt-3 font-semibold">{tr(s.titel)}</h3>
              <p className="mt-1.5 text-sm text-praxis-100/70 leading-relaxed">{tr(s.text)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Fragen() {
  const [offen, setOffen] = useState(0)
  return (
    <section id="fragen" className="max-w-3xl mx-auto px-4 py-16 scroll-mt-16">
      <h2 className="text-3xl font-bold text-slate-900 text-center">{tr(T.faqTitel)}</h2>
      <div className="mt-8 space-y-3">
        {FAQ.map((f, i) => (
          <div key={i} className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <button
              onClick={() => setOffen(offen === i ? -1 : i)}
              className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left rtl:text-right font-semibold text-slate-800 hover:bg-praxis-50/50"
            >
              {tr(f.frage)}
              <span className={`shrink-0 text-praxis-600 transition-transform ${offen === i ? 'rotate-45' : ''}`}>
                <Icon name="plus" className="w-5 h-5" />
              </span>
            </button>
            {offen === i && <p className="px-5 pb-5 text-sm text-slate-600 leading-relaxed">{tr(f.antwort)}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}

// Konfigurierte Öffnungszeiten EINMAL laden (kein Dauer-Listener pro Besucher);
// der Promise-Cache sorgt dafür, dass Tabelle + Kontakt zusammen nur einen Read kosten.
// Solange nichts konfiguriert ist (null), gilt der statische Text aus praxis.js.
let _ozLaden = null
function useOeffnungszeiten() {
  const [oz, setOz] = useState(null)
  useEffect(() => {
    let aktiv = true
    if (!_ozLaden) _ozLaden = getStore().then((s) => s.ladeOeffnungszeiten())
    _ozLaden.then((d) => { if (aktiv) setOz(d) }).catch(() => {})
    return () => { aktiv = false }
  }, [])
  return oz
}

const OZ_UND = { de: 'und', en: 'and', ar: 'و' }

function Oeffnungszeiten() {
  const oz = useOeffnungszeiten()

  const zeilen = oz
    ? [1, 2, 3, 4, 5, 6, 0].map((t) => {
        const f = oz.fenster[t] || []
        const text = f.length === 0
          ? (oz.telefon.includes(t) ? tr(T_NUR_TELEFON) : tr(T_GESCHLOSSEN))
          : f.map((x) => `${x.von} – ${x.bis}`).join(` ${tr(OZ_UND)} `)
        return { tag: tr(WOCHENTAGE[t]), text }
      })
    : OEFFNUNGSZEITEN_TEXT.map((z) => ({ tag: tr(z.tag), text: tr(z.zeit) }))

  return (
    <section id="oeffnungszeiten" className="max-w-6xl mx-auto px-4 pb-16 grid md:grid-cols-2 gap-8 scroll-mt-16">
      <div className="bg-white border border-slate-100 rounded-2xl p-7 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Icon name="clock" className="w-6 h-6 text-praxis-600" /> {tr(T.zeitenTitel)}
        </h2>
        <table className="mt-5 w-full text-sm">
          <tbody>
            {zeilen.map((z, i) => (
              <tr key={i} className="border-b border-slate-50 last:border-0">
                <td className="py-2.5 font-medium text-slate-700">{z.tag}</td>
                <td className="py-2.5 text-right rtl:text-left text-slate-500">{z.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-praxis-600 text-white rounded-2xl p-7 shadow-sm flex flex-col">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Icon name="calendar" className="w-6 h-6 text-praxis-100" /> {tr(T.schritteTitel)}
        </h2>
        <ol className="mt-5 space-y-4 text-praxis-50/90 text-sm">
          {T.schritte.map((s, i) => (
            <li key={i} className="flex gap-3 items-start">
              <span className="shrink-0 w-7 h-7 rounded-full bg-white/20 flex items-center justify-center font-bold text-white">{i + 1}</span>
              <span className="pt-1">{tr(s)}</span>
            </li>
          ))}
        </ol>
        <Link
          to="/termin"
          className="mt-auto pt-6 inline-flex items-center justify-center gap-2 bg-white text-praxis-800 font-semibold px-6 py-3 rounded-full hover:bg-praxis-50"
        >
          {tr(T.jetztBuchen)} <Icon name="arrowRight" className="w-4 h-4 rtl:rotate-180" />
        </Link>
      </div>
    </section>
  )
}

function Karriere() {
  return (
    <section id="karriere" className="bg-praxis-50/60 py-16 scroll-mt-16">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <h2 className="text-3xl font-bold text-slate-900">{tr(KARRIERE.titel)}</h2>
        <p className="mt-4 text-slate-600 leading-relaxed">{tr(KARRIERE.text)}</p>
        <p className="mt-2 text-sm text-slate-500">{tr(KARRIERE.hinweis)}</p>
        <a
          href={`mailto:${PRAXIS.email}?subject=Bewerbung`}
          className="mt-6 inline-flex items-center gap-2 bg-praxis-600 hover:bg-praxis-700 text-white font-semibold px-6 py-3 rounded-full"
        >
          <Icon name="mail" className="w-5 h-5" /> {tr(T.bewerben)}
        </a>
      </div>
    </section>
  )
}

function Kontakt() {
  // Telefon-Hinweis folgt den konfigurierten Öffnungszeiten (z. B. "Freitag: nur telefonisch")
  const oz = useOeffnungszeiten()
  const telefonHinweis = oz
    ? (oz.telefon.length > 0 ? `${oz.telefon.map((t) => tr(WOCHENTAGE[t])).join(', ')}: ${tr(T_NUR_TELEFON)}` : '')
    : tr(T.freitagTel)
  const karten = [
    { icon: 'pin', titel: T.adresse, zeilen: [PRAXIS.strasse, PRAXIS.plzOrt, tr(T.parken)], link: 'https://www.google.com/maps/search/?api=1&query=Sch%C3%B6pplerstra%C3%9Fe+4%2C+86154+Augsburg', linkText: T.route },
    { icon: 'phone', titel: T.telefon, zeilen: [PRAXIS.telefon, telefonHinweis].filter(Boolean), link: PRAXIS.telefonLink, linkText: T.anrufen },
    { icon: 'mail', titel: 'E-Mail', zeilen: [PRAXIS.email], link: `mailto:${PRAXIS.email}`, linkText: T.schreiben },
  ]
  return (
    <section id="kontakt" className="max-w-6xl mx-auto px-4 py-16 scroll-mt-16">
      <h2 className="text-3xl font-bold text-slate-900 text-center">{tr(T.kontaktTitel)}</h2>
      <div className="mt-10 grid md:grid-cols-3 gap-5">
        {karten.map((k, idx) => (
          <div key={idx} className="bg-white rounded-2xl border border-praxis-100 p-6 text-center shadow-sm">
            <div className="w-12 h-12 mx-auto rounded-xl bg-praxis-600 text-white flex items-center justify-center">
              <Icon name={k.icon} className="w-6 h-6" />
            </div>
            <h3 className="mt-4 font-semibold text-slate-900">{tr(k.titel)}</h3>
            {k.zeilen.map((z) => (
              <p key={z} className="text-sm text-slate-500 mt-1" dir="auto">{z}</p>
            ))}
            <a href={k.link} target={k.link.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="mt-3 inline-block text-sm font-semibold text-praxis-700 hover:underline">
              {tr(k.linkText)} →
            </a>
          </div>
        ))}
      </div>
      {/* Google Maps als Zwei-Klick-Lösung: lädt erst nach Einwilligung (Datenschutz) */}
      <KartenBlock />
      <p className="mt-8 text-center text-xs text-slate-400 max-w-xl mx-auto">{tr(PRAXIS.stornoHinweis)}</p>
    </section>
  )
}

function KartenBlock() {
  const [geladen, setGeladen] = useState(false)
  return (
    <div className="mt-6 bg-white rounded-2xl border border-praxis-100 shadow-sm overflow-hidden">
      {geladen ? (
        <iframe
          title="Google Maps – Praxis an der Wertachbrücke"
          src="https://www.google.com/maps?q=Sch%C3%B6pplerstra%C3%9Fe%204%2C%2086154%20Augsburg&output=embed"
          className="w-full h-72 md:h-96 border-0 block"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      ) : (
        <div className="h-72 md:h-96 bg-praxis-50 flex flex-col items-center justify-center text-center px-6">
          <div className="w-12 h-12 rounded-xl bg-praxis-600 text-white flex items-center justify-center">
            <Icon name="pin" className="w-6 h-6" />
          </div>
          <p className="mt-3 font-semibold text-slate-800">{PRAXIS.strasse}, {PRAXIS.plzOrt}</p>
          <button
            onClick={() => setGeladen(true)}
            className="mt-4 bg-praxis-600 hover:bg-praxis-700 text-white font-semibold px-6 py-3 rounded-full"
          >
            🗺 {tr(T.karteLaden)}
          </button>
          <p className="mt-3 text-xs text-slate-400 max-w-sm">{tr(T.karteHinweis)}</p>
        </div>
      )}
    </div>
  )
}

function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400 text-sm">
      <div className="max-w-6xl mx-auto px-4 py-10 flex flex-col md:flex-row justify-between gap-4">
        <div className="flex items-center gap-2 text-white">
          <ZahnLogo className="w-6 h-6" />
          <span className="font-semibold">{PRAXIS.name}</span>
        </div>
        <p dir="ltr">{PRAXIS.strasse} · {PRAXIS.plzOrt} · {PRAXIS.telefon}</p>
        <p className="text-slate-500">
          <Link to="/impressum" className="hover:text-white">Impressum</Link>
          {' · '}
          <Link to="/datenschutz" className="hover:text-white">Datenschutz</Link>
        </p>
      </div>
    </footer>
  )
}

export default function Home() {
  useLang() // rendert die ganze Seite bei Sprachwechsel neu
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Header />
      <Hero />
      <Leistungen />
      <Rundgang />
      <Team />
      <ZufriedenBild />
      <ErsterBesuch />
      <Fragen />
      <Oeffnungszeiten />
      <Karriere />
      <Kontakt />
      <Footer />
    </div>
  )
}
