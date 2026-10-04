"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const uuid_1 = require("uuid");
const resumeParserService_1 = require("../src/services/resumeParserService");
const jobAnalyzerService_1 = require("../src/services/jobAnalyzerService");
const matchScorerService_1 = require("../src/services/matchScorerService");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🌱 Seeding database with production sample data...');
    const userId = 'user-default-1';
    // 1. Create or upsert user
    await prisma.user.upsert({
        where: { email: 'alex.rivera@example.com' },
        update: {},
        create: {
            id: userId,
            email: 'alex.rivera@example.com',
            name: 'Alex Rivera',
            plan: 'ENTERPRISE',
        }
    });
    // 2. Sample Resume
    const sampleResumeText = `ALEX RIVERA
alex.rivera@example.com | (415) 555-0198 | San Francisco, CA
https://linkedin.com/in/alexrivera-eng | https://github.com/alexrivera-dev

PROFESSIONAL SUMMARY
Senior Full-Stack Software Engineer with 6+ years of experience designing and scaling distributed systems, cloud microservices, and high-conversion web applications. Passionate about developer productivity, TypeScript ecosystems, resilient PostgreSQL architectures, and real-time APIs. Led engineering pods of 5+ developers to deliver 99.99% uptime services serving 2M+ active users.

CORE TECHNICAL SKILLS
Languages: TypeScript, JavaScript, Python, Go, SQL, HTML5, CSS3, Bash
Frameworks: React, Next.js, Node.js, Express.js, Tailwind CSS, GraphQL, REST API, Redux
Databases: PostgreSQL, Redis, MongoDB, Prisma ORM
Cloud & DevOps: AWS (EC2, S3, Lambda, ECS), Docker, Kubernetes, CI/CD, GitHub Actions, Linux
Tools & Practices: Git, Unit Testing, Jest, Vitest, Cypress, Microservices, Agile / Scrum, System Design

PROFESSIONAL EXPERIENCE
Senior Full-Stack Engineer | Veloce Systems | San Francisco, CA
03/2022 - Present
• Architected and shipped event-driven microservices processing 45M+ daily webhook events using Node.js, TypeScript, and AWS Lambda, reducing API latency by 38%.
• Led the frontend migration of customer dashboard to Next.js and Tailwind CSS, increasing Lighthouse performance score from 62 to 98 and cutting bundle size by 44%.
• Designed robust PostgreSQL schema migrations and Redis caching strategies, decreasing database CPU utilization during peak traffic by 55%.
• Mentored 4 junior and mid-level engineers, instituted automated CI/CD pipelines via GitHub Actions, and established test-driven development (TDD) resulting in 88% unit test coverage.

Software Engineer | CloudScale Labs | San Jose, CA
06/2019 - 02/2022
• Developed core customer onboarding workflow with React and Express.js, boosting user activation and signup conversion rates by 22%.
• Integrated multi-tenant billing architecture using Stripe API and webhooks, processing over $12M in annual recurring revenue.
• Spearheaded containerization of 14 backend services with Docker and orchestrated deployment onto AWS ECS clusters.
• Collaborated closely with product designers and backend engineers in bi-weekly Agile / Scrum sprints to deliver features on schedule.

EDUCATION
Bachelor of Science in Computer Science
University of California, Berkeley | 2015 - 2019
GPA: 3.82 | Dean's Honors List

CERTIFICATIONS & AWARDS
• AWS Certified Solutions Architect - Associate
• HackerRank Top 1% Problem Solving Certification`;
    const parsedResume = resumeParserService_1.ResumeParserService.parseResume(sampleResumeText);
    // Check if resume already exists
    let resume = await prisma.resume.findFirst({ where: { userId, title: 'Alex Rivera - Senior Full Stack Resume' } });
    if (!resume) {
        resume = await prisma.resume.create({
            data: {
                id: (0, uuid_1.v4)(),
                userId,
                title: 'Alex Rivera - Senior Full Stack Resume',
                fileName: 'Alex_Rivera_Senior_FullStack.pdf',
                fileType: 'application/pdf',
                fileSize: 104857,
                rawText: sampleResumeText,
                parsedData: JSON.stringify(parsedResume.parsedData),
                atsAnalysis: JSON.stringify(parsedResume.atsAnalysis)
            }
        });
        console.log('✓ Created sample resume:', resume.title);
    }
    // 3. Sample Jobs
    const job1Text = `Senior Full-Stack Engineer
Stripe - Financial Infrastructure
Location: San Francisco, CA (Hybrid / Remote)
Employment Type: Full-time | Salary: $165,000 - $210,000 + Equity

About the Role:
At Stripe, we are building economic infrastructure for the internet. As a Senior Full-Stack Engineer on our Core Platform team, you will design, build, and maintain mission-critical APIs and intuitive user interfaces that empower millions of businesses worldwide to accept payments and grow online.

Responsibilities:
• Architect, build, and maintain performant, fault-tolerant web applications and RESTful/GraphQL APIs.
• Collaborate closely with cross-functional teams including product managers, designers, and platform engineers.
• Write high-quality, observable, well-tested code using TypeScript, React, and Node.js.
• Optimize data stores and relational queries in PostgreSQL for maximum scale and resilience.
• Drive engineering excellence, participate in architectural design reviews, and mentor engineers.

Qualifications & Requirements:
• 5+ years of professional full-stack software development experience.
• Strong proficiency in TypeScript, JavaScript, React, and Node.js.
• Deep understanding of relational databases (PostgreSQL or MySQL) and query optimization.
• Solid background in building and scaling distributed cloud systems on AWS or GCP.
• Experience with automated testing, CI/CD, and Docker.
• Bachelor's degree in Computer Science, related technical field, or equivalent experience.

Nice to Have:
• Experience with Go, Kafka, or event-driven systems.
• Prior background in FinTech, payments, or high-security compliance environments.
• Familiarity with Kubernetes and Terraform.`;
    const parsedJob1 = jobAnalyzerService_1.JobAnalyzerService.analyzeJob(job1Text, 'Senior Full-Stack Engineer');
    let job1 = await prisma.jobDescription.findFirst({ where: { userId, title: 'Senior Full-Stack Engineer' } });
    if (!job1) {
        job1 = await prisma.jobDescription.create({
            data: {
                id: (0, uuid_1.v4)(),
                userId,
                title: 'Senior Full-Stack Engineer',
                company: 'Stripe',
                location: 'San Francisco, CA (Remote Friendly)',
                employmentType: 'Full-time',
                salaryRange: '$165,000 - $210,000',
                rawText: job1Text,
                parsedData: JSON.stringify(parsedJob1)
            }
        });
        console.log('✓ Created sample job 1:', job1.title, 'at', job1.company);
    }
    const job2Text = `Staff / Lead AI Platform Engineer
Anthropic - Infrastructure & Model Deployment
Location: San Francisco, CA | Full-time | Salary: $220,000 - $290,000

About Anthropic:
Anthropic is an AI safety and research company dedicated to building reliable, beneficial, and interpretable AI systems.

What you will do:
• Build high-throughput low-latency inference serving infrastructure for frontier LLM models.
• Architect robust distributed data streaming pipelines with Python, Go, Kubernetes, and Kafka.
• Implement scalable model evaluation systems and monitoring using Prometheus and Grafana.
• Scale GPU orchestration and cloud infrastructure across multi-region AWS and GCP deployments.

Requirements:
• 7+ years of software engineering experience with distributed systems and platform infrastructure.
• High proficiency in Python, Go, Kubernetes, Docker, and Linux systems.
• Proven track record operating mission-critical distributed databases and messaging queues.
• Strong system design and cross-functional leadership capabilities.

Preferred:
• PyTorch or TensorFlow model inference deployment experience.
• Familiarity with Rust, CUDA, and high-performance networking.`;
    const parsedJob2 = jobAnalyzerService_1.JobAnalyzerService.analyzeJob(job2Text, 'Lead AI Platform Engineer');
    let job2 = await prisma.jobDescription.findFirst({ where: { userId, title: 'Lead AI Platform Engineer' } });
    if (!job2) {
        job2 = await prisma.jobDescription.create({
            data: {
                id: (0, uuid_1.v4)(),
                userId,
                title: 'Lead AI Platform Engineer',
                company: 'Anthropic',
                location: 'San Francisco, CA',
                employmentType: 'Full-time',
                salaryRange: '$220,000 - $290,000',
                rawText: job2Text,
                parsedData: JSON.stringify(parsedJob2)
            }
        });
        console.log('✓ Created sample job 2:', job2.title, 'at', job2.company);
    }
    // 4. Sample Match Analysis
    const match1 = matchScorerService_1.MatchScorerService.calculateMatch(resume.id, job1.id, { parsedData: JSON.parse(resume.parsedData), atsAnalysis: JSON.parse(resume.atsAnalysis), rawText: resume.rawText }, { parsedData: parsedJob1, rawText: job1Text });
    let matchRecord = await prisma.matchAnalysis.findFirst({ where: { resumeId: resume.id, jobId: job1.id } });
    if (!matchRecord) {
        matchRecord = await prisma.matchAnalysis.create({
            data: {
                id: match1.id,
                resumeId: resume.id,
                jobId: job1.id,
                overallScore: match1.overallScore,
                scoreBreakdown: JSON.stringify(match1.scoreBreakdown),
                skillMatrix: JSON.stringify(match1.skillMatrix),
                experienceComparison: JSON.stringify(match1.experienceComparison),
                strengths: JSON.stringify(match1.strengths),
                gaps: JSON.stringify(match1.gaps),
                actionableAdvice: JSON.stringify(match1.actionableAdvice)
            }
        });
        console.log(`✓ Calculated Match Analysis: ${match1.overallScore}% score`);
    }
    // 5. Sample Applications CRM
    const existingApps = await prisma.application.findMany({ where: { userId } });
    if (existingApps.length === 0) {
        await prisma.application.create({
            data: {
                id: (0, uuid_1.v4)(),
                userId,
                company: 'Stripe',
                position: 'Senior Full-Stack Engineer',
                location: 'San Francisco, CA',
                salary: '$185,000',
                status: 'interviewing',
                appliedDate: '2026-09-28',
                matchScore: match1.overallScore,
                notes: 'Technical screen passed with flying colors. Architecture round scheduled next Wednesday.',
                nextActionDate: '2026-10-08',
                resumeId: resume.id,
                jobId: job1.id,
                timeline: JSON.stringify([
                    { date: '2026-09-28', stage: 'applied', note: 'Applied via referral with tailored resume.' },
                    { date: '2026-10-01', stage: 'screening', note: 'Recruiter phone screen completed.' },
                    { date: '2026-10-03', stage: 'interviewing', note: 'System design interview invitation received.' }
                ])
            }
        });
        await prisma.application.create({
            data: {
                id: (0, uuid_1.v4)(),
                userId,
                company: 'Vercel',
                position: 'Senior Frontend Platform Engineer',
                location: 'Remote',
                salary: '$190,000',
                status: 'offer',
                appliedDate: '2026-09-15',
                matchScore: 92,
                notes: 'Formal offer received: $190k base + $80k equity/yr. Reviewing benefits and bonus terms.',
                nextActionDate: '2026-10-10',
                resumeId: resume.id,
                timeline: JSON.stringify([
                    { date: '2026-09-15', stage: 'applied', note: 'Applied online.' },
                    { date: '2026-09-22', stage: 'screening', note: 'Screening passed.' },
                    { date: '2026-09-29', stage: 'interviewing', note: 'Completed 4-part virtual on-site.' },
                    { date: '2026-10-03', stage: 'offer', note: 'Offer package received!' }
                ])
            }
        });
        await prisma.application.create({
            data: {
                id: (0, uuid_1.v4)(),
                userId,
                company: 'Anthropic',
                position: 'Lead AI Platform Engineer',
                location: 'San Francisco, CA',
                salary: '$240,000',
                status: 'applied',
                appliedDate: '2026-10-02',
                matchScore: 78,
                notes: 'Submitted application along with tailored cover letter highlighting Go & Kubernetes experience.',
                resumeId: resume.id,
                jobId: job2.id,
                timeline: JSON.stringify([
                    { date: '2026-10-02', stage: 'applied', note: 'Submitted application with AI tailored cover letter.' }
                ])
            }
        });
        console.log('✓ Seeded sample CRM applications');
    }
    // 6. Activity log
    await prisma.activityLog.create({
        data: {
            id: (0, uuid_1.v4)(),
            userId,
            type: 'match_calculated',
            title: 'Matched Alex Rivera Resume with Stripe Senior Full-Stack role (91% score)'
        }
    });
    console.log('🎉 Seed completed successfully!');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
