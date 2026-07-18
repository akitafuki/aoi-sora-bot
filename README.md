# BlueSky to Discord Bot

This project provides a Discord bot that cross-posts your BlueSky posts to a specified Discord channel. It is built with TypeScript and Node.js, integrating with BlueSky via `@atproto/api` and Discord via `discord.js`.

---

## Features

- **BlueSky Integration:** Connects to the BlueSky network (AT Protocol) to fetch your posts.
- **Discord Dual-Delivery Option:** Connects to Discord using either a standard **Bot Gateway Client** (Token + Channel ID) or a simple **Webhook Client** (Webhook URL).
- **Multi-Image Collage Support:** Bundles up to 4 images into grouped embeds so Discord automatically generates a sleek mosaic image grid.
- **Dynamic Catch-Up:** Traverses post feeds recursively using cursors during startup/recovery to retrieve all historical posts missed during bot downtime (up to 100 posts).
- **Poison Pill Prevention:** Wraps post delivery in error-isolated execution blocks so a single failing post doesn't crash the bot or block the queue.
- **Graceful Shutdowns:** Listens for termination signals (`SIGINT`/`SIGTERM`) to cleanly disconnect active database handles and Discord sockets.
- **Database Tracking:** Uses PostgreSQL (via Prisma) to securely store execution state, configuration settings, and posting history.
- **Docker Support:** Ready-to-go `docker-compose` configuration for automated, plug-and-play deployments.

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/install/)
- Node.js (if running locally without Docker)

---

## Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd blue-sky-discord-bot
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your settings:
```bash
cp .env.example .env
```

Edit the `.env` file:
* **BlueSky Settings:**
  * `BLUESKY_IDENTIFIER`: Your BlueSky handle (e.g. `user.bsky.social`).
  * `BLUESKY_APP_PASSWORD`: App Password generated in BlueSky settings.
* **Discord Settings (Choose one):**
  * **Option A (Webhook):** Add `DISCORD_WEBHOOK_URL` to send posts via webhook.
  * **Option B (Bot Client):** Add `DISCORD_TOKEN` and `DISCORD_CHANNEL_ID` to run a gateway client.
* **Database Settings:**
  * `DATABASE_URL`: Connection string for PostgreSQL (a working default is preconfigured in `docker-compose.yml`).

---

## Running with Docker (Recommended)

The easiest way to run the bot is via Docker Compose:

1. **Start the services:**
   ```bash
   docker-compose up -d --build
   ```
   This builds the app container and starts a PostgreSQL database. The application automatically initializes the database tables via Prisma on startup.

2. **View Logs:**
   ```bash
   docker-compose logs -f app
   ```

3. **Stop services:**
   ```bash
   docker-compose down
   ```

---

## Local Development (Without Docker)

To run the bot locally on your machine:

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Start PostgreSQL Database:**
   You can start just the database service using Docker Compose:
   ```bash
   docker-compose up -d db
   ```

3. **Sync Database Schema:**
   Push the schema definitions directly to the database:
   ```bash
   npx prisma db push
   ```

4. **Start the Bot in Dev Mode:**
   ```bash
   npm run dev
   ```