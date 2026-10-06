import {
  ScoreBreakdown,
  ActionableAdvice,
  BulletOptimization,
  CoverLetterTone
} from '@shared';

export interface TailorResumeResult {
  tailoredSummary: string;
  optimizedBullets: BulletOptimization[];
  suggestedSkillAdditions: Array<{ skill: string; placement: string; rationale: string }>;
  fullOptimizedText: string;
}

export interface GenerateCoverLetterResult {
  recipient: string;
  opening: string;
  bodyParagraphs: string[];
  closing: string;
  fullLetter: string;
  highlightedAchievements: string[];
}

export interface IAIProvider {
  name: string;
  isConfigured(): boolean;
  generateOptimizedResume(
    candidateResumeText: string,
    parsedResume: any,
    jobDescriptionText: string,
    parsedJob: any,
    missingSkills: string[]
  ): Promise<TailorResumeResult>;

  generateCoverLetter(
    candidateResume: any,
    jobDescription: any,
    tone: CoverLetterTone
  ): Promise<GenerateCoverLetterResult>;

  generateDeepInsights?(
    candidateResume: any,
    jobDescription: any
  ): Promise<{ strengths: string[]; gaps: string[]; actionableAdvice: ActionableAdvice[] }>;
}
