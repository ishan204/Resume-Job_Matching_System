import { createApp } from './app';
import { config } from './config';
import { connectDb } from './db';

async function bootstrap() {
  await connectDb();

  const app = createApp();

  app.listen(config.port, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 ResumeMatch AI Backend running on http://localhost:${config.port}`);
    console.log(`📡 Environment: ${config.nodeEnv}`);
    console.log(`🤖 AI Provider: ${config.geminiApiKey ? 'Google Gemini' : 'Local Semantic Engine (Ready)'}`);
    console.log(`======================================================\n`);
  });
}

bootstrap().catch((err) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
