"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uuid_1 = require("uuid");
const upload_1 = require("../middleware/upload");
const fileParserService_1 = require("../services/fileParserService");
const resumeParserService_1 = require("../services/resumeParserService");
const db_1 = require("../db");
const config_1 = require("../config");
const router = (0, express_1.Router)();
// Upload resume file (PDF, DOCX, TXT)
router.post('/upload', upload_1.upload.single('resume'), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: { message: 'No file uploaded' } });
        }
        const { path: filePath, originalname, mimetype, size } = req.file;
        // Extract text
        const rawText = await fileParserService_1.FileParserService.extractTextFromFile(filePath, mimetype, originalname);
        if (!rawText || rawText.length < 30) {
            return res.status(400).json({
                success: false,
                error: { message: 'Failed to extract text from file. Please ensure the document is not an image or password protected.' }
            });
        }
        // Parse structured data and ATS
        const { parsedData, atsAnalysis } = resumeParserService_1.ResumeParserService.parseResume(rawText);
        // Save to DB
        const resume = await db_1.prisma.resume.create({
            data: {
                id: (0, uuid_1.v4)(),
                userId: config_1.config.defaultUserId,
                title: req.body.title || originalname.replace(/\.[^/.]+$/, ''),
                fileName: originalname,
                fileType: mimetype,
                fileSize: size,
                rawText,
                parsedData: JSON.stringify(parsedData),
                atsAnalysis: JSON.stringify(atsAnalysis)
            }
        });
        // Record activity
        await db_1.prisma.activityLog.create({
            data: {
                id: (0, uuid_1.v4)(),
                userId: config_1.config.defaultUserId,
                type: 'resume_upload',
                title: `Uploaded resume "${resume.title}"`
            }
        });
        res.status(201).json({
            success: true,
            data: {
                id: resume.id,
                userId: resume.userId,
                title: resume.title,
                fileName: resume.fileName,
                fileType: resume.fileType,
                fileSize: resume.fileSize,
                rawText: resume.rawText,
                parsedData,
                atsAnalysis,
                createdAt: resume.createdAt.toISOString(),
                updatedAt: resume.updatedAt.toISOString()
            }
        });
    }
    catch (error) {
        next(error);
    }
});
// Create resume from raw text
router.post('/text', async (req, res, next) => {
    try {
        const { title, text } = req.body;
        if (!text || text.trim().length < 30) {
            return res.status(400).json({
                success: false,
                error: { message: 'Resume text must be at least 30 characters long' }
            });
        }
        const { parsedData, atsAnalysis } = resumeParserService_1.ResumeParserService.parseResume(text);
        const resume = await db_1.prisma.resume.create({
            data: {
                id: (0, uuid_1.v4)(),
                userId: config_1.config.defaultUserId,
                title: title || 'Pasted Resume',
                fileName: 'resume.txt',
                fileType: 'text/plain',
                fileSize: Buffer.byteLength(text, 'utf8'),
                rawText: text,
                parsedData: JSON.stringify(parsedData),
                atsAnalysis: JSON.stringify(atsAnalysis)
            }
        });
        await db_1.prisma.activityLog.create({
            data: {
                id: (0, uuid_1.v4)(),
                userId: config_1.config.defaultUserId,
                type: 'resume_upload',
                title: `Created resume "${resume.title}"`
            }
        });
        res.status(201).json({
            success: true,
            data: {
                id: resume.id,
                userId: resume.userId,
                title: resume.title,
                fileName: resume.fileName,
                fileType: resume.fileType,
                fileSize: resume.fileSize,
                rawText: resume.rawText,
                parsedData,
                atsAnalysis,
                createdAt: resume.createdAt.toISOString(),
                updatedAt: resume.updatedAt.toISOString()
            }
        });
    }
    catch (error) {
        next(error);
    }
});
// List all resumes
router.get('/', async (req, res, next) => {
    try {
        const resumes = await db_1.prisma.resume.findMany({
            where: { userId: config_1.config.defaultUserId },
            orderBy: { createdAt: 'desc' }
        });
        const formatted = resumes.map(r => ({
            id: r.id,
            userId: r.userId,
            title: r.title,
            fileName: r.fileName,
            fileType: r.fileType,
            fileSize: r.fileSize,
            rawText: r.rawText,
            parsedData: JSON.parse(r.parsedData),
            atsAnalysis: JSON.parse(r.atsAnalysis),
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString()
        }));
        res.json({ success: true, data: formatted });
    }
    catch (error) {
        next(error);
    }
});
// Get single resume
router.get('/:id', async (req, res, next) => {
    try {
        const resume = await db_1.prisma.resume.findUnique({
            where: { id: req.params.id }
        });
        if (!resume) {
            return res.status(404).json({ success: false, error: { message: 'Resume not found' } });
        }
        res.json({
            success: true,
            data: {
                id: resume.id,
                userId: resume.userId,
                title: resume.title,
                fileName: resume.fileName,
                fileType: resume.fileType,
                fileSize: resume.fileSize,
                rawText: resume.rawText,
                parsedData: JSON.parse(resume.parsedData),
                atsAnalysis: JSON.parse(resume.atsAnalysis),
                createdAt: resume.createdAt.toISOString(),
                updatedAt: resume.updatedAt.toISOString()
            }
        });
    }
    catch (error) {
        next(error);
    }
});
// Delete resume
router.delete('/:id', async (req, res, next) => {
    try {
        await db_1.prisma.resume.delete({
            where: { id: req.params.id }
        });
        res.json({ success: true, message: 'Resume deleted successfully' });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
