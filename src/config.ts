import dotenv from 'dotenv';
import { prisma } from './db';

dotenv.config();

// Static configuration (Credentials & Environment)
export const config = {
  bluesky: {
    identifier: process.env.BLUESKY_IDENTIFIER || '',
    password: process.env.BLUESKY_APP_PASSWORD || '',
  },
  discord: {
    token: process.env.DISCORD_TOKEN || '',
    channelId: process.env.DISCORD_CHANNEL_ID || '',
  },
  port: parseInt(process.env.PORT || '3000', 10),
};

const requiredKeys = [
  'BLUESKY_IDENTIFIER',
  'BLUESKY_APP_PASSWORD',
  'DISCORD_TOKEN',
  'DISCORD_CHANNEL_ID'
];

const missingKeys = requiredKeys.filter(key => !process.env[key]);

if (missingKeys.length > 0) {
  console.error(`Missing required environment variables: ${missingKeys.join(', ')}`);
  process.exit(1);
}

// Dynamic Configuration (Database backed)
export interface AppSettings {
  pollIntervalMinutes: number;
  ignoreReplies: boolean;
  ignoreReposts: boolean;
  ignoreKeywords: string[];
}

const defaultSettings: AppSettings = {
  pollIntervalMinutes: parseInt(process.env.POLL_INTERVAL_MINUTES || '5', 10),
  ignoreReplies: true,
  ignoreReposts: true,
  ignoreKeywords: [],
};

export async function getSettings(): Promise<AppSettings> {
  try {
    const dbConfig = await prisma.config.findUnique({ where: { id: 1 } });
    
    if (!dbConfig) {
      // Initialize with defaults if not exists
      await prisma.config.create({
        data: {
          id: 1,
          pollIntervalMinutes: defaultSettings.pollIntervalMinutes,
          ignoreReplies: defaultSettings.ignoreReplies,
          ignoreReposts: defaultSettings.ignoreReposts,
          ignoreKeywords: defaultSettings.ignoreKeywords,
        }
      });
      return defaultSettings;
    }

    return {
      pollIntervalMinutes: dbConfig.pollIntervalMinutes,
      ignoreReplies: dbConfig.ignoreReplies,
      ignoreReposts: dbConfig.ignoreReposts,
      ignoreKeywords: dbConfig.ignoreKeywords,
    };
  } catch (error) {
    console.warn('Failed to fetch settings from DB, using defaults:', error);
    return defaultSettings;
  }
}

export async function updateSettings(newSettings: Partial<AppSettings>): Promise<AppSettings> {
    const current = await getSettings();
    const updated = { ...current, ...newSettings };
    
    await prisma.config.upsert({
        where: { id: 1 },
        update: {
            pollIntervalMinutes: updated.pollIntervalMinutes,
            ignoreReplies: updated.ignoreReplies,
            ignoreReposts: updated.ignoreReposts,
            ignoreKeywords: updated.ignoreKeywords
        },
        create: {
            id: 1,
            ...updated
        }
    });
    
    return updated;
}