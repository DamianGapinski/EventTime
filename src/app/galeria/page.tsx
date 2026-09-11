'use client';

import { useState, useEffect, ChangeEvent } from 'react';
import Image from 'next/image';
import { processUploadedImage } from '@/lib/imageOptimizer';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Image as GalleryIcon, Gamepad2, Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase'; // lub ścieżka do Twojego pliku z klientem Supabase

interface Comment {
  id: string;
  text: string;
  createdAt: string;
}

interface MediaItem {
  id: string | number;
  type: 'image' | 'video';
  src: string;
  thumbSrc?: string;
  alt: string;
  authorName?: string;
  likes: number;
  isLiked?: boolean;
  comments: Comment[];
}

const generateVideoThumbnail = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const videoUrl = URL.createObjectURL(file);

    video.preload = 'metadata';
    video.src = videoUrl;
    video.muted = true;
    video.playsInline = true;

    video.onloadeddata = () => {
      video.currentTime = 1;
    };

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }

      const thumbUrl = canvas.toDataURL('image/jpeg', 0.8);
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
  
  const pathname = usePathname();

  const navLinks = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/galeria', icon: GalleryIcon, label: 'Galeria' },
    { href: '/games', icon: Gamepad2, label: 'Gry' },
    { href: '/contact', icon: Mail, label: 'Kontakt' },
  ];

  const fetchMedia = async () => {
    try {
      const res = await fetch('/api/media', { 
  method: 'GET', // ZAWSZE GET!
  cache: 'no-store' 
});
      const data = await res.json();

      if (data.success && Array.isArray(data.data)) {
        const fetchedItems: MediaItem[] = data.data.map((item: any, idx: number) => ({
          id: item.id || `fetched-${idx}-${Date.now()}`,
          type: item.type === 'video' ? 'video' : 'image',
          src: item.url || item.src,
          thumbSrc: item.thumbnail_url || item.thumbSrc,
          alt: 'Zdjęcie z wydarzenia',
          authorName: item.authorName || 'Gość',
          likes: item.likes || 0,
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

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (selectedMedia && isSlideshowActive) {
      interval = setInterval(nextSlide, 4000);
    }
    return () => clearInterval(interval);
  }, [selectedMedia, isSlideshowActive]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

      // 1. Pobranie presigned URL z API (używamy 'filename' i 'contentType')
      setUploadStatusText(`Przygotowanie pliku ${currentFileIndex}/${totalFiles}...`);
      
      const res = await fetch('/api/upload', {
  method: 'POST', // ZAWSZE POST!
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ filename: file.name, contentType: file.type }),
});

      const uploadData = await res.json();
      if (!uploadData.success || !uploadData.uploadUrl) {
        throw new Error('Nie udało się pobrać URL do przesyłania.');
      }

      // 2. Bezpośredni upload surowego pliku do S3
      setUploadStatusText(`Wysyłanie pliku ${currentFileIndex}/${totalFiles} do S3...`);
      const uploadRes = await fetch(uploadData.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error('Błąd podczas wysyłania pliku na S3.');
      }

      // 3. Zapis do bazy danych Supabase ze statusem "processing" dla wideo
      setUploadStatusText(`Zapisywanie w bazie ${currentFileIndex}/${totalFiles}...`);
      const { error: dbError } = await supabase.from('media').insert([
        {
          url: uploadData.publicUrl,
          thumbnail_url: uploadData.publicUrl,
          type: isVideo ? 'video' : 'image',
          status: isVideo ? 'processing' : 'ready',
        },
      ]);

      if (dbError) {
        console.error('Błąd zapisu do Supabase:', dbError);
      }

      setUploadProgress(Math.round((currentFileIndex / totalFiles) * 100));
    }

    setUploadStatusText('Wszystkie pliki zostały pomyślnie przesłane!');
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

    const newIsLiked = !targetItem.isLiked;
    const newLikes = newIsLiked ? targetItem.likes + 1 : targetItem.likes - 1;

    setMediaItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = { ...item, likes: newLikes, isLiked: newIsLiked };
          if (selectedMedia?.id === id) setSelectedMedia(updated);
          return updated;
        }
        return item;
      })
    );

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
                      src={item.thumbSrc || item.src}
                      preload="metadata"
                      poster={item.thumbSrc}
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
                  src={selectedMedia.src}
                  controls
                  playsInline
                  preload="metadata"
                  className="reel-media"
                />
              )}
            </div>

            <div className="reel-author-info">
              <div className="author-avatar">{(selectedMedia.authorName || 'D')[0].toUpperCase()}</div>
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
                      <p className="comment-text">{comment.text}</p>
                      <span className="comment-time">{comment.createdAt}</span>
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