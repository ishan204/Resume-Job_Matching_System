"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OptimizerService = void 0;
const uuid_1 = require("uuid");
const db_1 = require("../db");
const aiFactory_1 = require("./ai/aiFactory");
class OptimizerService {
    static async optimizeResume(matchAnalysisId, resumeId, targetJobId) {
        const resume = await db_1.prisma.resume.findUnique({ where: { id: resumeId } });
        if (!resume)
            throw new Error('Resume not found');
        const job = await db_1.prisma.jobDescription.findUnique({ where: { id: targetJobId } });
        if (!job)
            throw new Error('Job description not found');
        const matchAnalysis = await db_1.prisma.matchAnalysis.findUnique({ where: { id: matchAnalysisId } });
        if (!matchAnalysis)
            throw new Error('Match analysis not found');
        const parsedResume = JSON.parse(resume.parsedData);
        const parsedJob = JSON.parse(job.parsedData);
        const skillMatrix = JSON.parse(matchAnalysis.skillMatrix);
        const missingSkills = skillMatrix.missingRequiredSkills.map((s) => s.skill);
        const aiProvider = aiFactory_1.AIFactory.getProvider();
        const result = await aiProvider.generateOptimizedResume(resume.rawText, parsedResume, job.rawText, parsedJob, missingSkills);
        // Save to database
        const saved = await db_1.prisma.optimizedResume.create({
            data: {
                id: (0, uuid_1.v4)(),
                matchAnalysisId,
                resumeId,
                targetJobId,
                tailoredSummary: result.tailoredSummary,
                optimizedBullets: JSON.stringify(result.optimizedBullets),
                suggestedSkillAdditions: JSON.stringify(result.suggestedSkillAdditions),
                fullOptimizedText: result.fullOptimizedText,
            }
        });
        return {
            id: saved.id,
            matchAnalysisId: saved.matchAnalysisId,
            resumeId: saved.resumeId,
            targetJobId: saved.targetJobId,
            tailoredSummary: saved.tailoredSummary,
            optimizedBullets: JSON.parse(saved.optimizedBullets),
            suggestedSkillAdditions: JSON.parse(saved.suggestedSkillAdditions),
            fullOptimizedText: saved.fullOptimizedText,
            createdAt: saved.createdAt.toISOString()
        };
    }
    static async getOptimizedResume(id) {
        const record = await db_1.prisma.optimizedResume.findUnique({ where: { id } });
        if (!record)
            return null;
        return {
            id: record.id,
            matchAnalysisId: record.matchAnalysisId,
            resumeId: record.resumeId,
            targetJobId: record.targetJobId,
            tailoredSummary: record.tailoredSummary,
            optimizedBullets: JSON.parse(record.optimizedBullets),
            suggestedSkillAdditions: JSON.parse(record.suggestedSkillAdditions),
            fullOptimizedText: record.fullOptimizedText,
            createdAt: record.createdAt.toISOString()
        };
    }
}
exports.OptimizerService = OptimizerService;
