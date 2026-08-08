import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import Home from './pages/Home.jsx'
import Anfrage from './pages/Anfrage.jsx'
import { Impressum, Datenschutz } from './pages/Recht.jsx'
import { fehlerprotokollStarten } from '@shared/fehlerprotokoll.js'

// AP 3: Auch die öffentliche Webseite meldet unbehandelte Fehler in die
// Sammlung 'apilog' (firestore.rules erlaubt dafür NUR art 'fehler' mit
// harten Längengrenzen) – sonst bliebe eine kaputte Anfrage-Seite unbemerkt.
fehlerprotokollStarten('webseite')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/anfrage" element={<Anfrage />} />
        <Route path="/impressum" element={<Impressum />} />
        <Route path="/datenschutz" element={<Datenschutz />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>
)
