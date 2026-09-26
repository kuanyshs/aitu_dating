import type { FeedPage, FeedQuery } from './feed';
import type { Session } from './session';

/**
 * Every server capability the app uses. The mock and the future Cloud Code adapter
 * implement the same interface and return the same DTOs and error codes; methods
 * reject with `RepositoryError`. Ticket 09 completes the interface.
 */
export interface AituRepository {
  getSession(): Promise<Session>;
  getHomeFeed(query: FeedQuery): Promise<FeedPage>;
}
