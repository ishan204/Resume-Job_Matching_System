import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { JobAnalyzerService } from '../services/jobAnalyzerService';
import { prisma } from '../db';
import { config } from '../config';
import { validateBody } from '../middleware/validate';

const router = Router();

const createJobSchema = z.object({
  title: z.string().min(2, 'Job title is required'),
  company: z.string().min(1, 'Company name is required'),
  location: z.string().optional().default('Remote'),
  employmentType: z.string().optional().default('Full-time'),
  salaryRange: z.string().optional(),
  rawText: z.string().min(30, 'Job description must be at least 30 characters')
});

// Create and analyze new job description
router.post('/', validateBody(createJobSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, company, location, employmentType, salaryRange, rawText } = req.body;

    const parsedData = JobAnalyzerService.analyzeJob(rawText, title);

    const job = await prisma.jobDescription.create({
      data: {
        id: uuidv4(),
        userId: config.defaultUserId,
        title,
        company,
        location,
        employmentType,
        salaryRange,
        rawText,
        parsedData: JSON.stringify(parsedData)
      }
    });

    await prisma.activityLog.create({
      data: {
        id: uuidv4(),
        userId: config.defaultUserId,
        type: 'job_analyzed',
        title: `Analyzed job posting: ${title} at ${company}`
      }
    });

    res.status(201).json({
      success: true,
      data: {
        id: job.id,
        userId: job.userId,
        title: job.title,
        company: job.company,
        location: job.location,
        employmentType: job.employmentType,
        salaryRange: job.salaryRange || undefined,
        rawText: job.rawText,
        parsedData,
        createdAt: job.createdAt.toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

// List all job descriptions
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobs = await prisma.jobDescription.findMany({
      where: { userId: config.defaultUserId },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = jobs.map(j => ({
      id: j.id,
      userId: j.userId,
      title: j.title,
      company: j.company,
      location: j.location,
      employmentType: j.employmentType,
      salaryRange: j.salaryRange || undefined,
      rawText: j.rawText,
      parsedData: JSON.parse(j.parsedData),
      createdAt: j.createdAt.toISOString()
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    next(error);
  }
});

// Get single job description
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await prisma.jobDescription.findUnique({
      where: { id: req.params.id as string }
    });

    if (!job) {
      return res.status(404).json({ success: false, error: { message: 'Job not found' } });
    }

    res.json({
      success: true,
      data: {
        id: job.id,
        userId: job.userId,
        title: job.title,
        company: job.company,
        location: job.location,
        employmentType: job.employmentType,
        salaryRange: job.salaryRange || undefined,
        rawText: job.rawText,
        parsedData: JSON.parse(job.parsedData),
        createdAt: job.createdAt.toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

// Delete job description
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.jobDescription.delete({
      where: { id: req.params.id as string }
    });

    res.json({ success: true, message: 'Job description deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
