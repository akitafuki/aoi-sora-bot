import { getSettings } from './config';
import { loadState, saveState } from './state';
import { authenticateBluesky, getLatestPosts } from './bluesky';
import { initDiscord, postToDiscord, destroyDiscord } from './discord';
import { prisma } from './db';

let activeTimeout: NodeJS.Timeout | null = null;
let currentIntervalMinutes = 5;

async function runCheck() {
  console.log('Checking for new posts...');
  const state = await loadState();
  const settings = await getSettings();
  
  const isFirstRun = state.lastProcessedPostUri === null;

  // Pass dynamic settings to getLatestPosts (which also paginates to catch up)
  const newPosts = await getLatestPosts(state.lastProcessedPostUri, settings);

  if (newPosts.length === 0) {
    console.log('No new posts.');
    return;
  }

  // If first run, just save the latest one and skip posting
  if (isFirstRun) {
      const latest = newPosts[newPosts.length - 1]; 
      if (latest) {
          console.log(`First run detected. Marking latest post (${latest.post.uri}) as processed without sending.`);
          
          await saveState({
              lastProcessedPostUri: latest.post.uri,
              lastProcessedAt: new Date().toISOString()
          });
      }
      return;
  }

  // Process new posts with error isolation (prevent poison pills)
  for (const feedView of newPosts) {
      try {
          await postToDiscord(feedView);
          
          // Save to History on success
          try {
              await prisma.postHistory.create({
                  data: {
                      postUri: feedView.post.uri,
                      postedAt: new Date()
                  }
              });
          } catch (e) {
              console.error("Failed to save history", e);
          }

          // Save state on success
          await saveState({
              lastProcessedPostUri: feedView.post.uri,
              lastProcessedAt: new Date().toISOString()
          });
      } catch (error) {
          console.error(`Failed to process post ${feedView.post.uri} due to error:`, error);
          // Loop continues so that a single failing post doesn't block the entire queue.
      }
  }
}

function reschedulePolling(intervalMinutes: number) {
    if (activeTimeout) {
        clearTimeout(activeTimeout);
    }
    currentIntervalMinutes = intervalMinutes;
    const intervalMs = intervalMinutes * 60 * 1000;
    
    console.log(`Scheduling next post check in ${intervalMinutes} minutes.`);
    activeTimeout = setTimeout(async () => {
        try {
            await runCheck();
        } catch (e) {
            console.error("Error during scheduled check:", e);
        }
        reschedulePolling(currentIntervalMinutes);
    }, intervalMs);
}

async function main() {
  try {
    console.log('Starting BlueSky -> Discord Bot...');
    
    await authenticateBluesky();
    await initDiscord();

    // Initial run
    await runCheck();

    // Start Polling Loop
    const settings = await getSettings();
    reschedulePolling(settings.pollIntervalMinutes);

  } catch (error) {
    console.error('Fatal Error during startup:', error);
    process.exit(1);
  }
}

// Graceful Shutdown Registration
let isShuttingDown = false;
async function gracefulShutdown(signal: string) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);
    
    if (activeTimeout) {
        clearTimeout(activeTimeout);
    }

    try {
        await destroyDiscord();
        await prisma.$disconnect();
        console.log('Database connections closed.');
        console.log('Graceful shutdown complete.');
        process.exit(0);
    } catch (err) {
        console.error('Error during graceful shutdown:', err);
        process.exit(1);
    }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

main();