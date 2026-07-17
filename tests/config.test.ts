import { getSettings, updateSettings } from '../src/config';
import { prisma } from '../src/db';

jest.mock('../src/db', () => ({
  prisma: {
    config: {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

describe('config.ts Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSettings', () => {
    it('should return settings from DB if they exist', async () => {
      const mockDbConfig = {
        id: 1,
        pollIntervalMinutes: 10,
        ignoreReplies: false,
        ignoreReposts: true,
        ignoreKeywords: ['ad'],
      };
      (prisma.config.findUnique as jest.Mock).mockResolvedValue(mockDbConfig);

      const settings = await getSettings();

      expect(prisma.config.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(settings).toEqual({
        pollIntervalMinutes: 10,
        ignoreReplies: false,
        ignoreReposts: true,
        ignoreKeywords: ['ad'],
      });
    });

    it('should create default settings in DB and return them if none exist', async () => {
      (prisma.config.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.config.create as jest.Mock).mockResolvedValue({});

      const settings = await getSettings();

      expect(prisma.config.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(prisma.config.create).toHaveBeenCalled();
      expect(settings.pollIntervalMinutes).toBe(5); // from env/default
      expect(settings.ignoreReplies).toBe(true);
      expect(settings.ignoreReposts).toBe(true);
      expect(settings.ignoreKeywords).toEqual([]);
    });

    it('should fallback to defaults on DB error', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      (prisma.config.findUnique as jest.Mock).mockRejectedValue(new Error('Read error'));

      const settings = await getSettings();

      expect(settings.pollIntervalMinutes).toBe(5);
      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('updateSettings', () => {
    it('should upsert updated configuration', async () => {
      const mockDbConfig = {
        id: 1,
        pollIntervalMinutes: 5,
        ignoreReplies: true,
        ignoreReposts: true,
        ignoreKeywords: [],
      };
      (prisma.config.findUnique as jest.Mock).mockResolvedValue(mockDbConfig);
      (prisma.config.upsert as jest.Mock).mockResolvedValue({});

      const updated = await updateSettings({ pollIntervalMinutes: 15, ignoreReplies: false });

      expect(prisma.config.upsert).toHaveBeenCalledWith({
        where: { id: 1 },
        update: {
          pollIntervalMinutes: 15,
          ignoreReplies: false,
          ignoreReposts: true,
          ignoreKeywords: [],
        },
        create: {
          id: 1,
          pollIntervalMinutes: 15,
          ignoreReplies: false,
          ignoreReposts: true,
          ignoreKeywords: [],
        },
      });

      expect(updated.pollIntervalMinutes).toBe(15);
      expect(updated.ignoreReplies).toBe(false);
      expect(updated.ignoreReposts).toBe(true);
    });
  });
});
