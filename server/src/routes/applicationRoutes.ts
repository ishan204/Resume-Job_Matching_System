import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ApplicationService } from '../services/applicationService';
import { config } from '../config';
import { validateBody } from '../middleware/validate';

const router = Router();

const createApplicationSchema = z.object({
  company: z.string().min(1, 'Company is required'),
  position: z.string().min(1, 'Position is required'),
  location: z.string().optional().default('Remote'),
  salary: z.string().optional(),
  status: z.enum(['saved', 'applied', 'screening', 'interviewing', 'offer', 'rejected']).default('saved'),
  resumeId: z.string().uuid().optional(),
  jobId: z.string().uuid().optional(),
  matchScore: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  nextActionDate: z.string().optional()
});

const updateStatusSchema = z.object({
  status: z.enum(['saved', 'applied', 'screening', 'interviewing', 'offer', 'rejected']),
  note: z.string().optional()
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await ApplicationService.listApplications(config.defaultUserId);
    res.json({ success: true, data: list });
  } catch (error) {
    next(error);
  }
});

router.post('/', validateBody(createApplicationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const created = await ApplicationService.createApplication(config.defaultUserId, req.body);
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', validateBody(updateStatusSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await ApplicationService.updateApplicationStatus(
      req.params.id as string,
      req.body.status,
      req.body.note
    );
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

export default router;
