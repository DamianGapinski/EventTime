'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import styles from './page.module.css'; // Zakładam, że masz lub utworzysz ten plik stylów

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Comment {
  id: string;
  authorName: string;
  authorAvatar?: string;
  text: string;
  createdAt: string;
}

interface MediaItem {
  id: string;
  type: 'image' | 'video';
  src: string;
  thumbSrc: string;
  authorName: string;
  authorAvatar?: string;
  likes: number;
  comments: Comment[];
  createdAt: string;
}

export default function GalleryPage() {
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadStatusText, setUploadStatusText] = useState<string>('');

  // Stan lightboxa i pokazu slajdów
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  const [isSlideshowActive, setIsSlideshowActive] = useState<boolean>(false);
  const slideshowTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeVideoRef = useRef<HTMLVideoElement | null>(null);

  // Stan nowego komentarza
  const [commentText, setCommentText] = useState<string>('');

  useEffect(() => {
    fetchMedia();
  }, []);

  const fetchMedia = async () => {
    try {
      const res = await fetch('/api/media');
      const data = await res.json();
      if (data.success) {
        setMediaList(data.data);
      }
    } catch (err) {
      console.error('Błąd pobierania mediów:', err);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentUser = () => {
    const name = localStorage.getItem('gallery_user_name') || 'Gość';
    const avatarUrl = localStorage.getItem('gallery_user_avatar') || '';
    return { name, avatarUrl };
  };

  const generateVideoThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.src = URL.createObjectURL(file);

      video.onloadedmetadata = () => {
        video.currentTime = 0.5;
      };

      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 360;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        } else {
          resolve('');
        }
        URL.revokeObjectURL(video.src);
      };

      video.onerror = () => {
        resolve('');
        URL.revokeObjectURL(video.src);
      };
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const user = getCurrentUser();
    if (!localStorage.getItem('gallery_user_name')) {
      window.location.href = '/';
      return;
    }

    setUploading(true);
    const totalFiles = files.length;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isVideo = file.type.startsWith('video');
        const currentFileIndex = i + 1;

        setUploadStatusText(`Przetwarzanie pliku ${currentFileIndex}/${totalFiles}...`);

        let thumbBase64 = '';
        if (isVideo) {
          thumbBase64 = await generateVideoThumbnail(file);
        }

        setUploadStatusText(`Wysyłanie ${currentFileIndex}/${totalFiles}...`);
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const filePath = `uploads/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('media-bucket')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('media-bucket')
          .getPublicUrl(filePath);

        const publicUrl = publicUrlData.publicUrl;

        setUploadStatusText(`Zapisywanie w bazie ${currentFileIndex}/${totalFiles}...`);
        const dbRes = await fetch('/api/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: publicUrl,
            thumbUrl: thumbBase64 || publicUrl,
            type: isVideo ? 'video' : 'image',
            authorName: user.name,
            authorAvatar: user.avatarUrl,
          }),
        });

        const dbData = await dbRes.json();
        if (!dbData.success) {
          console.error('Błąd zapisu do bazy:', dbData.error);
        }
      }

      await fetchMedia();
    } catch (err: any) {
      console.error('Błąd podczas wysyłania:', err);
      alert('Wystąpił błąd podczas przesyłania plików: ' + (err.message || err));
    } finally {
      setUploading(false);
      setUploadStatusText('');
      e.target.value = '';
    }
  };

  const handleLike = async (item: MediaItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const likedKey = `liked_${item.id}`;
    const alreadyLiked = typeof window !== 'undefined' && Boolean(localStorage.getItem(likedKey));

    if (alreadyLiked) return;

    const newLikes = item.likes + 1;

    setMediaList((prev) =>
      prev.map((m) => (m.id === item.id ? { ...m, likes: newLikes } : m))
    );

    localStorage.setItem(likedKey, 'true');

    try {
      await fetch('/api/media', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, likes: newLikes }),
      });
    } catch (err) {
      console.error('Błąd polubienia:', err);
    }
  };

  const handleAddComment = async (itemId: string) => {
    if (!commentText.trim()) return;
    const user = getCurrentUser();

    if (!localStorage.getItem('gallery_user_name')) {
      window.location.href = '/';
      return;
    }

    const targetItem = mediaList.find((m) => m.id === itemId);
    if (!targetItem) return;

    const newComment: Comment = {
      id: Date.now().toString(),
      authorName: user.name,
      authorAvatar: user.avatarUrl,
      text: commentText.trim(),
      createdAt: new Date().toISOString(),
    };

    const updatedComments = [...targetItem.comments, newComment];

    setMediaList((prev) =>
      prev.map((m) => (m.id === itemId ? { ...m, comments: updatedComments } : m))
    );
    setCommentText('');

    try {
      await fetch('/api/media', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId, comments: updatedComments }),
      });
    } catch (err) {
      console.error('Błąd dodawania komentarza:', err);
    }
  };

  useEffect(() => {
    if (!isSlideshowActive || activeItemIndex === null) {
      if (slideshowTimerRef.current) clearTimeout(slideshowTimerRef.current);
      return;
    }

    const currentItem = mediaList[activeItemIndex];
    if (!currentItem) return;

    if (currentItem.type === 'image') {
      slideshowTimerRef.current = setTimeout(() => {
        setActiveItemIndex((prev) =>
          prev !== null ? (prev + 1) % mediaList.length : 0
        );
      }, 4000);
    } else if (currentItem.type === 'video') {
      if (activeVideoRef.current) {
        activeVideoRef.current.currentTime = 0;
        activeVideoRef.current.play().catch(() => {});
      }
    }

    return () => {
      if (slideshowTimerRef.current) clearTimeout(slideshowTimerRef.current);
    };
  }, [isSlideshowActive, activeItemIndex, mediaList]);

  const handleVideoEnded = () => {
    if (isSlideshowActive) {
      setActiveItemIndex((prev) =>
        prev !== null ? (prev + 1) % mediaList.length : 0
      );
    }
  };

  return (
    <div className={styles.galleryContainer || ''}>
      {/* NAGŁÓWEK */}
      <header className={styles.galleryHeader || ''}>
        <div>
          <h1>Galeria Wspomnień</h1>
          <p>Dziel się zdjęciami i filmami w czasie rzeczywistym</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/" style={{ fontSize: '0.85rem', textDecoration: 'underline' }}>
            Strona główna
          </Link>

          <label style={{ cursor: 'pointer', backgroundColor: '#4f46e5', color: '#fff', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 500 }}>
            Dodaj pliki
            <input type="file" multiple accept="image/*,video/*" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>
        </div>
      </header>

      {/* STATUS UPLOADU */}
      {uploading && (
        <div style={{ padding: '1rem', backgroundColor: '#1e1b4b', borderRadius: '8px', marginBottom: '1.5rem', color: '#c7d2fe' }}>
          {uploadStatusText}
        </div>
      )}

      {/* SIATKA GALERII */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem' }}>Ładowanie...</div>
      ) : mediaList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', border: '2px dashed #334155', borderRadius: '12px' }}>
          <p>Brak zdjęć i filmów w galerii.</p>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Użyj przycisku „Dodaj pliki”, aby wrzucić pierwsze materiały!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
          {mediaList.map((item, index) => {
            const likedKey = `liked_${item.id}`;
            const isLiked = typeof window !== 'undefined' && Boolean(localStorage.getItem(likedKey));

            return (
              <div
                key={item.id}
                onClick={() => {
                  setActiveItemIndex(index);
                  setIsSlideshowActive(false);
                }}
                style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
              >
                <div style={{ position: 'relative', aspectRatio: '1/1', backgroundColor: '#000', overflow: 'hidden' }}>
                  {item.type === 'video' ? (
                    <>
                      <img src={item.thumbSrc} alt="Miniaturka wideo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', paddingLeft: '2px' }}>
                          ▶
                        </div>
                      </div>
                    </>
                  ) : (
                    <img src={item.src} alt="Zdjęcie" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </div>

                <div style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'between', borderTop: '1px solid #1e293b', background: '#090d16' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                    {item.authorAvatar ? (
                      <img src={item.authorAvatar} alt="" style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>
                        {item.authorName?.charAt(0) || 'G'}
                      </div>
                    )}
                    <span style={{ fontSize: '0.75rem', color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.authorName || 'Gość'}
                    </span>
                  </div>

                  <button
                    onClick={(e) => handleLike(item, e)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      backgroundColor: isLiked ? '#ffe4e6' : '#1e293b',
                      color: isLiked ? '#e11d48' : '#cbd5e1',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <span>❤️</span>
                    <span>{item.likes}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL / LIGHTBOX */}
      {activeItemIndex !== null && mediaList[activeItemIndex] && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0, 0, 0, 0.95)', display: 'flex', flexDirection: 'column' }}>
          
          {/* Górna belka Lightboxa */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: 'rgba(0,0,0,0.5)' }}>
            <button
              onClick={() => {
                setActiveItemIndex(null);
                setIsSlideshowActive(false);
              }}
              style={{ backgroundColor: '#1e293b', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}
            >
              ✕ Zamknij
            </button>

            <button
              onClick={() => setIsSlideshowActive(!isSlideshowActive)}
              style={{
                backgroundColor: isSlideshowActive ? '#e11d48' : '#1e293b',
                color: '#fff',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              {isSlideshowActive ? '⏹ Zatrzymaj pokaz' : '▶ Pokaz slajdów'}
            </button>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
            {/* Główny podgląd */}
            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
              <div style={{ maxWidth: '100%', maxHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {mediaList[activeItemIndex].type === 'video' ? (
                  <video
                    ref={activeVideoRef}
                    src={mediaList[activeItemIndex].src}
                    controls
                    autoPlay
                    playsInline
                    onEnded={handleVideoEnded}
                    style={{ maxHeight: '75vh', maxWidth: '100%', borderRadius: '8px' }}
                  />
                ) : (
                  <img
                    src={mediaList[activeItemIndex].src}
                    alt="Podgląd"
                    style={{ maxHeight: '75vh', maxWidth: '100%', objectFit: 'contain', borderRadius: '8px' }}
                  />
                )}
              </div>

              {/* Strzałki nawigacji */}
              <button
                onClick={() => setActiveItemIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : mediaList.length - 1))}
                style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', background: '#1e293b', color: '#fff', border: 'none', padding: '1rem', borderRadius: '50%', cursor: 'pointer' }}
              >
                ‹
              </button>
              <button
                onClick={() => setActiveItemIndex((prev) => (prev !== null ? (prev + 1) % mediaList.length : 0))}
                style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: '#1e293b', color: '#fff', border: 'none', padding: '1rem', borderRadius: '50%', cursor: 'pointer' }}
              >
                ›
              </button>
            </div>

            {/* Panel boczny komentarzy */}
            <div style={{ width: '380px', backgroundColor: '#0f172a', borderLeft: '1px solid #1e293b', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '1rem', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {mediaList[activeItemIndex].authorAvatar ? (
                    <img src={mediaList[activeItemIndex].authorAvatar} alt="" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#fff' }}>
                      {mediaList[activeItemIndex].authorName?.charAt(0) || 'G'}
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 500, color: '#fff' }}>{mediaList[activeItemIndex].authorName}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {new Date(mediaList[activeItemIndex].createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <button
                  onClick={(e) => handleLike(mediaList[activeItemIndex], e)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: '#1e293b', color: '#fff', border: 'none', padding: '0.5rem 0.75rem', borderRadius: '8px', cursor: 'pointer' }}
                >
                  <span>❤️</span>
                  <span>{mediaList[activeItemIndex].likes}</span>
                </button>
              </div>

              {/* Lista */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {mediaList[activeItemIndex].comments.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#64748b', fontSize: '0.85rem', marginTop: '2rem' }}>Brak komentarzy. Bądź pierwszy!</p>
                ) : (
                  mediaList[activeItemIndex].comments.map((comment) => (
                    <div key={comment.id} style={{ backgroundColor: '#020617', border: '1px solid #1e293b', padding: '0.75rem', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#818cf8' }}>{comment.authorName}</span>
                        <span style={{ fontSize: '0.65rem', color: '#64748b' }}>
                          {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>{comment.text}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Input */}
              <div style={{ padding: '0.75rem', borderTop: '1px solid #1e293b', backgroundColor: '#020617', display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Napisz komentarz..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddComment(mediaList[activeItemIndex].id)}
                  style={{ flex: 1, backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', padding: '0.5rem 0.75rem', color: '#fff', fontSize: '0.85rem', outline: 'none' }}
                />
                <button
                  onClick={() => handleAddComment(mediaList[activeItemIndex].id)}
                  style={{ backgroundColor: '#4f46e5', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Wyślij
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}