'use client';

import { useState, useEffect } from 'react';
import Image from "next/image";
import styles from "./page.module.css";
import Link from 'next/link';

export default function Home() {
  const [showNameModal, setShowNameModal] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const savedName = localStorage.getItem('gallery_user_name');
    if (!savedName) {
      setShowNameModal(true);
    }
  }, []);

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

    {/* Okienko z formularzem dla nowego użytkownika */}
    {showNameModal && (
      <div className={styles.modalOverlay}>
        <div className={styles.modalContent}>
          <h2>Witaj na naszym weselu! 🎉</h2>
          <p>Wpisz swoje imię lub pseudonim, aby inni wiedzieli, kto dodaje zdjęcia i komentarze.</p>
          <form onSubmit={handleSaveName}>
            <input
              type="text"
              placeholder="Twoje imię..."
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              required
              className={styles.modalInput}
            />
            <button type="submit" className={styles.modalButton}>
              Zapisz i wejdź
            </button>
          </form>
        </div>
      </div>
    )}
    </>
  );
}