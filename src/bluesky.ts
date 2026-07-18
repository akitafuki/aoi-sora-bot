import { BskyAgent, AppBskyFeedDefs, AppBskyFeedPost } from '@atproto/api';
import { config, AppSettings } from './config';

const agent = new BskyAgent({
  service: 'https://bsky.social',
});

let isAuthenticated = false;

export async function authenticateBluesky() {
  if (isAuthenticated) return;
  try {
    await agent.login({
      identifier: config.bluesky.identifier,
      password: config.bluesky.password,
    });
    isAuthenticated = true;
    console.log('Authenticated with BlueSky');
  } catch (error) {
    console.error('Failed to login to BlueSky:', error);
    throw error;
  }
}

export async function getLatestPosts(sinceUri: string | null, settings: AppSettings) {
  if (!isAuthenticated) await authenticateBluesky();

  const validPosts: AppBskyFeedDefs.FeedViewPost[] = [];
  let cursor: string | undefined = undefined;
  let pageCount = 0;
  const maxPages = 5; // Scan up to 100 posts max to avoid infinite loops if sinceUri was deleted
  let foundSinceUri = false;

  try {
    while (pageCount < maxPages) {
      const response = await agent.getAuthorFeed({
        actor: config.bluesky.identifier,
        limit: 20,
        cursor: cursor,
      });

      const feed = response.data.feed;
      if (!feed || feed.length === 0) break;

      for (const feedView of feed) {
          const post = feedView.post;
          
          if (sinceUri && post.uri === sinceUri) {
              foundSinceUri = true;
              break;
          }

          // --- Filtering Logic ---
          
          // 1. Ignore Reposts (if configured)
          const isRepost = !!feedView.reason; 
          if (settings.ignoreReposts && isRepost) continue;

          // 2. Ignore Replies (if configured)
          if (!AppBskyFeedPost.isRecord(post.record)) continue;
          const record = post.record as AppBskyFeedPost.Record; 
          const isReply = !!record.reply; 
          if (settings.ignoreReplies && isReply) continue;

          // 3. Keywords (if configured)
          if (settings.ignoreKeywords.length > 0) {
              const text = (record?.text || '').toLowerCase();
              const hasKeyword = settings.ignoreKeywords.some(kw => text.includes(kw.toLowerCase()));
              if (hasKeyword) continue;
          }

          validPosts.push(feedView);
      }

      // If we found sinceUri, or if sinceUri was null (first run, just capture latest page), we stop paginating
      if (foundSinceUri || !sinceUri) {
          break;
      }

      cursor = response.data.cursor;
      if (!cursor) break;

      pageCount++;
    }

    // Return them in chronological order (Oldest -> Newest) so they post to Discord in order
    return validPosts.reverse();

  } catch (error) {
    console.error('Error fetching BlueSky posts:', error);
    return [];
  }
}
