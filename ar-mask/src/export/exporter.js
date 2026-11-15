// Writing video files.
//
// exportFile(): reads a video file frame by frame, puts the masks on every frame, and writes a new file. It is not
// real time: each frame waits until its masks are drawn, so no frame of the source can reach the output unmasked
// and none is skipped, however slow the computer is. The sound is carried over unchanged where the format allows.
//
// LiveRecorder: records the finished picture while it plays (camera or file).
import {
  Input, Output, Conversion, ALL_FORMATS, BlobSource, BufferTarget, Mp4OutputFormat, WebMOutputFormat, CanvasSource,
  canEncodeVideo, QUALITY_HIGH,
} from 'mediabunny';

/** The best file format this browser can encode: H.264 in MP4 where there is an encoder for it, otherwise WebM. */
async function pickFormat(width, height) {
  const tries = [
    ['avc', () => new Mp4OutputFormat({ fastStart: 'in-memory' })],
    ['vp9', () => new WebMOutputFormat()],
    ['vp8', () => new WebMOutputFormat()],
    ['av1', () => new Mp4OutputFormat({ fastStart: 'in-memory' })],
  ];
  for (const [codec, make] of tries) {
    try {
      if (await canEncodeVideo(codec, { width, height, quality: QUALITY_HIGH })) return { codec, format: make() };
    } catch { /* try the next */ }
  }
  throw new Error('This browser has no video encoder. Use a current Chrome, Edge or Safari.');
}

const even = (n) => Math.max(2, Math.round(n / 2) * 2);
const pause = () => new Promise((r) => setTimeout(r, 0));

/**
 * @param {File} file
 * @param {{
 *   tracker: import('../tracking/headTracker.js').HeadTracker,
 *   stage: import('../render/stage.js').Stage,
 *   keepAudio?: boolean,
 *   onProgress?: (fraction: number, frames: number) => void,
 *   signal?: AbortSignal,
 * }} o
 * @returns {Promise<{ blob: Blob, filename: string, frames: number, audioKept: boolean, codec: string, log: object[] }>}
 */
export async function exportFile(file, { tracker, stage, keepAudio = true, onProgress, signal }) {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const video = await input.getPrimaryVideoTrack();
  if (!video) throw new Error('No video track found in this file.');
  const W = even(video.displayWidth), H = even(video.displayHeight);
  const { codec, format } = await pickFormat(W, H);
  const output = new Output({ format, target: new BufferTarget() });

  // The body tracker runs on every frame here: there is time, and it is what covers a head the face tracker loses.
  const prevMode = tracker.poseMode;
  tracker.poseMode = 'always';
  tracker.reset();
  const base = performance.now();
  let frames = 0, lastT = null;
  const log = [];

  const conversion = await Conversion.init({
    input, output,
    tracks: 'primary',
    showWarnings: false,
    video: {
      codec,
      quality: QUALITY_HIGH,
      forceTranscode: true,
      allowTransformationMetadata: false, // phone videos: turn the frames upright before tracking
      processedWidth: W,
      processedHeight: H,
      process: async (sample) => {
        stage.captureVia((ctx) => sample.draw(ctx, 0, 0, W, H), W, H);
        const tracks = tracker.update(stage.frame, W, H, base + sample.timestamp * 1000);
        stage.render(tracks, lastT == null ? 0 : Math.max(0, sample.timestamp - lastT));
        lastT = sample.timestamp;
        log.push({ t: sample.timestamp, states: tracks.map((t) => t.state), hidden: stage.report.hidden });
        if (++frames % 4 === 0) await pause(); // let the page repaint its progress bar
        return stage.out;
      },
    },
    audio: keepAudio ? {} : { discard: true },
  });
  if (!conversion.isValid) {
    tracker.poseMode = prevMode;
    throw new Error('This video cannot be converted in this browser (its video codec could not be decoded).');
  }
  conversion.onProgress = (p) => onProgress?.(p, frames);
  const onAbort = () => conversion.cancel();
  signal?.addEventListener('abort', onAbort);
  try {
    await conversion.execute();
  } finally {
    signal?.removeEventListener('abort', onAbort);
    tracker.poseMode = prevMode;
    tracker.reset();
  }
  const audioKept = keepAudio && conversion.utilizedTracks.some((t) => t.type === 'audio');
  const stem = file.name.replace(/\.[^.]+$/, '') || 'video';
  return {
    blob: new Blob([output.target.buffer], { type: format.mimeType }),
    filename: `${stem}-masked${format.fileExtension}`,
    frames, audioKept, codec, log,
  };
}

/** Records the output canvas as it is drawn: call frame() after each finished picture. */
export class LiveRecorder {
  static async start(canvas) {
    const { codec, format } = await pickFormat(even(canvas.width), even(canvas.height));
    const rec = new LiveRecorder();
    rec.format = format;
    rec.output = new Output({ format, target: new BufferTarget() });
    rec.source = new CanvasSource(canvas, { codec, quality: QUALITY_HIGH, keyFrameInterval: 2, sizeChangeBehavior: 'contain' });
    rec.output.addVideoTrack(rec.source);
    await rec.output.start();
    rec.t0 = null;
    rec.busy = false;
    rec.frames = 0;
    rec.skipped = 0;
    return rec;
  }

  frame(nowMs) {
    if (this.t0 == null) this.t0 = nowMs;
    // If the encoder is still busy with the last frame, this one is left out of the file. That costs smoothness,
    // never privacy: only finished, masked pictures are ever handed to the encoder.
    if (this.busy) { this.skipped++; return; }
    this.busy = true;
    this.frames++;
    this.source.add((nowMs - this.t0) / 1000).catch((err) => console.warn('[mask-layer] record:', err)).finally(() => { this.busy = false; });
  }

  async stop() {
    await this.output.finalize();
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    return {
      blob: new Blob([this.output.target.buffer], { type: this.format.mimeType }),
      filename: `mask-layer-${stamp}${this.format.fileExtension}`,
      frames: this.frames, skipped: this.skipped,
    };
  }
}

/** Hand a finished file to the browser's downloads. */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return url;
}
