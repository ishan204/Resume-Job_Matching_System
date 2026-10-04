"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const matchScorerService_1 = require("../services/matchScorerService");
const db_1 = require("../db");
const config_1 = require("../config");
const validate_1 = require("../middleware/validate");
const router = (0, express_1.Router)();
const matchRequestSchema = zod_1.z.object({
    resumeId: zod_1.z.string().uuid('Invalid resumeId'),
    jobId: zod_1.z.string().uuid('Invalid jobId')
});
// Calculate and save match analysis
router.post('/', (0, validate_1.validateBody)(matchRequestSchema), async (req, res, next) => {
    try {
        const { resumeId, jobId } = req.body;
        const resume = await db_1.prisma.resume.findUnique({ where: { id: resumeId } });
        if (!resume) {
            return res.status(404).json({ success: false, error: { message: 'Resume not found' } });
        }
        const job = await db_1.prisma.jobDescription.findUnique({ where: { id: jobId } });
        if (!job) {
            return res.status(404).json({ success: false, error: { message: 'Job not found' } });
        }
        const parsedResume = JSON.parse(resume.parsedData);
        const atsAnalysis = JSON.parse(resume.atsAnalysis);
        const parsedJob = JSON.parse(job.parsedData);
        const analysis = matchScorerService_1.MatchScorerService.calculateMatch(resumeId, jobId, { parsedData: parsedResume, atsAnalysis, rawText: resume.rawText }, { parsedData: parsedJob, rawText: job.rawText });
        // Save to DB
        const saved = await db_1.prisma.matchAnalysis.create({
            data: {
                id: analysis.id,
                resumeId,
                jobId,
                overallScore: analysis.overallScore,
                scoreBreakdown: JSON.stringify(analysis.scoreBreakdown),
                skillMatrix: JSON.stringify(analysis.skillMatrix),
                experienceComparison: JSON.stringify(analysis.experienceComparison),
                strengths: JSON.stringify(analysis.strengths),
                gaps: JSON.stringify(analysis.gaps),
                actionableAdvice: JSON.stringify(analysis.actionableAdvice)
            }
        });
        await db_1.prisma.activityLog.create({
            data: {
                id: analysis.id,
                userId: config_1.config.defaultUserId,
                type: 'match_calculated',
                title: `Matched "${resume.title}" with "${job.title} at ${job.company}" (${analysis.overallScore}% score)`
            }
        });
        res.status(201).json({
            success: true,
            data: analysis
        });
    }
    catch (error) {
        next(error);
    }
});
// Get match analysis by ID
router.get('/:id', async (req, res, next) => {
    try {
        const saved = await db_1.prisma.matchAnalysis.findUnique({
            where: { id: req.params.id },
            include: {
                resume: { select: { title: true, fileName: true } },
                job: { select: { title: true, company: true } }
            }
        });
        if (!saved) {
            return res.status(404).json({ success: false, error: { message: 'Match analysis not found' } });
        }
        const analysis = {
            id: saved.id,
            resumeId: saved.resumeId,
            jobId: saved.jobId,
            overallScore: saved.overallScore,
            scoreBreakdown: JSON.parse(saved.scoreBreakdown),
            skillMatrix: JSON.parse(saved.skillMatrix),
            experienceComparison: JSON.parse(saved.experienceComparison),
            strengths: JSON.parse(saved.strengths),
            gaps: JSON.parse(saved.gaps),
            actionableAdvice: JSON.parse(saved.actionableAdvice),
            createdAt: saved.createdAt.toISOString(),
            resumeTitle: saved.resume.title,
            jobTitle: saved.job.title,
            company: saved.job.company
        };
        res.json({ success: true, data: analysis });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
