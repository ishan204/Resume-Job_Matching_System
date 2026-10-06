import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CoverLetterService } from '../services/coverLetterService';
import { validateBody } from '../middleware/validate';

const router = Router();

const generateSchema = z.object({
  resumeId: z.string().uuid(),
  jobId: z.string().uuid(),
  tone: z.enum(['professional', 'enthusiastic', 'confident', 'concise', 'technical']).default('professional')
});

const updateSchema = z.object({
  fullLetter: z.string().min(20, 'Letter content too short')
});

router.post('/generate', validateBody(generateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { resumeId, jobId, tone } = req.body;
    const coverLetter = await CoverLetterService.generateCoverLetter(resumeId, jobId, tone);
    res.status(201).json({ success: true, data: coverLetter });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const coverLetter = await CoverLetterService.getCoverLetter(req.params.id as string);
    if (!coverLetter) {
      return res.status(404).json({ success: false, error: { message: 'Cover letter not found' } });
    }
    res.json({ success: true, data: coverLetter });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', validateBody(updateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await CoverLetterService.updateCoverLetter(req.params.id as string, req.body.fullLetter);
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

export default router;
