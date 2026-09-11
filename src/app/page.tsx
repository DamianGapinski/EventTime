'use client';

import { useState, useEffect } from 'react';
import Image from "next/image";
import styles from "./page.module.css";
import Link from 'next/link';

export default function Home() {
  const [showNameModal, setShowNameModal] = useState(false);
  const [userName, setUserName] = useState('');

  // Sprawdzamy przy załadowaniu strony, czy użytkownik ma już zapisane imię
  useEffect(() => {
    const savedName = localStorage.getItem('gallery_user_name');
    if (!savedName) {
      setShowNameModal(true);
    }
  }, []);

  // Obsługa zapisu imienia z formularza
  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) return;

    localStorage.setItem('gallery_user_name', userName.trim());
    setShowNameModal(false);
  };

  return (
    <>
    <header>
      <h1><strong>Damian & Viktoria</strong><br/><br/> Uwiecznij wszystkie chwile</h1>
      
      <Link href="/galeria">
      <button>Przejdź do aplikacji</button>
      </Link>
      
    </header>
    <main>
      <ol>
        <li><h3>1.Naciśnij przycisk "Przejdź do aplikacji"</h3></li>
        <li><h3>2.Zrób lub dodaj zdjęcie/film z galerii</h3></li>
        <li><h3>3.Podziel się pięknymi chwilami</h3></li>
        <li><h3>4.Przeglądaj wszystkie piękne chwile</h3></li>
        <li><h3>5.Likój i komentuj zdjęcia/filmy innych urzytkowników</h3></li>
        <li><h3>6.Bierz udział w grach i zabawach razem z innymi urzytkownikami</h3></li>
        <li><h3>7.Zdobywaj punkty i wygrywaj nagrody</h3></li>
      </ol>
      <Link href="/galeria">
      <button>Przejdź do aplikacji</button>
      </Link>
    </main>

    {/* Okienko (div) z formularzem dla nowego użytkownika */}
    {showNameModal && (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
      }}>
        <div style={{
          backgroundColor: '#111',
          padding: '30px',
          borderRadius: '12px',
          maxWidth: '400px',
          width: '90%',
          color: '#fff',
          textAlign: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
        }}>
          <h2>Witaj na naszym weselu! 🎉</h2>
          <p style={{ margin: '15px 0', fontSize: '14px', color: '#ccc' }}>
            Wpisz swoje imię lub pseudonim, aby inni wiedzieli, kto dodaje zdjęcia i komentarze.
          </p>
          <form onSubmit={handleSaveName}>
            <input
              type="text"
              placeholder="Twoje imię..."
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '6px',
                border: '1px solid #444',
                backgroundColor: '#222',
                color: '#fff',
                fontSize: '16px',
                marginBottom: '15px',
                boxSizing: 'border-box'
              }}
            />
            <button
              type="submit"
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#ff4b5c',
                color: '#fff',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Zapisz i wejdź
            </button>
          </form>
        </div>
      </div>
    )}
    </>
  );
}