import express from 'express';
import cors from 'cors';
import resumeRoutes from './routes/resumeRoutes';
import jobRoutes from './routes/jobRoutes';
import matchRoutes from './routes/matchRoutes';
import optimizerRoutes from './routes/optimizerRoutes';
import coverLetterRoutes from './routes/coverLetterRoutes';
import applicationRoutes from './routes/applicationRoutes';
import statsRoutes from './routes/statsRoutes';
import healthRoutes from './routes/healthRoutes';
import { errorHandler } from './middleware/errorHandler';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // API Routes
  app.use('/api/resumes', resumeRoutes);
  app.use('/api/jobs', jobRoutes);
  app.use('/api/match', matchRoutes);
  app.use('/api/optimize', optimizerRoutes);
  app.use('/api/cover-letters', coverLetterRoutes);
  app.use('/api/applications', applicationRoutes);
  app.use('/api/stats', statsRoutes);
  app.use('/api/health', healthRoutes);

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}
