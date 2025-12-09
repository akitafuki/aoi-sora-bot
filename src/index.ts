import { config } from './config';
import { loadState, saveState } from './state';
import { authenticateBluesky, getLatestPosts } from './bluesky';
import { initDiscord, postToDiscord } from './discord';

async function runCheck() {
  console.log('Checking for new posts...');
  const state = await loadState();
  
  // If it's the very first run (lastProcessedPostUri is null), 
  // we might not want to dump the entire history. 
  // Let's just fetch the latest and mark it as seen without posting, 
  // OR post just the single latest one.
  // For this implementation: If null, we fetch latest, mark it, and don't post.
  // This avoids spamming 10 old posts on first startup.
  
  const isFirstRun = state.lastProcessedPostUri === null;

  const newPosts = await getLatestPosts(state.lastProcessedPostUri);

  if (newPosts.length === 0) {
    console.log('No new posts.');
    return;
  }

  // If first run, just save the latest one and skip posting
  if (isFirstRun) {
      const latest = newPosts[newPosts.length - 1]; // validPosts are sorted Oldest -> Newest
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
      
      // Save state after each success so we don't re-post if we crash halfway
      await saveState({
          lastProcessedPostUri: feedView.post.uri,
          lastProcessedAt: new Date().toISOString()
      });
  }
}

async function main() {
  try {
    console.log('Starting BlueSky -> Discord Bot...');
    
    await authenticateBluesky();
    await initDiscord();

    // Initial run
    await runCheck();

    // Schedule polling
    const intervalMs = config.pollIntervalMinutes * 60 * 1000;
    setInterval(runCheck, intervalMs);
    console.log(`Polling scheduled every ${config.pollIntervalMinutes} minutes.`);

  } catch (error) {
    console.error('Fatal Error:', error);
    process.exit(1);
  }
}

main();
