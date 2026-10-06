import { v4 as uuidv4 } from 'uuid';
import {
  MatchAnalysis,
  ScoreBreakdown,
  MatchedSkill,
  MissingSkill,
  ParsedResumeData,
  ParsedJobData,
  AtsAnalysis,
  ActionableAdvice,
  SkillCategory
} from '@shared';
import { SemanticEngine } from './ai/semanticEngine';
import { normalizeSkill } from '../constants/skillsTaxonomy';

export class MatchScorerService {
  private static semanticEngine = new SemanticEngine();

  /**
   * Calculates a full explainable match analysis between a parsed resume and a parsed job description.
   */
  public static calculateMatch(
    resumeId: string,
    jobId: string,
    resume: { parsedData: ParsedResumeData; atsAnalysis: AtsAnalysis; rawText: string },
    job: { parsedData: ParsedJobData; rawText: string }
  ): MatchAnalysis {
    const resumeData = resume.parsedData;
    const jobData = job.parsedData;

    // 1. HARD SKILLS MATCHING (40% weight)
    const { hardSkillsScore, matchedSkills, missingRequiredSkills, missingPreferredSkills, bonusSkills } =
      this.evaluateSkills(resumeData, jobData);

    // 2. EXPERIENCE & SENIORITY (25% weight)
    const { experienceScore, experienceComparison } = this.evaluateExperience(resumeData, jobData);

    // 3. RESPONSIBILITIES / SEMANTIC OVERLAP (20% weight)
    const responsibilitiesScore = this.evaluateResponsibilities(resumeData, jobData);

    // 4. EDUCATION (10% weight)
    const educationScore = this.evaluateEducation(resumeData, jobData);

    // 5. ATS FORMATTING (5% weight)
    const atsFormattingScore = Math.min(Math.max(resume.atsAnalysis.overallAtsScore, 30), 100);

    // WEIGHTED OVERALL SCORE
    const overallScore = Math.round(
      hardSkillsScore * 0.40 +
      experienceScore * 0.25 +
      responsibilitiesScore * 0.20 +
      educationScore * 0.10 +
      atsFormattingScore * 0.05
    );

    const scoreBreakdown: ScoreBreakdown = {
      hardSkillsScore,
      experienceScore,
      responsibilitiesScore,
      educationScore,
      atsFormattingScore
    };

    // GENERATE EXPLAINABLE STRENGTHS, GAPS & ADVICE
    const { strengths, gaps, actionableAdvice } = this.generateExplanationsAndAdvice(
      scoreBreakdown,
      matchedSkills,
      missingRequiredSkills,
      experienceComparison,
      resume.atsAnalysis
    );

    return {
      id: uuidv4(),
      resumeId,
      jobId,
      overallScore,
      scoreBreakdown,
      skillMatrix: {
        matchedSkills,
        missingRequiredSkills,
        missingPreferredSkills,
        bonusSkills
      },
      experienceComparison,
      strengths,
      gaps,
      actionableAdvice,
      createdAt: new Date().toISOString()
    };
  }

  private static evaluateSkills(resumeData: ParsedResumeData, jobData: ParsedJobData) {
    const candidateSkillsLower = new Set(resumeData.skills.map(s => s.toLowerCase()));
    const matchedSkills: MatchedSkill[] = [];
    const missingRequiredSkills: MissingSkill[] = [];
    const missingPreferredSkills: MissingSkill[] = [];

    // Evaluate Required Skills
    let requiredPoints = 0;
    const totalRequired = jobData.requiredSkills.length || 1;

    for (const reqSkill of jobData.requiredSkills) {
      const def = normalizeSkill(reqSkill);
      const category: SkillCategory = def?.category || 'domainKnowledge';

      let isMatch = candidateSkillsLower.has(reqSkill.toLowerCase());
      if (!isMatch && def) {
        isMatch = def.synonyms.some(syn => candidateSkillsLower.has(syn.toLowerCase()));
      }

      if (isMatch) {
        requiredPoints++;
        matchedSkills.push({
          skill: reqSkill,
          category,
          importance: 'required',
          contextFound: this.findSkillContext(reqSkill, resumeData)
        });
      } else {
        missingRequiredSkills.push({
          skill: reqSkill,
          category,
          importance: 'critical',
          recommendation: `High-priority requirement for this position. If you have experience with ${reqSkill}, incorporate it directly into your skills list and relevant project bullets.`
        });
      }
    }

    // Evaluate Preferred Skills
    let preferredPoints = 0;
    const totalPreferred = jobData.preferredSkills.length || 1;

    for (const prefSkill of jobData.preferredSkills) {
      const def = normalizeSkill(prefSkill);
      const category: SkillCategory = def?.category || 'domainKnowledge';

      let isMatch = candidateSkillsLower.has(prefSkill.toLowerCase());
      if (!isMatch && def) {
        isMatch = def.synonyms.some(syn => candidateSkillsLower.has(syn.toLowerCase()));
      }

      if (isMatch) {
        preferredPoints++;
        matchedSkills.push({
          skill: prefSkill,
          category,
          importance: 'preferred',
          contextFound: this.findSkillContext(prefSkill, resumeData)
        });
      } else {
        missingPreferredSkills.push({
          skill: prefSkill,
          category,
          importance: 'bonus',
          recommendation: `Nice-to-have skill. Adding ${prefSkill} will provide a competitive edge over other applicants.`
        });
      }
    }

    // Identify candidate bonus skills
    const jobSkillsSet = new Set([
      ...jobData.requiredSkills.map(s => s.toLowerCase()),
      ...jobData.preferredSkills.map(s => s.toLowerCase())
    ]);

    const bonusSkills = resumeData.skills.filter(s => !jobSkillsSet.has(s.toLowerCase())).slice(0, 8);

    // Calculate score: 75% required, 25% preferred
    const requiredScore = (requiredPoints / totalRequired) * 100;
    const preferredScore = totalPreferred > 0 ? (preferredPoints / totalPreferred) * 100 : 100;
    const hardSkillsScore = Math.round(requiredScore * 0.75 + preferredScore * 0.25);

    return {
      hardSkillsScore: Math.min(Math.max(hardSkillsScore, 20), 100),
      matchedSkills,
      missingRequiredSkills,
      missingPreferredSkills,
      bonusSkills
    };
  }

  private static findSkillContext(skill: string, resumeData: ParsedResumeData): string | undefined {
    const sLower = skill.toLowerCase();
    for (const exp of resumeData.experience) {
      for (const bullet of exp.bullets) {
        if (bullet.toLowerCase().includes(sLower)) {
          return `${exp.company}: "${bullet.slice(0, 100)}..."`;
        }
      }
    }
    return undefined;
  }

  private static evaluateExperience(resumeData: ParsedResumeData, jobData: ParsedJobData) {
    const candidateYears = resumeData.detectedExperienceYears;
    const requiredYears = jobData.minYearsExperience;

    let status: 'meets' | 'exceeds' | 'under' = 'meets';
    let assessment = '';
    let experienceScore = 80;

    if (candidateYears >= requiredYears + 2) {
      status = 'exceeds';
      assessment = `Exceeds experience requirements: Candidate brings ${candidateYears} years of experience vs. ${requiredYears} years required for this role.`;
      experienceScore = 100;
    } else if (candidateYears >= requiredYears) {
      status = 'meets';
      assessment = `Meets experience criteria: Candidate has ${candidateYears} years of relevant experience, satisfying the ${requiredYears} year minimum.`;
      experienceScore = 90;
    } else {
      status = 'under';
      const gap = requiredYears - candidateYears;
      assessment = `Experience gap: Position seeks ${requiredYears}+ years, candidate profile indicates ~${candidateYears} years (${gap} yr differential). Emphasize high-velocity project delivery to compensate.`;
      experienceScore = Math.max(Math.round((candidateYears / requiredYears) * 85), 35);
    }

    return {
      experienceScore,
      experienceComparison: {
        requiredYears,
        candidateYears,
        status,
        assessment
      }
    };
  }

  private static evaluateResponsibilities(resumeData: ParsedResumeData, jobData: ParsedJobData): number {
    const allResumeBullets = resumeData.experience.flatMap(e => e.bullets).join(' ');
    const allJobResponsibilities = jobData.keyResponsibilities.join(' ');

    if (!allResumeBullets || !allJobResponsibilities) return 75;

    const similarity = this.semanticEngine.calculateCosineSimilarity(allResumeBullets, allJobResponsibilities);
    // Scale cosine similarity (which typically ranges 0.15 - 0.6 in text) to 40 - 95 score
    const scaled = Math.round(35 + similarity * 110);
    return Math.min(Math.max(scaled, 40), 98);
  }

  private static evaluateEducation(resumeData: ParsedResumeData, jobData: ParsedJobData): number {
    if (resumeData.education.length === 0) return 60;

    const eduText = resumeData.education.map(e => `${e.degree} ${e.institution}`).join(' ').toLowerCase();
    const hasCSDegree = eduText.includes('computer science') || eduText.includes('software') || eduText.includes('engineering') || eduText.includes('information technology');
    const hasMasters = eduText.includes('master') || eduText.includes('m.s.') || eduText.includes('phd');

    if (hasMasters && hasCSDegree) return 100;
    if (hasCSDegree) return 92;
    if (resumeData.education.length > 0) return 80;
    return 60;
  }

  private static generateExplanationsAndAdvice(
    breakdown: ScoreBreakdown,
    matchedSkills: MatchedSkill[],
    missingRequiredSkills: MissingSkill[],
    experienceComparison: { status: 'meets' | 'exceeds' | 'under'; candidateYears: number; requiredYears: number },
    ats: AtsAnalysis
  ) {
    const strengths: string[] = [];
    const gaps: string[] = [];
    const actionableAdvice: ActionableAdvice[] = [];

    // Strengths
    if (breakdown.hardSkillsScore >= 75) {
      strengths.push(`Strong technical stack alignment: Matched ${matchedSkills.length} critical and preferred skills.`);
    }
    if (experienceComparison.status === 'exceeds' || experienceComparison.status === 'meets') {
      strengths.push(`Seniority fit: Candidate meets the target experience requirements (${experienceComparison.candidateYears} yrs vs ${experienceComparison.requiredYears} yrs required).`);
    }
    if (breakdown.responsibilitiesScore >= 75) {
      strengths.push('High semantic alignment between past work accomplishments and day-to-day job responsibilities.');
    }
    if (ats.overallAtsScore >= 80) {
      strengths.push('Clean, machine-readable ATS formatting with recognizable sections and contact fields.');
    }

    // Gaps
    if (missingRequiredSkills.length > 0) {
      gaps.push(`Missing ${missingRequiredSkills.length} high-priority required skills: ${missingRequiredSkills.slice(0, 3).map(s => s.skill).join(', ')}.`);
    }
    if (experienceComparison.status === 'under') {
      gaps.push(`Candidate experience (${experienceComparison.candidateYears} yrs) is under the target threshold (${experienceComparison.requiredYears} yrs).`);
    }
    if (ats.overallAtsScore < 75) {
      gaps.push('Resume formatting has potential ATS parse bottlenecks (missing sections or metrics).');
    }

    // Actionable Advice (Ordered by impact)
    if (missingRequiredSkills.length > 0) {
      const topMissing = missingRequiredSkills.slice(0, 2).map(s => s.skill).join(' and ');
      actionableAdvice.push({
        priority: 'high',
        title: `Incorporate Missing Core Skills: ${topMissing}`,
        description: `This position explicitly requires ${topMissing}. If you have worked with these technologies, showcase them under your skills and within your project bullets to bypass automated screening filters.`,
        exampleSnippet: `• Engineered scalable service leveraging ${missingRequiredSkills[0]?.skill || 'target skill'}, decreasing processing time by 30%.`
      });
    }

    actionableAdvice.push({
      priority: 'high',
      title: 'Strengthen Bullet Points with Quantifiable Metrics',
      description: 'Use the Google XYZ Formula: Accomplished [X], as measured by [Y], by doing [Z]. Recruiters and ATS rank measurable accomplishments substantially higher.',
      exampleSnippet: 'Before: "Worked on database performance." -> After: "Optimized database indexing and caching, reducing P99 query latency by 45%."'
    });

    if (experienceComparison.status === 'under') {
      actionableAdvice.push({
        priority: 'medium',
        title: 'Highlight High-Ownership & Accelerated Leadership',
        description: 'Compensate for the years-of-experience differential by emphasizing architectural leadership, production complexity, and rapid promotions.',
        exampleSnippet: 'Demonstrate end-to-end ownership from architecture RFC to multi-region cloud deployment.'
      });
    }

    return { strengths, gaps, actionableAdvice };
  }
}
