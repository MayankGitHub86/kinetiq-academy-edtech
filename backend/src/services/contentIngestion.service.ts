import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { SSRFProtection } from './ssrf.service';
import { logger } from '../utils/logger';

export interface ExtractedContent {
  title: string;
  sourceType: 'url' | 'document' | 'text' | 'video_url';
  url?: string;
  filePath?: string;
  author?: string;
  wordCount: number;
  rawText: string;
  cleanedText: string;
  headings: Array<{ level: number; text: string }>;
  chunks: Array<{ id: number; heading: string; text: string }>;
  metadata: Record<string, any>;
}

export class ContentIngestionService {
  /**
   * Extract educational content from a public web page
   */
  public static async extractFromUrl(urlString: string): Promise<ExtractedContent> {
    const validatedUrl = await SSRFProtection.validateUrl(urlString);

    logger.info(`Fetching educational content from URL: ${validatedUrl.href}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    let html: string;
    try {
      const response = await fetch(validatedUrl.href, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) KinetiqAcademy/1.0 (Educational Bot)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch web page: HTTP ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
        throw new Error(`Unsupported content type: ${contentType}. Expected HTML or text.`);
      }

      html = await response.text();
    } finally {
      clearTimeout(timeout);
    }

    const $ = cheerio.load(html);

    // Remove noise: scripts, styles, forms, navigation, footer, ads, cookie banners
    $('script, style, noscript, nav, footer, header, aside, iframe, svg, form, .cookie-banner, .advertisement, [role="navigation"], [role="banner"]').remove();

    const title = $('title').text().trim() || $('h1').first().text().trim() || validatedUrl.hostname;
    const author = $('meta[name="author"]').attr('content') || $('meta[property="article:author"]').attr('content') || '';
    const description = $('meta[name="description"]').attr('content') || '';

    // Extract headings
    const headings: Array<{ level: number; text: string }> = [];
    $('h1, h2, h3, h4').each((_, el) => {
      const tagName = el.tagName.toLowerCase();
      const level = parseInt(tagName.replace('h', ''), 10);
      const text = $(el).text().trim();
      if (text) headings.push({ level, text });
    });

    // Select primary content area if present, otherwise body
    let contentSelector = 'main, article, [role="main"], .content, #content, .post-content, body';
    let bodyText = $(contentSelector).first().text();

    if (!bodyText || bodyText.trim().length < 100) {
      bodyText = $('body').text();
    }

    const cleanedText = this.normalizeText(bodyText);
    const wordCount = cleanedText.split(/\s+/).filter(Boolean).length;
    const chunks = this.chunkText(cleanedText, headings);

    return {
      title,
      sourceType: 'url',
      url: validatedUrl.href,
      author,
      wordCount,
      rawText: bodyText,
      cleanedText,
      headings,
      chunks,
      metadata: {
        domain: validatedUrl.hostname,
        description,
        scrapedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Extract educational content from an uploaded document (PDF, DOCX, TXT, MD, Code)
   */
  public static async extractFromFile(filePath: string, originalName: string, mimeType: string): Promise<ExtractedContent> {
    const ext = path.extname(originalName).toLowerCase();
    let rawText = '';
    const metadata: Record<string, any> = { originalName, extension: ext, mimeType };

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found at path: ${filePath}`);
    }

    if (ext === '.pdf' || mimeType.includes('pdf')) {
      const buffer = fs.readFileSync(filePath);
      const parserFn: any = (pdfParse as any).default || pdfParse;
      const pdfData = await parserFn(buffer);
      rawText = pdfData.text;
      metadata.pageCount = pdfData.numpages;
      metadata.pdfInfo = pdfData.info;
    } else if (ext === '.docx' || mimeType.includes('wordprocessingml')) {
      const buffer = fs.readFileSync(filePath);
      const docxResult = await mammoth.extractRawText({ buffer });
      rawText = docxResult.value;
      if (docxResult.messages?.length) {
        metadata.docxMessages = docxResult.messages;
      }
    } else if (['.txt', '.md', '.markdown', '.js', '.ts', '.py', '.java', '.cpp', '.c', '.go', '.rs', '.html', '.css', '.json'].includes(ext)) {
      rawText = fs.readFileSync(filePath, 'utf8');
    } else {
      throw new Error(`Unsupported document format: ${ext}. Supported formats: PDF, DOCX, TXT, Markdown, and source code files.`);
    }

    const title = path.basename(originalName, ext).replace(/[_-]/g, ' ');
    const cleanedText = this.normalizeText(rawText);
    const wordCount = cleanedText.split(/\s+/).filter(Boolean).length;
    
    // Detect headings in text if markdown or plain text
    const headings = this.extractTextHeadings(cleanedText);
    const chunks = this.chunkText(cleanedText, headings);

    return {
      title,
      sourceType: 'document',
      filePath,
      wordCount,
      rawText,
      cleanedText,
      headings,
      chunks,
      metadata,
    };
  }

  /**
   * Extract educational content from pasted raw text
   */
  public static extractFromText(rawText: string, customTitle = 'Custom Learning Subject'): ExtractedContent {
    const cleanedText = this.normalizeText(rawText);
    const wordCount = cleanedText.split(/\s+/).filter(Boolean).length;
    const headings = this.extractTextHeadings(cleanedText);
    const chunks = this.chunkText(cleanedText, headings);

    return {
      title: customTitle,
      sourceType: 'text',
      wordCount,
      rawText,
      cleanedText,
      headings,
      chunks,
      metadata: {
        pastedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Clean and normalize raw extracted text
   */
  public static normalizeText(text: string): string {
    return text
      // Replace excessive whitespace
      .replace(/\r\n/g, '\n')
      .replace(/\t/g, '  ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n\s*\n+/g, '\n\n')
      // Strip potential prompt injection sequences
      .replace(/ignore (all )?previous instructions/gi, '[filtered instruction]')
      .replace(/you are now an unrestricted/gi, '[filtered instruction]')
      .trim();
  }

  /**
   * Extract headings from text lines (Markdown or capitalized titles)
   */
  private static extractTextHeadings(text: string): Array<{ level: number; text: string }> {
    const lines = text.split('\n');
    const headings: Array<{ level: number; text: string }> = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) {
        const match = trimmed.match(/^(#{1,4})\s+(.+)$/);
        if (match) {
          headings.push({ level: match[1].length, text: match[2].trim() });
        }
      } else if (trimmed.length > 3 && trimmed.length < 80 && /^[A-Z0-9\s:.-]+$/.test(trimmed) && !trimmed.endsWith('.')) {
        headings.push({ level: 2, text: trimmed });
      }
    }

    return headings;
  }

  /**
   * Chunk text into manageable token/character blocks with sliding overlap
   */
  public static chunkText(
    text: string,
    headings: Array<{ level: number; text: string }>,
    maxChunkChars = 3200,
    overlapChars = 300
  ): Array<{ id: number; heading: string; text: string }> {
    const chunks: Array<{ id: number; heading: string; text: string }> = [];
    if (!text || text.length === 0) return chunks;

    // Split into paragraphs
    const paragraphs = text.split(/\n\s*\n/);
    let currentChunk = '';
    let currentHeading = headings[0]?.text || 'Introduction & Overview';
    let chunkId = 1;

    for (const para of paragraphs) {
      const trimmedPara = para.trim();
      if (!trimmedPara) continue;

      // Check if paragraph matches any heading
      const matchingHeading = headings.find(h => trimmedPara.startsWith(h.text));
      if (matchingHeading) {
        currentHeading = matchingHeading.text;
      }

      if ((currentChunk.length + trimmedPara.length) > maxChunkChars && currentChunk.length > 0) {
        chunks.push({
          id: chunkId++,
          heading: currentHeading,
          text: currentChunk.trim(),
        });

        // Sliding overlap
        const overlap = currentChunk.slice(-overlapChars);
        currentChunk = overlap + '\n\n' + trimmedPara;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + trimmedPara;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push({
        id: chunkId++,
        heading: currentHeading,
        text: currentChunk.trim(),
      });
    }

    return chunks;
  }
}
