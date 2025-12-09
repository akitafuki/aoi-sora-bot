import { Client, GatewayIntentBits, TextChannel, EmbedBuilder } from 'discord.js';
import { config } from './config';
import { AppBskyFeedDefs, AppBskyFeedPost, AppBskyEmbedImages, AppBskyEmbedExternal } from '@atproto/api';

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

let targetChannel: TextChannel | null = null;

export async function initDiscord() {
  return new Promise<void>((resolve, reject) => {
    client.once('ready', async () => {
      console.log(`Discord Bot logged in as ${client.user?.tag}`);
      
      try {
        const channel = await client.channels.fetch(config.discord.channelId);
        if (channel?.isTextBased() && !channel.isDMBased()) {
             targetChannel = channel as TextChannel;
             resolve();
        } else {
            reject(new Error('Channel not found or is not a text channel.'));
        }
      } catch (error) {
        reject(error);
      }
    });

    client.login(config.discord.token).catch(reject);
  });
}

export async function postToDiscord(feedView: AppBskyFeedDefs.FeedViewPost) {
  if (!targetChannel) throw new Error('Discord channel not initialized');

  const post = feedView.post;
  if (!AppBskyFeedPost.isRecord(post.record)) return; // Skip if not a valid record
  const record = post.record;
  const text = record.text || '';
  
  // Construct URL
  // URI format: at://did:plc:k6.../app.bsky.feed.post/3jk...
  const uriParts = post.uri.split('/');
  const rkey = uriParts[uriParts.length - 1];
  const handle = post.author.handle;
  const postUrl = `https://bsky.app/profile/${handle}/post/${rkey}`;

    const embed = new EmbedBuilder()
      .setAuthor({ 
          name: `${post.author.displayName || handle} (@${handle})`, 
          iconURL: post.author.avatar ?? undefined
      })    .setDescription(text.length > 0 ? text : null) // Description cannot be empty string
    .setColor(0x0084ff) // Blue-ish
    .setTimestamp(new Date(record.createdAt))
    .setURL(postUrl);

  // Handle Images
  // BlueSky embeds images in 'post.embed'
  // We can only put one main image in a Discord Embed properly via setImage.
  // If there are multiple, we might need multiple embeds or just show the first one.
  // For simplicity, we'll show the first one.
  if (post.embed && AppBskyEmbedImages.isView(post.embed)) {
      const images = post.embed.images;
      if (images && images.length > 0) {
          embed.setImage(images[0].fullsize);
      }
  }

  // Handle External Links (Cards)
  if (post.embed && AppBskyEmbedExternal.isView(post.embed)) {
      const external = post.embed.external;
      // We can add this to the footer or a field
      embed.addFields({ name: 'Link', value: `[${external.title}](${external.uri})` });
      if (external.thumb && !embed.data.image) {
          embed.setImage(external.thumb);
      }
  }

  try {
    await targetChannel.send({ content: `New post on BlueSky:\n${postUrl}`, embeds: [embed] });
    console.log(`Posted to Discord: ${rkey}`);
  } catch (error) {
    console.error('Failed to send to Discord:', error);
  }
}
