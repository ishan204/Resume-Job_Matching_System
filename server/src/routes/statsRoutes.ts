import { Router, Request, Response, NextFunction } from 'express';
import { ApplicationService } from '../services/applicationService';
import { config } from '../config';

const router = Router();

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await ApplicationService.getDashboardStats(config.defaultUserId);
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

export default router;
