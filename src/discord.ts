import { Client, GatewayIntentBits, TextChannel, EmbedBuilder, WebhookClient } from 'discord.js';
import { config } from './config';
import { AppBskyFeedDefs, AppBskyFeedPost, AppBskyEmbedImages, AppBskyEmbedExternal } from '@atproto/api';

let client: Client | null = null;
let webhookClient: WebhookClient | null = null;
let targetChannel: TextChannel | null = null;

export async function initDiscord() {
  if (config.discord.webhookUrl) {
    console.log('Using Discord Webhook Client');
    webhookClient = new WebhookClient({ url: config.discord.webhookUrl });
    return;
  }

  // Fallback to bot client
  client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  return new Promise<void>((resolve, reject) => {
    if (!client) return reject(new Error('Client not initialized'));
    
    client.once('ready', async () => {
      console.log(`Discord Bot logged in as ${client?.user?.tag}`);
      
      try {
        const channel = await client?.channels.fetch(config.discord.channelId);
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

export async function destroyDiscord() {
  if (client) {
    client.destroy();
    client = null;
    console.log('Discord Bot client connection destroyed.');
  }
  if (webhookClient) {
    webhookClient.destroy();
    webhookClient = null;
    console.log('Discord Webhook client connection destroyed.');
  }
  targetChannel = null;
}

export async function postToDiscord(feedView: AppBskyFeedDefs.FeedViewPost) {
  if (!webhookClient && !targetChannel) throw new Error('Discord channel or Webhook not initialized');

  const post = feedView.post;
  if (!AppBskyFeedPost.isRecord(post.record)) return; // Skip if not a valid record
  const record = post.record as AppBskyFeedPost.Record;
  const text = record.text || '';
  
  // Construct URL
  // URI format: at://did:plc:k6.../app.bsky.feed.post/3jk...
  const uriParts = post.uri.split('/');
  const rkey = uriParts[uriParts.length - 1];
  const handle = post.author.handle;
  const postUrl = `https://bsky.app/profile/${handle}/post/${rkey}`;

  const embeds: EmbedBuilder[] = [];

  const mainEmbed = new EmbedBuilder()
    .setAuthor({ 
        name: `${post.author.displayName || handle} (@${handle})`, 
        iconURL: post.author.avatar ?? undefined
    })
    .setDescription(text.length > 0 ? text : null) // Description cannot be empty string
    .setColor(0x0084ff) // Blue-ish
    .setTimestamp(new Date(record.createdAt))
    .setURL(postUrl);

  embeds.push(mainEmbed);

  // Handle Images (Up to 4 images mosaic/collage)
  if (post.embed && AppBskyEmbedImages.isView(post.embed)) {
      const images = post.embed.images;
      if (images && images.length > 0) {
          mainEmbed.setImage(images[0].fullsize);
          for (let i = 1; i < images.length; i++) {
              const imageEmbed = new EmbedBuilder()
                  .setURL(postUrl)
                  .setImage(images[i].fullsize);
              embeds.push(imageEmbed);
          }
      }
  }

  // Handle External Links (Cards)
  if (post.embed && AppBskyEmbedExternal.isView(post.embed)) {
      const external = post.embed.external;
      mainEmbed.addFields({ name: 'Link', value: `[${external.title}](${external.uri})` });
      if (external.thumb && embeds.length === 1 && !mainEmbed.data.image) {
          mainEmbed.setImage(external.thumb);
      }
  }

  try {
    const payload = {
      content: `New post on BlueSky:\n${postUrl}`,
      embeds: embeds
    };

    if (webhookClient) {
      await webhookClient.send(payload);
    } else if (targetChannel) {
      await targetChannel.send(payload);
    }
    console.log(`Posted to Discord: ${rkey}`);
  } catch (error) {
    console.error('Failed to send to Discord:', error);
    throw error; // Propagate the error so that index.ts can isolate it
  }
}
