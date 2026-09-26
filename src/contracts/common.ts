import { z } from 'zod';

export const Id = z.string().min(1);
export const IsoDateTime = z.iso.datetime();
export const IsoDate = z.iso.date();
export const RequestId = z.string().min(1);

/** Cursor-paginated list; the mock uses a local offset but keeps the production shape. */
export function Page<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().optional(),
    hasMore: z.boolean(),
  });
}
export type Page<T> = { items: T[]; nextCursor?: string; hasMore: boolean };
