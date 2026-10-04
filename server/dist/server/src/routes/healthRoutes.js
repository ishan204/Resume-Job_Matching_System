"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const aiFactory_1 = require("../services/ai/aiFactory");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    let dbStatus = 'ok';
    try {
        await db_1.prisma.$queryRaw `SELECT 1`;
    }
    catch (e) {
        dbStatus = 'disconnected';
    }
    const aiProvider = aiFactory_1.AIFactory.getProvider();
    res.json({
        status: dbStatus === 'ok' ? 'healthy' : 'degraded',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        services: {
            database: dbStatus,
            aiProvider: aiProvider.name,
            aiConfigured: aiProvider.isConfigured()
        }
    });
});
exports.default = router;
