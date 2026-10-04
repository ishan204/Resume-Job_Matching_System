import { v4 as uuidv4 } from 'uuid';
import { Application, ApplicationStatus, DashboardStats } from '@shared';
import { prisma } from '../db';

export class ApplicationService {
  public static async listApplications(userId: string): Promise<Application[]> {
    const list = await prisma.application.findMany({
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
      status: item.status as ApplicationStatus,
      appliedDate: item.appliedDate,
      matchScore: item.matchScore || undefined,
      notes: item.notes,
      nextActionDate: item.nextActionDate,
      timeline: JSON.parse(item.timeline || '[]'),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }));
  }

  public static async createApplication(
    userId: string,
    data: {
      company: string;
      position: string;
      location?: string;
      salary?: string;
      status?: ApplicationStatus;
      resumeId?: string;
      jobId?: string;
      matchScore?: number;
      notes?: string;
      nextActionDate?: string;
    }
  ): Promise<Application> {
    const initialTimeline = [
      {
        date: new Date().toISOString().split('T')[0],
        stage: data.status || 'saved',
        note: 'Application record created in ResumeMatch AI'
      }
    ];

    const record = await prisma.application.create({
      data: {
        id: uuidv4(),
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
    await prisma.activityLog.create({
      data: {
        id: uuidv4(),
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
      status: record.status as ApplicationStatus,
      appliedDate: record.appliedDate,
      matchScore: record.matchScore || undefined,
      notes: record.notes,
      nextActionDate: record.nextActionDate,
      timeline: JSON.parse(record.timeline),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  public static async updateApplicationStatus(
    id: string,
    status: ApplicationStatus,
    note?: string
  ): Promise<Application> {
    const existing = await prisma.application.findUnique({ where: { id } });
    if (!existing) throw new Error('Application not found');

    const timeline = JSON.parse(existing.timeline || '[]');
    timeline.push({
      date: new Date().toISOString().split('T')[0],
      stage: status,
      note: note || `Stage moved to ${status}`
    });

    const updateData: any = {
      status,
      timeline: JSON.stringify(timeline)
    };

    if (status === 'applied' && !existing.appliedDate) {
      updateData.appliedDate = new Date().toISOString().split('T')[0];
    }

    const updated = await prisma.application.update({
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
      status: updated.status as ApplicationStatus,
      appliedDate: updated.appliedDate,
      matchScore: updated.matchScore || undefined,
      notes: updated.notes,
      nextActionDate: updated.nextActionDate,
      timeline: JSON.parse(updated.timeline),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  public static async getDashboardStats(userId: string): Promise<DashboardStats> {
    const totalResumes = await prisma.resume.count({ where: { userId } });
    const totalJobs = await prisma.jobDescription.count({ where: { userId } });
    const totalMatches = await prisma.matchAnalysis.count();
    const applications = await prisma.application.findMany({ where: { userId } });

    const activeApplications = applications.filter(a => a.status !== 'rejected').length;
    const interviewsCount = applications.filter(a => a.status === 'screening' || a.status === 'interviewing').length;
    const offersCount = applications.filter(a => a.status === 'offer').length;

    const matches = await prisma.matchAnalysis.findMany({ select: { overallScore: true } });
    const avgScore = matches.length > 0
      ? Math.round(matches.reduce((acc, m) => acc + m.overallScore, 0) / matches.length)
      : 82;

    const activities = await prisma.activityLog.findMany({
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
        type: a.type as any,
        title: a.title,
        timestamp: a.createdAt.toISOString()
      }))
    };
  }
}
