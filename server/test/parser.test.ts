import { describe, it, expect } from 'vitest';
import { ResumeParserService } from '../src/services/resumeParserService';
import { JobAnalyzerService } from '../src/services/jobAnalyzerService';

describe('ResumeParserService', () => {
  const sampleResume = `
JANE DOE
jane.doe@example.com | (555) 123-4567 | New York, NY
https://linkedin.com/in/janedoe | https://github.com/janedoe

PROFESSIONAL SUMMARY
Results-oriented Senior Software Engineer with 6+ years of experience designing, architecting, and optimizing enterprise applications. Proven expertise in TypeScript, React, and Node.js with a commitment to test-driven engineering and operational excellence.

SKILLS
Languages: TypeScript, JavaScript, Python, SQL, HTML5, CSS3
Frameworks: React, Next.js, Node.js, Express.js, GraphQL
Databases: PostgreSQL, Redis, MongoDB
Cloud & DevOps: AWS, Docker, Kubernetes, CI/CD, Git

EXPERIENCE
Senior Software Engineer | FinTech Corp | New York, NY
01/2021 - Present
• Architected and developed high-throughput payment microservices with Node.js and TypeScript, handling 15k requests/sec.
• Optimized PostgreSQL query execution plans and caching with Redis, reducing latency by 45% for 2M active accounts.
• Spearheaded frontend migration to React and Next.js, increasing Lighthouse performance score by 35 points.
• Engineered automated CI/CD deployment pipelines on AWS with Docker, cutting deployment cycle times by 50%.

Software Engineer | CloudScale Inc | Boston, MA
06/2018 - 12/2020
• Implemented core customer onboarding workflows, accelerating new user conversion rates by 22%.
• Collaborated in cross-functional Agile sprints to ship 12 major product milestones on schedule.

EDUCATION
Bachelor of Science in Computer Science | Columbia University | 2014 - 2018
GPA: 3.85 | Dean's List
`;

  it('correctly extracts contact information', () => {
    const { parsedData } = ResumeParserService.parseResume(sampleResume);
    expect(parsedData.contactInfo.email).toBe('jane.doe@example.com');
    expect(parsedData.contactInfo.phone).toBe('(555) 123-4567');
    expect(parsedData.contactInfo.linkedin).toContain('linkedin.com/in/janedoe');
    expect(parsedData.contactInfo.github).toContain('github.com/janedoe');
  });

  it('detects technical skills and categorizes them', () => {
    const { parsedData } = ResumeParserService.parseResume(sampleResume);
    expect(parsedData.skills).toContain('TypeScript');
    expect(parsedData.skills).toContain('React');
    expect(parsedData.skills).toContain('Node.js');
    expect(parsedData.skills).toContain('PostgreSQL');
    expect(parsedData.skills).toContain('Docker');
    expect(parsedData.skills).toContain('AWS');
    expect(parsedData.categorizedSkills.languages).toContain('TypeScript');
    expect(parsedData.categorizedSkills.frameworks).toContain('React');
  });

  it('calculates ATS readiness score and checks', () => {
    const { atsAnalysis } = ResumeParserService.parseResume(sampleResume);
    expect(atsAnalysis.overallAtsScore).toBeGreaterThanOrEqual(60);
    expect(atsAnalysis.formattingChecks.length).toBeGreaterThan(0);
    expect(atsAnalysis.formattingChecks.find(c => c.rule === 'Contact Details')?.passed).toBe(true);
  });
});

describe('JobAnalyzerService', () => {
  const sampleJob = `
Senior Backend Engineer
Company: Acme Corp
Requirements:
• 5+ years of experience with Node.js, TypeScript, and PostgreSQL
• Strong background in AWS cloud infrastructure
Nice to Have:
• Experience with Kubernetes and Go
`;

  it('correctly classifies required vs preferred skills', () => {
    const parsed = JobAnalyzerService.analyzeJob(sampleJob, 'Senior Backend Engineer');
    expect(parsed.requiredSkills).toContain('TypeScript');
    expect(parsed.requiredSkills).toContain('Node.js');
    expect(parsed.requiredSkills).toContain('PostgreSQL');
    expect(parsed.preferredSkills).toContain('Kubernetes');
    expect(parsed.preferredSkills).toContain('Go');
    expect(parsed.minYearsExperience).toBe(5);
    expect(parsed.seniorityLevel).toBe('senior');
  });
});
