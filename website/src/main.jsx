import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import Home from './pages/Home.jsx'
import Buchung from './pages/Buchung.jsx'
import { Impressum, Datenschutz } from './pages/Recht.jsx'
import Feedback from './pages/Feedback.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/termin" element={<Buchung />} />
        <Route path="/impressum" element={<Impressum />} />
        <Route path="/datenschutz" element={<Datenschutz />} />
        <Route path="/feedback" element={<Feedback />} />
      </Routes>
    </HashRouter>
  </React.StrictMode>
)
