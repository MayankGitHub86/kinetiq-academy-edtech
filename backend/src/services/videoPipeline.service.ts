import fs from 'fs';
import path from 'path';
import { execFile, execFileSync } from 'child_process';
import { promisify } from 'util';
import sharp from 'sharp';
import ffmpegPath from 'ffmpeg-static';
import { logger } from '../utils/logger';
import { GeneratedVideoStoryboard } from './aiGenerator.service';
import { VideoAsset } from '../models/AiLearning';
import { Lesson } from '../models/Course';

const execFileAsync = promisify(execFile);

// ─── ffprobe path resolution ───────────────────────────────────────────────
function getFfprobePath(): string {
  // ffmpeg-static bundles ffprobe alongside ffmpeg
  const ffmpegBin = ffmpegPath as string;
  const dir = path.dirname(ffmpegBin);
  const probeName = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';
  const probePath = path.join(dir, probeName);
  if (fs.existsSync(probePath)) return probePath;
  // Try adjacent bin
  return ffmpegBin.replace(/ffmpeg(\.exe)?$/i, `ffprobe${process.platform === 'win32' ? '.exe' : ''}`);
}

export interface RenderedVideoResult {
  videoUrl: string;
  thumbnailUrl: string;
  captionsVttUrl: string;
  durationSeconds: number;
  transcript: Array<{ start: number; end: number; text: string }>;
  captionsVtt: string;
  ffprobeReport?: any;
}

export interface VideoValidationReport {
  passed: boolean;
  videoStream: boolean;
  audioStream: boolean;
  fileSizeBytes: number;
  durationSeconds: number;
  resolution: string;
  codec: string;
  audioCodec: string;
  checks: Array<{ check: string; result: 'PASS' | 'FAIL' | 'WARN'; detail: string }>;
}

export class VideoPipelineService {
  private static openaiKey = process.env.OPENAI_API_KEY || '';
  private static uploadsDir = path.join(process.cwd(), 'public', 'uploads');

  // ─── Windows SAPI TTS via `say` npm package ──────────────────────────────
  private static async generateSpeechViaSAPI(text: string, outputWavPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Dynamic require to avoid TypeScript import issues
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const say = require('say');
        say.export(text, null, 1.0, outputWavPath, (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Generates Text-to-Speech audio for a narration string.
   * Priority: 1. OpenAI TTS  2. Windows SAPI  3. FFmpeg sine fallback
   */
  public static async generateSpeechAudio(text: string, outputMp3Path: string, durationEstimateSeconds = 8): Promise<number> {
    // 1. OpenAI TTS (best quality)
    if (this.openaiKey && !this.openaiKey.includes('your_openai_key')) {
      try {
        const response = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.openaiKey}`,
          },
          body: JSON.stringify({
            model: 'tts-1',
            voice: 'onyx',
            input: text,
            response_format: 'mp3',
          }),
        });

        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          fs.writeFileSync(outputMp3Path, Buffer.from(arrayBuffer));
          logger.info(`✅ OpenAI TTS audio generated: ${outputMp3Path}`);
          return durationEstimateSeconds;
        } else {
          const body = await response.text();
          logger.warn(`OpenAI TTS HTTP ${response.status}: ${body.slice(0, 200)}. Falling over to SAPI.`);
        }
      } catch (err: any) {
        logger.warn(`OpenAI TTS fetch failed: ${err.message}. Falling over to SAPI.`);
      }
    }

    // 2. Windows SAPI (free, high quality, uses OS voice)
    const tempWavPath = outputMp3Path.replace(/\.mp3$/i, '_sapi.wav');
    try {
      await this.generateSpeechViaSAPI(text, tempWavPath);
      if (fs.existsSync(tempWavPath) && fs.statSync(tempWavPath).size > 1000) {
        // Convert WAV → MP3 via FFmpeg
        await execFileAsync(ffmpegPath as string, [
          '-y', '-i', tempWavPath,
          '-c:a', 'libmp3lame', '-b:a', '128k',
          outputMp3Path,
        ]);
        try { fs.unlinkSync(tempWavPath); } catch {}

        // Measure actual audio duration
        const actualDuration = await this.getAudioDuration(outputMp3Path);
        logger.info(`✅ Windows SAPI TTS audio generated: ${outputMp3Path} (${actualDuration.toFixed(1)}s)`);
        return actualDuration || durationEstimateSeconds;
      }
    } catch (err: any) {
      logger.warn(`Windows SAPI TTS failed: ${err.message}. Falling back to FFmpeg synthesized audio.`);
      try { if (fs.existsSync(tempWavPath)) fs.unlinkSync(tempWavPath); } catch {}
    }

    // 3. FFmpeg synthesized tonal audio (last resort)
    const safeDuration = Math.max(4, Math.min(30, durationEstimateSeconds));
    // Generate a more complex synthesized audio with multiple harmonics for better educational feel
    const args = [
      '-y',
      '-f', 'lavfi',
      '-i', `aevalsrc=0.12*sin(220*2*PI*t)+0.06*sin(440*2*PI*t)+0.03*sin(880*2*PI*t):s=22050:d=${safeDuration}`,
      '-af', `afade=t=in:ss=0:d=0.5,afade=t=out:st=${Math.max(0, safeDuration - 0.5)}:d=0.5`,
      '-c:a', 'libmp3lame', '-b:a', '64k',
      outputMp3Path,
    ];
    await execFileAsync(ffmpegPath as string, args);
    logger.warn(`⚠️ Using FFmpeg synthesized audio for scene (SAPI unavailable): ${outputMp3Path}`);
    return safeDuration;
  }

  /**
   * Get audio duration using ffprobe or ffmpeg
   */
  private static async getAudioDuration(filePath: string): Promise<number> {
    try {
      const ffprobePath = getFfprobePath();
      if (fs.existsSync(ffprobePath)) {
        const { stdout } = await execFileAsync(ffprobePath, [
          '-v', 'quiet',
          '-print_format', 'json',
          '-show_format',
          filePath,
        ]);
        const info = JSON.parse(stdout);
        const dur = parseFloat(info.format?.duration || '0');
        if (dur > 0) return dur;
      }
    } catch {}

    // Fallback: parse duration from ffmpeg -i
    try {
      const [, stderr] = await new Promise<[string, string]>((resolve) => {
        execFile(ffmpegPath as string, ['-i', filePath], (_err, stdout, stderr) => {
          resolve([stdout || '', stderr || '']);
        });
      });
      const durMatch = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/);
      if (durMatch) {
        return parseInt(durMatch[1], 10) * 3600 + parseInt(durMatch[2], 10) * 60 + parseFloat(durMatch[3]);
      }
    } catch {}

    return 0;
  }

  // ─── SVG Slide Renderer ───────────────────────────────────────────────────

  /**
   * Escape XML entities for SVG rendering
   */
  private static escapeXml(unsafe: string): string {
    return (unsafe || '').replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  }

  /**
   * Word-wrap a string to SVG tspan elements, max width in characters
   */
  private static wrapTextToTspan(text: string, x: number, y: number, lineHeight: number, maxChars: number, attrs = ''): string {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (testLine.length > maxChars && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    return lines.map((line, i) =>
      `<tspan x="${x}" dy="${i === 0 ? 0 : lineHeight}" ${attrs}>${this.escapeXml(line)}</tspan>`
    ).join('');
  }

  /**
   * Render a 1920×1080 educational slide SVG based on scene content
   */
  public static async renderSceneSlide(
    sceneNumber: number,
    totalScenes: number,
    title: string,
    bulletPoints: string[],
    codeHighlight: string | undefined,
    narration: string,
    outputPath: string
  ): Promise<void> {
    const escapedTitle = this.escapeXml(title);

    // Build bullet points SVG with icons
    const bulletIcons = ['▶', '◆', '●', '★', '→'];
    const bulletsSvg = bulletPoints.slice(0, 5).map((bp, i) => {
      const y = 360 + (i * 78);
      const icon = bulletIcons[i % bulletIcons.length];
      const truncated = bp.length > 52 ? bp.slice(0, 49) + '…' : bp;
      return `
        <g transform="translate(100, ${y})">
          <text x="0" y="0" font-family="Segoe UI, Inter, -apple-system, sans-serif" font-size="22" fill="#6366f1">${icon}</text>
          <text x="36" y="0" font-family="Segoe UI, Inter, -apple-system, sans-serif" font-size="26" font-weight="500" fill="#f1f5f9">
            ${this.wrapTextToTspan(truncated, 0, 0, 32, 52)}
          </text>
        </g>
      `;
    }).join('\n');

    // Build code block SVG
    let codeBlockSvg = '';
    if (codeHighlight && codeHighlight.trim()) {
      const codeLines = codeHighlight.split('\n').slice(0, 7);
      const linesSvg = codeLines.map((line, idx) => {
        const trimmed = line.length > 48 ? line.slice(0, 45) + '…' : line;
        // Syntax color: keywords in purple, strings in green, comments in gray
        const isComment = trimmed.trim().startsWith('//') || trimmed.trim().startsWith('#');
        const isKeyword = /^(function|const|let|var|return|if|for|class|import|export|async|await)\b/.test(trimmed.trim());
        const color = isComment ? '#64748b' : isKeyword ? '#a78bfa' : '#38bdf8';
        return `<text x="22" y="${56 + (idx * 34)}" font-family="Cascadia Code, Courier New, monospace" font-size="21" fill="${color}">${this.escapeXml(trimmed)}</text>`;
      }).join('\n');

      // Line numbers
      const lineNums = codeLines.map((_, idx) =>
        `<text x="6" y="${56 + (idx * 34)}" font-family="Courier New, monospace" font-size="16" fill="#334155" text-anchor="middle">${idx + 1}</text>`
      ).join('\n');

      codeBlockSvg = `
        <g transform="translate(940, 260)">
          <!-- Terminal window background -->
          <rect width="860" height="${70 + codeLines.length * 34}" rx="14" fill="#050c1a" stroke="#1e3a5f" stroke-width="2"/>
          <!-- Header strip -->
          <rect width="860" height="42" rx="14" fill="#0d1f3c"/>
          <rect x="0" y="28" width="860" height="14" fill="#0d1f3c"/>
          <!-- Traffic lights -->
          <circle cx="28" cy="21" r="7" fill="#ef4444" opacity="0.8"/>
          <circle cx="52" cy="21" r="7" fill="#f59e0b" opacity="0.8"/>
          <circle cx="76" cy="21" r="7" fill="#22c55e" opacity="0.8"/>
          <!-- File name chip -->
          <rect x="108" y="10" width="180" height="22" rx="4" fill="#1e3a5f"/>
          <text x="198" y="25" font-family="Courier New, monospace" font-size="13" fill="#94a3b8" text-anchor="middle">implementation.ts</text>
          <!-- Left gutter -->
          <rect x="0" y="42" width="18" height="${codeLines.length * 34 + 28}" fill="#060e1c"/>
          ${lineNums}
          ${linesSvg}
        </g>
      `;
    }

    // Progress bar
    const progressW = Math.round((sceneNumber / totalScenes) * 1760);
    const progressSvg = `
      <rect x="80" y="1048" width="1760" height="6" rx="3" fill="#1e293b"/>
      <rect x="80" y="1048" width="${progressW}" height="6" rx="3" fill="url(#primaryGlow)"/>
    `;

    // Narration caption (bottom)
    const captionText = narration.length > 140 ? narration.slice(0, 137) + '…' : narration;

    // Decorative accent elements
    const decorSvg = `
      <!-- Decorative circuit lines top-right -->
      <g opacity="0.07">
        <line x1="1400" y1="0" x2="1400" y2="250" stroke="#6366f1" stroke-width="1"/>
        <line x1="1400" y1="250" x2="1600" y2="250" stroke="#6366f1" stroke-width="1"/>
        <circle cx="1400" cy="250" r="4" fill="#6366f1"/>
        <line x1="1600" y1="0" x2="1600" y2="180" stroke="#06b6d4" stroke-width="1"/>
        <circle cx="1600" cy="180" r="4" fill="#06b6d4"/>
      </g>
      <!-- Glow blob top-left -->
      <radialGradient id="blobGlow" cx="15%" cy="25%" r="35%">
        <stop offset="0%" stop-color="#4f46e5" stop-opacity="0.12"/>
        <stop offset="100%" stop-color="#4f46e5" stop-opacity="0"/>
      </radialGradient>
      <rect width="1920" height="1080" fill="url(#blobGlow)"/>
    `;

    const svg = `
      <svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#060d1e"/>
            <stop offset="45%" stop-color="#0a1628"/>
            <stop offset="100%" stop-color="#060d1e"/>
          </linearGradient>
          <linearGradient id="primaryGlow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#4f46e5"/>
            <stop offset="50%" stop-color="#7c3aed"/>
            <stop offset="100%" stop-color="#06b6d4"/>
          </linearGradient>
          <linearGradient id="titleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#ffffff"/>
            <stop offset="70%" stop-color="#e2e8f0"/>
            <stop offset="100%" stop-color="#a5b4fc"/>
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="shadow">
            <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.4"/>
          </filter>
        </defs>

        <!-- Background -->
        <rect width="1920" height="1080" fill="url(#bgGradient)"/>

        <!-- Subtle dot grid -->
        <defs>
          <pattern id="dotGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="1.2" fill="#1e293b" opacity="0.5"/>
          </pattern>
        </defs>
        <rect width="1920" height="1080" fill="url(#dotGrid)"/>

        ${decorSvg}

        <!-- Top accent bar -->
        <rect x="0" y="0" width="1920" height="4" fill="url(#primaryGlow)"/>

        <!-- Brand Header -->
        <g transform="translate(80, 30)">
          <!-- Logo badge -->
          <rect width="52" height="52" rx="12" fill="#312e81" stroke="#4f46e5" stroke-width="1.5"/>
          <text x="26" y="35" font-family="Segoe UI, sans-serif" font-size="24" font-weight="900" fill="#a5b4fc" text-anchor="middle">K</text>
          <!-- Brand text -->
          <text x="64" y="24" font-family="Segoe UI, Inter, sans-serif" font-size="20" font-weight="700" fill="#c7d2fe" letter-spacing="0.05em">KINETIQ</text>
          <text x="64" y="44" font-family="Segoe UI, Inter, sans-serif" font-size="13" font-weight="400" fill="#6366f1" letter-spacing="0.12em">ACADEMY</text>

          <!-- Scene indicator pill -->
          <g transform="translate(1620, 4)">
            <rect width="150" height="44" rx="22" fill="#0f172a" stroke="#334155" stroke-width="1.5"/>
            <text x="75" y="28" font-family="Segoe UI, Inter, sans-serif" font-size="15" font-weight="600" fill="#94a3b8" text-anchor="middle">SCENE ${sceneNumber} / ${totalScenes}</text>
          </g>
        </g>

        <!-- Divider -->
        <line x1="80" y1="100" x2="1840" y2="100" stroke="#1e293b" stroke-width="1"/>

        <!-- Main Title Section -->
        <g transform="translate(80, 130)">
          <text x="0" y="0" font-family="Segoe UI, Inter, -apple-system, sans-serif" font-size="56" font-weight="800" fill="url(#titleGrad)" filter="url(#glow)" letter-spacing="-0.02em">
            ${this.wrapTextToTspan(escapedTitle, 0, 0, 58, 42)}
          </text>
          <!-- Accent underline -->
          <rect x="0" y="72" width="180" height="5" rx="2.5" fill="url(#primaryGlow)"/>
          <rect x="190" y="72" width="40" height="5" rx="2.5" fill="#6366f1" opacity="0.3"/>
          <rect x="240" y="72" width="20" height="5" rx="2.5" fill="#6366f1" opacity="0.15"/>
        </g>

        <!-- Left Column: Bullet Points -->
        ${bulletsSvg}

        <!-- Right Column: Code or Diagram -->
        ${codeBlockSvg}

        <!-- Bottom narration bar -->
        <g transform="translate(80, 920)">
          <rect width="1760" height="100" rx="16" fill="#050c1a" opacity="0.92" stroke="#1e293b" stroke-width="1.5" filter="url(#shadow)"/>
          <rect width="5" height="60" rx="2.5" x="24" y="20" fill="url(#primaryGlow)"/>
          <text x="46" y="42" font-family="Segoe UI, Inter, sans-serif" font-size="11" font-weight="600" fill="#4f46e5" letter-spacing="0.1em">NARRATION</text>
          <text x="46" y="68" font-family="Segoe UI, Inter, sans-serif" font-size="21" fill="#cbd5e1">
            ${this.wrapTextToTspan(captionText, 0, 0, 28, 110)}
          </text>
        </g>

        <!-- Progress bar -->
        ${progressSvg}
      </svg>
    `;

    await sharp(Buffer.from(svg))
      .png({ quality: 95, compressionLevel: 6 })
      .toFile(outputPath);
  }

  /**
   * Validate a rendered MP4 using ffprobe
   */
  public static async validateVideo(videoPath: string): Promise<VideoValidationReport> {
    const checks: VideoValidationReport['checks'] = [];
    const ffprobePath = getFfprobePath();

    let videoStream = false;
    let audioStream = false;
    let durationSeconds = 0;
    let resolution = 'unknown';
    let codec = 'unknown';
    let audioCodec = 'unknown';
    let fileSizeBytes = 0;
    let ffprobeData: any = null;

    // Check file exists
    if (!fs.existsSync(videoPath)) {
      checks.push({ check: 'File Exists', result: 'FAIL', detail: `File not found: ${videoPath}` });
      return { passed: false, videoStream, audioStream, fileSizeBytes: 0, durationSeconds: 0, resolution, codec, audioCodec, checks };
    }

    fileSizeBytes = fs.statSync(videoPath).size;
    checks.push({
      check: 'File Size',
      result: fileSizeBytes > 50000 ? 'PASS' : 'FAIL',
      detail: `${(fileSizeBytes / 1024).toFixed(0)} KB`,
    });

    // Run ffprobe or fallback to ffmpeg -i
    let probed = false;
    if (fs.existsSync(ffprobePath)) {
      try {
        const { stdout } = await execFileAsync(ffprobePath, [
          '-v', 'quiet', '-print_format', 'json', '-show_streams', '-show_format', videoPath,
        ]);
        ffprobeData = JSON.parse(stdout);
        const streams = ffprobeData.streams || [];
        const format = ffprobeData.format || {};
        durationSeconds = parseFloat(format.duration || '0');

        for (const stream of streams) {
          if (stream.codec_type === 'video') {
            videoStream = true;
            codec = stream.codec_name || 'unknown';
            resolution = `${stream.width}x${stream.height}`;
          }
          if (stream.codec_type === 'audio') {
            audioStream = true;
            audioCodec = stream.codec_name || 'unknown';
          }
        }
        probed = true;
      } catch (err: any) {
        checks.push({ check: 'ffprobe Parse', result: 'WARN', detail: err.message });
      }
    }

    if (!probed) {
      try {
        const [, stderr] = await new Promise<[string, string]>((resolve) => {
          execFile(ffmpegPath as string, ['-i', videoPath], (_err, stdout, stderr) => {
            resolve([stdout || '', stderr || '']);
          });
        });
        const durMatch = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/);
        if (durMatch) {
          durationSeconds = parseInt(durMatch[1], 10) * 3600 + parseInt(durMatch[2], 10) * 60 + parseFloat(durMatch[3]);
        }
        const vMatch = stderr.match(/Video:\s*([a-zA-Z0-9_-]+).*?,\s*([0-9]{3,4}x[0-9]{3,4})/);
        if (vMatch) {
          videoStream = true;
          codec = vMatch[1];
          resolution = vMatch[2];
        }
        const aMatch = stderr.match(/Audio:\s*([a-zA-Z0-9_-]+)/);
        if (aMatch) {
          audioStream = true;
          audioCodec = aMatch[1];
        }
        checks.push({
          check: 'Media Inspection (FFmpeg)',
          result: 'PASS',
          detail: `Parsed via FFmpeg: ${durationSeconds.toFixed(1)}s, ${resolution}, ${codec}/${audioCodec}`,
        });
      } catch (err: any) {
        checks.push({ check: 'FFmpeg Probe', result: 'WARN', detail: err.message });
      }
    }

    checks.push({ check: 'Video Stream', result: videoStream ? 'PASS' : 'FAIL', detail: videoStream ? `codec: ${codec}` : 'No video stream detected' });
    checks.push({ check: 'Audio Stream', result: audioStream ? 'PASS' : 'FAIL', detail: audioStream ? `codec: ${audioCodec}` : 'No audio stream (WARN: may be silent slide show)' });
    checks.push({ check: 'Duration', result: durationSeconds > 5 ? 'PASS' : 'FAIL', detail: `${durationSeconds.toFixed(1)} seconds` });
    checks.push({ check: 'Resolution', result: resolution !== 'unknown' ? 'PASS' : 'WARN', detail: resolution });

    const passed = fileSizeBytes > 50000 && videoStream && durationSeconds > 5;
    return { passed, videoStream, audioStream, fileSizeBytes, durationSeconds, resolution, codec, audioCodec, checks };
  }

  /**
   * Full end-to-end rendering: converts a GeneratedVideoStoryboard into a broadcast-quality MP4 file!
   */
  public static async renderStoryboardToMp4(
    storyboard: GeneratedVideoStoryboard,
    videoAssetId: string
  ): Promise<RenderedVideoResult> {
    const tempDir = path.join(this.uploadsDir, 'temp', videoAssetId);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Ensure output directories exist
    const videosDir = path.join(this.uploadsDir, 'videos');
    const thumbsDir = path.join(this.uploadsDir, 'thumbnails');
    [videosDir, thumbsDir].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

    const sceneVideos: string[] = [];
    const transcript: Array<{ start: number; end: number; text: string }> = [];
    let currentTimestamp = 0;
    const vttLines: string[] = ['WEBVTT', ''];

    const formatVttTime = (sec: number) => {
      const m = Math.floor(sec / 60).toString().padStart(2, '0');
      const s = Math.floor(sec % 60).toString().padStart(2, '0');
      const ms = Math.floor((sec % 1) * 1000).toString().padStart(3, '0');
      return `00:${m}:${s}.${ms}`;
    };

    try {
      const totalScenes = storyboard.scenes.length;
      logger.info(`🎬 Rendering ${totalScenes}-scene educational video for asset ${videoAssetId}...`);

      for (let i = 0; i < totalScenes; i++) {
        const scene = storyboard.scenes[i];
        const sceneNum = i + 1;
        const slideImgPath = path.join(tempDir, `scene_${sceneNum}.png`);
        const sceneAudioPath = path.join(tempDir, `scene_${sceneNum}.mp3`);
        const sceneVideoPath = path.join(tempDir, `scene_${sceneNum}.mp4`);

        logger.info(`  ▶ Rendering scene ${sceneNum}/${totalScenes}: "${scene.title}"`);

        // 1. Render slide image
        await this.renderSceneSlide(
          sceneNum,
          totalScenes,
          scene.title,
          scene.bulletPoints || [],
          scene.codeHighlight,
          scene.narration,
          slideImgPath
        );

        // 2. Generate speech audio (real TTS)
        const durationSec = await this.generateSpeechAudio(
          scene.narration,
          sceneAudioPath,
          scene.durationSeconds || 10
        );

        // 3. Mux scene image and audio into scene MP4 (H.264 / AAC)
        const muxArgs = [
          '-y',
          '-loop', '1',
          '-i', slideImgPath,
          '-i', sceneAudioPath,
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '22',
          '-tune', 'stillimage',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-pix_fmt', 'yuv420p',
          '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2',
          '-shortest',
          sceneVideoPath,
        ];

        await execFileAsync(ffmpegPath as string, muxArgs);
        if (!fs.existsSync(sceneVideoPath)) {
          throw new Error(`Scene ${sceneNum} MP4 was not created.`);
        }
        sceneVideos.push(sceneVideoPath);

        // Transcript tracking
        const startSec = currentTimestamp;
        const endSec = currentTimestamp + durationSec;
        transcript.push({
          start: Math.round(startSec * 10) / 10,
          end: Math.round(endSec * 10) / 10,
          text: scene.narration,
        });

        vttLines.push(`${formatVttTime(startSec)} --> ${formatVttTime(endSec)}`);
        vttLines.push(scene.narration);
        vttLines.push('');

        currentTimestamp = endSec;
        logger.info(`  ✅ Scene ${sceneNum} complete (${durationSec.toFixed(1)}s)`);
      }

      // 4. Concatenate all scene MP4s
      const concatListPath = path.join(tempDir, 'concat_list.txt');
      const concatContent = sceneVideos.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n');
      fs.writeFileSync(concatListPath, concatContent, 'utf8');

      const finalVideoFileName = `${videoAssetId}.mp4`;
      const finalVideoPath = path.join(videosDir, finalVideoFileName);
      const thumbnailFileName = `${videoAssetId}_thumb.png`;
      const thumbnailPath = path.join(thumbsDir, thumbnailFileName);

      logger.info(`  📼 Concatenating ${sceneVideos.length} scenes into final MP4...`);
      const concatArgs = [
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', concatListPath,
        '-c', 'copy',
        finalVideoPath,
      ];

      await execFileAsync(ffmpegPath as string, concatArgs);

      if (!fs.existsSync(finalVideoPath)) {
        throw new Error('Final concatenated MP4 was not produced by FFmpeg.');
      }

      const finalSizeMB = (fs.statSync(finalVideoPath).size / 1024 / 1024).toFixed(2);
      logger.info(`  ✅ Final MP4 created: ${finalVideoPath} (${finalSizeMB} MB, ${currentTimestamp.toFixed(1)}s)`);

      // 5. Extract thumbnail from first scene slide
      if (fs.existsSync(path.join(tempDir, 'scene_1.png'))) {
        await sharp(path.join(tempDir, 'scene_1.png'))
          .resize(1280, 720)
          .jpeg({ quality: 85 })
          .toFile(thumbnailPath.replace('_thumb.png', '_thumb.jpg'));
      }

      // 6. Write VTT captions file
      const vttString = vttLines.join('\n');
      const vttFileName = `${videoAssetId}.vtt`;
      const vttPath = path.join(videosDir, vttFileName);
      fs.writeFileSync(vttPath, vttString, 'utf8');

      // 7. Validate the output
      const validation = await this.validateVideo(finalVideoPath);
      logger.info(`  🔍 Validation: ${validation.passed ? 'PASSED' : 'FAILED'} | ${validation.resolution} | Video:${validation.videoStream} Audio:${validation.audioStream} | ${validation.durationSeconds.toFixed(1)}s`);
      if (!validation.passed) {
        logger.warn('  ⚠️ Video validation did not pass all checks. See report for details.');
      }

      const videoUrl = `/uploads/videos/${finalVideoFileName}`;
      const thumbnailUrl = `/uploads/thumbnails/${thumbnailFileName}`;
      const captionsVttUrl = `/uploads/videos/${vttFileName}`;

      logger.info(`✅ Educational video pipeline complete: ${videoUrl}`);

      return {
        videoUrl,
        thumbnailUrl: thumbnailUrl.replace('_thumb.png', '_thumb.jpg'),
        captionsVttUrl,
        durationSeconds: Math.round(currentTimestamp),
        transcript,
        captionsVtt: vttString,
        ffprobeReport: validation,
      };
    } finally {
      // Clean up temporary rendering chunks
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  }

  /**
   * Links rendered video asset to the LMS database models
   */
  public static async attachVideoToLesson(
    lessonId: string,
    courseId: string,
    title: string,
    rendered: RenderedVideoResult,
    storyboard: GeneratedVideoStoryboard
  ): Promise<VideoAsset> {
    const videoAsset = await VideoAsset.create({
      lessonId,
      courseId,
      title,
      videoUrl: rendered.videoUrl,
      thumbnailUrl: rendered.thumbnailUrl,
      durationSeconds: rendered.durationSeconds,
      videoStyle: storyboard.style || 'technical_whiteboard',
      script: storyboard.scenes.map(s => s.narration).join('\n\n'),
      storyboard: storyboard.scenes,
      captionsVtt: rendered.captionsVtt,
      transcript: rendered.transcript,
      provider: 'scene_renderer_v2',
      status: 'ready',
    });

    // Update lesson model
    await Lesson.update(
      {
        videoUrl: rendered.videoUrl,
        durationMinutes: Math.max(1, Math.ceil(rendered.durationSeconds / 60)),
      },
      { where: { id: lessonId } }
    );

    return videoAsset;
  }
}
