import { z } from 'zod';

import { Page } from './common';
import { CityKey } from './people';
import { PostView } from './post';

export const FeedTab = z.enum(['for_you', 'popular', 'city', 'plans', 'following']);
export type FeedTab = z.infer<typeof FeedTab>;

export const FeedQuery = z.object({
  tab: FeedTab,
  /** Required for the `city` tab; ignored otherwise. */
  city: CityKey.optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});
export type FeedQuery = z.infer<typeof FeedQuery>;

export const FeedPage = Page(PostView);
export type FeedPage = z.infer<typeof FeedPage>;
