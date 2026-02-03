import { prisma } from './db';

export interface BotState {
  lastProcessedPostUri: string | null;
  lastProcessedAt: string | null;
}

const DEFAULT_ID = 1;

export async function loadState(): Promise<BotState> {
  try {
    const state = await prisma.botState.findUnique({
      where: { id: DEFAULT_ID },
    });

    if (!state) {
      // Create default state if it doesn't exist
      await prisma.botState.create({
        data: {
          id: DEFAULT_ID,
          lastProcessedPostUri: null,
          lastProcessedAt: null,
        },
      });
      return { lastProcessedPostUri: null, lastProcessedAt: null };
    }

    return {
        lastProcessedPostUri: state.lastProcessedPostUri,
        lastProcessedAt: state.lastProcessedAt ? state.lastProcessedAt.toISOString() : null
    };
  } catch (error) {
    console.error('Failed to load state from DB:', error);
    // Fallback to avoid crash loop, though DB error is critical
    return { lastProcessedPostUri: null, lastProcessedAt: null };
  }
}

export async function saveState(state: BotState): Promise<void> {
  try {
    await prisma.botState.upsert({
      where: { id: DEFAULT_ID },
      update: {
        lastProcessedPostUri: state.lastProcessedPostUri,
        lastProcessedAt: state.lastProcessedAt ? new Date(state.lastProcessedAt) : null,
      },
      create: {
        id: DEFAULT_ID,
        lastProcessedPostUri: state.lastProcessedPostUri,
        lastProcessedAt: state.lastProcessedAt ? new Date(state.lastProcessedAt) : null,
      },
    });
  } catch (error) {
    console.error('Failed to save state to DB:', error);
  }
}