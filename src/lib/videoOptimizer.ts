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
      onProgress(Math.round(progress * 100));
    });
  }

  const inputName = 'input.mp4';
  const outputName = 'output.mp4';

  await ffmpeg.writeFile(inputName, await fetchFile(file));

  await ffmpeg.exec([
    '-i', inputName,
    '-vf', 'scale=-2:1080',
    '-c:v', 'libx264',
    '-crf', '28',
    '-preset', 'ultrafast',
    '-c:a', 'aac',
    outputName,
  ]);

  const data = await ffmpeg.readFile(outputName);
  const compressedBlob = new Blob([data as any], { type: 'video/mp4' });
  
  return new File([compressedBlob], file.name.replace(/\.[^/.]+$/, '') + '.mp4', {
    type: 'video/mp4',
  });
}