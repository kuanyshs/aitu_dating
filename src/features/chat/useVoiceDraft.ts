import { useCallback, useEffect, useRef, useState } from 'react';

import type { VoiceRef } from '@/contracts';
import { useSendMessage } from '@/data/hooks';
import { useRepository } from '@/data/RepositoryProvider';
import { newIdempotencyKey } from '@/features/access/steps';
import { blobToDataUrl, startRecording, type RecordedVoice, type Recording } from '@/media';
import { strings } from '@/ui/strings';
import { useToast } from '@/ui/toast';

type Recorded = RecordedVoice & {
  /** For listening before sending. */
  url: string;
  uploadKey: string;
  messageKey: string;
};

export type VoiceDraft =
  | { phase: 'idle' }
  | { phase: 'recording'; elapsedMs: number }
  | { phase: 'recorded'; voice: Recorded; sending: boolean; unsent: boolean };

/**
 * A voice message on its way: record (up to a minute), listen, delete or send. A failed
 * send keeps the recording with «Повторить»; the same keys make a retry store and send it
 * once.
 */
export function useVoiceDraft(chatId: string) {
  const repository = useRepository();
  const send = useSendMessage(chatId);
  const toast = useToast((s) => s.show);
  const [draft, setDraft] = useState<VoiceDraft>({ phase: 'idle' });
  const recording = useRef<Recording | null>(null);
  // What went up already, by upload key: «Повторить» after a failed send does not upload again.
  const uploads = useRef(new Map<string, VoiceRef>());

  const finish = useCallback(async () => {
    const active = recording.current;
    recording.current = null;
    if (!active) return;
    const voice = await active.stop();
    setDraft({
      phase: 'recorded',
      voice: {
        ...voice,
        url: URL.createObjectURL(voice.blob),
        uploadKey: newIdempotencyKey(),
        messageKey: newIdempotencyKey(),
      },
      sending: false,
      unsent: false,
    });
  }, []);

  const start = useCallback(async () => {
    try {
      recording.current = await startRecording(
        (elapsedMs) => setDraft({ phase: 'recording', elapsedMs }),
        () => void finish(),
      );
      setDraft({ phase: 'recording', elapsedMs: 0 });
    } catch (error) {
      const problem = (error as { problem?: 'unsupported' | 'denied' }).problem;
      toast(problem === 'denied' ? strings.chat.voice.denied : strings.chat.voice.unsupported);
    }
  }, [finish, toast]);

  const discard = useCallback(() => {
    recording.current?.cancel();
    recording.current = null;
    setDraft((current) => {
      if (current.phase === 'recorded') URL.revokeObjectURL(current.voice.url);
      return { phase: 'idle' };
    });
  }, []);

  const submit = useCallback(async () => {
    if (draft.phase !== 'recorded' || draft.sending) return;
    const voice = draft.voice;
    setDraft({ ...draft, sending: true, unsent: false });
    try {
      const uploaded =
        uploads.current.get(voice.uploadKey) ??
        (await repository.uploadVoice({
          mimeType: voice.mimeType,
          durationMs: Math.round(voice.durationMs),
          sizeBytes: voice.blob.size,
          dataUrl: await blobToDataUrl(voice.blob),
          idempotencyKey: voice.uploadKey,
        }));
      uploads.current.set(voice.uploadKey, uploaded);
      await send.mutateAsync({ text: '', voiceId: uploaded.id, idempotencyKey: voice.messageKey });
      URL.revokeObjectURL(voice.url);
      setDraft({ phase: 'idle' });
    } catch {
      setDraft((current) =>
        current.phase === 'recorded' ? { ...current, sending: false, unsent: true } : current,
      );
      toast(strings.chat.failedToast);
    }
  }, [draft, repository, send, toast]);

  // Leaving the chat mid-recording lets the microphone go.
  useEffect(() => () => recording.current?.cancel(), []);

  return { draft, start, stop: finish, discard, submit };
}
