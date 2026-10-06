"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoverLetterService = void 0;
const uuid_1 = require("uuid");
const db_1 = require("../db");
const aiFactory_1 = require("./ai/aiFactory");
class CoverLetterService {
    static async generateCoverLetter(resumeId, jobId, tone = 'professional') {
        const resume = await db_1.prisma.resume.findUnique({ where: { id: resumeId } });
        if (!resume)
            throw new Error('Resume not found');
        const job = await db_1.prisma.jobDescription.findUnique({ where: { id: jobId } });
        if (!job)
            throw new Error('Job description not found');
        const parsedResume = JSON.parse(resume.parsedData);
        const parsedJob = JSON.parse(job.parsedData);
        const aiProvider = aiFactory_1.AIFactory.getProvider();
        const result = await aiProvider.generateCoverLetter(parsedResume, {
            title: job.title,
            company: job.company,
            rawText: job.rawText,
            parsedData: parsedJob
        }, tone);
        const saved = await db_1.prisma.coverLetter.create({
            data: {
                id: (0, uuid_1.v4)(),
                resumeId,
                jobId,
                company: job.company,
                role: job.title,
                tone,
                recipient: result.recipient,
                opening: result.opening,
                bodyParagraphs: JSON.stringify(result.bodyParagraphs),
                closing: result.closing,
                fullLetter: result.fullLetter,
                highlightedAchievements: JSON.stringify(result.highlightedAchievements),
            }
        });
        return {
            id: saved.id,
            resumeId: saved.resumeId,
            jobId: saved.jobId,
            company: saved.company,
            role: saved.role,
            tone: saved.tone,
            recipient: saved.recipient,
            opening: saved.opening,
            bodyParagraphs: JSON.parse(saved.bodyParagraphs),
            closing: saved.closing,
            fullLetter: saved.fullLetter,
            highlightedAchievements: JSON.parse(saved.highlightedAchievements),
            createdAt: saved.createdAt.toISOString()
        };
    }
    static async getCoverLetter(id) {
        const record = await db_1.prisma.coverLetter.findUnique({ where: { id } });
        if (!record)
            return null;
        return {
            id: record.id,
            resumeId: record.resumeId,
            jobId: record.jobId,
            company: record.company,
            role: record.role,
            tone: record.tone,
            recipient: record.recipient,
            opening: record.opening,
            bodyParagraphs: JSON.parse(record.bodyParagraphs),
            closing: record.closing,
            fullLetter: record.fullLetter,
            highlightedAchievements: JSON.parse(record.highlightedAchievements),
            createdAt: record.createdAt.toISOString()
        };
    }
    static async updateCoverLetter(id, fullLetter) {
        const updated = await db_1.prisma.coverLetter.update({
            where: { id },
            data: { fullLetter }
        });
        return {
            id: updated.id,
            resumeId: updated.resumeId,
            jobId: updated.jobId,
            company: updated.company,
            role: updated.role,
            tone: updated.tone,
            recipient: updated.recipient,
            opening: updated.opening,
            bodyParagraphs: JSON.parse(updated.bodyParagraphs),
            closing: updated.closing,
            fullLetter: updated.fullLetter,
            highlightedAchievements: JSON.parse(updated.highlightedAchievements),
            createdAt: updated.createdAt.toISOString()
        };
    }
}
exports.CoverLetterService = CoverLetterService;
