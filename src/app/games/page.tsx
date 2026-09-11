'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Image as GalleryIcon, Gamepad2, Mail, Camera, CheckCircle2, Circle } from 'lucide-react';

interface Challenge {
  id: number;
  title: string;
  description: string;
  points: number;
  completed: boolean;
}

const INITIAL_CHALLENGES: Challenge[] = [
  {
    id: 1,
    title: "Osoba w czerwonych butach",
    description: "Znajdź kogoś, kto założył czerwone buty i zrób mu wyraźne zdjęcie!",
    points: 100,
    completed: false,
  },
  {
    id: 2,
    title: "Najbardziej szalony tanecznym krok",
    description: "Uchwyć na parkiecie kogoś wykonującego najbardziej nietypowy układ taneczny.",
    points: 150,
    completed: false,
  },
  {
    id: 3,
    title: "Toast za Młodą Parę",
    description: "Zrób zdjęcie w momencie wznoszenia toastu z pełnymi kieliszkami.",
    points: 100,
    completed: false,
  },
  {
    id: 4,
    title: "Grupa wsparcia przy barze",
    description: "Zrób fotkę ekipie zgromadzonej w okolicach baru lub kącika z przekąskami.",
    points: 120,
    completed: false,
  },
  {
    id: 5,
    title: "Najsłodszy moment wieczoru",
    description: "Uchwyć kogoś zajadającego się tortem lub weselnymi słodkościami z uśmiechem od ucha do ucha.",
    points: 130,
    completed: false,
  },
  {
    id: 6,
    title: "Selfie z Młodą Parą",
    description: "Zrób wspólne, uśmiechnięte selfie razem z gospodarzami wieczoru!",
    points: 200,
    completed: false,
  },
];

const VersionBadge = () => {
  const commitHash = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA
    ? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA.substring(0, 7)
    : 'dev-local';

  return <div className="version-badge">v: {commitHash}</div>;
};

export default function GamesPage() {
  const pathname = usePathname();
  const [challenges, setChallenges] = useState<Challenge[]>(INITIAL_CHALLENGES);

  const navLinks = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/galeria', icon: GalleryIcon, label: 'Galeria' },
    { href: '/games', icon: Gamepad2, label: 'Gry' },
    { href: '/contact', icon: Mail, label: 'Kontakt' },
  ];

  const toggleChallenge = (id: number) => {
    setChallenges((prev) =>
      prev.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item))
    );
  };

  const totalPoints = challenges.reduce((acc, curr) => (curr.completed ? acc + curr.points : acc), 0);
  const completedCount = challenges.filter((c) => c.completed).length;

  return (
    <>
      <div className="gallery-container" style={{ paddingBottom: '100px', maxWidth: '600px', margin: '0 auto', paddingLeft: '16px', paddingRight: '16px' }}>
        <div className="gallery-header" style={{ textAlign: 'center', marginBottom: '25px' }}>
          <h1>Wyzwania Weselne 📸</h1>
          <p style={{ color: '#666', fontSize: '14px', marginTop: '5px' }}>
            Wykonuj zadania, zdobywaj punkty i uwieczniaj najlepsze momenty imprezy!
          </p>

          {/* Licznik punktów i postępu */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-around',
              background: '#f8f9fa',
              padding: '15px',
              borderRadius: '12px',
              marginTop: '20px',
              border: '1px solid #eaeaea',
            }}
          >
            <div>
              <span style={{ display: 'block', fontSize: '12px', color: '#888' }}>UKOŃCZONE ZADANIA</span>
              <strong style={{ fontSize: '18px', color: '#222' }}>
                {completedCount} / {challenges.length}
              </strong>
            </div>
            <div style={{ borderLeft: '1px solid #ddd', paddingLeft: '20px' }}>
              <span style={{ display: 'block', fontSize: '12px', color: '#888' }}>ZDOBYTE PUNKTY</span>
              <strong style={{ fontSize: '18px', color: '#0070f3' }}>{totalPoints} pkt</strong>
            </div>
          </div>
        </div>

        {/* Lista wyzwań */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {challenges.map((challenge) => (
            <div
              key={challenge.id}
              style={{
                background: challenge.completed ? '#f0fdf4' : '#fff',
                border: challenge.completed ? '1px solid #bbf7d0' : '1px solid #eaeaea',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '14px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                transition: 'all 0.2s ease',
              }}
            >
              <button
                onClick={() => toggleChallenge(challenge.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px',
                  color: challenge.completed ? '#22c55e' : '#cbd5e1',
                  flexShrink: 0,
                }}
                title={challenge.completed ? 'Oznacz jako niewykonane' : 'Oznacz jako wykonane'}
              >
                {challenge.completed ? <CheckCircle2 size={28} /> : <Circle size={28} />}
              </button>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <h3
                    style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: challenge.completed ? '#166534' : '#1f2937',
                      textDecoration: challenge.completed ? 'line-through' : 'none',
                    }}
                  >
                    {challenge.title}
                  </h3>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 'bold',
                      background: challenge.completed ? '#dcfce7' : '#eff6ff',
                      color: challenge.completed ? '#15803d' : '#1d4ed8',
                      padding: '2px 8px',
                      borderRadius: '20px',
                    }}
                  >
                    +{challenge.points} pkt
                  </span>
                </div>
                <p
                  style={{
                    fontSize: '13px',
                    color: challenge.completed ? '#4b5563' : '#6b7280',
                    marginBottom: '12px',
                  }}
                >
                  {challenge.description}
                </p>

                {/* Przycisk szybkiego przejścia do galerii w celu wrzucenia zdjęcia */}
                <Link
                  href="/galeria"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: '500',
                    color: '#0070f3',
                    textDecoration: 'none',
                    background: '#f0f7ff',
                    padding: '6px 12px',
                    borderRadius: '6px',
                  }}
                >
                  <Camera size={15} />
                  <span>Prześlij zdjęcie do zadania</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      <VersionBadge />

      <nav>
        <ul>
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={pathname === link.href ? 'nav-item active' : 'nav-item'}
                  title={link.label}
                  aria-label={link.label}
                >
                  <Icon size={24} />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}