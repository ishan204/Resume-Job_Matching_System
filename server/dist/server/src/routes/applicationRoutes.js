"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const applicationService_1 = require("../services/applicationService");
const config_1 = require("../config");
const validate_1 = require("../middleware/validate");
const router = (0, express_1.Router)();
const createApplicationSchema = zod_1.z.object({
    company: zod_1.z.string().min(1, 'Company is required'),
    position: zod_1.z.string().min(1, 'Position is required'),
    location: zod_1.z.string().optional().default('Remote'),
    salary: zod_1.z.string().optional(),
    status: zod_1.z.enum(['saved', 'applied', 'screening', 'interviewing', 'offer', 'rejected']).default('saved'),
    resumeId: zod_1.z.string().uuid().optional(),
    jobId: zod_1.z.string().uuid().optional(),
    matchScore: zod_1.z.number().min(0).max(100).optional(),
    notes: zod_1.z.string().optional(),
    nextActionDate: zod_1.z.string().optional()
});
const updateStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['saved', 'applied', 'screening', 'interviewing', 'offer', 'rejected']),
    note: zod_1.z.string().optional()
});
router.get('/', async (req, res, next) => {
    try {
        const list = await applicationService_1.ApplicationService.listApplications(config_1.config.defaultUserId);
        res.json({ success: true, data: list });
    }
    catch (error) {
        next(error);
    }
});
router.post('/', (0, validate_1.validateBody)(createApplicationSchema), async (req, res, next) => {
    try {
        const created = await applicationService_1.ApplicationService.createApplication(config_1.config.defaultUserId, req.body);
        res.status(201).json({ success: true, data: created });
    }
    catch (error) {
        next(error);
    }
});
router.patch('/:id/status', (0, validate_1.validateBody)(updateStatusSchema), async (req, res, next) => {
    try {
        const updated = await applicationService_1.ApplicationService.updateApplicationStatus(req.params.id, req.body.status, req.body.note);
        res.json({ success: true, data: updated });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
