import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  createAgentAuthMiddleware,
  type AuthMiddlewareOptions,
} from './auth/middleware.js';
import { chatRouter } from './routes/chat.js';

export interface AgentProxyAppOptions {
  corsOrigin?: string;
  rateLimitRpm?: number;
  auth?: AuthMiddlewareOptions;
}

export function createAgentProxyApp(options: AgentProxyAppOptions = {}): express.Express {
  const corsOrigin = options.corsOrigin ?? process.env.CORS_ORIGIN ?? 'http://localhost:5173';
  const rateLimitRpm = options.rateLimitRpm
    ?? parseInt(process.env.AGENT_PROXY_RATE_LIMIT_RPM ?? '60', 10);
  const app = express();

  app.use(cors({ origin: corsOrigin }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'agent-proxy' });
  });

  const chatLimiter = rateLimit({
    windowMs: 60_000,
    limit: rateLimitRpm,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => rateLimitRpm <= 0,
    message: { error: 'rate_limit_exceeded', retry_after_seconds: 60 },
  });

  app.use(
    '/api/agent/chat',
    chatLimiter,
    createAgentAuthMiddleware(options.auth),
    express.json({ limit: '1mb' }),
    chatRouter,
  );

  return app;
}
