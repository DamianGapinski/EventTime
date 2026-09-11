'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

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

  // Pomocnicza funkcja pobierająca aktualnego użytkownika z localStorage
  const getCurrentUser = () => {
    const name = localStorage.getItem('gallery_user_name') || 'Gość';
    const avatarUrl = localStorage.getItem('gallery_user_avatar') || '';
    return { name, avatarUrl };
  };

  // Generowanie miniaturki dla wideo (zgodne z iOS/WebKit)
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

  // Upload plików
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

        // 1. Upload do Storage Supabase
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

        // 2. Zapis do bazy danych przez API
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

  // Obsługa polubień z zabezpieczeniem przed wielokrotnym kliknięciem (LocalStorage)
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

  // Dodawanie komentarza
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

  // Inteligentny Pokaz Slajdów
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
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      {/* NAGŁÓWEK */}
      <header className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            Galeria Wspomnień
          </h1>
          <p className="text-slate-400 text-sm mt-1">Dziel się zdjęciami i filmami w czasie rzeczywistym</p>
        </div>

        <div className="flex items-center gap-4">
          <a
            href="/"
            className="text-xs text-slate-400 hover:text-white underline underline-offset-4 transition"
          >
            Strona główna
          </a>

          {/* Przycisk dodawania */}
          <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 transition flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Dodaj pliki
            <input type="file" multiple accept="image/*,video/*" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </header>

      {/* STATUS UPLOADU */}
      {uploading && (
        <div className="mb-6 bg-indigo-950/50 border border-indigo-800/50 p-4 rounded-xl flex items-center gap-3 animate-pulse">
          <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-indigo-200 font-medium">{uploadStatusText}</span>
        </div>
      )}

      {/* SIATKA GALERII */}
      {loading ? (
        <div className="flex justify-center items-center py-24">
          <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : mediaList.length === 0 ? (
        <div className="text-center py-24 border-2 border-dashed border-slate-800 rounded-2xl">
          <p className="text-slate-400 mb-2">Brak zdjęć i filmów w galerii.</p>
          <p className="text-sm text-slate-600">Użyj przycisku „Dodaj pliki”, aby wrzucić pierwsze materiały!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                className="group relative bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden cursor-pointer hover:border-slate-700 transition flex flex-col"
              >
                <div className="relative aspect-square bg-slate-950 overflow-hidden">
                  {item.type === 'video' ? (
                    <>
                      <img src={item.thumbSrc} alt="Miniaturka wideo" className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <div className="w-12 h-12 rounded-full bg-indigo-600/90 flex items-center justify-center text-white pl-0.5 shadow-lg">
                          ▶
                        </div>
                      </div>
                    </>
                  ) : (
                    <img src={item.src} alt="Zdjęcie" className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                  )}
                </div>

                {/* Stopka karty */}
                <div className="p-3 flex items-center justify-between bg-slate-900/90 border-t border-slate-800">
                  <div className="flex items-center gap-2 truncate">
                    {item.authorAvatar ? (
                      <img src={item.authorAvatar} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                        {item.authorName?.charAt(0) || 'G'}
                      </div>
                    )}
                    <span className="text-xs text-slate-300 truncate">{item.authorName || 'Gość'}</span>
                  </div>

                  <button
                    onClick={(e) => handleLike(item, e)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                      isLiked ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
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
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col md:flex-row">
          {/* Główny widok media */}
          <div className="flex-1 relative flex items-center justify-center p-4">
            <button
              onClick={() => {
                setActiveItemIndex(null);
                setIsSlideshowActive(false);
              }}
              className="absolute top-4 left-4 z-20 bg-slate-900/80 hover:bg-slate-800 text-white p-2.5 rounded-xl border border-slate-700 transition"
            >
              ✕ Zamknij
            </button>

            <button
              onClick={() => setIsSlideshowActive(!isSlideshowActive)}
              className={`absolute top-4 right-4 z-20 px-4 py-2 rounded-xl text-sm font-medium border transition ${
                isSlideshowActive
                  ? 'bg-rose-600/90 border-rose-500 text-white'
                  : 'bg-slate-900/80 border-slate-700 text-slate-200 hover:bg-slate-800'
              }`}
            >
              {isSlideshowActive ? '⏹ Zatrzymaj pokaz' : '▶ Pokaz slajdów'}
            </button>

            <div className="max-w-4xl max-h-[85vh] w-full h-full flex items-center justify-center">
              {mediaList[activeItemIndex].type === 'video' ? (
                <video
                  ref={activeVideoRef}
                  src={mediaList[activeItemIndex].src}
                  controls
                  autoPlay
                  playsInline
                  onEnded={handleVideoEnded}
                  className="max-h-full max-w-full object-contain rounded-xl"
                />
              ) : (
                <img
                  src={mediaList[activeItemIndex].src}
                  alt="Podgląd"
                  className="max-h-full max-w-full object-contain rounded-xl"
                />
              )}
            </div>

            {/* Strzałki nawigacji */}
            <button
              onClick={() => setActiveItemIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : mediaList.length - 1))}
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-slate-900/80 hover:bg-slate-800 text-white p-3 rounded-full border border-slate-700 transition"
            >
              ‹
            </button>
            <button
              onClick={() => setActiveItemIndex((prev) => (prev !== null ? (prev + 1) % mediaList.length : 0))}
              className="absolute right-4 md:right-[380px] top-1/2 -translate-y-1/2 bg-slate-900/80 hover:bg-slate-800 text-white p-3 rounded-full border border-slate-700 transition"
            >
              ›
            </button>
          </div>

          {/* Panel boczny: Komentarze i info */}
          <div className="w-full md:w-[380px] bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 flex flex-col h-[40vh] md:h-full">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {mediaList[activeItemIndex].authorAvatar ? (
                  <img src={mediaList[activeItemIndex].authorAvatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center font-bold">
                    {mediaList[activeItemIndex].authorName?.charAt(0) || 'G'}
                  </div>
                )}
                <div>
                  <div className="font-medium text-sm">{mediaList[activeItemIndex].authorName}</div>
                  <div className="text-xs text-slate-500">
                    {new Date(mediaList[activeItemIndex].createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              <button
                onClick={(e) => handleLike(mediaList[activeItemIndex], e)}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-xl text-xs font-medium transition"
              >
                <span>❤️</span>
                <span>{mediaList[activeItemIndex].likes}</span>
              </button>
            </div>

            {/* Lista komentarzy */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {mediaList[activeItemIndex].comments.length === 0 ? (
                <p className="text-center text-slate-500 text-xs py-8">Brak komentarzy. Bądź pierwszy!</p>
              ) : (
                mediaList[activeItemIndex].comments.map((comment) => (
                  <div key={comment.id} className="bg-slate-950/50 border border-slate-800/60 p-3 rounded-xl">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-indigo-400">{comment.authorName}</span>
                      <span className="text-[10px] text-slate-600">
                        {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300">{comment.text}</p>
                  </div>
                ))
              )}
            </div>

            {/* Formularz dodawania komentarza */}
            <div className="p-3 border-t border-slate-800 bg-slate-950/30 flex gap-2">
              <input
                type="text"
                placeholder="Napisz komentarz..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddComment(mediaList[activeItemIndex].id)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition"
              />
              <button
                onClick={() => handleAddComment(mediaList[activeItemIndex].id)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition"
              >
                Wyślij
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}