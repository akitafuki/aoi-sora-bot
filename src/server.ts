import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { z } from 'zod';
import { getSettings, updateSettings } from './config';
import { loadState } from './state';
import { prisma } from './db';

const app = express();

// Security Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// API Key Authentication Middleware
const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.API_KEY;

  if (!validApiKey) {
    console.warn('API_KEY not set in environment variables. allowing all requests (INSECURE).');
    return next();
  }

  if (!apiKey || apiKey !== validApiKey) {
    res.status(401).json({ error: 'Unauthorized: Invalid or missing API Key' });
    return;
  }

  next();
};

// Zod Schema for Config Validation
const configSchema = z.object({
  pollIntervalMinutes: z.number().min(1).optional(),
  ignoreReplies: z.boolean().optional(),
  ignoreReposts: z.boolean().optional(),
  ignoreKeywords: z.array(z.string()).optional(),
});

// Swagger Options
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BlueSky Bot API',
      version: '1.0.0',
    },
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
        },
      },
    },
    security: [
      {
        ApiKeyAuth: [],
      },
    ],
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
app.get('/status', authenticate, async (req, res) => {
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
app.get('/config', authenticate, async (req, res) => {
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
 *       400:
 *         description: Validation error
 */
app.patch('/config', authenticate, async (req, res) => {
  try {
      const validation = configSchema.safeParse(req.body);
      
      if (!validation.success) {
        res.status(400).json({ error: 'Validation failed', details: validation.error.format() });
        return;
      }

      const settings = await updateSettings(validation.data);
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
app.post('/trigger', authenticate, async (req, res) => {
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
app.get('/history', authenticate, async (req, res) => {
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
