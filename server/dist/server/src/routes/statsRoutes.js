"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const applicationService_1 = require("../services/applicationService");
const config_1 = require("../config");
const router = (0, express_1.Router)();
router.get('/', async (req, res, next) => {
    try {
        const stats = await applicationService_1.ApplicationService.getDashboardStats(config_1.config.defaultUserId);
        res.json({ success: true, data: stats });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
