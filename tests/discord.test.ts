import { initDiscord, postToDiscord, destroyDiscord } from '../src/discord';
import { config } from '../src/config';

// Mock database to prevent Prisma client initialization errors
jest.mock('../src/db', () => ({
  prisma: {},
}));

// Mock @atproto/api completely to avoid loading pure ESM package in Jest
jest.mock('@atproto/api', () => ({
  AppBskyFeedPost: {
    isRecord: (record: any): boolean => {
      return record && typeof record === 'object';
    },
  },
  AppBskyEmbedImages: {
    isView: (embed: any): boolean => {
      return embed && embed.$type === 'app.bsky.embed.images#view';
    },
  },
  AppBskyEmbedExternal: {
    isView: (embed: any): boolean => {
      return embed && embed.$type === 'app.bsky.embed.external#view';
    },
  },
}));

// Mock discord.js completely with full mock implementation
jest.mock('discord.js', () => {
  const mockSend = jest.fn().mockResolvedValue(true);
  const mockLogin = jest.fn().mockResolvedValue('token');
  const mockDestroy = jest.fn();
  const mockFetch = jest.fn();

  (global as any).mockDiscordSend = mockSend;
  (global as any).mockDiscordLogin = mockLogin;
  (global as any).mockDiscordDestroy = mockDestroy;
  (global as any).mockDiscordFetch = mockFetch;

  class MockClient {
    once = jest.fn().mockImplementation((event: string, callback: () => void) => {
      if (event === 'ready') {
        this.user = { tag: 'TestBot#1234' };
        setTimeout(callback, 0);
      }
    });
    channels = {
      fetch: mockFetch
    };
    login = mockLogin;
    destroy = mockDestroy;
    user = { tag: 'TestBot#1234' };
  }

  class MockWebhookClient {
    send = mockSend;
    destroy = mockDestroy;
  }

  class MockEmbedBuilder {
    data: any = {};
    setAuthor = jest.fn().mockReturnThis();
    setDescription = jest.fn().mockImplementation((desc) => {
      this.data.description = desc;
      return this;
    });
    setColor = jest.fn().mockReturnThis();
    setTimestamp = jest.fn().mockReturnThis();
    setURL = jest.fn().mockReturnThis();
    setImage = jest.fn().mockImplementation((url) => {
      this.data.image = { url };
      return this;
    });
    addFields = jest.fn().mockImplementation((field) => {
      this.data.fields = this.data.fields || [];
      this.data.fields.push(field);
      return this;
    });
  }

  return {
    Client: MockClient,
    WebhookClient: MockWebhookClient,
    EmbedBuilder: MockEmbedBuilder,
    GatewayIntentBits: { Guilds: 1 },
  };
});

// Retrieve references from global scope
const mockSend = (global as any).mockDiscordSend;
const mockLogin = (global as any).mockDiscordLogin;
const mockDestroy = (global as any).mockDiscordDestroy;
const mockFetch = (global as any).mockDiscordFetch;

describe('discord.ts Unit Tests', () => {
  beforeEach(async () => {
    await destroyDiscord();
    jest.clearAllMocks();
    mockSend.mockReset().mockResolvedValue(true);
    mockLogin.mockReset().mockResolvedValue('token');
    mockDestroy.mockReset();
    mockFetch.mockReset();

    // Reset config options to defaults
    config.discord.webhookUrl = '';
    config.discord.token = 'bot-token';
    config.discord.channelId = 'channel-id';
  });

  describe('initDiscord', () => {
    it('should initialize WebhookClient if webhookUrl is present', async () => {
      config.discord.webhookUrl = 'https://discord.com/api/webhooks/123/abc';
      await initDiscord();
      
      expect(config.discord.webhookUrl).toBe('https://discord.com/api/webhooks/123/abc');
    });

    it('should initialize Client and fetch channel if token is present', async () => {
      mockFetch.mockResolvedValue({
        isTextBased: () => true,
        isDMBased: () => false,
        send: mockSend,
      });

      await initDiscord();

      expect(mockLogin).toHaveBeenCalledWith('bot-token');
      expect(mockFetch).toHaveBeenCalledWith('channel-id');
    });

    it('should reject if target channel is not text-based', async () => {
      mockFetch.mockResolvedValue({
        isTextBased: () => false,
        isDMBased: () => false,
      });

      await expect(initDiscord()).rejects.toThrow('Channel not found or is not a text channel.');
    });

    it('should reject if channel fetch throws error', async () => {
      mockFetch.mockRejectedValue(new Error('Fetch failed'));

      await expect(initDiscord()).rejects.toThrow('Fetch failed');
    });
  });

  describe('postToDiscord', () => {
    const mockFeedView = {
      post: {
        uri: 'at://did:plc:123/app.bsky.feed.post/456',
        author: {
          handle: 'test.bsky.social',
          displayName: 'Test User',
          avatar: 'https://avatar.url',
        },
        record: {
          $type: 'app.bsky.feed.post',
          text: 'Hello BlueSky!',
          createdAt: new Date().toISOString(),
        },
      },
    };

    it('should send post via WebhookClient if configured', async () => {
      config.discord.webhookUrl = 'https://discord.com/api/webhooks/123/abc';
      await initDiscord();
      await postToDiscord(mockFeedView as any);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const [payload] = mockSend.mock.calls[0];
      expect(payload.content).toContain('https://bsky.app/profile/test.bsky.social/post/456');
      expect(payload.embeds).toHaveLength(1);
      expect(payload.embeds[0].data.description).toBe('Hello BlueSky!');
    });

    it('should send post via TextChannel if using Bot Client', async () => {
      const mockChannelSend = jest.fn().mockResolvedValue(true);
      mockFetch.mockResolvedValue({
        isTextBased: () => true,
        isDMBased: () => false,
        send: mockChannelSend,
      });

      await initDiscord();
      await postToDiscord(mockFeedView as any);

      expect(mockChannelSend).toHaveBeenCalledTimes(1);
      const [payload] = mockChannelSend.mock.calls[0];
      expect(payload.content).toContain('https://bsky.app/profile/test.bsky.social/post/456');
      expect(payload.embeds).toHaveLength(1);
    });

    it('should format multiple images correctly in embeds list', async () => {
      config.discord.webhookUrl = 'https://discord.com/api/webhooks/123/abc';
      await initDiscord();

      const postWithImages = {
        ...mockFeedView,
        post: {
          ...mockFeedView.post,
          embed: {
            $type: 'app.bsky.embed.images#view',
            images: [
              { fullsize: 'https://img1.url' },
              { fullsize: 'https://img2.url' },
              { fullsize: 'https://img3.url' },
            ],
          },
        },
      };

      await postToDiscord(postWithImages as any);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const [payload] = mockSend.mock.calls[0];
      expect(payload.embeds).toHaveLength(3);
      expect(payload.embeds[0].data.image.url).toBe('https://img1.url');
      expect(payload.embeds[1].data.image.url).toBe('https://img2.url');
      expect(payload.embeds[2].data.image.url).toBe('https://img3.url');
    });

    it('should format external link correctly in field', async () => {
      config.discord.webhookUrl = 'https://discord.com/api/webhooks/123/abc';
      await initDiscord();

      const postWithExternal = {
        ...mockFeedView,
        post: {
          ...mockFeedView.post,
          embed: {
            $type: 'app.bsky.embed.external#view',
            external: {
              title: 'External Site',
              uri: 'https://external.url',
              thumb: 'https://thumb.url',
            },
          },
        },
      };

      await postToDiscord(postWithExternal as any);

      expect(mockSend).toHaveBeenCalledTimes(1);
      const [payload] = mockSend.mock.calls[0];
      expect(payload.embeds).toHaveLength(1);
      expect(payload.embeds[0].data.fields[0].name).toBe('Link');
      expect(payload.embeds[0].data.fields[0].value).toContain('[External Site](https://external.url)');
    });

    it('should propagate send errors', async () => {
      config.discord.webhookUrl = 'https://discord.com/api/webhooks/123/abc';
      await initDiscord();
      mockSend.mockRejectedValue(new Error('API Error'));

      await expect(postToDiscord(mockFeedView as any)).rejects.toThrow('API Error');
    });
  });

  describe('destroyDiscord', () => {
    it('should destroy WebhookClient if active', async () => {
      config.discord.webhookUrl = 'https://discord.com/api/webhooks/123/abc';
      await initDiscord();
      await destroyDiscord();

      expect(mockDestroy).toHaveBeenCalledTimes(1);
    });

    it('should destroy Client if active', async () => {
      mockFetch.mockResolvedValue({
        isTextBased: () => true,
        isDMBased: () => false,
        send: mockSend,
      });

      await initDiscord();
      await destroyDiscord();

      expect(mockDestroy).toHaveBeenCalledTimes(1);
    });
  });
});
