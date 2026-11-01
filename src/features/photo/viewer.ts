import { create } from 'zustand';

import type { PhotoRef } from '@/contracts';

type ViewerState = {
  photos: PhotoRef[];
  index: number;
  show(photos: PhotoRef[], index: number): void;
};

/** What the full-screen viewer shows; set right before opening `/photo`. */
export const usePhotoViewer = create<ViewerState>((set) => ({
  photos: [],
  index: 0,
  show: (photos, index) => set({ photos, index }),
}));
