import { v4 as uuidv4 } from 'uuid';
import { OptimizedResume } from '@shared';
import { prisma } from '../db';
import { AIFactory } from './ai/aiFactory';

export class OptimizerService {
  public static async optimizeResume(
    matchAnalysisId: string,
    resumeId: string,
    targetJobId: string
  ): Promise<OptimizedResume> {
    const resume = await prisma.resume.findUnique({ where: { id: resumeId } });
    if (!resume) throw new Error('Resume not found');

    const job = await prisma.jobDescription.findUnique({ where: { id: targetJobId } });
    if (!job) throw new Error('Job description not found');

    const matchAnalysis = await prisma.matchAnalysis.findUnique({ where: { id: matchAnalysisId } });
    if (!matchAnalysis) throw new Error('Match analysis not found');

    const parsedResume = JSON.parse(resume.parsedData);
    const parsedJob = JSON.parse(job.parsedData);
    const skillMatrix = JSON.parse(matchAnalysis.skillMatrix);
    const missingSkills = skillMatrix.missingRequiredSkills.map((s: any) => s.skill);

    const aiProvider = AIFactory.getProvider();
    const result = await aiProvider.generateOptimizedResume(
      resume.rawText,
      parsedResume,
      job.rawText,
      parsedJob,
      missingSkills
    );

    // Save to database
    const saved = await prisma.optimizedResume.create({
      data: {
        id: uuidv4(),
        matchAnalysisId,
        resumeId,
        targetJobId,
        tailoredSummary: result.tailoredSummary,
        optimizedBullets: JSON.stringify(result.optimizedBullets),
        suggestedSkillAdditions: JSON.stringify(result.suggestedSkillAdditions),
        fullOptimizedText: result.fullOptimizedText,
      }
    });

    return {
      id: saved.id,
      matchAnalysisId: saved.matchAnalysisId,
      resumeId: saved.resumeId,
      targetJobId: saved.targetJobId,
      tailoredSummary: saved.tailoredSummary,
      optimizedBullets: JSON.parse(saved.optimizedBullets),
      suggestedSkillAdditions: JSON.parse(saved.suggestedSkillAdditions),
      fullOptimizedText: saved.fullOptimizedText,
      createdAt: saved.createdAt.toISOString()
    };
  }

  public static async getOptimizedResume(id: string): Promise<OptimizedResume | null> {
    const record = await prisma.optimizedResume.findUnique({ where: { id } });
    if (!record) return null;

    return {
      id: record.id,
      matchAnalysisId: record.matchAnalysisId,
      resumeId: record.resumeId,
      targetJobId: record.targetJobId,
      tailoredSummary: record.tailoredSummary,
      optimizedBullets: JSON.parse(record.optimizedBullets),
      suggestedSkillAdditions: JSON.parse(record.suggestedSkillAdditions),
      fullOptimizedText: record.fullOptimizedText,
      createdAt: record.createdAt.toISOString()
    };
  }
}
