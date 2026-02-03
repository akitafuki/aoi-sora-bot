import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { getSettings, updateSettings } from './config';
import { loadState } from './state';
import { prisma } from './db';

const app = express();
app.use(cors());
app.use(express.json());

// Swagger Options
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BlueSky Bot API',
      version: '1.0.0',
    },
  },
  apis: ['./src/server.ts'], // Path to the API docs
};

const openapiSpecification = swaggerJsdoc(options);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiSpecification));

// Define Trigger Callback
let triggerCallback: (() => Promise<void>) | null = null;

export function setTriggerCallback(cb: () => Promise<void>) {
  triggerCallback = cb;
}

/**
 * @openapi
 * /status:
 *   get:
 *     description: Get bot status
 *     responses:
 *       200:
 *         description: Success
 */
app.get('/status', async (req, res) => {
  const state = await loadState();
  res.json(state);
});

/**
 * @openapi
 * /config:
 *   get:
 *     description: Get current configuration
 *     responses:
 *       200:
 *         description: Success
 */
app.get('/config', async (req, res) => {
  const settings = await getSettings();
  res.json(settings);
});

/**
 * @openapi
 * /config:
 *   patch:
 *     description: Update configuration
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pollIntervalMinutes:
 *                 type: number
 *               ignoreReplies:
 *                 type: boolean
 *               ignoreReposts:
 *                 type: boolean
 *               ignoreKeywords:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Updated configuration
 */
app.patch('/config', async (req, res) => {
  try {
      const settings = await updateSettings(req.body);
      res.json(settings);
  } catch (error) {
      res.status(500).json({ error: 'Failed to update settings' });
  }
});

/**
 * @openapi
 * /trigger:
 *   post:
 *     description: Trigger an immediate check
 *     responses:
 *       200:
 *         description: Triggered
 */
app.post('/trigger', async (req, res) => {
  if (triggerCallback) {
    triggerCallback().catch(err => console.error("Manual trigger failed:", err));
    res.json({ message: 'Check triggered' });
  } else {
    res.status(503).json({ message: 'Bot not ready' });
  }
});

/**
 * @openapi
 * /history:
 *   get:
 *     description: Get post history
 *     responses:
 *       200:
 *         description: List of posts
 */
app.get('/history', async (req, res) => {
  try {
    const history = await prisma.postHistory.findMany({
        orderBy: { postedAt: 'desc' },
        take: 50
    });
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

export function startServer(port: number) {
  app.listen(port, () => {
    console.log(`API Server running on port ${port}`);
    console.log(`Swagger docs available at http://localhost:${port}/api-docs`);
  });
}
