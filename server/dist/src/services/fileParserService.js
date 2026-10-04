"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileParserService = void 0;
const fs_1 = __importDefault(require("fs"));
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const mammoth_1 = __importDefault(require("mammoth"));
class FileParserService {
    /**
     * Extracts clean, structured plain text from PDF, DOCX, or TXT file paths.
     */
    static async extractTextFromFile(filePath, mimeType, originalName) {
        const ext = originalName.split('.').pop()?.toLowerCase();
        if (ext === 'pdf' || mimeType.includes('pdf')) {
            return this.parsePdf(filePath);
        }
        else if (ext === 'docx' || mimeType.includes('officedocument.wordprocessingml')) {
            return this.parseDocx(filePath);
        }
        else if (ext === 'doc') {
            // DOC files can be read as text or parsed
            return this.parseDoc(filePath);
        }
        else {
            // Default to plain text UTF-8
            return this.parseTxt(filePath);
        }
    }
    static async parsePdf(filePath) {
        const dataBuffer = fs_1.default.readFileSync(filePath);
        const data = await (0, pdf_parse_1.default)(dataBuffer);
        return this.cleanExtractedText(data.text);
    }
    static async parseDocx(filePath) {
        const result = await mammoth_1.default.extractRawText({ path: filePath });
        return this.cleanExtractedText(result.value);
    }
    static async parseDoc(filePath) {
        const buffer = fs_1.default.readFileSync(filePath);
        // Convert ascii / printable chars
        const text = buffer.toString('utf-8').replace(/[^\x20-\x7E\t\r\n]/g, ' ');
        return this.cleanExtractedText(text);
    }
    static parseTxt(filePath) {
        const content = fs_1.default.readFileSync(filePath, 'utf-8');
        return this.cleanExtractedText(content);
    }
    static cleanExtractedText(raw) {
        return raw
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/[ \t]+/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }
}
exports.FileParserService = FileParserService;
