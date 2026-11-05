import { VOICE_MAX_MS, VOICE_TYPES, type VoiceType } from '@/contracts';

/** Why recording could not start: no microphone in this browser, or no permission. */
export type RecordProblem = 'unsupported' | 'denied';

export type Recording = {
  /** Stops and hands over what was recorded; at the limit it stops by itself. */
  stop(): Promise<RecordedVoice>;
  /** Stops and throws the recording away. */
  cancel(): void;
};

export type RecordedVoice = { blob: Blob; mimeType: VoiceType; durationMs: number };

/** «audio/webm;codecs=opus» → «audio/webm»; formats the contract does not know fall back. */
export function voiceType(mime: string): VoiceType {
  const base = mime.split(';')[0]!.trim().toLowerCase();
  return (VOICE_TYPES as readonly string[]).includes(base) ? (base as VoiceType) : 'audio/webm';
}

/** «0:07», «1:00». */
export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function canRecord(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'
  );
}

/**
 * Starts recording from the microphone. `onTick` reports the elapsed time; at
 * VOICE_MAX_MS the recording stops and `onLimit` is called.
 */
export async function startRecording(
  onTick: (elapsedMs: number) => void,
  onLimit: () => void,
): Promise<Recording> {
  if (!canRecord()) throw Object.assign(new Error('unsupported'), { problem: 'unsupported' });
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    throw Object.assign(new Error('denied'), { problem: 'denied' });
  }
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const startedAt = Date.now();
  let stoppedAt: number | undefined;
  const timer = setInterval(() => {
    const elapsed = Date.now() - startedAt;
    onTick(Math.min(elapsed, VOICE_MAX_MS));
    if (elapsed >= VOICE_MAX_MS) onLimit();
  }, 200);
  const release = () => {
    clearInterval(timer);
    stream.getTracks().forEach((track) => track.stop());
  };
  const finished = new Promise<RecordedVoice>((resolve) => {
    recorder.onstop = () => {
      release();
      const durationMs = Math.min(Math.max((stoppedAt ?? Date.now()) - startedAt, 1), VOICE_MAX_MS);
      const mimeType = voiceType(recorder.mimeType || chunks[0]?.type || 'audio/webm');
      resolve({ blob: new Blob(chunks, { type: mimeType }), mimeType, durationMs });
    };
  });
  recorder.start(250);
  return {
    stop() {
      if (recorder.state !== 'inactive') {
        stoppedAt = Date.now();
        recorder.stop();
      }
      return finished;
    },
    cancel() {
      recorder.onstop = null;
      if (recorder.state !== 'inactive') recorder.stop();
      release();
    },
  };
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
