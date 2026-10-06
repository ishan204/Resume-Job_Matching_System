import { Router, Request, Response } from 'express';
import { prisma } from '../db';
import { AIFactory } from '../services/ai/aiFactory';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  let dbStatus = 'ok';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (e) {
    dbStatus = 'disconnected';
  }

  const aiProvider = AIFactory.getProvider();

  res.json({
    status: dbStatus === 'ok' ? 'healthy' : 'degraded',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
      aiProvider: aiProvider.name,
      aiConfigured: aiProvider.isConfigured()
    }
  });
});

export default router;
