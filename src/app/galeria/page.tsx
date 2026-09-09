'use client';

import { useState, useEffect, ChangeEvent } from 'react';
import Image from 'next/image';
import { processUploadedImage } from '@/lib/imageOptimizer';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Image as GalleryIcon, Gamepad2, Mail } from 'lucide-react';

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
  url?: string;
}

interface ApiMediaItem {
  id?: string | number;
  resourceType?: string;
  type?: string;
  url: string;
  authorName?: string;
  likes?: number;
  comments?: Comment[];
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

// Komponent wyświetlający wersję aplikacji z Vercel
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

const initialMedia: MediaItem[] = [
  {
    id: 1,
    type: 'image',
    src: '/images/background.jpg',
    thumbSrc: '/images/background.jpg',
    alt: 'Pierwszy taniec',
    authorName: 'Damian',
    likes: 12,
    comments: [
      {
        id: '1',
        text: 'Super ujęcie!',
        createdAt: '12:30',
      },
    ],
  },
];

export default function GaleriaPage() {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>(initialMedia);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const pathname = usePathname();
  const [isSlideshowActive, setIsSlideshowActive] = useState(false);
  const [errorImages, setErrorImages] = useState<Record<string, boolean>>({});
  const [uploadStatusText, setUploadStatusText] = useState('');

  const navLinks = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/galeria', icon: GalleryIcon, label: 'Galeria' },
    { href: '/games', icon: Gamepad2, label: 'Gry' },
    { href: '/contact', icon: Mail, label: 'Kontakt' },
  ];

  const fetchMedia = async () => {
    try {
      const res = await fetch('/api/media', { cache: 'no-store' });
      const data = await res.json();

      if (data.success && Array.isArray(data.data) && data.data.length > 0) {
        const fetchedItems: MediaItem[] = data.data.map(
          (item: ApiMediaItem, idx: number) => ({
            id: item.id || `fetched-${idx}-${Date.now()}`,
            type: item.resourceType === 'video' || item.type === 'video' ? 'video' : 'image',
            src: item.url,
            thumbSrc: item.url,
            alt: 'Zdjęcie z wydarzenia',
            authorName: item.authorName || 'Gość',
            likes: item.likes || 0,
            comments: item.comments || [],
          })
        );
        setMediaItems(fetchedItems);
      }
    } catch (err) {
      console.error('Błąd podczas pobierania galerii:', err);
    }
  };

  useEffect(() => {
    fetchMedia();
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
      interval = setInterval(() => {
        nextSlide();
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [selectedMedia, isSlideshowActive]);

  // ==========================================
  // BEZPOŚREDNI UPLOAD PLIKU DO S3 (BEZ FFmpeg)
  // ==========================================
  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const processedItems: MediaItem[] = [];
    const fileArray = Array.from(files);
    const totalFiles = fileArray.length;

    console.log(`[FRONTEND] Wybrano plików: ${totalFiles}`);

    try {
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        const currentFileIndex = i + 1;
        const isVideo = file.type.startsWith('video/');
        const isImage = file.type.startsWith('image/');

        console.log(`[FRONTEND] Plik ${currentFileIndex}:`, {
          name: file.name,
          size: file.size, // ROZMIAR W BAJTACH - KLUCZOWY DO PORÓWNANIA
          type: file.type,
          lastModified: file.lastModified,
        });

        if (!isImage && !isVideo) continue;

        // Krok 1: Pobranie Presigned URL
        setUploadStatusText(`Przygotowywanie pliku ${currentFileIndex}/${totalFiles}...`);
        const uploadRequest = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type || (isVideo ? 'video/mp4' : 'application/octet-stream'),
          }),
        });

        const uploadData = await uploadRequest.json();
        console.log(`[FRONTEND] Odpowiedź z /api/upload:`, uploadData);

        if (!uploadData.success || !uploadData.uploadUrl) {
          throw new Error('Nie udało się uzyskać podpisanego URL do S3');
        }

        // Krok 2: Test z ArrayBuffer (wymuszenie poprawnego Content-Length)
        setUploadStatusText(`Wysyłanie do S3 (${currentFileIndex}/${totalFiles})...`);
        
        console.log(`[FRONTEND] Konwertuję plik na ArrayBuffer do wysyłki...`);
        const arrayBuffer = await file.arrayBuffer();
        console.log(`[FRONTEND] ArrayBuffer gotowy. Liczba bajtów: ${arrayBuffer.byteLength}`);

        const finalContentType = isVideo ? 'video/mp4' : (file.type || 'application/octet-stream');

        const uploadRes = await fetch(uploadData.uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': finalContentType,
          },
          body: arrayBuffer, // Wysyłamy bufor, a nie surowy strumień pliku
        });

        console.log(`[FRONTEND] Status odpowiedzi z S3 (PUT):`, uploadRes.status, uploadRes.statusText);

        if (!uploadRes.ok) {
          const errorText = await uploadRes.text();
          console.error(`[FRONTEND] Błąd S3 szczegóły:`, errorText);
          throw new Error(`Upload do S3 nie powiódł się: ${uploadRes.status}`);
        }

        const uploadedUrl = uploadData.publicUrl;
        console.log(`[FRONTEND] Plik wgrany pomyślnie. URL: ${uploadedUrl}`);

        // Krok 3: Zapis w bazie danych
        await fetch('/api/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: uploadedUrl,
            type: isVideo ? 'video' : 'image',
            authorName: 'Gość',
          }),
        });

        // Krok 4: Miniaturka
        if (isImage) {
          try {
            const { thumb, full } = await processUploadedImage(file);
            processedItems.push({
              id: Date.now() + Math.random(),
              type: 'image',
              src: uploadedUrl || full,
              thumbSrc: uploadedUrl || thumb,
              alt: file.name,
              authorName: 'Gość',
              likes: 0,
              comments: [],
            });
          } catch (imageError) {
            console.error('Błąd miniatury zdjęcia:', imageError);
          }
        } else {
          const thumbUrl = await generateVideoThumbnail(file);
          processedItems.push({
            id: Date.now() + Math.random(),
            type: 'video',
            src: uploadedUrl,
            thumbSrc: thumbUrl,
            alt: file.name,
            authorName: 'Gość',
            likes: 0,
            comments: [],
          });
        }
      }
    } catch (fileError) {
      console.error('[FRONTEND] Błąd podczas przesyłania plików:', fileError);
    } finally {
      setMediaItems((prev) => [...processedItems, ...prev]);
      setIsUploading(false);
      setUploadStatusText('');
      e.target.value = '';
    }
  };

  const handleToggleLike = (id: string | number) => {
    setMediaItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const isLiked = !item.isLiked;
          const likes = isLiked ? item.likes + 1 : item.likes - 1;
          const updated = { ...item, likes, isLiked };
          if (selectedMedia?.id === id) {
            setSelectedMedia(updated);
          }
          return updated;
        }
        return item;
      })
    );
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !selectedMedia) return;

    const newComment: Comment = {
      id: Date.now().toString(),
      text: newCommentText.trim(),
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMediaItems((prev) =>
      prev.map((item) => {
        if (item.id === selectedMedia.id) {
          const updated = {
            ...item,
            comments: [...item.comments, newComment],
          };
          setSelectedMedia(updated);
          return updated;
        }
        return item;
      })
    );
    setNewCommentText('');
  };

  const closeModal = () => {
    setSelectedMedia(null);
    setIsCommentsOpen(false);
    setIsSlideshowActive(false);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
                    onError={() => {
                      setErrorImages((prev) => ({ ...prev, [item.id]: true }));
                    }}
                  />
                ) : (
                  <div className="video-thumb-container">
                    <video
                      src={item.thumbSrc || item.src}
                      preload="metadata"
                      className="gallery-thumb object-cover"
                      onError={() => {
                        setErrorImages((prev) => ({ ...prev, [item.id]: true }));
                      }}
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
              (e.currentTarget as HTMLElement & { touchStartX?: number }).touchStartX =
                e.touches[0].clientX;
            }}
            onTouchEnd={(e) => {
              const target = e.currentTarget as HTMLElement & { touchStartX?: number };
              const startX = target.touchStartX;
              if (startX === undefined) return;

              const endX = e.changedTouches[0].clientX;
              const diffX = startX - endX;
              const threshold = 50;

              if (diffX > threshold) {
                nextSlide();
              } else if (diffX < -threshold) {
                prevSlide();
              }
            }}
          >
            <button className="reel-close-btn" onClick={closeModal}>
              ✕
            </button>

            <div
              className="reel-media-wrapper reel-media-animated"
              key={selectedMedia.id}
              onClick={() => setIsCommentsOpen(false)}
            >
              {selectedMedia.type === 'image' ? (
                <Image
                  key={selectedMedia.src}
                  src={selectedMedia.src}
                  alt={selectedMedia.alt}
                  fill
                  unoptimized
                  className="reel-media"
                />
              ) : selectedMedia.src && selectedMedia.src.trim() !== '' ? (
                <video
                  key={selectedMedia.src}
                  src={selectedMedia.src}
                  controls
                  playsInline
                  preload="auto"
                  className="reel-media"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-white">
                  Brak pliku wideo do wyświetlenia
                </div>
              )}
            </div>

            <div className="reel-author-info">
              <div className="author-avatar">
                {(selectedMedia.authorName || 'D')[0].toUpperCase()}
              </div>
              <span className="author-name">{selectedMedia.authorName || 'Damian'}</span>
            </div>

            <div className="reel-actions">
              <button
                className="action-btn slideshow-toggle-square-btn"
                onClick={() => setIsSlideshowActive((prev) => !prev)}
                title={isSlideshowActive ? 'Zatrzymaj pokaz slajdów' : 'Rozpocznij pokaz slajdów'}
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

              <button
                className="action-btn"
                onClick={() => setIsCommentsOpen((prev) => !prev)}
              >
                <span className="icon">💬</span>
                <span className="count">{selectedMedia.comments.length}</span>
              </button>
            </div>

            <div className={`bottom-comments-sheet ${isCommentsOpen ? 'open' : ''}`}>
              <div className="sheet-header">
                <span>Komentarze ({selectedMedia.comments.length})</span>
                <button className="sheet-close" onClick={() => setIsCommentsOpen(false)}>
                  ✕
                </button>
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
        <button onClick={scrollToTop} className="scroll-to-top-btn">
          ↑ Powrót na górę
        </button>
      </div>

      <nav>
        <ul>
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={isActive ? 'nav-item active' : 'nav-item'}
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