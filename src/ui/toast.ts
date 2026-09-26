import { create } from 'zustand';

type ToastState = {
  message?: string;
  id: number;
  show(message: string): void;
  hide(): void;
};

/** Short success/info feedback after an action; one toast at a time. */
export const useToast = create<ToastState>((set) => ({
  id: 0,
  show: (message) => set((s) => ({ message, id: s.id + 1 })),
  hide: () => set({ message: undefined }),
}));
