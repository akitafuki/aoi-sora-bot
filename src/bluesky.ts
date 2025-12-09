import { BskyAgent, AppBskyFeedDefs, AppBskyFeedPost } from '@atproto/api';
import { config } from './config';

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

export async function getLatestPosts(sinceUri: string | null) {
  if (!isAuthenticated) await authenticateBluesky();

  try {
    // Fetch author feed
    const { data } = await agent.getAuthorFeed({
      actor: config.bluesky.identifier,
      limit: 10, 
    });

    // Filter and sort posts
    // API returns newest first. We want to process from oldest -> newest if we are catching up,
    // but for "getLatest" we usually just want the list. 
    // We need to stop if we hit 'sinceUri'.

    const validPosts: AppBskyFeedDefs.FeedViewPost[] = [];

    for (const feedView of data.feed) {
        const post = feedView.post;
        
        // Stop if we reach the last processed post
        if (post.uri === sinceUri) break;

        // --- Filtering Logic ---
        
        // 1. Ignore Reposts (if configured)
        // The feed usually contains your own posts, replies, and reposts.
        // If it's a repost by YOU, the reason will be populated.
        const isRepost = !!feedView.reason; 
        if (config.filters.ignoreReposts && isRepost) continue;

        // 2. Ignore Replies (if configured)
        // A reply usually has a 'reply' record attached to the record object
        // We need to inspect the record type safely
        if (!AppBskyFeedPost.isRecord(post.record)) continue;
        const record = post.record as AppBskyFeedPost.Record; 
        const isReply = !!record.reply; 
        if (config.filters.ignoreReplies && isReply) continue;

        // 3. Keywords (if configured)
        if (config.filters.ignoreKeywords.length > 0) {
            const text = (record?.text || '').toLowerCase();
            const hasKeyword = config.filters.ignoreKeywords.some(kw => text.includes(kw.toLowerCase()));
            if (hasKeyword) continue;
        }

        validPosts.push(feedView);
    }

    // Return them in chronological order (Oldest -> Newest) so they post to Discord in order
    return validPosts.reverse();

  } catch (error) {
    console.error('Error fetching BlueSky posts:', error);
    return [];
  }
}
