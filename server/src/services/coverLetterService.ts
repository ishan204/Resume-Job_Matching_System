import { v4 as uuidv4 } from 'uuid';
import { CoverLetter, CoverLetterTone } from '@shared';
import { prisma } from '../db';
import { AIFactory } from './ai/aiFactory';

export class CoverLetterService {
  public static async generateCoverLetter(
    resumeId: string,
    jobId: string,
    tone: CoverLetterTone = 'professional'
  ): Promise<CoverLetter> {
    const resume = await prisma.resume.findUnique({ where: { id: resumeId } });
    if (!resume) throw new Error('Resume not found');

    const job = await prisma.jobDescription.findUnique({ where: { id: jobId } });
    if (!job) throw new Error('Job description not found');

    const parsedResume = JSON.parse(resume.parsedData);
    const parsedJob = JSON.parse(job.parsedData);

    const aiProvider = AIFactory.getProvider();
    const result = await aiProvider.generateCoverLetter(
      parsedResume,
      {
        title: job.title,
        company: job.company,
        rawText: job.rawText,
        parsedData: parsedJob
      },
      tone
    );

    const saved = await prisma.coverLetter.create({
      data: {
        id: uuidv4(),
        resumeId,
        jobId,
        company: job.company,
        role: job.title,
        tone,
        recipient: result.recipient,
        opening: result.opening,
        bodyParagraphs: JSON.stringify(result.bodyParagraphs),
        closing: result.closing,
        fullLetter: result.fullLetter,
        highlightedAchievements: JSON.stringify(result.highlightedAchievements),
      }
    });

    return {
      id: saved.id,
      resumeId: saved.resumeId,
      jobId: saved.jobId,
      company: saved.company,
      role: saved.role,
      tone: saved.tone as CoverLetterTone,
      recipient: saved.recipient,
      opening: saved.opening,
      bodyParagraphs: JSON.parse(saved.bodyParagraphs),
      closing: saved.closing,
      fullLetter: saved.fullLetter,
      highlightedAchievements: JSON.parse(saved.highlightedAchievements),
      createdAt: saved.createdAt.toISOString()
    };
  }

  public static async getCoverLetter(id: string): Promise<CoverLetter | null> {
    const record = await prisma.coverLetter.findUnique({ where: { id } });
    if (!record) return null;

    return {
      id: record.id,
      resumeId: record.resumeId,
      jobId: record.jobId,
      company: record.company,
      role: record.role,
      tone: record.tone as CoverLetterTone,
      recipient: record.recipient,
      opening: record.opening,
      bodyParagraphs: JSON.parse(record.bodyParagraphs),
      closing: record.closing,
      fullLetter: record.fullLetter,
      highlightedAchievements: JSON.parse(record.highlightedAchievements),
      createdAt: record.createdAt.toISOString()
    };
  }

  public static async updateCoverLetter(id: string, fullLetter: string): Promise<CoverLetter | null> {
    const updated = await prisma.coverLetter.update({
      where: { id },
      data: { fullLetter }
    });

    return {
      id: updated.id,
      resumeId: updated.resumeId,
      jobId: updated.jobId,
      company: updated.company,
      role: updated.role,
      tone: updated.tone as CoverLetterTone,
      recipient: updated.recipient,
      opening: updated.opening,
      bodyParagraphs: JSON.parse(updated.bodyParagraphs),
      closing: updated.closing,
      fullLetter: updated.fullLetter,
      highlightedAchievements: JSON.parse(updated.highlightedAchievements),
      createdAt: updated.createdAt.toISOString()
    };
  }
}
