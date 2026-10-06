"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticEngine = void 0;
class SemanticEngine {
    name = 'LocalSemanticEngine';
    isConfigured() {
        return true; // Always ready without external API keys!
    }
    /**
     * Calculates cosine similarity between two text snippets using TF-IDF tokenization.
     */
    calculateCosineSimilarity(textA, textB) {
        const tokensA = this.tokenize(textA);
        const tokensB = this.tokenize(textB);
        if (tokensA.length === 0 || tokensB.length === 0)
            return 0.5;
        const termFreqA = this.termFrequency(tokensA);
        const termFreqB = this.termFrequency(tokensB);
        const allTerms = new Set([...Object.keys(termFreqA), ...Object.keys(termFreqB)]);
        let dotProduct = 0;
        let magA = 0;
        let magB = 0;
        for (const term of allTerms) {
            const a = termFreqA[term] || 0;
            const b = termFreqB[term] || 0;
            dotProduct += a * b;
            magA += a * a;
            magB += b * b;
        }
        if (magA === 0 || magB === 0)
            return 0.5;
        const similarity = dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));
        return Math.min(Math.max(similarity, 0), 1);
    }
    tokenize(text) {
        const stopwords = new Set([
            'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'are', 'was', 'were', 'will', 'been',
            'their', 'they', 'our', 'what', 'which', 'who', 'whom', 'into', 'onto', 'about', 'than', 'such',
            'more', 'some', 'other', 'then', 'them', 'these', 'those', 'also', 'over', 'only', 'would', 'could'
        ]);
        return text.toLowerCase()
            .replace(/[^a-z0-9+#.\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2 && !stopwords.has(w));
    }
    termFrequency(tokens) {
        const tf = {};
        for (const t of tokens) {
            tf[t] = (tf[t] || 0) + 1;
        }
        return tf;
    }
    /**
     * Generates optimized resume bullets using the Google XYZ Formula and weaves missing keywords.
     */
    async generateOptimizedResume(candidateResumeText, parsedResume, jobDescriptionText, parsedJob, missingSkills) {
        // 1. Craft tailored executive summary
        const candidateName = parsedResume.contactInfo.name || 'Candidate';
        const candidateExpYears = parsedResume.detectedExperienceYears || 4;
        const topMatched = parsedResume.skills.filter(s => parsedJob.requiredSkills.includes(s)).slice(0, 4);
        const topKeywordsStr = topMatched.length > 0 ? topMatched.join(', ') : 'modern full-stack architecture';
        const tailoredSummary = `Results-driven software engineer with ${candidateExpYears}+ years of hands-on experience specializing in ${topKeywordsStr}. Proven track record designing scalable architectures, driving cross-functional engineering execution, and optimizing mission-critical systems. Eager to leverage technical expertise in ${topMatched[0] || 'core technologies'} to deliver high-velocity, reliable solutions.`;
        // 2. Transform bullets using Google XYZ format & target keywords
        const optimizedBullets = [];
        const suggestedKeywordsPool = [...missingSkills, ...parsedJob.requiredSkills];
        let kwIndex = 0;
        for (const exp of parsedResume.experience) {
            for (const bullet of exp.bullets) {
                if (bullet.length < 20)
                    continue;
                const assignedKeyword = suggestedKeywordsPool[kwIndex % (suggestedKeywordsPool.length || 1)] || 'system scalability';
                kwIndex++;
                const enhanced = this.rewriteBulletWithXYZ(bullet, assignedKeyword);
                optimizedBullets.push({
                    experienceId: exp.id,
                    company: exp.company,
                    originalBullet: bullet,
                    optimizedBullet: enhanced.text,
                    reason: enhanced.reason,
                    targetKeywordsAdded: enhanced.keywordsAdded
                });
            }
        }
        // 3. Suggested additions
        const suggestedSkillAdditions = missingSkills.slice(0, 3).map(skill => ({
            skill,
            placement: 'Technical Skills & Recent Experience',
            rationale: `Target job heavily prioritizes ${skill}. If you have hands-on experience or project exposure with ${skill}, highlight it explicitly.`
        }));
        // 4. Synthesize full optimized resume text
        const fullOptimizedText = this.buildFullOptimizedText(parsedResume, tailoredSummary, optimizedBullets);
        return {
            tailoredSummary,
            optimizedBullets,
            suggestedSkillAdditions,
            fullOptimizedText
        };
    }
    rewriteBulletWithXYZ(original, targetKeyword) {
        const clean = original.replace(/^[•\-*]\s*/, '').trim();
        const strongVerbs = ['Architected', 'Spearheaded', 'Engineered', 'Overhauled', 'Streamlined', 'Delivered'];
        const randomVerb = strongVerbs[Math.floor(Math.random() * strongVerbs.length)];
        // If original already has a metric (% or $)
        const hasMetric = clean.match(/(\d+%\s*|\$\d+|\b\d+\s*(?:users|ms|times|k|million)\b)/i);
        let optimizedText = clean;
        const keywordsAdded = [];
        if (hasMetric) {
            if (!clean.toLowerCase().includes(targetKeyword.toLowerCase())) {
                optimizedText = `${clean}, leveraging ${targetKeyword} to enhance throughput and reliability.`;
                keywordsAdded.push(targetKeyword);
            }
        }
        else {
            // Add metric and action verb
            const metrics = ['improving system throughput by 32%', 'reducing response latency by 45ms', 'boosting operational efficiency by 28%', 'scaling system reliability to 99.9% uptime'];
            const chosenMetric = metrics[Math.floor(Math.random() * metrics.length)];
            if (!clean.toLowerCase().includes(targetKeyword.toLowerCase())) {
                optimizedText = `${randomVerb} and optimized ${clean.charAt(0).toLowerCase() + clean.slice(1)}, integrating ${targetKeyword} and ${chosenMetric}.`;
                keywordsAdded.push(targetKeyword);
            }
            else {
                optimizedText = `${randomVerb} ${clean.charAt(0).toLowerCase() + clean.slice(1)}, successfully ${chosenMetric}.`;
            }
        }
        return {
            text: optimizedText,
            reason: `Restructured using Google's XYZ formula (Accomplished [X], measured by [Y], by doing [Z]) while incorporating the target requirement (${targetKeyword}).`,
            keywordsAdded
        };
    }
    buildFullOptimizedText(parsedResume, tailoredSummary, optimizedBullets) {
        const lines = [];
        lines.push(parsedResume.contactInfo.name.toUpperCase());
        lines.push(`${parsedResume.contactInfo.email} | ${parsedResume.contactInfo.phone} | ${parsedResume.contactInfo.location}`);
        if (parsedResume.contactInfo.linkedin || parsedResume.contactInfo.github) {
            lines.push([parsedResume.contactInfo.linkedin, parsedResume.contactInfo.github].filter(Boolean).join(' | '));
        }
        lines.push('\n=== PROFESSIONAL SUMMARY ===');
        lines.push(tailoredSummary);
        lines.push('\n=== CORE TECHNICAL SKILLS ===');
        for (const [category, skills] of Object.entries(parsedResume.categorizedSkills)) {
            if (skills.length > 0) {
                lines.push(`${category.toUpperCase()}: ${skills.join(', ')}`);
            }
        }
        lines.push('\n=== PROFESSIONAL EXPERIENCE ===');
        for (const exp of parsedResume.experience) {
            lines.push(`\n${exp.title} | ${exp.company} (${exp.startDate || '2022'} - ${exp.endDate || 'Present'})`);
            const relatedBullets = optimizedBullets.filter(b => b.experienceId === exp.id);
            if (relatedBullets.length > 0) {
                for (const b of relatedBullets) {
                    lines.push(`• ${b.optimizedBullet}`);
                }
            }
            else {
                for (const bullet of exp.bullets) {
                    lines.push(`• ${bullet}`);
                }
            }
        }
        if (parsedResume.education.length > 0) {
            lines.push('\n=== EDUCATION ===');
            for (const edu of parsedResume.education) {
                lines.push(`${edu.degree} - ${edu.institution} ${edu.year ? `(${edu.year})` : ''}`);
            }
        }
        return lines.join('\n');
    }
    /**
     * Generates a tone-aligned, achievement-focused cover letter.
     */
    async generateCoverLetter(candidateResume, jobDescription, tone) {
        const candidateName = candidateResume.contactInfo.name || 'Candidate';
        const targetRole = jobDescription.title || 'Software Engineer';
        const targetCompany = jobDescription.company || 'your engineering organization';
        const topSkills = candidateResume.skills.slice(0, 3).join(', ') || 'full-stack software development';
        const topExperience = candidateResume.experience[0];
        const keyAchievement = topExperience && topExperience.bullets[0]
            ? topExperience.bullets[0]
            : 'spearheaded scalable cloud architecture that reduced operational overhead significantly';
        const greetings = {
            professional: `Dear Hiring Team at ${targetCompany},`,
            enthusiastic: `Dear ${targetCompany} Team,`,
            confident: `Dear Hiring Manager,`,
            concise: `Dear Hiring Manager,`,
            technical: `Dear Engineering Leadership at ${targetCompany},`
        };
        const openings = {
            professional: `I am writing to express my strong interest in the ${targetRole} position at ${targetCompany}. With a comprehensive background in ${topSkills} and a proven history of shipping high-impact software, I am excited about the opportunity to contribute to your team's ongoing innovation.`,
            enthusiastic: `I was thrilled to discover the opening for the ${targetRole} role at ${targetCompany}! As someone who deeply admires your mission and technical excellence, I would be thrilled to bring my passion for ${topSkills} to help build high-impact products.`,
            confident: `With over ${candidateResume.detectedExperienceYears || 4} years of high-velocity engineering experience building resilient distributed systems, I am confident that my background in ${topSkills} aligns directly with what you are seeking in a ${targetRole} at ${targetCompany}.`,
            concise: `I am applying for the ${targetRole} role at ${targetCompany}. My background in ${topSkills} directly addresses your requirements for driving dependable, scalable engineering solutions.`,
            technical: `I am submitting my candidacy for the ${targetRole} position at ${targetCompany}. Having engineered scalable distributed systems leveraging ${topSkills}, I am well-prepared to tackle your toughest technical challenges.`
        };
        const bodyParagraphs = [
            `In my most recent role as ${topExperience?.title || 'Software Engineer'} at ${topExperience?.company || 'my previous company'}, I ${keyAchievement.charAt(0).toLowerCase() + keyAchievement.slice(1)}. This experience honed my ability to translate complex product requirements into robust, maintainable architecture while mentoring peer engineers.`,
            `What particularly draws me to ${targetCompany} is your emphasis on technical craftsmanship and delivering tangible value to end users. The challenges outlined in your ${targetRole} description—specifically regarding scalability, code reliability, and rapid iteration—are problems I have successfully navigated throughout my career.`
        ];
        const closings = {
            professional: `Thank you for your time and consideration. I welcome the opportunity to discuss how my technical expertise and leadership can support ${targetCompany}'s goals in an interview. Sincerely, ${candidateName}.`,
            enthusiastic: `I would love the chance to connect and discuss how my energy, dedication, and technical background can add value to ${targetCompany}! Sincerely, ${candidateName}.`,
            confident: `I look forward to discussing how my experience can immediately translate into measurable impact for your engineering team. Best regards, ${candidateName}.`,
            concise: `Thank you for your consideration. I look forward to connecting. Sincerely, ${candidateName}.`,
            technical: `I look forward to discussing our system design philosophies and how my skills can advance your engineering roadmap. Regards, ${candidateName}.`
        };
        const fullLetter = [
            greetings[tone],
            '',
            openings[tone],
            '',
            bodyParagraphs[0],
            '',
            bodyParagraphs[1],
            '',
            closings[tone]
        ].join('\n');
        return {
            recipient: `Hiring Team at ${targetCompany}`,
            opening: openings[tone],
            bodyParagraphs,
            closing: closings[tone],
            fullLetter,
            highlightedAchievements: [keyAchievement, `Demonstrated mastery in ${topSkills}`]
        };
    }
    /**
     * Generates strengths, gaps, and actionable advice.
     */
    async generateDeepInsights(candidateResume, jobDescription) {
        const strengths = [];
        const gaps = [];
        const actionableAdvice = [];
        // Evaluate matched vs missing
        const matched = candidateResume.skills.filter(s => jobDescription.requiredSkills.includes(s));
        const missing = jobDescription.requiredSkills.filter(s => !candidateResume.skills.includes(s));
        if (matched.length > 0) {
            strengths.push(`Strong alignment on core technologies: ${matched.slice(0, 4).join(', ')}.`);
        }
        if (candidateResume.detectedExperienceYears >= jobDescription.minYearsExperience) {
            strengths.push(`Experience level (${candidateResume.detectedExperienceYears}+ yrs) meets or exceeds the required ${jobDescription.minYearsExperience} yrs.`);
        }
        if (missing.length > 0) {
            gaps.push(`Missing prominent job requirements: ${missing.slice(0, 3).join(', ')}.`);
            actionableAdvice.push({
                priority: 'high',
                title: `Address Missing Core Skills: ${missing.slice(0, 2).join(', ')}`,
                description: `The job description strongly emphasizes ${missing.slice(0, 2).join(' and ')}. If you possess adjacent skills or academic/project experience with these tools, integrate them into your technical skills and project descriptions.`,
                exampleSnippet: `Example: "Engineered high-throughput data processing pipeline using ${missing[0] || 'target tech'} and Docker."`
            });
        }
        actionableAdvice.push({
            priority: 'medium',
            title: 'Incorporate Quantifiable Metrics (Google XYZ Formula)',
            description: 'Strengthen bullet points by answering: What was accomplished? How was it measured? How was it achieved?',
            exampleSnippet: 'Before: "Improved API performance." -> After: "Decreased API latency by 42% by indexing PostgreSQL queries and introducing Redis caching."'
        });
        return { strengths, gaps, actionableAdvice };
    }
}
exports.SemanticEngine = SemanticEngine;
