# BlueSky to Discord Bot

This project provides a Discord bot that cross-posts your BlueSky posts to a specified Discord channel. It is built with TypeScript and Node.js, integrating with BlueSky via `@atproto/api` and Discord via `discord.js`.

**New:** Now includes a REST API for management and uses PostgreSQL for robust state and history tracking.

## Features

-   **BlueSky Integration:** Connects to the BlueSky network (AT Protocol) to fetch your posts.
-   **Discord Integration:** Connects to Discord to send formatted messages, including rich embeds with images and links.
-   **Dynamic Configuration:** Change poll intervals and filters via API without restarting.
-   **API & Documentation:** Includes a Swagger/OpenAPI interface for easy management.
-   **Database:** Uses PostgreSQL (via Prisma) to store execution state, configuration, and post history.
-   **Docker Support:** Full `docker-compose` setup for easy deployment.

## Prerequisites

-   [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/install/)
-   Node.js (if running locally without Docker)

## Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd blue-sky-discord-bot
```

### 2. Configure Environment Variables

Rename `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Edit the `.env` file:
-   `BLUESKY_IDENTIFIER`: Your BlueSky handle.
-   `BLUESKY_APP_PASSWORD`: App Password from BlueSky settings.
-   `DISCORD_TOKEN`: Discord Bot Token.
-   `DISCORD_CHANNEL_ID`: Channel ID to post to.
-   `DATABASE_URL`: Connection string for Postgres (default provided in example works with docker-compose).
-   `PORT`: API Port (default 3000).

## Running with Docker (Recommended)

The easiest way to run the bot and the database is using Docker Compose.

1.  **Start the services:**
    ```bash
    docker-compose up -d --build
    ```
    This will start the PostgreSQL database and the Bot application. The bot will automatically run database migrations on startup.

2.  **View Logs:**
    ```bash
    docker-compose logs -f app
    ```

3.  **Stop services:**
    ```bash
    docker-compose down
    ```

## API & Documentation

The bot exposes a REST API for management and monitoring.

-   **Base URL:** `http://localhost:3000`
-   **Swagger UI:** `http://localhost:3000/api-docs`

### Key Endpoints

-   `GET /status`: View current bot state (last processed post).
-   `GET /config`: View current runtime configuration.
-   `PATCH /config`: Update configuration (poll interval, filters).
-   `POST /trigger`: Force an immediate check for new posts.
-   `GET /history`: View a log of recently sent posts.

**Example: Update Configuration**
```bash
curl -X PATCH http://localhost:3000/config \
  -H "Content-Type: application/json" \
  -d '{"pollIntervalMinutes": 10, "ignoreReplies": false}'
```

## Local Development (Without Docker)

If you want to run locally:

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Start Database:**
    You still need a Postgres database. You can run just the DB via Docker:
    ```bash
    docker-compose up -d db
    ```

3.  **Run Migrations:**
    ```bash
    npx prisma migrate dev
    ```

4.  **Start the Bot:**
    ```bash
    npm run dev
    ```