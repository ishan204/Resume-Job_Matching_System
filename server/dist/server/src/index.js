"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
const config_1 = require("./config");
const db_1 = require("./db");
async function bootstrap() {
    await (0, db_1.connectDb)();
    const app = (0, app_1.createApp)();
    app.listen(config_1.config.port, () => {
        console.log(`\n======================================================`);
        console.log(`🚀 ResumeMatch AI Backend running on http://localhost:${config_1.config.port}`);
        console.log(`📡 Environment: ${config_1.config.nodeEnv}`);
        console.log(`🤖 AI Provider: ${config_1.config.geminiApiKey ? 'Google Gemini' : 'Local Semantic Engine (Ready)'}`);
        console.log(`======================================================\n`);
    });
}
bootstrap().catch((err) => {
    console.error('Fatal bootstrap error:', err);
    process.exit(1);
});
