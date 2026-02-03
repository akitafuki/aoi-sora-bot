import { config, getSettings } from './config';
import { loadState, saveState } from './state';
import { authenticateBluesky, getLatestPosts } from './bluesky';
import { initDiscord, postToDiscord } from './discord';
import { startServer, setTriggerCallback } from './server';
import { prisma } from './db';

async function runCheck() {
  console.log('Checking for new posts...');
  const state = await loadState();
  const settings = await getSettings();
  
  const isFirstRun = state.lastProcessedPostUri === null;

  // Pass dynamic settings to getLatestPosts
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

  // Process new posts
  for (const feedView of newPosts) {
      await postToDiscord(feedView);
      
      // Save to History
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

      // Save state
      await saveState({
          lastProcessedPostUri: feedView.post.uri,
          lastProcessedAt: new Date().toISOString()
      });
  }
}

async function scheduleNextRun() {
    const settings = await getSettings();
    const intervalMs = settings.pollIntervalMinutes * 60 * 1000;
    setTimeout(async () => {
        try {
            await runCheck();
        } catch (e) {
            console.error("Error during scheduled check:", e);
        }
        scheduleNextRun();
    }, intervalMs);
}

async function main() {
  try {
    console.log('Starting BlueSky -> Discord Bot...');
    
    // Start API Server
    startServer(config.port);
    setTriggerCallback(runCheck);

    await authenticateBluesky();
    await initDiscord();

    // Initial run
    await runCheck();

    // Start Polling Loop
    scheduleNextRun();

  } catch (error) {
    console.error('Fatal Error:', error);
    process.exit(1);
  }
}

main();