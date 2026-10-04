import { describe, it, expect } from 'vitest';
import { MatchScorerService } from '../src/services/matchScorerService';
import { ResumeParserService } from '../src/services/resumeParserService';
import { JobAnalyzerService } from '../src/services/jobAnalyzerService';

describe('MatchScorerService', () => {
  const resumeText = `
ALICE CHEN
alice@example.com | (415) 555-9876
Senior Software Engineer with 6 years experience in Python, AWS, Docker, and PostgreSQL.
Led microservices scaling and reduced query latency by 35%.
Bachelor of Science in Computer Science, Stanford University.
`;

  const jobText = `
Senior Platform Engineer
Company: CloudTech
Requirements:
• 5+ years experience with Python, Docker, and PostgreSQL
• AWS cloud deployment
Nice to have:
• Kubernetes and Terraform
`;

  it('calculates weighted multi-factor match score with explainability', () => {
    const resume = ResumeParserService.parseResume(resumeText);
    const job = JobAnalyzerService.analyzeJob(jobText, 'Senior Platform Engineer');

    const analysis = MatchScorerService.calculateMatch(
      'resume-1',
      'job-1',
      { parsedData: resume.parsedData, atsAnalysis: resume.atsAnalysis, rawText: resumeText },
      { parsedData: job, rawText: jobText }
    );

    expect(analysis.overallScore).toBeGreaterThanOrEqual(70);
    expect(analysis.scoreBreakdown.hardSkillsScore).toBeGreaterThan(70);
    expect(analysis.experienceComparison.status).toBe('meets');
    expect(analysis.skillMatrix.matchedSkills.length).toBeGreaterThan(0);
    expect(analysis.actionableAdvice.length).toBeGreaterThan(0);
    expect(analysis.strengths.length).toBeGreaterThan(0);
  });
});
