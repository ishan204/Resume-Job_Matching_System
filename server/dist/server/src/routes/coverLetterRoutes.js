"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const coverLetterService_1 = require("../services/coverLetterService");
const validate_1 = require("../middleware/validate");
const router = (0, express_1.Router)();
const generateSchema = zod_1.z.object({
    resumeId: zod_1.z.string().uuid(),
    jobId: zod_1.z.string().uuid(),
    tone: zod_1.z.enum(['professional', 'enthusiastic', 'confident', 'concise', 'technical']).default('professional')
});
const updateSchema = zod_1.z.object({
    fullLetter: zod_1.z.string().min(20, 'Letter content too short')
});
router.post('/generate', (0, validate_1.validateBody)(generateSchema), async (req, res, next) => {
    try {
        const { resumeId, jobId, tone } = req.body;
        const coverLetter = await coverLetterService_1.CoverLetterService.generateCoverLetter(resumeId, jobId, tone);
        res.status(201).json({ success: true, data: coverLetter });
    }
    catch (error) {
        next(error);
    }
});
router.get('/:id', async (req, res, next) => {
    try {
        const coverLetter = await coverLetterService_1.CoverLetterService.getCoverLetter(req.params.id);
        if (!coverLetter) {
            return res.status(404).json({ success: false, error: { message: 'Cover letter not found' } });
        }
        res.json({ success: true, data: coverLetter });
    }
    catch (error) {
        next(error);
    }
});
router.put('/:id', (0, validate_1.validateBody)(updateSchema), async (req, res, next) => {
    try {
        const updated = await coverLetterService_1.CoverLetterService.updateCoverLetter(req.params.id, req.body.fullLetter);
        res.json({ success: true, data: updated });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
