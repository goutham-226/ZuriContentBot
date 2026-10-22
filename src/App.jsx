import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import Navbar from './components/Navbar';
import Logo from './components/Logo';
import Home from './pages/HOME/Home';
import { AuthProvider, RequireAuth } from './lib/auth';
import { LoginPage, SignupPage } from './pages/AUTH/AuthPages';
import Dashboard from './pages/BOTS/Dashboard';
import NewBot from './pages/BOTS/NewBot';
import BotPage from './pages/BOTS/BotPage';
import RunPage from './pages/BOTS/RunPage';
import Pricing from './pages/PRICING/Pricing';
import Guide from './pages/GUIDE/Guide';
import Niches from './pages/NICHES/Niches';

import './App.css';
import './pages/pages.css';

function App() {
  return (
    <Router>
      <AuthProvider>
        {/* Phones are not supported: below 768px this replaces the app (see App.css) */}
        <div className="device-gate" role="alert">
          <Logo size={48} />
          <h1>Open CreatorFriendly.AI on a bigger screen</h1>
          <p>Building and managing your bots works on laptops, tablets and desktops. Phones aren't supported.</p>
        </div>
        <div className="app">
          <Navbar />
          <main>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/guide" element={<Guide />} />
              <Route path="/niches" element={<Niches />} />
              <Route path="/bots" element={<RequireAuth><Dashboard /></RequireAuth>} />
              <Route path="/bots/new" element={<RequireAuth><NewBot /></RequireAuth>} />
              <Route path="/bots/:id" element={<RequireAuth><BotPage /></RequireAuth>} />
              <Route path="/runs/:id" element={<RequireAuth><RunPage /></RequireAuth>} />
              <Route path="/create" element={<Navigate to="/bots/new" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
