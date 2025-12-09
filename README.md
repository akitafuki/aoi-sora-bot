# BlueSky to Discord Bot

This project provides a Discord bot that cross-posts your BlueSky posts to a specified Discord channel. It is built with TypeScript and Node.js, integrating with BlueSky via `@atproto/api` and Discord via `discord.js`.

## Features

-   **BlueSky Integration:** Connects to the BlueSky network (AT Protocol) to fetch your posts.
-   **Discord Integration:** Connects to Discord to send formatted messages, including rich embeds with images and links.
-   **Polling:** Periodically checks for new posts to avoid overwhelming APIs.
-   **Filtering Options:**
    -   Ignores replies by default.
    -   Ignores reposts (retweets) by default.
    -   (Extendable for keyword filtering)
-   **State Persistence:** Uses a `state.json` file to keep track of the last processed post, preventing duplicate posts on restarts.
-   **Docker Support:** Includes a `Dockerfile` for easy deployment.

## Setup

### 1. Clone the Repository

```bash
# Assuming you are in the directory where you want to clone the project
# git clone <repository-url>
# cd blue-sky-discord-bot
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Rename `.env.example` to `.env` and fill in your credentials and configuration:

```bash
cp .env.example .env
```

Edit the newly created `.env` file with your specific values:

-   `BLUESKY_IDENTIFIER`: Your BlueSky handle (e.g., `your-handle.bsky.social`).
-   `BLUESKY_APP_PASSWORD`: Generate an **App Password** for the bot from your BlueSky settings (Settings > Advanced > App Passwords). **Do NOT use your main BlueSky password.**
-   `DISCORD_TOKEN`: Create a new bot application in the [Discord Developer Portal](https://discord.com/developers/applications), then navigate to "Bot" to get your token. Ensure your bot has the necessary permissions to send messages in the target channel.
-   `DISCORD_CHANNEL_ID`: In Discord, enable "Developer Mode" (User Settings > Advanced). Then, right-click on the desired channel and select "Copy ID".
-   `POLL_INTERVAL_MINUTES`: The interval (in minutes) at which the bot will check for new BlueSky posts (default is `5`).

### 4. Build the Project

```bash
npm run build
```

## Running the Bot

### Development Mode (with `ts-node`)

For development, you can run the bot directly using `ts-node`:

```bash
npm run dev
```

### Production Mode (from compiled JavaScript)

To run the compiled JavaScript:

```bash
npm start
```

### Running with Docker

For a containerized deployment:

1.  **Build the Docker image:**
    ```bash
    docker build -t bsky-bot .
    ```

2.  **Run the Docker container:**
    Make sure your `.env` file is correctly configured in the project root.
    ```bash
    docker run -d --name bsky-discord-bot --env-file ./.env bsky-bot
    ```
    -   `-d`: Runs the container in detached mode (in the background).
    -   `--name bsky-discord-bot`: Assigns a name to your container.
    -   `--env-file ./.env`: Mounts your `.env` file into the container for environment variables.

### Stopping the Docker Container

If you need to stop the running Docker container:

```bash
docker stop bsky-discord-bot
docker rm bsky-discord-bot # Optional: to remove the container
```

## Filtering Options

The bot includes basic filtering:

-   **`config.ts`**:
    -   `config.filters.ignoreReplies`: Set to `true` to ignore replies (default: `true`).
    -   `config.filters.ignoreReposts`: Set to `true` to ignore reposts (default: `true`).
    -   `config.filters.ignoreKeywords`: An array of strings. Posts containing any of these keywords (case-insensitive) will be ignored. You can modify this directly in `src/config.ts` for now. For a more robust solution, this could be moved to an environment variable or a separate configuration file.

Feel free to modify `src/config.ts` to adjust these filtering behaviors.
