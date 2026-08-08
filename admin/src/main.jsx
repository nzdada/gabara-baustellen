import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
// Wörterbuch EINMAL registrieren, bevor die App rendert (Deutsch/Arabisch)
import '@shared/texte.js'
import { anwenden as themaAnwenden } from '@shared/thema.js'
import { fehlerprotokollStarten } from '@shared/fehlerprotokoll.js'
import App from './App.jsx'

// VOR dem ersten Rendern setzen, sonst blitzt beim Laden kurz das helle Bild auf
themaAnwenden()

// AP 3: Unbehandelte Fehler (window.onerror / unhandledrejection) landen mit
// Versionskennung in der Sammlung 'apilog' – das Büro sieht sie im Protokoll
// unter Einstellungen → FastBill, statt erst Tage später davon zu hören.
fehlerprotokollStarten('verwaltung')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
)
