import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { MatchScorerService } from '../services/matchScorerService';
import { prisma } from '../db';
import { config } from '../config';
import { validateBody } from '../middleware/validate';

const router = Router();

const matchRequestSchema = z.object({
  resumeId: z.string().uuid('Invalid resumeId'),
  jobId: z.string().uuid('Invalid jobId')
});

// Calculate and save match analysis
router.post('/', validateBody(matchRequestSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { resumeId, jobId } = req.body;

    const resume = await prisma.resume.findUnique({ where: { id: resumeId } });
    if (!resume) {
      return res.status(404).json({ success: false, error: { message: 'Resume not found' } });
    }

    const job = await prisma.jobDescription.findUnique({ where: { id: jobId } });
    if (!job) {
      return res.status(404).json({ success: false, error: { message: 'Job not found' } });
    }

    const parsedResume = JSON.parse(resume.parsedData);
    const atsAnalysis = JSON.parse(resume.atsAnalysis);
    const parsedJob = JSON.parse(job.parsedData);

    const analysis = MatchScorerService.calculateMatch(
      resumeId,
      jobId,
      { parsedData: parsedResume, atsAnalysis, rawText: resume.rawText },
      { parsedData: parsedJob, rawText: job.rawText }
    );

    // Save to DB
    const saved = await prisma.matchAnalysis.create({
      data: {
        id: analysis.id,
        resumeId,
        jobId,
        overallScore: analysis.overallScore,
        scoreBreakdown: JSON.stringify(analysis.scoreBreakdown),
        skillMatrix: JSON.stringify(analysis.skillMatrix),
        experienceComparison: JSON.stringify(analysis.experienceComparison),
        strengths: JSON.stringify(analysis.strengths),
        gaps: JSON.stringify(analysis.gaps),
        actionableAdvice: JSON.stringify(analysis.actionableAdvice)
      }
    });

    await prisma.activityLog.create({
      data: {
        id: analysis.id,
        userId: config.defaultUserId,
        type: 'match_calculated',
        title: `Matched "${resume.title}" with "${job.title} at ${job.company}" (${analysis.overallScore}% score)`
      }
    });

    res.status(201).json({
      success: true,
      data: analysis
    });
  } catch (error) {
    next(error);
  }
});

// Get match analysis by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const saved = await prisma.matchAnalysis.findUnique({
      where: { id: req.params.id as string },
      include: {
        resume: { select: { title: true, fileName: true } },
        job: { select: { title: true, company: true } }
      }
    });

    if (!saved) {
      return res.status(404).json({ success: false, error: { message: 'Match analysis not found' } });
    }

    const analysis = {
      id: saved.id,
      resumeId: saved.resumeId,
      jobId: saved.jobId,
      overallScore: saved.overallScore,
      scoreBreakdown: JSON.parse(saved.scoreBreakdown),
      skillMatrix: JSON.parse(saved.skillMatrix),
      experienceComparison: JSON.parse(saved.experienceComparison),
      strengths: JSON.parse(saved.strengths),
      gaps: JSON.parse(saved.gaps),
      actionableAdvice: JSON.parse(saved.actionableAdvice),
      createdAt: saved.createdAt.toISOString(),
      resumeTitle: saved.resume.title,
      jobTitle: saved.job.title,
      company: saved.job.company
    };

    res.json({ success: true, data: analysis });
  } catch (error) {
    next(error);
  }
});

export default router;
