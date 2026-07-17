import { loadState, saveState } from '../src/state';
import { prisma } from '../src/db';

jest.mock('../src/db', () => ({
  prisma: {
    botState: {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

describe('state.ts Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loadState', () => {
    it('should load state successfully if it exists in DB', async () => {
      const mockDbState = {
        id: 1,
        lastProcessedPostUri: 'at://123',
        lastProcessedAt: new Date('2025-12-04T09:58:26.714Z'),
      };
      (prisma.botState.findUnique as jest.Mock).mockResolvedValue(mockDbState);

      const state = await loadState();

      expect(prisma.botState.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(state.lastProcessedPostUri).toBe('at://123');
      expect(state.lastProcessedAt).toBe('2025-12-04T09:58:26.714Z');
    });

    it('should create and return default state if it does not exist in DB', async () => {
      (prisma.botState.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.botState.create as jest.Mock).mockResolvedValue({
        id: 1,
        lastProcessedPostUri: null,
        lastProcessedAt: null,
      });

      const state = await loadState();

      expect(prisma.botState.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(prisma.botState.create).toHaveBeenCalledWith({
        data: {
          id: 1,
          lastProcessedPostUri: null,
          lastProcessedAt: null,
        },
      });
      expect(state.lastProcessedPostUri).toBeNull();
      expect(state.lastProcessedAt).toBeNull();
    });

    it('should fallback to default state on DB error', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      (prisma.botState.findUnique as jest.Mock).mockRejectedValue(new Error('DB Connection Failed'));

      const state = await loadState();

      expect(state.lastProcessedPostUri).toBeNull();
      expect(state.lastProcessedAt).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('saveState', () => {
    it('should upsert state to DB', async () => {
      const stateToSave = {
        lastProcessedPostUri: 'at://456',
        lastProcessedAt: '2026-07-17T03:00:00.000Z',
      };

      await saveState(stateToSave);

      expect(prisma.botState.upsert).toHaveBeenCalledWith({
        where: { id: 1 },
        update: {
          lastProcessedPostUri: 'at://456',
          lastProcessedAt: new Date('2026-07-17T03:00:00.000Z'),
        },
        create: {
          id: 1,
          lastProcessedPostUri: 'at://456',
          lastProcessedAt: new Date('2026-07-17T03:00:00.000Z'),
        },
      });
    });

    it('should log an error if saving to DB fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      (prisma.botState.upsert as jest.Mock).mockRejectedValue(new Error('Write Failed'));

      await saveState({ lastProcessedPostUri: null, lastProcessedAt: null });

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});
