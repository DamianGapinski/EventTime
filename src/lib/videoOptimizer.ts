import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;

export async function optimizeVideo(
  file: File, 
  onProgress?: (progress: number) => void
): Promise<File> {
  if (!ffmpeg) {
    ffmpeg = new FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
  }

  if (onProgress) {
    ffmpeg.on('progress', ({ progress }) => {
      // Zabezpieczenie przed wartościami NaN lub ujemnymi
      if (progress >= 0 && progress <= 1) {
        onProgress(Math.round(progress * 100));
      }
    });
  }

  const inputName = `input_${Date.now()}.mp4`;
  const outputName = `output_${Date.now()}.mp4`;

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    // Używamy bezpieczniejszych ustawień, które nie przepełnią pamięci przeglądarki
    await ffmpeg.exec([
      '-i', inputName,
      '-vf', 'scale=-2:1080',
      '-c:v', 'libx264',
      '-crf', '28',
      '-preset', 'veryfast',
      '-c:a', 'aac',
      '-b:a', '128k',
      outputName,
    ]);

    const data = await ffmpeg.readFile(outputName);
    const compressedBlob = new Blob([data as any], { type: 'video/mp4' });
    
    // Czyszczenie wirtualnego systemu plików FFmpeg, aby zwolnić pamięć RAM
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);

    // Jeśli z jakiegoś powodu plik wyjściowy jest większy lub równy oryginałowi, zwracamy oryginał
    if (compressedBlob.size >= file.size) {
      console.warn('Kompresja nie zmniejszyła pliku, używam oryginału.');
      return file;
    }

    return new File([compressedBlob], file.name.replace(/\.[^/.]+$/, '') + '.mp4', {
      type: 'video/mp4',
    });
  } catch (err) {
    console.error('Błąd transkodowania FFmpeg w przeglądarce:', err);
    // Awaryjny fallback – jeśli FFmpeg wyłoży się na gigantycznym pliku 8K, przepuszczamy oryginał
    return file;
  }
}