'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Home() {
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [tempNameInput, setTempNameInput] = useState('');
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const savedName = localStorage.getItem('userName');
    if (!savedName) {
      setIsNameModalOpen(true);
    } else {
      setUserName(savedName);
    }
  }, []);

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempNameInput.trim()) return;

    localStorage.setItem('userName', tempNameInput.trim());
    setUserName(tempNameInput.trim());
    setIsNameModalOpen(false);
  };

  return (
    <>
      {/* Wyskakujący modal na stronie głównej */}
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

      <header>
        <h1><strong>Damian & Viktoria</strong><br/><br/> Uwiecznij wszystkie chwile</h1>
      </header>
      <main>
        {userName && <p style={{ textAlign: 'center', marginBottom: '20px' }}>Witaj, <strong>{userName}</strong>!</p>}
        
        <div style={{ textAlign: 'center', margin: '20px 0' }}>
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