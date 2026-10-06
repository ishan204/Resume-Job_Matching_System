export type SkillCategory =
  | 'languages'
  | 'frameworks'
  | 'databases'
  | 'cloudDevops'
  | 'tools'
  | 'softSkills'
  | 'domainKnowledge';

export interface ContactInfo {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
}

export interface WorkExperienceItem {
  id: string;
  company: string;
  title: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  bullets: string[];
  detectedSkills: string[];
}

export interface EducationItem {
  id: string;
  degree: string;
  institution: string;
  year?: string;
  gpa?: string;
  honors?: string;
}

export interface ProjectItem {
  name: string;
  description: string;
  technologies: string[];
  link?: string;
}

export interface ParsedResumeData {
  contactInfo: ContactInfo;
  summary: string;
  skills: string[];
  categorizedSkills: Record<SkillCategory, string[]>;
  experience: WorkExperienceItem[];
  education: EducationItem[];
  certifications: string[];
  projects: ProjectItem[];
  detectedExperienceYears: number;
}

export interface AtsCheckItem {
  rule: string;
  passed: boolean;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface AtsAnalysis {
  overallAtsScore: number;
  readabilityScore: number;
  formattingChecks: AtsCheckItem[];
  keywordDensity: number;
  wordCount: number;
  pageCountEstimate: number;
}

export interface Resume {
  id: string;
  userId: string;
  title: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  rawText: string;
  parsedData: ParsedResumeData;
  atsAnalysis: AtsAnalysis;
  createdAt: string;
  updatedAt: string;
}

export interface ParsedJobData {
  requiredSkills: string[];
  preferredSkills: string[];
  categorizedRequirements: Record<SkillCategory, string[]>;
  minYearsExperience: number;
  seniorityLevel: 'entry' | 'mid' | 'senior' | 'lead' | 'executive';
  keyResponsibilities: string[];
  educationRequirements: string[];
}

export interface JobDescription {
  id: string;
  userId: string;
  title: string;
  company: string;
  location: string;
  employmentType: string;
  salaryRange?: string;
  rawText: string;
  parsedData: ParsedJobData;
  createdAt: string;
}

export interface MatchedSkill {
  skill: string;
  category: SkillCategory;
  importance: 'required' | 'preferred';
  contextFound?: string;
}

export interface MissingSkill {
  skill: string;
  category: SkillCategory;
  importance: 'critical' | 'bonus';
  recommendation: string;
}

export interface ScoreBreakdown {
  hardSkillsScore: number;       // Weight 40%
  experienceScore: number;       // Weight 25%
  responsibilitiesScore: number; // Weight 20%
  educationScore: number;        // Weight 10%
  atsFormattingScore: number;    // Weight 5%
}

export interface ActionableAdvice {
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  exampleSnippet?: string;
}

export interface MatchAnalysis {
  id: string;
  resumeId: string;
  jobId: string;
  overallScore: number;
  scoreBreakdown: ScoreBreakdown;
  skillMatrix: {
    matchedSkills: MatchedSkill[];
    missingRequiredSkills: MissingSkill[];
    missingPreferredSkills: MissingSkill[];
    bonusSkills: string[];
  };
  experienceComparison: {
    requiredYears: number;
    candidateYears: number;
    status: 'meets' | 'exceeds' | 'under';
    assessment: string;
  };
  strengths: string[];
  gaps: string[];
  actionableAdvice: ActionableAdvice[];
  createdAt: string;
}

export interface BulletOptimization {
  experienceId: string;
  company: string;
  originalBullet: string;
  optimizedBullet: string;
  reason: string;
  targetKeywordsAdded: string[];
}

export interface OptimizedResume {
  id: string;
  matchAnalysisId: string;
  resumeId: string;
  targetJobId: string;
  tailoredSummary: string;
  optimizedBullets: BulletOptimization[];
  suggestedSkillAdditions: Array<{ skill: string; placement: string; rationale: string }>;
  fullOptimizedText: string;
  createdAt: string;
}

export type CoverLetterTone = 'professional' | 'enthusiastic' | 'confident' | 'concise' | 'technical';

export interface CoverLetter {
  id: string;
  resumeId: string;
  jobId: string;
  company: string;
  role: string;
  tone: CoverLetterTone;
  recipient: string;
  opening: string;
  bodyParagraphs: string[];
  closing: string;
  fullLetter: string;
  highlightedAchievements: string[];
  createdAt: string;
}

export type ApplicationStatus =
  | 'saved'
  | 'applied'
  | 'screening'
  | 'interviewing'
  | 'offer'
  | 'rejected';

export interface ApplicationTimelineEvent {
  date: string;
  stage: string;
  note: string;
}

export interface Application {
  id: string;
  userId: string;
  resumeId?: string;
  jobId?: string;
  company: string;
  position: string;
  location: string;
  salary?: string;
  status: ApplicationStatus;
  appliedDate?: string | null;
  matchScore?: number;
  notes: string;
  nextActionDate?: string | null;
  timeline: ApplicationTimelineEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalResumes: number;
  totalJobs: number;
  totalMatches: number;
  averageMatchScore: number;
  activeApplications: number;
  interviewsCount: number;
  offersCount: number;
  recentActivities: Array<{
    id: string;
    type: 'resume_upload' | 'job_analyzed' | 'match_calculated' | 'optimized_resume' | 'cover_letter' | 'application_updated';
    title: string;
    timestamp: string;
  }>;
}
