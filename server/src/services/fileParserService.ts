import fs from 'fs';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

export class FileParserService {
  /**
   * Extracts clean, structured plain text from PDF, DOCX, or TXT file paths.
   */
  public static async extractTextFromFile(filePath: string, mimeType: string, originalName: string): Promise<string> {
    const ext = originalName.split('.').pop()?.toLowerCase();

    if (ext === 'pdf' || mimeType.includes('pdf')) {
      return this.parsePdf(filePath);
    } else if (ext === 'docx' || mimeType.includes('officedocument.wordprocessingml')) {
      return this.parseDocx(filePath);
    } else if (ext === 'doc') {
      // DOC files can be read as text or parsed
      return this.parseDoc(filePath);
    } else {
      // Default to plain text UTF-8
      return this.parseTxt(filePath);
    }
  }

  private static async parsePdf(filePath: string): Promise<string> {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return this.cleanExtractedText(data.text);
  }

  private static async parseDocx(filePath: string): Promise<string> {
    const result = await mammoth.extractRawText({ path: filePath });
    return this.cleanExtractedText(result.value);
  }

  private static async parseDoc(filePath: string): Promise<string> {
    const buffer = fs.readFileSync(filePath);
    // Convert ascii / printable chars
    const text = buffer.toString('utf-8').replace(/[^\x20-\x7E\t\r\n]/g, ' ');
    return this.cleanExtractedText(text);
  }

  private static parseTxt(filePath: string): string {
    const content = fs.readFileSync(filePath, 'utf-8');
    return this.cleanExtractedText(content);
  }

  public static cleanExtractedText(raw: string): string {
    return raw
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
