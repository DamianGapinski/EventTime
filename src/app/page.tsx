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

      {userName && (
        <div className="user-badge-container">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`user-badge-btn ${isExpanded ? 'expanded' : ''}`}
            title="Kliknij, aby zobaczyć imię"
          >
            <div className="user-badge-avatar">
              {firstLetter}
            </div>
            {isExpanded && (
              <span className="user-badge-text">
                Witaj, <strong className="user-badge-name">{userName}</strong>!
              </span>
            )}
          </button>
        </div>
      )}

      <header>
        <h1><strong>Damian & Wiktoria</strong><br/><br/> Uwiecznij wszystkie chwile</h1>
        <div className="gallery-link-wrapper">
          <Link href="/galeria" className="gallery-link-btn">
            Przejdź do galerii
          </Link>
        </div>
      </header>
      
    </>
  );
}