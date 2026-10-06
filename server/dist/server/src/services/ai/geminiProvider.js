"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiProvider = void 0;
const semanticEngine_1 = require("./semanticEngine");
const config_1 = require("../../config");
class GeminiProvider {
    name = 'Google Gemini';
    semanticFallback = new semanticEngine_1.SemanticEngine();
    isConfigured() {
        return Boolean(config_1.config.geminiApiKey && config_1.config.geminiApiKey.length > 5);
    }
    async generateOptimizedResume(candidateResumeText, parsedResume, jobDescriptionText, parsedJob, missingSkills) {
        if (!this.isConfigured()) {
            return this.semanticFallback.generateOptimizedResume(candidateResumeText, parsedResume, jobDescriptionText, parsedJob, missingSkills);
        }
        try {
            const prompt = `
You are an expert executive resume writer and ATS optimization specialist.
Target Job Description:
${jobDescriptionText.slice(0, 1500)}

Candidate Resume:
${candidateResumeText.slice(0, 2000)}

Missing or High-Priority Skills to weave in honestly:
${missingSkills.join(', ')}

Provide a JSON response strictly matching this format without any markdown wrapper:
{
  "tailoredSummary": "A compelling 3-4 sentence professional summary tailored to the target job title and requirements",
  "optimizedBullets": [
    {
      "experienceId": "${parsedResume.experience[0]?.id || 'exp-1'}",
      "company": "${parsedResume.experience[0]?.company || 'Tech Company'}",
      "originalBullet": "Original resume bullet point",
      "optimizedBullet": "Rewritten bullet using Google XYZ formula (Accomplished [X] measured by [Y] doing [Z]) with relevant keywords",
      "reason": "Why this change improves ATS match and recruiter appeal",
      "targetKeywordsAdded": ["Keyword1", "Keyword2"]
    }
  ],
  "suggestedSkillAdditions": [
    {
      "skill": "Skill name",
      "placement": "Suggested section",
      "rationale": "Why this should be highlighted"
    }
  ],
  "fullOptimizedText": "Complete clean text of the resume with new summary and optimized bullets"
}
`;
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config_1.config.geminiApiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { responseMimeType: 'application/json' }
                })
            });
            if (!response.ok) {
                throw new Error(`Gemini API returned status ${response.status}`);
            }
            const data = await response.json();
            const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!content)
                throw new Error('Empty response from Gemini');
            const parsed = JSON.parse(content);
            return {
                tailoredSummary: parsed.tailoredSummary || '',
                optimizedBullets: parsed.optimizedBullets || [],
                suggestedSkillAdditions: parsed.suggestedSkillAdditions || [],
                fullOptimizedText: parsed.fullOptimizedText || ''
            };
        }
        catch (err) {
            console.warn('[GeminiProvider] Falling back to SemanticEngine due to error:', err);
            return this.semanticFallback.generateOptimizedResume(candidateResumeText, parsedResume, jobDescriptionText, parsedJob, missingSkills);
        }
    }
    async generateCoverLetter(candidateResume, jobDescription, tone) {
        if (!this.isConfigured()) {
            return this.semanticFallback.generateCoverLetter(candidateResume, jobDescription, tone);
        }
        try {
            const prompt = `
You are an expert career consultant writing a tailored cover letter.
Candidate details:
Name: ${candidateResume.contactInfo.name}
Top Skills: ${candidateResume.skills.slice(0, 8).join(', ')}
Key Experience: ${JSON.stringify(candidateResume.experience.slice(0, 2))}

Target Job:
Role: ${jobDescription.title}
Company: ${jobDescription.company}
Description snippet: ${jobDescription.rawText.slice(0, 1500)}
Desired Tone: ${tone}

Return strict JSON:
{
  "recipient": "Hiring Team at ${jobDescription.company}",
  "opening": "Engaging opening paragraph introducing candidate and interest in ${jobDescription.company}",
  "bodyParagraphs": [
    "First body paragraph detailing concrete achievements matching job requirements",
    "Second body paragraph explaining company alignment, culture fit, and value addition"
  ],
  "closing": "Professional closing paragraph and call to action",
  "fullLetter": "Complete formatted cover letter string",
  "highlightedAchievements": ["Achievement 1", "Achievement 2"]
}
`;
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config_1.config.geminiApiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { responseMimeType: 'application/json' }
                })
            });
            if (!response.ok)
                throw new Error(`Gemini API error ${response.status}`);
            const data = await response.json();
            const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
            const parsed = JSON.parse(content);
            return {
                recipient: parsed.recipient || `Hiring Team at ${jobDescription.company}`,
                opening: parsed.opening || '',
                bodyParagraphs: parsed.bodyParagraphs || [],
                closing: parsed.closing || '',
                fullLetter: parsed.fullLetter || '',
                highlightedAchievements: parsed.highlightedAchievements || []
            };
        }
        catch (err) {
            console.warn('[GeminiProvider] Falling back to SemanticEngine for cover letter:', err);
            return this.semanticFallback.generateCoverLetter(candidateResume, jobDescription, tone);
        }
    }
}
exports.GeminiProvider = GeminiProvider;
