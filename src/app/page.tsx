'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [name, setName] = useState('');
  const router = useRouter();

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    // Zapisujemy imię i nazwisko w pamięci przeglądarki
    localStorage.setItem('userName', name.trim());
    router.push('/galeria');
  };

  return (
    <>
      <header>
        <h1><strong>Damian & Viktoria</strong><br/><br/> Uwiecznij wszystkie chwile</h1>
      </header>
      <main>
        <form onSubmit={handleStart} style={{ margin: '20px 0', display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '300px' }}>
          <label htmlFor="userName">Podaj swoje imię (i nazwisko):</label>
          <input
            id="userName"
            type="text"
            placeholder="np. Jan Kowalski"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <button type="submit" style={{ padding: '10px', fontSize: '16px', cursor: 'pointer' }}>
            Przejdź do aplikacji
          </button>
        </form>

        <ol>
          <li><h3>1. Wpisz swoje imię i przejdź do aplikacji</h3></li>
          <li><h3>2. Zrób lub dodaj zdjęcie/film z galerii</h3></li>
          <li><h3>3. Podziel się pięknymi chwilami</h3></li>
          <li><h3>4. Przeglądaj wszystkie chwile i zobacz, kto je dodał</h3></li>
          <li><h3>5. Lajkuj i komentuj zdjęcia innych</h3></li>
        </ol>
      </main>
    </>
  );
}