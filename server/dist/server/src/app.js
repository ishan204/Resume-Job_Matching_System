"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const resumeRoutes_1 = __importDefault(require("./routes/resumeRoutes"));
const jobRoutes_1 = __importDefault(require("./routes/jobRoutes"));
const matchRoutes_1 = __importDefault(require("./routes/matchRoutes"));
const optimizerRoutes_1 = __importDefault(require("./routes/optimizerRoutes"));
const coverLetterRoutes_1 = __importDefault(require("./routes/coverLetterRoutes"));
const applicationRoutes_1 = __importDefault(require("./routes/applicationRoutes"));
const statsRoutes_1 = __importDefault(require("./routes/statsRoutes"));
const healthRoutes_1 = __importDefault(require("./routes/healthRoutes"));
const errorHandler_1 = require("./middleware/errorHandler");
function createApp() {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)());
    app.use(express_1.default.json({ limit: '10mb' }));
    app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
    // API Routes
    app.use('/api/resumes', resumeRoutes_1.default);
    app.use('/api/jobs', jobRoutes_1.default);
    app.use('/api/match', matchRoutes_1.default);
    app.use('/api/optimize', optimizerRoutes_1.default);
    app.use('/api/cover-letters', coverLetterRoutes_1.default);
    app.use('/api/applications', applicationRoutes_1.default);
    app.use('/api/stats', statsRoutes_1.default);
    app.use('/api/health', healthRoutes_1.default);
    // Centralized Error Handler
    app.use(errorHandler_1.errorHandler);
    return app;
}
