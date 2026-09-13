'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Home() {
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [tempNameInput, setTempNameInput] = useState('');
  const [userName, setUserName] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    let token = localStorage.getItem('app_browser_token');
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem('app_browser_token', token);
    }

    const savedName = localStorage.getItem('userName') || localStorage.getItem('gallery_user_name');
    
    if (!savedName) {
      setIsNameModalOpen(true);
    } else {
      setUserName(savedName);
    }
  }, []);

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempNameInput.trim()) return;

    const trimmedName = tempNameInput.trim();
    
    localStorage.setItem('userName', trimmedName);
    localStorage.setItem('gallery_user_name', trimmedName);
    
    setUserName(trimmedName);
    setIsNameModalOpen(false);
  };

  const firstLetter = userName ? userName.charAt(0).toUpperCase() : '?';

  return (
    <>
      {/* Wyskakujący modal tożsamości */}
      {isNameModalOpen && (
        <div className="name-modal-overlay">
          <div className="name-modal-content">
            <h2>Jak masz na imię?</h2>
            <p>Podaj swoje imię, aby inni wiedzieli, kto dodał wspomnienie lub zostawił komentarz.</p>
            <form onSubmit={handleSaveName} className="name-modal-form">
              <input
                type="text"
                placeholder="np. Jan Kowalski"
                value={tempNameInput}
                onChange={(e) => setTempNameInput(e.target.value)}
                required
                autoFocus
                className="name-modal-input"
              />
              <button type="submit" className="name-modal-btn">
                Zapisz i wejdź
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Profil w prawym górnym rogu */}
      {userName && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
        }}>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isExpanded ? 'flex-start' : 'center',
              gap: '10px',
              background: '#1a1a1a',
              color: '#fff',
              border: '2px solid #0070f3',
              borderRadius: isExpanded ? '16px' : '50%',
              width: isExpanded ? 'auto' : '45px',
              height: '45px',
              padding: isExpanded ? '0 16px 0 8px' : '0',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
            title="Kliknij, aby zobaczyć imię"
          >
            <div style={{
              minWidth: '31px',
              height: '31px',
              borderRadius: '50%',
              background: '#0070f3',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '16px',
            }}>
              {firstLetter}
            </div>
            {isExpanded && (
              <span style={{
                fontSize: '14px',
                fontWeight: '500',
                color: '#fff',
              }}>
                Witaj, <strong style={{ color: '#38bdf8' }}>{userName}</strong>!
              </span>
            )}
          </button>
        </div>
      )}

      <header>
        <h1><strong>Damian & Viktoria</strong><br/><br/> Uwiecznij wszystkie chwile</h1>
      </header>
      <main>
        <div style={{ textAlign: 'center', margin: '30px 0' }}>
          <Link href="/galeria" style={{ padding: '12px 24px', background: '#0070f3', color: '#fff', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold' }}>
            Przejdź do galerii
          </Link>
        </div>

        <ol>
          <li><h3>1. Zrób lub dodaj zdjęcie/film z galerii</h3></li>
          <li><h3>2. Podziel się pięknymi chwilami</h3></li>
          <li><h3>3. Przeglądaj wszystkie piękne chwile</h3></li>
          <li><h3>4. Lajkuj i komentuj zdjęcia/filmy innych użytkowników</h3></li>
        </ol>
      </main>
    </>
  );
}