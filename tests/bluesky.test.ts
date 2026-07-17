import { getLatestPosts, authenticateBluesky } from '../src/bluesky';
import { BskyAgent, AppBskyFeedPost } from '@atproto/api';

// Mock database to prevent Prisma client initialization errors
jest.mock('../src/db', () => ({
  prisma: {},
}));

// Mock BskyAgent and AppBskyFeedPost completely to avoid loading pure ESM package in Jest
jest.mock('@atproto/api', () => {
  const login = jest.fn();
  const getAuthorFeed = jest.fn();
  (global as any).mockBskyLogin = login;
  (global as any).mockBskyGetAuthorFeed = getAuthorFeed;
  return {
    BskyAgent: jest.fn().mockImplementation(() => ({
      login,
      getAuthorFeed,
    })),
    AppBskyFeedPost: {
      isRecord: (record: any): boolean => {
        return record && typeof record === 'object';
      },
    },
  };
});

const mockLogin = (global as any).mockBskyLogin;
const mockGetAuthorFeed = (global as any).mockBskyGetAuthorFeed;

describe('bluesky.ts Unit Tests', () => {
  const defaultSettings = {
    pollIntervalMinutes: 5,
    ignoreReplies: true,
    ignoreReposts: true,
    ignoreKeywords: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockLogin.mockResolvedValue({});
  });

  describe('authenticateBluesky', () => {
    it('should call login on the agent', async () => {
      await authenticateBluesky();
      expect(mockLogin).toHaveBeenCalled();
    });
  });

  describe('getLatestPosts', () => {
    it('should fetch posts and return them in reverse (chronological) order', async () => {
      const mockFeed = {
        data: {
          feed: [
            {
              post: {
                uri: 'at://1',
                cid: 'cid1',
                author: { handle: 'test.bsky.social' },
                record: {
                  $type: 'app.bsky.feed.post',
                  text: 'Newer Post',
                  createdAt: new Date().toISOString(),
                },
              },
            },
            {
              post: {
                uri: 'at://2',
                cid: 'cid2',
                author: { handle: 'test.bsky.social' },
                record: {
                  $type: 'app.bsky.feed.post',
                  text: 'Older Post',
                  createdAt: new Date().toISOString(),
                },
              },
            },
          ],
        },
      };

      mockGetAuthorFeed.mockResolvedValue(mockFeed);

      const posts = await getLatestPosts(null, { ...defaultSettings, ignoreReplies: false, ignoreReposts: false });

      expect(posts).toHaveLength(2);
      // Chronological order: Older post first, newer post second
      expect(posts[0].post.uri).toBe('at://2');
      expect(posts[1].post.uri).toBe('at://1');
    });

    it('should stop processing once sinceUri is reached', async () => {
      const mockFeed = {
        data: {
          feed: [
            {
              post: {
                uri: 'at://newer-unprocessed',
                cid: 'cid1',
                author: { handle: 'test.bsky.social' },
                record: {
                  $type: 'app.bsky.feed.post',
                  text: 'Newer Unprocessed Post',
                  createdAt: new Date().toISOString(),
                },
              },
            },
            {
              post: {
                uri: 'at://already-processed',
                cid: 'cid2',
                author: { handle: 'test.bsky.social' },
                record: {
                  $type: 'app.bsky.feed.post',
                  text: 'Already Processed Post',
                  createdAt: new Date().toISOString(),
                },
              },
            },
            {
              post: {
                uri: 'at://even-older-unreachable',
                cid: 'cid3',
                author: { handle: 'test.bsky.social' },
                record: {
                  $type: 'app.bsky.feed.post',
                  text: 'Older Unreachable Post',
                  createdAt: new Date().toISOString(),
                },
              },
            },
          ],
        },
      };

      mockGetAuthorFeed.mockResolvedValue(mockFeed);

      const posts = await getLatestPosts('at://already-processed', {
        ...defaultSettings,
        ignoreReplies: false,
        ignoreReposts: false,
      });

      expect(posts).toHaveLength(1);
      expect(posts[0].post.uri).toBe('at://newer-unprocessed');
    });

    it('should filter out reposts if ignoreReposts is true', async () => {
      const mockFeed = {
        data: {
          feed: [
            {
              post: {
                uri: 'at://post-regular',
                author: { handle: 'test.bsky.social' },
                record: { $type: 'app.bsky.feed.post', text: 'Regular post' },
              },
            },
            {
              post: {
                uri: 'at://post-repost',
                author: { handle: 'test.bsky.social' },
                record: { $type: 'app.bsky.feed.post', text: 'Reposted post' },
              },
              reason: {
                $type: 'app.bsky.feed.defs#skeletonReasonRepost',
                by: 'did:plc:123',
                indexedAt: new Date().toISOString(),
              },
            },
          ],
        },
      };

      mockGetAuthorFeed.mockResolvedValue(mockFeed);

      const posts = await getLatestPosts(null, { ...defaultSettings, ignoreReposts: true, ignoreReplies: false });

      expect(posts).toHaveLength(1);
      expect(posts[0].post.uri).toBe('at://post-regular');
    });

    it('should filter out replies if ignoreReplies is true', async () => {
      const mockFeed = {
        data: {
          feed: [
            {
              post: {
                uri: 'at://post-regular',
                author: { handle: 'test.bsky.social' },
                record: { $type: 'app.bsky.feed.post', text: 'Regular post' },
              },
            },
            {
              post: {
                uri: 'at://post-reply',
                author: { handle: 'test.bsky.social' },
                record: {
                  $type: 'app.bsky.feed.post',
                  text: 'Reply post',
                  reply: {
                    root: { uri: 'at://root', cid: 'cidroot' },
                    parent: { uri: 'at://parent', cid: 'cidparent' },
                  },
                },
              },
            },
          ],
        },
      };

      mockGetAuthorFeed.mockResolvedValue(mockFeed);

      const posts = await getLatestPosts(null, { ...defaultSettings, ignoreReplies: true, ignoreReposts: false });

      expect(posts).toHaveLength(1);
      expect(posts[0].post.uri).toBe('at://post-regular');
    });

    it('should filter out posts containing ignoreKeywords', async () => {
      const mockFeed = {
        data: {
          feed: [
            {
              post: {
                uri: 'at://post-regular',
                author: { handle: 'test.bsky.social' },
                record: { $type: 'app.bsky.feed.post', text: 'Clean post' },
              },
            },
            {
              post: {
                uri: 'at://post-spam',
                author: { handle: 'test.bsky.social' },
                record: { $type: 'app.bsky.feed.post', text: 'This is spam content' },
              },
            },
          ],
        },
      };

      mockGetAuthorFeed.mockResolvedValue(mockFeed);

      const posts = await getLatestPosts(null, {
        ...defaultSettings,
        ignoreReplies: false,
        ignoreReposts: false,
        ignoreKeywords: ['spam', 'ad'],
      });

      expect(posts).toHaveLength(1);
      expect(posts[0].post.uri).toBe('at://post-regular');
    });
  });
});
