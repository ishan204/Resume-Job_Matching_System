import { ParsedJobData, SkillCategory } from '@shared';
import { extractSkillsFromText, normalizeSkill } from '../constants/skillsTaxonomy';

export class JobAnalyzerService {
  /**
   * Analyzes job description text to extract structured requirements, skills, and seniority.
   */
  public static analyzeJob(text: string, titleHint?: string): ParsedJobData {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const lower = text.toLowerCase();

    // 1. Extract all recognized skills
    const { skills: allSkills, categorized } = extractSkillsFromText(text);

    // 2. Distinguish Required vs. Preferred skills
    const { requiredSkills, preferredSkills } = this.classifyRequiredAndPreferred(text, allSkills);

    // 3. Detect Min Years Experience & Seniority
    const { minYearsExperience, seniorityLevel } = this.detectExperienceAndSeniority(text, titleHint);

    // 4. Extract Key Responsibilities
    const keyResponsibilities = this.extractResponsibilities(text);

    // 5. Extract Education Requirements
    const educationRequirements = this.extractEducationRequirements(text);

    return {
      requiredSkills,
      preferredSkills,
      categorizedRequirements: categorized,
      minYearsExperience,
      seniorityLevel,
      keyResponsibilities,
      educationRequirements
    };
  }

  private static classifyRequiredAndPreferred(
    text: string,
    allSkills: string[]
  ): { requiredSkills: string[]; preferredSkills: string[] } {
    const lower = text.toLowerCase();

    // Look for preferred / nice to have section
    const preferredHeaderRegex = /(?:preferred qualifications|nice to have|bonus points|preferred skills|plus if you have)\s*[:\n]/i;
    const match = text.match(preferredHeaderRegex);

    let preferredText = '';
    let requiredText = text;

    if (match && match.index !== undefined) {
      const preferredStart = match.index;
      const nextSection = text.slice(preferredStart + match[0].length).search(/\n\s*(?:benefits|about us|what we offer|responsibilities|compensation)\s*[:\n]/i);
      if (nextSection !== -1) {
        preferredText = text.slice(preferredStart, preferredStart + match[0].length + nextSection);
      } else {
        preferredText = text.slice(preferredStart);
      }
      requiredText = text.slice(0, preferredStart) + (nextSection !== -1 ? text.slice(preferredStart + match[0].length + nextSection) : '');
    }

    const preferredExtracted = extractSkillsFromText(preferredText).skills;
    const requiredSkills: string[] = [];
    const preferredSkills: string[] = [];

    for (const skill of allSkills) {
      if (preferredExtracted.includes(skill)) {
        preferredSkills.push(skill);
      } else {
        requiredSkills.push(skill);
      }
    }

    // Ensure we don't have empty required skills if skills exist
    if (requiredSkills.length === 0 && preferredSkills.length > 0) {
      return {
        requiredSkills: preferredSkills.slice(0, Math.ceil(preferredSkills.length * 0.7)),
        preferredSkills: preferredSkills.slice(Math.ceil(preferredSkills.length * 0.7))
      };
    }

    return { requiredSkills, preferredSkills };
  }

  private static detectExperienceAndSeniority(
    text: string,
    titleHint?: string
  ): { minYearsExperience: number; seniorityLevel: 'entry' | 'mid' | 'senior' | 'lead' | 'executive' } {
    const combined = `${titleHint || ''} ${text}`.toLowerCase();

    // Seniority detection
    let seniorityLevel: 'entry' | 'mid' | 'senior' | 'lead' | 'executive' = 'mid';
    if (combined.match(/\b(vp|director|head of|chief|cto|cfo|executive)\b/)) {
      seniorityLevel = 'executive';
    } else if (combined.match(/\b(principal|staff|lead|architect|manager)\b/)) {
      seniorityLevel = 'lead';
    } else if (combined.match(/\b(senior|sr\.?|lead developer|experienced)\b/)) {
      seniorityLevel = 'senior';
    } else if (combined.match(/\b(junior|jr\.?|intern|entry|graduate|associate)\b/)) {
      seniorityLevel = 'entry';
    }

    // Years detection
    let minYearsExperience = seniorityLevel === 'entry' ? 1 : seniorityLevel === 'senior' ? 5 : seniorityLevel === 'lead' ? 7 : 3;

    const yearsMatch = text.match(/(\d+)\s*(?:-|–|\+)?\s*(?:to\s*\d+\s*)?years?(?:\s+of)?(?:\s+relevant|\s+professional|\s+commercial)?\s+experience/i);
    if (yearsMatch) {
      minYearsExperience = parseInt(yearsMatch[1], 10);
    }

    return { minYearsExperience, seniorityLevel };
  }

  private static extractResponsibilities(text: string): string[] {
    const respRegex = /(?:responsibilities|what you will do|what you'll do|day to day|key duties|role overview)\s*[:\n]/i;
    const match = text.match(respRegex);
    if (!match || match.index === undefined) {
      // Fallback: extract bullet points from text
      return text.split('\n')
        .map(l => l.replace(/^[•\-*·]\s*/, '').trim())
        .filter(l => l.length > 25 && l.length < 200)
        .slice(0, 5);
    }

    const remainingText = text.slice(match.index + match[0].length);
    const nextMatch = remainingText.match(/\n\s*(?:requirements|qualifications|what we offer|benefits|about you)\s*[:\n]/i);
    const respSection = nextMatch && nextMatch.index !== undefined
      ? remainingText.slice(0, nextMatch.index)
      : remainingText.slice(0, 1000);

    const items = respSection.split('\n')
      .map(l => l.replace(/^[•\-*·]\s*/, '').trim())
      .filter(l => l.length > 15 && l.length < 250);

    return items.slice(0, 8);
  }

  private static extractEducationRequirements(text: string): string[] {
    const eduList: string[] = [];
    const degMatches = text.match(/(?:bachelor'?s?|master'?s?|phd|doctorate|degree\s+in\s+computer\s+science|b\.?s\.?|m\.?s\.?)[^.\n]*/gi);
    if (degMatches) {
      for (const m of degMatches) {
        if (!eduList.includes(m.trim())) {
          eduList.push(m.trim());
        }
      }
    }
    if (eduList.length === 0) {
      eduList.push("Bachelor's degree in Computer Science, related technical field, or equivalent practical experience");
    }
    return eduList;
  }
}
