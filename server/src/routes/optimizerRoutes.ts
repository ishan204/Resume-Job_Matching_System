import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { OptimizerService } from '../services/optimizerService';
import { validateBody } from '../middleware/validate';

const router = Router();

const optimizeSchema = z.object({
  matchAnalysisId: z.string().uuid(),
  resumeId: z.string().uuid(),
  targetJobId: z.string().uuid()
});

router.post('/', validateBody(optimizeSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { matchAnalysisId, resumeId, targetJobId } = req.body;
    const optimized = await OptimizerService.optimizeResume(matchAnalysisId, resumeId, targetJobId);
    res.status(201).json({ success: true, data: optimized });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const optimized = await OptimizerService.getOptimizedResume(req.params.id as string);
    if (!optimized) {
      return res.status(404).json({ success: false, error: { message: 'Optimized resume not found' } });
    }
    res.json({ success: true, data: optimized });
  } catch (error) {
    next(error);
  }
});

export default router;
