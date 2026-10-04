"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uuid_1 = require("uuid");
const zod_1 = require("zod");
const jobAnalyzerService_1 = require("../services/jobAnalyzerService");
const db_1 = require("../db");
const config_1 = require("../config");
const validate_1 = require("../middleware/validate");
const router = (0, express_1.Router)();
const createJobSchema = zod_1.z.object({
    title: zod_1.z.string().min(2, 'Job title is required'),
    company: zod_1.z.string().min(1, 'Company name is required'),
    location: zod_1.z.string().optional().default('Remote'),
    employmentType: zod_1.z.string().optional().default('Full-time'),
    salaryRange: zod_1.z.string().optional(),
    rawText: zod_1.z.string().min(30, 'Job description must be at least 30 characters')
});
// Create and analyze new job description
router.post('/', (0, validate_1.validateBody)(createJobSchema), async (req, res, next) => {
    try {
        const { title, company, location, employmentType, salaryRange, rawText } = req.body;
        const parsedData = jobAnalyzerService_1.JobAnalyzerService.analyzeJob(rawText, title);
        const job = await db_1.prisma.jobDescription.create({
            data: {
                id: (0, uuid_1.v4)(),
                userId: config_1.config.defaultUserId,
                title,
                company,
                location,
                employmentType,
                salaryRange,
                rawText,
                parsedData: JSON.stringify(parsedData)
            }
        });
        await db_1.prisma.activityLog.create({
            data: {
                id: (0, uuid_1.v4)(),
                userId: config_1.config.defaultUserId,
                type: 'job_analyzed',
                title: `Analyzed job posting: ${title} at ${company}`
            }
        });
        res.status(201).json({
            success: true,
            data: {
                id: job.id,
                userId: job.userId,
                title: job.title,
                company: job.company,
                location: job.location,
                employmentType: job.employmentType,
                salaryRange: job.salaryRange || undefined,
                rawText: job.rawText,
                parsedData,
                createdAt: job.createdAt.toISOString()
            }
        });
    }
    catch (error) {
        next(error);
    }
});
// List all job descriptions
router.get('/', async (req, res, next) => {
    try {
        const jobs = await db_1.prisma.jobDescription.findMany({
            where: { userId: config_1.config.defaultUserId },
            orderBy: { createdAt: 'desc' }
        });
        const formatted = jobs.map(j => ({
            id: j.id,
            userId: j.userId,
            title: j.title,
            company: j.company,
            location: j.location,
            employmentType: j.employmentType,
            salaryRange: j.salaryRange || undefined,
            rawText: j.rawText,
            parsedData: JSON.parse(j.parsedData),
            createdAt: j.createdAt.toISOString()
        }));
        res.json({ success: true, data: formatted });
    }
    catch (error) {
        next(error);
    }
});
// Get single job description
router.get('/:id', async (req, res, next) => {
    try {
        const job = await db_1.prisma.jobDescription.findUnique({
            where: { id: req.params.id }
        });
        if (!job) {
            return res.status(404).json({ success: false, error: { message: 'Job not found' } });
        }
        res.json({
            success: true,
            data: {
                id: job.id,
                userId: job.userId,
                title: job.title,
                company: job.company,
                location: job.location,
                employmentType: job.employmentType,
                salaryRange: job.salaryRange || undefined,
                rawText: job.rawText,
                parsedData: JSON.parse(job.parsedData),
                createdAt: job.createdAt.toISOString()
            }
        });
    }
    catch (error) {
        next(error);
    }
});
// Delete job description
router.delete('/:id', async (req, res, next) => {
    try {
        await db_1.prisma.jobDescription.delete({
            where: { id: req.params.id }
        });
        res.json({ success: true, message: 'Job description deleted successfully' });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
