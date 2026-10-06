import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { upload } from '../middleware/upload';
import { FileParserService } from '../services/fileParserService';
import { ResumeParserService } from '../services/resumeParserService';
import { prisma } from '../db';
import { config } from '../config';

const router = Router();

// Upload resume file (PDF, DOCX, TXT)
router.post('/upload', upload.single('resume'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: { message: 'No file uploaded' } });
    }

    const { path: filePath, originalname, mimetype, size } = req.file;

    // Extract text
    const rawText = await FileParserService.extractTextFromFile(filePath, mimetype, originalname);
    if (!rawText || rawText.length < 30) {
      return res.status(400).json({
        success: false,
        error: { message: 'Failed to extract text from file. Please ensure the document is not an image or password protected.' }
      });
    }

    // Parse structured data and ATS
    const { parsedData, atsAnalysis } = ResumeParserService.parseResume(rawText);

    // Save to DB
    const resume = await prisma.resume.create({
      data: {
        id: uuidv4(),
        userId: config.defaultUserId,
        title: req.body.title || originalname.replace(/\.[^/.]+$/, ''),
        fileName: originalname,
        fileType: mimetype,
        fileSize: size,
        rawText,
        parsedData: JSON.stringify(parsedData),
        atsAnalysis: JSON.stringify(atsAnalysis)
      }
    });

    // Record activity
    await prisma.activityLog.create({
      data: {
        id: uuidv4(),
        userId: config.defaultUserId,
        type: 'resume_upload',
        title: `Uploaded resume "${resume.title}"`
      }
    });

    res.status(201).json({
      success: true,
      data: {
        id: resume.id,
        userId: resume.userId,
        title: resume.title,
        fileName: resume.fileName,
        fileType: resume.fileType,
        fileSize: resume.fileSize,
        rawText: resume.rawText,
        parsedData,
        atsAnalysis,
        createdAt: resume.createdAt.toISOString(),
        updatedAt: resume.updatedAt.toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

// Create resume from raw text
router.post('/text', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, text } = req.body;
    if (!text || text.trim().length < 30) {
      return res.status(400).json({
        success: false,
        error: { message: 'Resume text must be at least 30 characters long' }
      });
    }

    const { parsedData, atsAnalysis } = ResumeParserService.parseResume(text);

    const resume = await prisma.resume.create({
      data: {
        id: uuidv4(),
        userId: config.defaultUserId,
        title: title || 'Pasted Resume',
        fileName: 'resume.txt',
        fileType: 'text/plain',
        fileSize: Buffer.byteLength(text, 'utf8'),
        rawText: text,
        parsedData: JSON.stringify(parsedData),
        atsAnalysis: JSON.stringify(atsAnalysis)
      }
    });

    await prisma.activityLog.create({
      data: {
        id: uuidv4(),
        userId: config.defaultUserId,
        type: 'resume_upload',
        title: `Created resume "${resume.title}"`
      }
    });

    res.status(201).json({
      success: true,
      data: {
        id: resume.id,
        userId: resume.userId,
        title: resume.title,
        fileName: resume.fileName,
        fileType: resume.fileType,
        fileSize: resume.fileSize,
        rawText: resume.rawText,
        parsedData,
        atsAnalysis,
        createdAt: resume.createdAt.toISOString(),
        updatedAt: resume.updatedAt.toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

// List all resumes
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const resumes = await prisma.resume.findMany({
      where: { userId: config.defaultUserId },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = resumes.map(r => ({
      id: r.id,
      userId: r.userId,
      title: r.title,
      fileName: r.fileName,
      fileType: r.fileType,
      fileSize: r.fileSize,
      rawText: r.rawText,
      parsedData: JSON.parse(r.parsedData),
      atsAnalysis: JSON.parse(r.atsAnalysis),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    next(error);
  }
});

// Get single resume
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const resume = await prisma.resume.findUnique({
      where: { id: req.params.id as string }
    });

    if (!resume) {
      return res.status(404).json({ success: false, error: { message: 'Resume not found' } });
    }

    res.json({
      success: true,
      data: {
        id: resume.id,
        userId: resume.userId,
        title: resume.title,
        fileName: resume.fileName,
        fileType: resume.fileType,
        fileSize: resume.fileSize,
        rawText: resume.rawText,
        parsedData: JSON.parse(resume.parsedData),
        atsAnalysis: JSON.parse(resume.atsAnalysis),
        createdAt: resume.createdAt.toISOString(),
        updatedAt: resume.updatedAt.toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

// Delete resume
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.resume.delete({
      where: { id: req.params.id as string }
    });

    res.json({ success: true, message: 'Resume deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
