import { SeedData } from '../records';
import { members } from './members';
import { plans } from './plans';
import { posts } from './posts';
import { commentReactions, comments, follows, reactions, reports, reposts } from './relations';

/** Validated seed; throws at startup if any record breaks its schema. */
export function loadSeed(): SeedData {
  return SeedData.parse({
    members,
    posts,
    plans,
    comments,
    follows,
    reactions,
    commentReactions,
    reposts,
    reports,
  });
}
