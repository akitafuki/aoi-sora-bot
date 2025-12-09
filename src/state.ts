import fs from 'fs/promises';
import path from 'path';

const STATE_FILE = path.resolve(process.cwd(), 'state.json');

export interface BotState {
  lastProcessedPostUri: string | null;
  lastProcessedAt: string | null;
}

const defaultState: BotState = {
  lastProcessedPostUri: null,
  lastProcessedAt: null
};

export async function loadState(): Promise<BotState> {
  try {
    const data = await fs.readFile(STATE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    // If file doesn't exist, return default
    return defaultState;
  }
}

export async function saveState(state: BotState): Promise<void> {
  try {
    await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save state:', error);
  }
}
