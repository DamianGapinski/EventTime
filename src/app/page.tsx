'use client';

import React, { useState, useEffect } from 'react';
import Image from "next/image";
import styles from "./page.module.css";
import Link from 'next/link';

interface UserProfile {
  name: string;
  avatarUrl: string;
}

export default function Home() {
  const [profile, setProfile] = useState<UserProfile>({ name: '', avatarUrl: '' });
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [tempName, setTempName] = useState<string>('');
  const [tempAvatar, setTempAvatar] = useState<string>('');

  useEffect(() => {
    const savedName = localStorage.getItem('gallery_user_name');
    const savedAvatar = localStorage.getItem('gallery_user_avatar');

    if (!savedName) {
      setIsProfileModalOpen(true);
    } else {
      setProfile({
        name: savedName,
        avatarUrl: savedAvatar || '',
      });
    }
  }, []);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempName.trim()) return;

    const newProfile = {
      name: tempName.trim(),
      avatarUrl: tempAvatar.trim(),
    };

    localStorage.setItem('gallery_user_name', newProfile.name);
    localStorage.setItem('gallery_user_avatar', newProfile.avatarUrl);
    setProfile(newProfile);
    setIsProfileModalOpen(false);
  };

  return (
    <>
      <header>
        <h1><strong>Event Time</strong><br/><br/> Uwiecznij wszystkie chwile</h1>
        
        <Link href="/galeria">
          <button>Przejdź do aplikacji</button>
        </Link>
      </header>

      <main>
        <ol>
          <li><h3>1. Naciśnij przycisk &quot;Przejdź do aplikacji&quot;</h3></li>
          <li><h3>2. Zrób lub dodaj zdjęcie/film z galerii</h3></li>
          <li><h3>3. Podziel się pięknymi chwilami</h3></li>
          <li><h3>4. Przeglądaj wszystkie piękne chwile</h3></li>
          <li><h3>5. Lajkuj i komentuj zdjęcia/filmy innych użytkowników</h3></li>
          <li><h3>6. Bierz udział w grach i zabawach razem z innymi użytkownikami</h3></li>
          <li><h3>7. Zdobywaj punkty i wygrywaj nagrody</h3></li>
        </ol>

        <Link href="/galeria">
          <button>Przejdź do aplikacji</button>
        </Link>
      </main>

      {/* MODAL TOŻSAMOŚCI UŻYTKOWNIKA NA STRONIE GŁÓWNEJ */}
      {isProfileModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '1rem',
            maxWidth: '400px',
            width: '100%',
            padding: '2rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            color: '#f8fafc',
            fontFamily: 'sans-serif'
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Przedstaw się</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1.5rem', lineHeight: '1.4' }}>
              Wprowadź swoje imię lub pseudonim, aby inni wiedzieli, kto dodaje zdjęcia, lajki i komentarze.
            </p>

            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#94a3b8', marginBottom: '0.3rem' }}>
                  Twoje imię lub pseudonim *
                </label>
                <input
                  type="text"
                  required
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  placeholder="np. Jan Kowalski"
                  style={{
                    width: '100%',
                    backgroundColor: '#020617',
                    border: '1px solid #1e293b',
                    borderRadius: '0.75rem',
                    padding: '0.625rem 0.875rem',
                    fontSize: '0.875rem',
                    color: '#fff',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '500', color: '#94a3b8', marginBottom: '0.3rem' }}>
                  Link do zdjęcia profilowego (opcjonalnie)
                </label>
                <input
                  type="url"
                  value={tempAvatar}
                  onChange={(e) => setTempAvatar(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  style={{
                    width: '100%',
                    backgroundColor: '#020617',
                    border: '1px solid #1e293b',
                    borderRadius: '0.75rem',
                    padding: '0.625rem 0.875rem',
                    fontSize: '0.875rem',
                    color: '#fff',
                    outline: 'none'
                  }}
                />
              </div>

              <button
                type="submit"
                style={{
                  width: '100%',
                  backgroundColor: '#4f46e5',
                  color: '#fff',
                  fontWeight: '500',
                  padding: '0.75rem',
                  borderRadius: '0.75rem',
                  border: 'none',
                  cursor: 'pointer',
                  marginTop: '0.5rem',
                  fontSize: '0.875rem',
                  boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.3)'
                }}
              >
                Zapisz i kontynuuj
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}