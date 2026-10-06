"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const optimizerService_1 = require("../services/optimizerService");
const validate_1 = require("../middleware/validate");
const router = (0, express_1.Router)();
const optimizeSchema = zod_1.z.object({
    matchAnalysisId: zod_1.z.string().uuid(),
    resumeId: zod_1.z.string().uuid(),
    targetJobId: zod_1.z.string().uuid()
});
router.post('/', (0, validate_1.validateBody)(optimizeSchema), async (req, res, next) => {
    try {
        const { matchAnalysisId, resumeId, targetJobId } = req.body;
        const optimized = await optimizerService_1.OptimizerService.optimizeResume(matchAnalysisId, resumeId, targetJobId);
        res.status(201).json({ success: true, data: optimized });
    }
    catch (error) {
        next(error);
    }
});
router.get('/:id', async (req, res, next) => {
    try {
        const optimized = await optimizerService_1.OptimizerService.getOptimizedResume(req.params.id);
        if (!optimized) {
            return res.status(404).json({ success: false, error: { message: 'Optimized resume not found' } });
        }
        res.json({ success: true, data: optimized });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
