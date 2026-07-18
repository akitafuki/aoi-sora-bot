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
    webhookUrl: process.env.DISCORD_WEBHOOK_URL || '',
  },
};

const hasBluesky = !!(process.env.BLUESKY_IDENTIFIER && process.env.BLUESKY_APP_PASSWORD);
const hasWebhook = !!process.env.DISCORD_WEBHOOK_URL;
const hasBot = !!(process.env.DISCORD_TOKEN && process.env.DISCORD_CHANNEL_ID);

if ((!hasBluesky || (!hasWebhook && !hasBot)) && process.env.NODE_ENV !== 'test') {
  const missing = [];
  if (!process.env.BLUESKY_IDENTIFIER) missing.push('BLUESKY_IDENTIFIER');
  if (!process.env.BLUESKY_APP_PASSWORD) missing.push('BLUESKY_APP_PASSWORD');
  if (!hasWebhook && !hasBot) {
    missing.push('Either DISCORD_WEBHOOK_URL OR both (DISCORD_TOKEN and DISCORD_CHANNEL_ID)');
  }
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
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