'use client';

import { useState, useEffect, useRef, ChangeEvent, FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Image as GalleryIcon, Gamepad2, Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Comment {
  id: string;
  text: string;
  createdAt: string;
  authorName?: string;
}

interface MediaItem {
  id: string | number;
  type: 'image' | 'video';
  src: string;
  thumbSrc?: string;
  alt: string;
  authorName?: string;
  authorAvatar?: string;
  likes: number;
  isLiked?: boolean;
  comments: Comment[];
}

interface UserProfile {
  id: string;
  name: string;
  avatarUrl?: string;
}

const generateVideoThumbnail = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const videoUrl = URL.createObjectURL(file);

    video.preload = 'metadata';
    video.src = videoUrl;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = false;

    video.onloadeddata = () => {
      video.currentTime = 0.5;
    };

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 400;
      canvas.height = video.videoHeight || 600;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }

      const thumbUrl = canvas.toDataURL('image/jpeg', 0.7);
      URL.revokeObjectURL(videoUrl);
      resolve(thumbUrl);
    };

    video.onerror = (err) => {
      URL.revokeObjectURL(videoUrl);
      reject(err);
    };
  });
};

const VersionBadge = () => {
  const commitHash = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA 
    ? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA.substring(0, 7) 
    : 'dev-local';

  return (
    <div style={{
      position: 'fixed',
      bottom: '80px',
      right: '12px',
      background: 'rgba(0, 0, 0, 0.75)',
      color: '#fff',
      padding: '4px 8px',
      fontSize: '11px',
      borderRadius: '4px',
      zIndex: 9999,
      pointerEvents: 'none',
      fontFamily: 'monospace',
    }}>
      v: {commitHash}
    </div>
  );
};

export default function GaleriaPage() {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSlideshowActive, setIsSlideshowActive] = useState(false);
  const [errorImages, setErrorImages] = useState<Record<string, boolean>>({});
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  // Profile stan
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [tempName, setTempName] = useState('');
  const [tempAvatar, setTempAvatar] = useState('');

  const activeVideoRef = useRef<HTMLVideoElement | null>(null);
  const pathname = usePathname();

  const navLinks = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/galeria', icon: GalleryIcon, label: 'Galeria' },
    { href: '/games', icon: Gamepad2, label: 'Gry' },
    { href: '/contact', icon: Mail, label: 'Kontakt' },
  ];

  useEffect(() => {
    let token = localStorage.getItem('app_browser_token');
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem('app_browser_token', token);
    }
    const savedName = localStorage.getItem('app_user_name');
    const savedAvatar = localStorage.getItem('app_user_avatar');

    if (savedName) {
      setProfile({ id: token, name: savedName, avatarUrl: savedAvatar || undefined });
    } else {
      setIsProfileModalOpen(true);
    }
  }, []);

  const handleSaveProfile = (e: FormEvent) => {
    e.preventDefault();
    if (!tempName.trim()) return;

    const token = localStorage.getItem('app_browser_token')!;
    localStorage.setItem('app_user_name', tempName.trim());
    if (tempAvatar.trim()) {
      localStorage.setItem('app_user_avatar', tempAvatar.trim());
    }

    setProfile({ id: token, name: tempName.trim(), avatarUrl: tempAvatar.trim() || undefined });
    setIsProfileModalOpen(false);
  };

  const fetchMedia = async () => {
    try {
      const res = await fetch('/api/media', { method: 'GET', cache: 'no-store' });
      const data = await res.json();

      if (data.success && Array.isArray(data.data)) {
        const likedItems: string[] = JSON.parse(localStorage.getItem('liked_media') || '[]');
        const fetchedItems: MediaItem[] = data.data.map((item: any, idx: number) => ({
          id: item.id || `fetched-${idx}-${Date.now()}`,
          type: item.type === 'video' ? 'video' : 'image',
          src: item.url || item.src,
          thumbSrc: item.thumbnail_url || item.thumbSrc,
          alt: 'Zdjęcie z wydarzenia',
          authorName: item.authorName || 'Gość',
          authorAvatar: item.authorAvatar,
          likes: item.likes || 0,
          isLiked: likedItems.includes(String(item.id)),
          comments: item.comments || [],
        }));
        setMediaItems(fetchedItems);
      }
    } catch (err) {
      console.error('Błąd podczas pobierania galerii:', err);
    }
  };

  useEffect(() => {
    fetchMedia();
    const interval = setInterval(fetchMedia, 5000);
    return () => clearInterval(interval);
  }, []);

  const nextSlide = () => {
    if (!selectedMedia) return;
    setMediaItems((currentItems) => {
      const currentIndex = currentItems.findIndex((m) => m.id === selectedMedia.id);
      const nextIndex = (currentIndex + 1) % currentItems.length;
      setSelectedMedia(currentItems[nextIndex]);
      return currentItems;
    });
  };

  const prevSlide = () => {
    if (!selectedMedia) return;
    setMediaItems((currentItems) => {
      const currentIndex = currentItems.findIndex((m) => m.id === selectedMedia.id);
      const prevIndex = (currentIndex - 1 + currentItems.length) % currentItems.length;
      setSelectedMedia(currentItems[prevIndex]);
      return currentItems;
    });
  };

  // Inteligentny pokaz slajdów: obsługa wideo + fallback timer dla zdjęć
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (selectedMedia && isSlideshowActive) {
      if (selectedMedia.type === 'image') {
        timer = setTimeout(nextSlide, 4000);
      } else if (activeVideoRef.current) {
        activeVideoRef.current.currentTime = 0;
        activeVideoRef.current.play().catch(() => {});
      }
    }
    return () => clearTimeout(timer);
  }, [selectedMedia, isSlideshowActive]);

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);
    const totalFiles = files.length;

    try {
      for (let i = 0; i < totalFiles; i++) {
        const file = files[i];
        const currentFileIndex = i + 1;
        const isVideo = file.type.startsWith('video/');

        let thumbBase64 = '';
        if (isVideo) {
          setUploadStatusText(`Generowanie miniaturki ${currentFileIndex}/${totalFiles}...`);
          try {
            thumbBase64 = await generateVideoThumbnail(file);
          } catch (thumbErr) {
            console.warn('Nie udało się wygenerować miniaturki wideo:', thumbErr);
          }
        }

        setUploadStatusText(`Przygotowanie pliku ${currentFileIndex}/${totalFiles}...`);
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, contentType: file.type }),
        });

        const uploadData = await res.json();
        if (!uploadData.success || !uploadData.uploadUrl) {
          throw new Error('Nie udało się pobrać URL do przesyłania.');
        }

        setUploadStatusText(`Wysyłanie pliku ${currentFileIndex}/${totalFiles} do S3...`);
        const uploadRes = await fetch(uploadData.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        });

        if (!uploadRes.ok) {
          throw new Error('Błąd podczas wysyłania pliku na S3.');
        }

        setUploadStatusText(`Zapisywanie w bazie ${currentFileIndex}/${totalFiles}...`);
        const { error: dbError } = await supabase.from('media').insert([
          {
            url: uploadData.publicUrl,
            type: isVideo ? 'video' : 'image',
            authorName: profile?.name || 'Gość',
            authorAvatar: profile?.avatarUrl || null,
          },
        ]);

        if (dbError) {
          console.error('Błąd zapisu do Supabase:', dbError);
        }

        const newItem: MediaItem = {
          id: `local-${Date.now()}-${i}`,
          type: isVideo ? 'video' : 'image',
          src: uploadData.publicUrl,
          thumbSrc: isVideo ? thumbBase64 : uploadData.publicUrl,
          alt: file.name,
          authorName: profile?.name || 'Gość',
          authorAvatar: profile?.avatarUrl,
          likes: 0,
          comments: [],
        };
        setMediaItems((prev) => [newItem, ...prev]);
        setUploadProgress(Math.round((currentFileIndex / totalFiles) * 100));
      }

      setUploadStatusText('Wszystkie pliki zostały pomyślnie przesłane!');
      fetchMedia();
    } catch (error) {
      console.error('Błąd podczas przesyłania plików:', error);
      setUploadStatusText('Wystąpił błąd podczas przesyłania.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleToggleLike = async (id: string | number) => {
    const targetItem = mediaItems.find((item) => item.id === id);
    if (!targetItem) return;

    const likedItems: string[] = JSON.parse(localStorage.getItem('liked_media') || '[]');
    const isAlreadyLiked = likedItems.includes(String(id));

    if (isAlreadyLiked) return; // Zablokuj ponowne polubienie

    const newLikes = targetItem.likes + 1;

    setMediaItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, likes: newLikes, isLiked: true };
          if (selectedMedia?.id === id) setSelectedMedia(updated);
          return updated;
        }
        return item;
      })
    );

    const updatedLikedItems = [...likedItems, String(id)];
    localStorage.setItem('liked_media', JSON.stringify(updatedLikedItems));

    try {
      await fetch('/api/media', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, likes: newLikes }),
      });
    } catch (err) {
      console.error('Błąd zapisu lajka:', err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !selectedMedia) return;

    const newComment: Comment = {
      id: Date.now().toString(),
      text: newCommentText.trim(),
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      authorName: profile?.name || 'Gość',
    };

    const updatedComments = [...selectedMedia.comments, newComment];

    setMediaItems((prev) =>
      prev.map((item) => {
        if (item.id === selectedMedia.id) {
          const updated = { ...item, comments: updatedComments };
          setSelectedMedia(updated);
          return updated;
        }
        return item;
      })
    );
    setNewCommentText('');

    try {
      await fetch('/api/media', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedMedia.id, comments: updatedComments }),
      });
    } catch (err) {
      console.error('Błąd zapisu komentarza:', err);
    }
  };

  const closeModal = () => {
    setSelectedMedia(null);
    setIsCommentsOpen(false);
    setIsSlideshowActive(false);
  };

  return (
    <>
      <div className="gallery-container">
        <div className="gallery-header">
          <h1>Galeria Wspomnień</h1>
          
          <div className="flex items-center gap-3 mb-4">
            {profile && (
              <div 
                onClick={() => setIsProfileModalOpen(true)}
                className="flex items-center gap-2 cursor-pointer bg-neutral-800 px-3 py-1.5 rounded-full border border-neutral-700"
              >
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="Avatar" className="w-6 h-6 rounded-full object-cover" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-xs text-white">
                    {profile.name[0]?.toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-medium text-white">{profile.name}</span>
                <span className="text-xs text-neutral-400">Edytuj</span>
              </div>
            )}
          </div>

          <section className="upload-section flex flex-col items-center gap-2">
            <label className="upload-button cursor-pointer">
              {isUploading ? uploadStatusText : 'Prześlij wspomnienie'}
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                disabled={isUploading}
                onChange={handleFileUpload}
                className="file-input hidden"
              />
            </label>
          </section>
        </div>

        <div className="masonry-grid">
          {mediaItems
            .filter((item) => !errorImages[item.id])
            .map((item) => (
              <div
                key={item.id}
                className="masonry-item"
                onClick={() => {
                  setSelectedMedia(item);
                  setIsSlideshowActive(false);
                }}
              >
                {item.type === 'image' ? (
                  <Image
                    src={item.thumbSrc || item.src}
                    alt={item.alt}
                    width={400}
                    height={600}
                    unoptimized
                    className="gallery-thumb"
                    onError={() => setErrorImages((prev) => ({ ...prev, [item.id]: true }))}
                  />
                ) : (
                  <div className="video-thumb-container">
                    <video
                      src={item.src}
                      preload="metadata"
                      className="gallery-thumb object-cover"
                      onError={() => setErrorImages((prev) => ({ ...prev, [item.id]: true }))}
                    />
                    <div className="play-overlay">
                      <span className="play-icon">▶</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
        </div>

        {selectedMedia && (
          <div
            className="reel-modal-overlay"
            onTouchStart={(e) => {
              (e.currentTarget as HTMLElement & { touchStartX?: number }).touchStartX = e.touches[0].clientX;
            }}
            onTouchEnd={(e) => {
              const target = e.currentTarget as HTMLElement & { touchStartX?: number };
              const startX = target.touchStartX;
              if (startX === undefined) return;

              const diffX = startX - e.changedTouches[0].clientX;
              if (diffX > 50) nextSlide();
              else if (diffX < -50) prevSlide();
            }}
          >
            <button className="reel-close-btn" onClick={closeModal}>✕</button>

            <div className="reel-media-wrapper reel-media-animated" key={selectedMedia.id} onClick={() => setIsCommentsOpen(false)}>
              {selectedMedia.type === 'image' ? (
                <Image
                  src={selectedMedia.src}
                  alt={selectedMedia.alt}
                  fill
                  unoptimized
                  className="reel-media"
                />
              ) : (
                <video
                  ref={activeVideoRef}
                  src={selectedMedia.src}
                  controls
                  playsInline
                  preload="metadata"
                  className="reel-media"
                  onEnded={() => {
                    if (isSlideshowActive) nextSlide();
                  }}
                />
              )}
            </div>

            <div className="reel-author-info">
              {selectedMedia.authorAvatar ? (
                <img src={selectedMedia.authorAvatar} alt="Avatar" className="author-avatar object-cover" />
              ) : (
                <div className="author-avatar">{(selectedMedia.authorName || 'D')[0].toUpperCase()}</div>
              )}
              <span className="author-name">{selectedMedia.authorName || 'Damian'}</span>
            </div>

            <div className="reel-actions">
              <button
                className="action-btn slideshow-toggle-square-btn"
                onClick={() => setIsSlideshowActive((prev) => !prev)}
                title={isSlideshowActive ? 'Zatrzymaj pokaz' : 'Rozpocznij pokaz'}
              >
                <span className="icon">{isSlideshowActive ? '⏸' : '▶'}</span>
              </button>

              <button
                className={`action-btn ${selectedMedia.isLiked ? 'liked' : ''}`}
                onClick={() => handleToggleLike(selectedMedia.id)}
              >
                <span className="icon">⭐</span>
                <span className="count">{selectedMedia.likes}</span>
              </button>

              <button className="action-btn" onClick={() => setIsCommentsOpen((prev) => !prev)}>
                <span className="icon">💬</span>
                <span className="count">{selectedMedia.comments.length}</span>
              </button>
            </div>

            <div className={`bottom-comments-sheet ${isCommentsOpen ? 'open' : ''}`}>
              <div className="sheet-header">
                <span>Komentarze ({selectedMedia.comments.length})</span>
                <button className="sheet-close" onClick={() => setIsCommentsOpen(false)}>✕</button>
              </div>

              <div className="sheet-comments-list">
                {selectedMedia.comments.length === 0 ? (
                  <p className="no-comments">Brak komentarzy. Napisz coś!</p>
                ) : (
                  selectedMedia.comments.map((comment) => (
                    <div key={comment.id} className="sheet-comment-item">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-indigo-400">{comment.authorName || 'Gość'}</span>
                        <span className="comment-time">{comment.createdAt}</span>
                      </div>
                      <p className="comment-text">{comment.text}</p>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleAddComment} className="sheet-form">
                <input
                  type="text"
                  placeholder="Dodaj komentarz..."
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                />
                <button type="submit">Wyślij</button>
              </form>
            </div>
          </div>
        )}

        {/* Modal Tożsamości */}
        {isProfileModalOpen && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[10000] p-4">
            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-xl max-w-md w-full shadow-xl">
              <h2 className="text-xl font-bold text-white mb-2">Przedstaw się</h2>
              <p className="text-sm text-neutral-400 mb-4">Wpisz swoje imię i opcjonalnie podaj link do zdjęcia, aby inni wiedzieli, kto dodaje wspomnienia.</p>
              
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">Imię i nazwisko / Pseudonim</label>
                  <input
                    type="text"
                    required
                    placeholder="np. Anna Nowak"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">Link do zdjęcia profilowego (opcjonalnie)</label>
                  <input
                    type="url"
                    placeholder="https://example.com/avatar.jpg"
                    value={tempAvatar}
                    onChange={(e) => setTempAvatar(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 rounded-lg transition-colors text-sm"
                >
                  Zapisz i kontynuuj
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      <VersionBadge />

      <div className="scroll-to-top-wrapper">
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="scroll-to-top-btn">
          ↑ Powrót na górę
        </button>
      </div>

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