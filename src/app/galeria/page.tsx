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

const generateVideoThumbnail = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = URL.createObjectURL(file);
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
      ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const thumbUrl = canvas.toDataURL('image/jpeg', 0.8);
      URL.revokeObjectURL(video.src);
      resolve(thumbUrl);
    };

    video.onerror = (err) => reject(err);
  });
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
    comments: [{ id: '1', text: 'Super ujęcie!', createdAt: '12:30' }],
  }
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
  const [uploadProgress, setUploadProgress] = useState(0);
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
        const fetchedItems: MediaItem[] = data.data.map((item: any, idx: number) => ({
          id: item.id || `fetched-${idx}-${Date.now()}`,
          type: item.resourceType === 'video' || item.type === 'video' ? 'video' : 'image',
          src: item.url,
          thumbSrc: item.url,
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
  }, []);

  const nextSlide = () => {
    if (!selectedMedia) return;
    setMediaItems((currentItems) => {
      const currentIndex = currentItems.findIndex(m => m.id === selectedMedia.id);
      const nextIndex = (currentIndex + 1) % currentItems.length;
      setSelectedMedia(currentItems[nextIndex]);
      return currentItems;
    });
  };

  const prevSlide = () => {
    if (!selectedMedia) return;
    setMediaItems((currentItems) => {
      const currentIndex = currentItems.findIndex(m => m.id === selectedMedia.id);
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

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const processedItems: MediaItem[] = [];
    const totalFiles = files.length;
    let currentFileIndex = 0;

    for (let file of Array.from(files)) {
      currentFileIndex++;
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');

      if (!isImage && !isVideo) continue;

      if (isVideo) {
        try {
          setUploadStatusText(`Kompresja wideo (${currentFileIndex}/${totalFiles})...`);
          file = await compressVideo(file);
        } catch (err) {
          console.warn('Nie udało się skompresować wideo, wysyłam oryginał:', err);
        }
      }

      let uploadedUrl = '';

      try {
        setUploadStatusText(`Przygotowanie do wysyłki (${currentFileIndex}/${totalFiles})...`);
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, contentType: file.type }),
        });
        
        const { uploadUrl, publicUrl, success } = await res.json();

        if (success && uploadUrl) {
          // Wysyłka z paskiem postępu przez XMLHttpRequest
          await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', uploadUrl);
            xhr.setRequestHeader('Content-Type', file.type);

            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                const percentComplete = Math.round((event.loaded / event.total) * 100);
                setUploadProgress(percentComplete);
                setUploadStatusText(`Wysyłanie ${currentFileIndex}/${totalFiles}: ${percentComplete}%`);
              }
            };

            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                uploadedUrl = publicUrl;
                resolve(true);
              } else {
                reject(new Error(`Błąd uploadu: ${xhr.status}`));
              }
            };

            xhr.onerror = () => reject(new Error('Błąd sieci podczas wysyłania'));
            xhr.send(file);
          });

          if (uploadedUrl) {
            try {
              await fetch('/api/media', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  url: uploadedUrl,
                  type: isVideo ? 'video' : 'image',
                  authorName: 'Gość',
                }),
              });
            } catch (dbErr) {
              console.error('Błąd zapisu w bazie danych:', dbErr);
            }
          }
        }
      } catch (uploadErr) {
        console.error('Błąd podczas uploadu do AWS S3:', uploadErr);
      }

      if (isImage) {
        try {
          setUploadStatusText('Generowanie miniatury...');
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
        } catch (err) {
          console.error('Błąd miniatury zdjęcia:', err);
        }
      } else if (isVideo) {
        try {
          setUploadStatusText('Generowanie miniatury wideo...');
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
        } catch (err) {
          console.error('Błąd miniatury wideo:', err);
        }
      }
    }

    setMediaItems((prev) => [...processedItems, ...prev]);
    setIsUploading(false);
    setUploadProgress(0);
    setUploadStatusText('');
    e.target.value = '';
  };

  const handleToggleLike = (id: string | number) => {
    setMediaItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const isLiked = !item.isLiked;
          const likes = isLiked ? item.likes + 1 : item.likes - 1;
          const updated = { ...item, likes, isLiked };
          if (selectedMedia?.id === id) setSelectedMedia(updated);
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
          const updated = { ...item, comments: [...item.comments, newComment] };
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
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  const compressVideo = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.muted = false; // Musimy włączyć, żeby pobrać audio
      video.playsInline = true;

      video.onloadedmetadata = () => {
        video.play().catch(() => {
          // Jeśli automatyczne odtwarzanie jest zablokowane, zwracamy oryginał z dźwiękiem
          resolve(file);
        });
      };

      video.onplay = () => {
        const canvas = document.createElement('canvas');
        let width = video.videoWidth;
        let height = video.videoHeight;
        const maxDim = 1080;

        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Pobieramy strumień wideo z canvasa
        const canvasStream = canvas.captureStream(30);
        
        // Pobieramy strumień audio bezpośrednio z oryginalnego elementu wideo
        const audioStream = (video as any).captureStream ? (video as any).captureStream() : (video as any).mozCaptureStream ? (video as any).mozCaptureStream() : null;

        if (audioStream && audioStream.getAudioTracks().length > 0) {
          canvasStream.addTrack(audioStream.getAudioTracks()[0]);
        }

        let recorder: MediaRecorder;
        const options = [
          { mimeType: 'video/webm;codecs=vp9,opus' },
          { mimeType: 'video/webm' },
          { mimeType: 'video/mp4' }
        ];

        const selectedOption = options.find(opt => MediaRecorder.isTypeSupported(opt.mimeType));
        
        try {
          recorder = new MediaRecorder(canvasStream, selectedOption || undefined);
        } catch {
          resolve(file);
          return;
        }

        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = () => {
          const compressedBlob = new Blob(chunks, { type: recorder.mimeType || 'video/mp4' });
          if (compressedBlob.size >= file.size) {
            resolve(file);
          } else {
            const compressedFile = new File([compressedBlob], file.name.replace(/\.[^/.]+$/, "") + '.mp4', { type: compressedBlob.type });
            resolve(compressedFile);
          }
          URL.revokeObjectURL(video.src);
        };

        recorder.start();

        const draw = () => {
          if (video.ended || video.paused) {
            if (recorder.state === 'recording') recorder.stop();
            video.remove();
            return;
          }
          ctx?.drawImage(video, 0, 0, width, height);
          requestAnimationFrame(draw);
        };
        draw();
      };

      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve(file);
      };
    });
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

            {/* Pasek postępu */}
            {isUploading && (
              <div className="w-full max-xs:w-64 w-72 bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner mt-2">
                <div 
                  className="bg-blue-600 h-full transition-all duration-200 ease-out" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            )}
          </section>
        </div>

        {/* Siatka Masonry Grid */}
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
                      src={item.src} 
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

        {/* Pełnoekranowy widok Reel Style */}
        {selectedMedia && (
          <div 
            className="reel-modal-overlay"
            onTouchStart={(e) => {
              (e.currentTarget as any).touchStartX = e.touches[0].clientX;
            }}
            onTouchEnd={(e) => {
              const startX = (e.currentTarget as any).touchStartX;
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
              key={selectedMedia?.id} 
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
                <video key={selectedMedia.src} src={selectedMedia.src} controls autoPlay loop className="reel-media" />
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
              {/* Przycisk pokazu slajdów w zaokrąglonym kwadracie nad gwiazdką */}
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