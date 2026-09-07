export interface OptimizedImageResult {
  full: string;
  thumb: string;
}

export const compressToWebP = (
  file: File,
  quality = 0.85,
  maxWidth = 1920
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.src = URL.createObjectURL(file);

    image.onload = () => {
      let { width, height } = image;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const generateVideoThumbnail = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = URL.createObjectURL(file);
    video.muted = true;
    video.playsInline = true;

    video.onloadeddata = () => {
      video.currentTime = 1; // Pobiera klatkę z 1. sekundy filmu
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

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Nie udało się uzyskać kontekstu Canvas'));
        return;
      }

      ctx.drawImage(image, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(image.src);
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Błąd podczas konwersji do WebP'));
          }
        },
        'image/webp',
        quality
      );
    };

    image.onerror = (err) => reject(err);
  });
};

// Generowanie zestawu: Lekka miniaturka na telefon (max 400px) + Zdjęcie HD
export const processUploadedImage = async (
  file: File
): Promise<OptimizedImageResult> => {
  // 1. Miniaturka na telefon (Szerokość max 400px, jakość 70% ~ 20-40 KB)
  const thumbBlob = await compressToWebP(file, 0.7, 400);
  
  // 2. Pełny wymiar do podglądu (Szerokość max 1600px, jakość 85% ~ 150-300 KB)
  const fullBlob = await compressToWebP(file, 0.85, 1600);

  return {
    thumb: URL.createObjectURL(thumbBlob),
    full: URL.createObjectURL(fullBlob),
  };
};