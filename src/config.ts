import dotenv from 'dotenv';

dotenv.config();

export const config = {
  bluesky: {
    identifier: process.env.BLUESKY_IDENTIFIER || '',
    password: process.env.BLUESKY_APP_PASSWORD || '',
  },
  discord: {
    token: process.env.DISCORD_TOKEN || '',
    channelId: process.env.DISCORD_CHANNEL_ID || '',
  },
  pollIntervalMinutes: parseInt(process.env.POLL_INTERVAL_MINUTES || '5', 10),
  filters: {
    ignoreReplies: true,
    ignoreReposts: true,
    ignoreKeywords: [] as string[], // Can be extended to load from env if needed
  }
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
