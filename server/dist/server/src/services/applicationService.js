"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApplicationService = void 0;
const uuid_1 = require("uuid");
const db_1 = require("../db");
class ApplicationService {
    static async listApplications(userId) {
        const list = await db_1.prisma.application.findMany({
            where: { userId },
            orderBy: { updatedAt: 'desc' }
        });
        return list.map(item => ({
            id: item.id,
            userId: item.userId,
            resumeId: item.resumeId || undefined,
            jobId: item.jobId || undefined,
            company: item.company,
            position: item.position,
            location: item.location,
            salary: item.salary || undefined,
            status: item.status,
            appliedDate: item.appliedDate,
            matchScore: item.matchScore || undefined,
            notes: item.notes,
            nextActionDate: item.nextActionDate,
            timeline: JSON.parse(item.timeline || '[]'),
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
        }));
    }
    static async createApplication(userId, data) {
        const initialTimeline = [
            {
                date: new Date().toISOString().split('T')[0],
                stage: data.status || 'saved',
                note: 'Application record created in ResumeMatch AI'
            }
        ];
        const record = await db_1.prisma.application.create({
            data: {
                id: (0, uuid_1.v4)(),
                userId,
                company: data.company,
                position: data.position,
                location: data.location || 'Remote',
                salary: data.salary,
                status: data.status || 'saved',
                appliedDate: data.status === 'applied' ? new Date().toISOString().split('T')[0] : null,
                resumeId: data.resumeId,
                jobId: data.jobId,
                matchScore: data.matchScore,
                notes: data.notes || '',
                nextActionDate: data.nextActionDate,
                timeline: JSON.stringify(initialTimeline),
            }
        });
        // Record activity
        await db_1.prisma.activityLog.create({
            data: {
                id: (0, uuid_1.v4)(),
                userId,
                type: 'application_updated',
                title: `Created application for ${record.position} at ${record.company}`
            }
        });
        return {
            id: record.id,
            userId: record.userId,
            resumeId: record.resumeId || undefined,
            jobId: record.jobId || undefined,
            company: record.company,
            position: record.position,
            location: record.location,
            salary: record.salary || undefined,
            status: record.status,
            appliedDate: record.appliedDate,
            matchScore: record.matchScore || undefined,
            notes: record.notes,
            nextActionDate: record.nextActionDate,
            timeline: JSON.parse(record.timeline),
            createdAt: record.createdAt.toISOString(),
            updatedAt: record.updatedAt.toISOString(),
        };
    }
    static async updateApplicationStatus(id, status, note) {
        const existing = await db_1.prisma.application.findUnique({ where: { id } });
        if (!existing)
            throw new Error('Application not found');
        const timeline = JSON.parse(existing.timeline || '[]');
        timeline.push({
            date: new Date().toISOString().split('T')[0],
            stage: status,
            note: note || `Stage moved to ${status}`
        });
        const updateData = {
            status,
            timeline: JSON.stringify(timeline)
        };
        if (status === 'applied' && !existing.appliedDate) {
            updateData.appliedDate = new Date().toISOString().split('T')[0];
        }
        const updated = await db_1.prisma.application.update({
            where: { id },
            data: updateData
        });
        return {
            id: updated.id,
            userId: updated.userId,
            resumeId: updated.resumeId || undefined,
            jobId: updated.jobId || undefined,
            company: updated.company,
            position: updated.position,
            location: updated.location,
            salary: updated.salary || undefined,
            status: updated.status,
            appliedDate: updated.appliedDate,
            matchScore: updated.matchScore || undefined,
            notes: updated.notes,
            nextActionDate: updated.nextActionDate,
            timeline: JSON.parse(updated.timeline),
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
        };
    }
    static async getDashboardStats(userId) {
        const totalResumes = await db_1.prisma.resume.count({ where: { userId } });
        const totalJobs = await db_1.prisma.jobDescription.count({ where: { userId } });
        const totalMatches = await db_1.prisma.matchAnalysis.count();
        const applications = await db_1.prisma.application.findMany({ where: { userId } });
        const activeApplications = applications.filter(a => a.status !== 'rejected').length;
        const interviewsCount = applications.filter(a => a.status === 'screening' || a.status === 'interviewing').length;
        const offersCount = applications.filter(a => a.status === 'offer').length;
        const matches = await db_1.prisma.matchAnalysis.findMany({ select: { overallScore: true } });
        const avgScore = matches.length > 0
            ? Math.round(matches.reduce((acc, m) => acc + m.overallScore, 0) / matches.length)
            : 82;
        const activities = await db_1.prisma.activityLog.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 6
        });
        return {
            totalResumes,
            totalJobs,
            totalMatches,
            averageMatchScore: avgScore,
            activeApplications,
            interviewsCount,
            offersCount,
            recentActivities: activities.map(a => ({
                id: a.id,
                type: a.type,
                title: a.title,
                timestamp: a.createdAt.toISOString()
            }))
        };
    }
}
exports.ApplicationService = ApplicationService;
