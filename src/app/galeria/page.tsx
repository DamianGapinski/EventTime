'use client';

import { useState, useEffect, useRef, ChangeEvent } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Image as GalleryIcon, Gamepad2, Mail, Heart, Trash2, X, Play, Pause, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from './galeria.module.css';

interface Comment {
  id: string;
  name: string;
  text: string;
  createdAt: string;
}

interface MediaItem {
  id: string | number;
  type: 'image' | 'video';
  src: string;
  thumb_url?: string;
  likes: number;
  comments: Comment[];
  author_name?: string;
}

const VersionBadge = () => {
  const commitHash = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA
    ? process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA.substring(0, 7)
    : 'dev-local';

  return <div className="version-badge">v: {commitHash}</div>;
};

const generateVideoThumbnail = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const videoUrl = URL.createObjectURL(file);

    video.preload = 'auto';
    video.src = videoUrl;
    video.muted = true;
    video.playsInline = true;
    video.load();

    video.onloadeddata = () => {
      setTimeout(() => {
        video.currentTime = 0.5;
      }, 200);
    };

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 240;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }

      try {
        const thumbUrl = canvas.toDataURL('image/jpeg', 0.7);
        URL.revokeObjectURL(videoUrl);
        resolve(thumbUrl);
      } catch (err) {
        URL.revokeObjectURL(videoUrl);
        reject(err);
      }
    };

    video.onerror = (err) => {
      URL.revokeObjectURL(videoUrl);
      reject(err);
    };
  });
};

export default function GaleriaPage() {
  const pathname = usePathname();
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [isSlideshowActive, setIsSlideshowActive] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [newCommentText, setNewCommentText] = useState<string>('');
  const [userName, setUserName] = useState<string>('Gość');

  const navLinks = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/galeria', icon: GalleryIcon, label: 'Galeria' },
    { href: '/games', icon: Gamepad2, label: 'Gry' },
    { href: '/contact', icon: Mail, label: 'Kontakt' },
  ];

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedName = localStorage.getItem('userName');
      if (savedName) setUserName(savedName);
    }
    fetchMedia();
  }, []);

  const fetchMedia = async () => {
    try {
      const { data, error } = await supabase
        .from('media')
        .select('*')
        .order('id', { ascending: false });

      if (error) throw error;
      if (data) {
        setMediaItems(data.map((item: any) => ({
          ...item,
          comments: Array.isArray(item.comments) ? item.comments : [],
          author_name: item.author_name || 'Gość'
        })));
      }
    } catch (err) {
      console.error('Błąd pobierania mediów:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    if (selectedMedia && isSlideshowActive) {
      if (selectedMedia.type === 'image') {
        timeout = setTimeout(() => {
          nextSlide();
        }, 4000);
      } else {
        if (videoRef.current) {
          videoRef.current.play().catch(() => {
            timeout = setTimeout(() => nextSlide(), 4000);
          });
        }
      }
    }

    return () => clearTimeout(timeout);
  }, [selectedMedia, isSlideshowActive]);

  const nextSlide = () => {
    if (!selectedMedia || mediaItems.length === 0) return;
    const currentIndex = mediaItems.findIndex((m) => m.id === selectedMedia.id);
    const nextIndex = (currentIndex + 1) % mediaItems.length;
    setSelectedMedia(mediaItems[nextIndex]);
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isVideo = file.type.startsWith('video');
        let thumbnailUrl = '';

        if (isVideo) {
          try {
            thumbnailUrl = await generateVideoThumbnail(file);
          } catch (err) {
            console.error('Błąd miniatury wideo', err);
          }
        }

        const fileName = `${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('media-bucket')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('media-bucket')
          .getPublicUrl(fileName);

        const mediaUrl = publicUrlData.publicUrl;

        const newItem = {
          type: isVideo ? 'video' : 'image',
          src: mediaUrl,
          thumb_url: isVideo ? thumbnailUrl : mediaUrl,
          likes: 0,
          comments: [],
          author_name: userName,
        };

        const { data: insertedData, error: dbError } = await supabase
          .from('media')
          .insert([newItem])
          .select()
          .single();

        if (dbError) throw dbError;

        if (insertedData) {
          setMediaItems((prev) => [
            {
              ...insertedData,
              comments: Array.isArray(insertedData.comments) ? insertedData.comments : [],
              author_name: insertedData.author_name || 'Gość'
            },
            ...prev
          ]);
        }
      }
    } catch (err) {
      console.error('Błąd przesyłania:', err);
      alert('Wystąpił błąd podczas wysyłania pliku.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleLike = async (item: MediaItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updatedLikes = item.likes + 1;

    setMediaItems((prev) =>
      prev.map((m) => (m.id === item.id ? { ...m, likes: updatedLikes } : m))
    );

    if (selectedMedia && selectedMedia.id === item.id) {
      setSelectedMedia({ ...selectedMedia, likes: updatedLikes });
    }

    try {
      await supabase
        .from('media')
        .update({ likes: updatedLikes })
        .eq('id', item.id);
    } catch (err) {
      console.error('Błąd polubienia:', err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !selectedMedia) return;

    const newComment: Comment = {
      id: Date.now().toString(),
      name: userName,
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
      await supabase
        .from('media')
        .update({ comments: updatedComments })
        .eq('id', selectedMedia.id);
    } catch (err) {
      console.error('Błąd zapisu komentarza:', err);
    }
  };

  const handleDelete = async (id: string | number) => {
    if (!confirm('Czy na pewno chcesz usunąć ten element?')) return;
    try {
      await supabase.from('media').delete().eq('id', id);
      setMediaItems((prev) => prev.filter((item) => item.id !== id));
      setSelectedMedia(null);
      setIsSlideshowActive(false);
    } catch (err) {
      console.error('Błąd usuwania:', err);
    }
  };

  return (
    <>
      <div className="gallery-container" style={{ paddingBottom: '100px' }}>
        <div className={styles.headerContainer}>
          <div className={styles.headerTop}>
            <div>
              <h1>Galeria Wspomnień</h1>
              <p style={{ color: '#666', fontSize: '13px' }}>Cześć, <strong>{userName}</strong>!</p>
            </div>
          </div>
          
          <div className={styles.actionsRow}>
            {mediaItems.length > 0 && (
              <button
                onClick={() => {
                  setSelectedMedia(mediaItems[0]);
                  setIsSlideshowActive(true);
                }}
                className={styles.slideshowBtn}
              >
                <Play size={18} /> Pokaz slajdów
              </button>
            )}

            <label className={styles.uploadLabel}>
              <Plus size={18} /> {uploading ? 'Wysyłanie...' : 'Dodaj'}
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleFileUpload}
                disabled={uploading}
                className={styles.hiddenInput}
              />
            </label>
          </div>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', color: '#888', marginTop: '40px' }}>Ładowanie wspomnień...</p>
        ) : mediaItems.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#888', marginTop: '40px' }}>Brak zdjęć i filmów. Dodaj pierwsze wspomnienie!</p>
        ) : (
          <div className="gallery-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
            {mediaItems.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  setSelectedMedia(item);
                  setIsSlideshowActive(false);
                }}
                style={{
                  position: 'relative',
                  aspectRatio: '1',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  background: '#000',
                }}
              >
                <img
                  src={item.type === 'video' ? (item.thumb_url || item.src) : item.src}
                  alt="wspomnienie"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <div style={{
                  position: 'absolute',
                  bottom: '0',
                  left: '0',
                  right: '0',
                  padding: '6px 8px',
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                  color: '#fff',
                  fontSize: '11px',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <span>{item.author_name || 'Gość'}</span>
                  <span>❤️ {item.likes}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedMedia && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.9)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <button
            onClick={() => { setSelectedMedia(null); setIsSlideshowActive(false); }}
            style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
          >
            <X size={28} />
          </button>

          <div style={{ position: 'absolute', top: '20px', left: '20px', display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setIsSlideshowActive(!isSlideshowActive)}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              {isSlideshowActive ? <Pause size={16} /> : <Play size={16} />}
              {isSlideshowActive ? 'Zatrzymaj pokaz' : 'Włącz pokaz'}
            </button>
          </div>

          <div style={{ maxWidth: '500px', width: '100%', maxHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
            {selectedMedia.type === 'image' ? (
              <img
                src={selectedMedia.src}
                alt="Fullscreen"
                style={{ maxWidth: '100%', maxHeight: '50vh', objectFit: 'contain', borderRadius: '8px' }}
              />
            ) : (
              <video
                ref={videoRef}
                src={selectedMedia.src}
                controls
                autoPlay={isSlideshowActive}
                playsInline
                preload="metadata"
                style={{ maxWidth: '100%', maxHeight: '50vh', objectFit: 'contain', borderRadius: '8px' }}
                onEnded={() => {
                  if (isSlideshowActive) {
                    nextSlide();
                  }
                }}
              />
            )}

            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', color: '#fff' }}>
              <span>Autor: <strong>{selectedMedia.author_name || 'Gość'}</strong></span>
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                <button
                  onClick={(e) => handleLike(selectedMedia, e)}
                  style={{ background: 'none', border: 'none', color: '#ff4d4f', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '16px' }}
                >
                  <Heart size={20} fill="#ff4d4f" /> {selectedMedia.likes}
                </button>
                <button
                  onClick={() => handleDelete(selectedMedia.id)}
                  style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer' }}
                  title="Usuń"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            <div style={{ width: '100%', background: '#1e1e1e', borderRadius: '8px', padding: '12px', marginTop: '10px', maxHeight: '150px', overflowY: 'auto' }}>
              {selectedMedia.comments.length === 0 ? (
                <p style={{ color: '#888', fontSize: '13px', textAlign: 'center', margin: 0 }}>Brak komentarzy.</p>
              ) : (
                selectedMedia.comments.map((c) => (
                  <div key={c.id} style={{ marginBottom: '10px', fontSize: '13px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <span style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '12px' }}>{c.name || 'Gość'}</span>
                      <span style={{ fontSize: '10px', color: '#888' }}>{c.createdAt}</span>
                    </div>
                    <p style={{ color: '#fff', margin: '0', fontSize: '14px' }}>{c.text}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddComment} style={{ width: '100%', display: 'flex', gap: '8px', marginTop: '8px' }}>
              <input
                type="text"
                placeholder="Napisz komentarz jako..."
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: 'none', fontSize: '13px' }}
              />
              <button type="submit" style={{ background: '#0070f3', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                Wyślij
              </button>
            </form>
          </div>
        </div>
      )}

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