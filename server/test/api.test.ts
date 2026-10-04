import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/db';

describe('ResumeMatch AI API Integration Suite', () => {
  const app = createApp();

  it('GET /api/health returns healthy system status and AI provider', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.services.database).toBe('ok');
    expect(res.body.services.aiProvider).toBeDefined();
  });

  it('GET /api/stats returns dashboard metrics', async () => {
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalResumes).toBeGreaterThanOrEqual(1);
    expect(res.body.data.totalJobs).toBeGreaterThanOrEqual(1);
    expect(res.body.data.averageMatchScore).toBeGreaterThanOrEqual(50);
  });

  it('GET /api/resumes returns list of parsed resumes', async () => {
    const res = await request(app).get('/api/resumes');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].parsedData.skills).toBeDefined();
    expect(res.body.data[0].atsAnalysis.overallAtsScore).toBeDefined();
  });

  it('GET /api/jobs returns list of analyzed jobs', async () => {
    const res = await request(app).get('/api/jobs');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].parsedData.requiredSkills).toBeDefined();
  });

  it('POST /api/match calculates real-time match between existing resume and job', async () => {
    const resumesRes = await request(app).get('/api/resumes');
    const jobsRes = await request(app).get('/api/jobs');

    const resumeId = resumesRes.body.data[0].id;
    const jobId = jobsRes.body.data[0].id;

    const matchRes = await request(app).post('/api/match').send({ resumeId, jobId });
    expect(matchRes.status).toBe(201);
    expect(matchRes.body.success).toBe(true);
    expect(matchRes.body.data.overallScore).toBeGreaterThan(50);
    expect(matchRes.body.data.scoreBreakdown.hardSkillsScore).toBeDefined();
    expect(matchRes.body.data.skillMatrix.matchedSkills).toBeDefined();
    expect(matchRes.body.data.actionableAdvice.length).toBeGreaterThan(0);
  });

  it('POST /api/cover-letters/generate synthesizes tailored cover letter', async () => {
    const resumesRes = await request(app).get('/api/resumes');
    const jobsRes = await request(app).get('/api/jobs');

    const resumeId = resumesRes.body.data[0].id;
    const jobId = jobsRes.body.data[0].id;

    const clRes = await request(app).post('/api/cover-letters/generate').send({
      resumeId,
      jobId,
      tone: 'enthusiastic'
    });

    expect(clRes.status).toBe(201);
    expect(clRes.body.success).toBe(true);
    expect(clRes.body.data.opening).toBeDefined();
    expect(clRes.body.data.fullLetter).toMatch(/alex/i);
  });

  it('Application CRM pipeline supports creation and status updates', async () => {
    const createRes = await request(app).post('/api/applications').send({
      company: 'Datadog',
      position: 'Senior Infrastructure Engineer',
      location: 'Remote',
      salary: '$195,000',
      status: 'saved',
      notes: 'Initial bookmark from hiring board.'
    });

    expect(createRes.status).toBe(201);
    const appId = createRes.body.data.id;

    const updateRes = await request(app).patch(`/api/applications/${appId}/status`).send({
      status: 'applied',
      note: 'Applied through team referral.'
    });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.status).toBe('applied');
    expect(updateRes.body.data.timeline.length).toBe(2);
  });
});
