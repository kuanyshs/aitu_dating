import { useCallback, useRef, useState } from 'react';

import type { PhotoRef } from '@/contracts';
import { useRepository } from '@/data/RepositoryProvider';
import {
  checkPhotoFile,
  isPhotoType,
  photoOrigin,
  pickPhotos,
  resizePhoto,
  type PhotoOrigin,
} from '@/media';
import { strings } from '@/ui/strings';
import { useToast } from '@/ui/toast';

/** One picked Фото on its way up: uploading, failed (with «Повторить») or stored. */
export type PhotoSlot = {
  key: string;
  status: 'uploading' | 'error' | 'done';
  /** Shown while uploading and after a failure; the stored url once done. */
  preview: string;
  photo?: PhotoRef;
  file?: { mimeType: string; sizeBytes: number; origin: PhotoOrigin };
};

const newKey = () => `photo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Picks, checks, shrinks and uploads up to `max` Фото. Each slot keeps its idempotency key,
 * so «Повторить» never stores a second copy; a cancelled upload is simply dropped.
 */
export function usePhotoSlots(max: number, initial: PhotoRef[] = []) {
  const repository = useRepository();
  const toast = useToast((s) => s.show);
  const [slots, setSlots] = useState<PhotoSlot[]>(() =>
    initial.map((photo) => ({ key: photo.id, status: 'done', preview: photo.url, photo })),
  );
  const live = useRef(new Set<string>());

  const patch = useCallback((key: string, next: Partial<PhotoSlot>) => {
    setSlots((all) => all.map((s) => (s.key === key ? { ...s, ...next } : s)));
  }, []);

  const upload = useCallback(
    async (slot: PhotoSlot) => {
      if (!slot.file || !isPhotoType(slot.file.mimeType)) return;
      live.current.add(slot.key);
      patch(slot.key, { status: 'uploading' });
      try {
        const photo = await repository.uploadPhoto({
          mimeType: slot.file.mimeType,
          sizeBytes: slot.file.sizeBytes,
          dataUrl: slot.preview,
          origin: slot.file.origin,
          idempotencyKey: slot.key,
        });
        if (live.current.has(slot.key)) patch(slot.key, { status: 'done', photo });
      } catch {
        if (live.current.has(slot.key)) patch(slot.key, { status: 'error' });
      }
    },
    [patch, repository],
  );

  const add = useCallback(async () => {
    const room = max - slots.length;
    if (room <= 0) return;
    const files = await pickPhotos(room);
    for (const file of files) {
      const problem = checkPhotoFile(file);
      if (problem) {
        toast(strings.photo.problems[problem]);
        continue;
      }
      let preview: string;
      // Where the picture came from is read off the original, before the copy drops it.
      const origin = await photoOrigin(file).catch((): PhotoOrigin => 'upload');
      try {
        preview = await resizePhoto(file);
      } catch {
        toast(strings.photo.unreadable);
        continue;
      }
      const slot: PhotoSlot = {
        key: newKey(),
        status: 'uploading',
        preview,
        file: { mimeType: file.type, sizeBytes: file.size, origin },
      };
      setSlots((all) => (all.length >= max ? all : [...all, slot]));
      void upload(slot);
    }
  }, [max, slots.length, toast, upload]);

  const remove = useCallback((key: string) => {
    live.current.delete(key);
    setSlots((all) => all.filter((s) => s.key !== key));
  }, []);

  const move = useCallback((key: string, by: -1 | 1) => {
    setSlots((all) => {
      const from = all.findIndex((s) => s.key === key);
      const to = from + by;
      if (from < 0 || to < 0 || to >= all.length) return all;
      const next = [...all];
      [next[from], next[to]] = [next[to]!, next[from]!];
      return next;
    });
  }, []);

  /** Puts a Фото first: in a profile that makes it the main one. */
  const makeFirst = useCallback((key: string) => {
    setSlots((all) => {
      const slot = all.find((s) => s.key === key);
      return slot ? [slot, ...all.filter((s) => s.key !== key)] : all;
    });
  }, []);

  const retry = useCallback(
    (key: string) => {
      const slot = slots.find((s) => s.key === key);
      if (slot) void upload(slot);
    },
    [slots, upload],
  );

  const reset = useCallback((photos: PhotoRef[]) => {
    live.current.clear();
    setSlots(photos.map((photo) => ({ key: photo.id, status: 'done', preview: photo.url, photo })));
  }, []);

  const photos = slots.flatMap((s) => (s.status === 'done' && s.photo ? [s.photo] : []));
  return {
    slots,
    photos,
    /** Ids of stored Фото in the chosen order. */
    photoIds: photos.map((p) => p.id),
    busy: slots.some((s) => s.status === 'uploading'),
    failed: slots.some((s) => s.status === 'error'),
    full: slots.length >= max,
    add,
    remove,
    move,
    makeFirst,
    retry,
    reset,
  };
}
