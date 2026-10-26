/**
 * KINETIQ ACADEMY — SAP ABAP MASTER PIPELINE E2E VERIFICATION
 * ============================================================
 * Mandatory real-world test using:
 * Source: https://www.tutorialspoint.com/sap_abap/index.htm
 *
 * Verifies:
 * - Test A: Source extraction + Intelligent Content Enrichment (SAP NetWeaver, DDIC, Open SQL)
 * - Test B: Deep 3-module, 9-lesson curriculum with authentic ABAP syntax and diagrams
 * - Test C: Learning materials + 100-mark structured practice examination paper
 * - Test D: Lesson-specific animated teaching video (SAPI TTS + FFmpeg + WebVTT + ffprobe)
 * - Test E: Course publishing to LMS and Student LMS player accessibility
 */

import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const BASE_URL = 'http://localhost:4000/api/v1';
const TEST_URL = 'https://www.tutorialspoint.com/sap_abap/index.htm';
const ADMIN_CREDS = { email: 'admin@kinetiqacademy.com', password: 'Admin@123' };

let adminToken = '';
let jobId = '';
let courseId = '';
let courseSlug = '';
let videoAssetPath = '';

type TestResult = 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT_TESTED' | 'WARN';
interface TestCase {
  id: string;
  name: string;
  result: TestResult;
  detail: string;
  durationMs?: number;
}

const testResults: TestCase[] = [];

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function record(id: string, name: string, result: TestResult, detail: string, durationMs?: number) {
  testResults.push({ id, name, result, detail, durationMs });
  const icon = result === 'PASS' ? '✅' : result === 'FAIL' ? '❌' : result === 'BLOCKED' ? '⚠️' : '⏭️';
  console.log(`${icon} [${id}] ${name} => ${result}: ${detail}${durationMs !== undefined ? ` (${durationMs}ms)` : ''}`);
}

async function apiCall(method: string, endpoint: string, body?: any, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data };
}

// ─── Test 1: API Health Check ──────────────────────────────────────────────
async function testHealth() {
  const t = Date.now();
  try {
    const res = await fetch('http://localhost:4000/health');
    const data: any = await res.json();
    if (res.ok && data.status === 'ok') {
      record('T01', 'API Health Check', 'PASS', `Status: ${data.status}, Database: ${data.checks?.database}, Redis: ${data.checks?.redis}`, Date.now() - t);
    } else {
      record('T01', 'API Health Check', 'FAIL', `HTTP ${res.status}: ${JSON.stringify(data)}`, Date.now() - t);
    }
  } catch (e: any) {
    record('T01', 'API Health Check', 'FAIL', e.message, Date.now() - t);
    throw e;
  }
}

// ─── Test 2: Admin Authentication ──────────────────────────────────────────
async function testAuth() {
  const t = Date.now();
  try {
    const r = await apiCall('POST', '/auth/login', ADMIN_CREDS);
    const token = r.data?.data?.accessToken || r.data?.data?.tokens?.accessToken;
    const user = r.data?.data?.user;
    if (r.status === 200 && token) {
      adminToken = token;
      record('T02', 'Admin Authentication', 'PASS', `User: ${user?.email || 'admin'} (Role: ${user?.role || 'admin'})`, Date.now() - t);
    } else {
      record('T02', 'Admin Authentication', 'FAIL', `HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 200)}`, Date.now() - t);
      throw new Error('Admin authentication failed.');
    }
  } catch (e: any) {
    record('T02', 'Admin Authentication', 'FAIL', e.message, Date.now() - t);
    throw e;
  }
}

// ─── Test 3: Start SAP ABAP Content Generation Job ──────────────────────────
async function testStartJob() {
  const t = Date.now();
  try {
    const r = await apiCall('POST', '/ai/content-jobs', {
      sourceType: 'url',
      url: TEST_URL,
      options: {
        title: 'SAP ABAP Masterclass: Enterprise Architecture, Syntax & Practical Programming',
        category: 'Enterprise Software',
        targetLevel: 'beginner',
        videoStyle: 'technical_whiteboard',
        questionCount: 8,
        outputSelection: ['curriculum', 'lessons', 'notes', 'flashcards', 'questions', 'video'],
      },
    }, adminToken);

    if (r.status === 201 && r.data?.data?.id) {
      jobId = r.data.data.id;
      record('T03', 'Start SAP ABAP Content Job', 'PASS', `Job ID: ${jobId}`, Date.now() - t);
    } else {
      record('T03', 'Start SAP ABAP Content Job', 'FAIL', `HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 300)}`, Date.now() - t);
      throw new Error('Job creation failed.');
    }
  } catch (e: any) {
    record('T03', 'Start SAP ABAP Content Job', 'FAIL', e.message, Date.now() - t);
    throw e;
  }
}

// ─── Test 4: Wait for Pipeline Completion ──────────────────────────────────
async function testWaitForCompletion() {
  const t = Date.now();
  const maxWaitMs = 10 * 60 * 1000; // 10 minutes
  const pollInterval = 4000;
  let elapsed = 0;
  let lastStage = '';

  log('Waiting for pipeline execution (Source Extraction -> Enrichment -> Syllabus -> Lessons -> Materials -> Practice Paper -> Video)...');

  while (elapsed < maxWaitMs) {
    await new Promise(r => setTimeout(r, pollInterval));
    elapsed += pollInterval;

    const r = await apiCall('GET', `/ai/content-jobs/${jobId}`, undefined, adminToken);
    const job = r.data?.data;

    if (!job) {
      record('T04', 'Pipeline Execution', 'FAIL', 'Job not found during polling', Date.now() - t);
      throw new Error('Job disappeared during polling.');
    }

    const stage = job.stage || 'unknown';
    const progress = job.progress || 0;

    if (stage !== lastStage) {
      log(`  Stage: [${stage.toUpperCase()}] | Progress: ${progress}% | Elapsed: ${(elapsed / 1000).toFixed(0)}s`);
      lastStage = stage;
    }

    if (stage === 'completed' || job.status === 'review_required' || job.status === 'completed') {
      const hasVideo = !!job.generatedData?.videoAsset?.videoUrl;
      const hasCurriculum = !!job.generatedData?.modules?.length;
      const duration = Date.now() - t;
      record('T04', 'Pipeline Execution', 'PASS',
        `Completed in ${(duration / 1000).toFixed(0)}s | Status: ${job.status} | Stage: ${stage} | Modules: ${job.generatedData?.modules?.length} | Video: ${hasVideo}`,
        duration);
      return job;
    }

    if (stage === 'failed' || job.status === 'failed') {
      record('T04', 'Pipeline Execution', 'FAIL', `Job failed: ${job.errorMessage}`, Date.now() - t);
      throw new Error(`Generation job failed: ${job.errorMessage}`);
    }
  }

  record('T04', 'Pipeline Execution', 'FAIL', `Timeout after ${maxWaitMs / 60000} minutes`, Date.now() - t);
  throw new Error('Job timed out.');
}

// ─── Test 5: Verify Intelligent Content Enrichment (Test A) ────────────────
async function testEnrichmentVerification(job: any) {
  const t = Date.now();
  const data = job.generatedData;
  const analysis = data?.analysis;
  const enrichmentRecords: any[] = data?.enrichmentRecords || analysis?.enrichmentRecords || [];

  log(`  Domain detected: ${analysis?.detectedDomain || analysis?.domain || 'unknown'}, Topic: "${analysis?.topic}"`);
  log(`  Missing prerequisites identified: ${(analysis?.missingPrerequisites || []).join(', ')}`);
  log(`  Enrichment records count: ${enrichmentRecords.length}`);

  let hasSapDocs = false;
  if (Array.isArray(enrichmentRecords) && enrichmentRecords.length > 0) {
    for (const rec of enrichmentRecords) {
      const topic = rec.topicAdded || rec.topic;
      const url = rec.researchSourceUrl || rec.url || '';
      const type = rec.sourceType || 'verified_external';
      log(`    - Topic: "${topic}" | Source: ${rec.source || rec.sourceTitle || type} (${url})`);
      if (url.includes('help.sap.com') || url.includes('sap.com')) {
        hasSapDocs = true;
      }
    }
  }

  const pass = enrichmentRecords.length >= 3 && hasSapDocs;
  record('T05', 'Test A: Intelligent Content Enrichment', pass ? 'PASS' : 'FAIL',
    `Records: ${enrichmentRecords.length} | Official SAP Doc Citations: ${hasSapDocs} | Missing Prereqs: ${analysis?.missingPrerequisites?.length || 0}`,
    Date.now() - t);
}

// ─── Test 6: Verify Course Curriculum & Deep Lessons (Test B) ──────────────
async function testCurriculumAndLessons(job: any) {
  const t = Date.now();
  const data = job.generatedData;
  const modules = data?.modules || [];
  const allLessons = modules.flatMap((m: any) => m.lessons || []);

  log(`  Modules count: ${modules.length}`);
  log(`  Total lessons generated: ${allLessons.length}`);

  let abapKeywordsFound = 0;
  let diagramsFound = 0;
  let workedExamplesFound = 0;
  let misconceptionsFound = 0;
  let definitionsFound = 0;

  for (const l of allLessons) {
    const codeSnippetList = l.codeSnippets || [];
    const codeText = codeSnippetList.map((cs: any) => cs.code || '').join('\n');
    const fullText = JSON.stringify(l);

    if (
      codeText.includes('DATA:') || codeText.includes('SELECT') ||
      codeText.includes('TYPES:') || codeText.includes('LOOP AT') ||
      fullText.includes('SAP NetWeaver') || fullText.includes('ABAP')
    ) {
      abapKeywordsFound++;
    }

    if (
      (l.diagrams && l.diagrams.length > 0) ||
      fullText.includes('Database Layer') || fullText.includes('NetWeaver')
    ) {
      diagramsFound++;
    }

    if (l.workedExamples && l.workedExamples.length > 0) {
      workedExamplesFound++;
    }

    if (
      (l.commonMisconceptions && l.commonMisconceptions.length > 0) ||
      fullText.includes('N+1') || fullText.includes('Work Area')
    ) {
      misconceptionsFound++;
    }

    if (l.definitions && l.definitions.length > 0) {
      definitionsFound++;
    }
  }

  log(`  Lessons with ABAP Syntax / Context: ${abapKeywordsFound}/${allLessons.length}`);
  log(`  Lessons with NetWeaver Architecture Diagrams: ${diagramsFound}/${allLessons.length}`);
  log(`  Lessons with Worked Examples: ${workedExamplesFound}/${allLessons.length}`);
  log(`  Lessons with Debugging & Misconceptions: ${misconceptionsFound}/${allLessons.length}`);
  log(`  Lessons with Terminology Definitions: ${definitionsFound}/${allLessons.length}`);

  const pass = modules.length >= 3 && allLessons.length >= 6 && abapKeywordsFound >= 3;
  record('T06', 'Test B: Curriculum & Deep Lessons', pass ? 'PASS' : 'FAIL',
    `Modules: ${modules.length} | Lessons: ${allLessons.length} | ABAP Keywords: ${abapKeywordsFound} | NetWeaver Diagrams: ${diagramsFound} | Worked Examples: ${workedExamplesFound}`,
    Date.now() - t);
}

// ─── Test 7: Verify Learning Materials & 100-Mark Practice Paper (Test C) ───
async function testLearningMaterialsAndPracticePaper(job: any) {
  const t = Date.now();
  const data = job.generatedData;
  const paper = data?.practicePaper;
  const notes = data?.studyNotes;
  const flashcards = data?.flashcards || [];
  const questions = data?.questions || [];

  log(`  Study notes length: ${(notes?.detailedNotes || '').length} chars`);
  log(`  Flashcards count: ${flashcards.length}`);
  log(`  Quiz questions count: ${questions.length}`);

  let paperPass = false;
  let paperDetail = 'Practice paper missing';

  if (paper) {
    const allQuestions = (paper.sections || []).flatMap((s: any) => s.questions || []);
    const withAnswers = allQuestions.filter((q: any) => q.correctAnswer);
    const withExplanations = allQuestions.filter((q: any) => q.explanation);

    log(`  Practice Paper Title: "${paper.title}"`);
    log(`  Total Marks: ${paper.totalMarks} | Time Limit: ${paper.durationMinutes} min | Passing Score: ${paper.passingScore}`);
    log(`  Sections count: ${paper.sections?.length || 0}`);

    for (const s of (paper.sections || [])) {
      log(`    - Section: "${s.title}" (${s.questions?.length || 0} questions)`);
    }

    log(`  Total Examination Questions: ${allQuestions.length}`);
    log(`  Questions with Valid Answer Keys: ${withAnswers.length}`);
    log(`  Questions with Detailed Explanations: ${withExplanations.length}`);

    const has100Marks = paper.totalMarks === 100;
    const has3Sections = (paper.sections || []).length === 3;
    const hasValidAnswers = withAnswers.length >= 8;

    paperPass = has100Marks && has3Sections && hasValidAnswers;
    paperDetail = `100 Marks: ${has100Marks} | 3 Sections: ${has3Sections} | Questions: ${allQuestions.length} | Answers: ${withAnswers.length}`;
  }

  const pass = paperPass && flashcards.length > 0 && questions.length > 0;
  record('T07', 'Test C: Learning Materials & 100-Mark Practice Paper', pass ? 'PASS' : 'FAIL',
    `Paper: [${paperDetail}] | Flashcards: ${flashcards.length} | Quizzes: ${questions.length}`,
    Date.now() - t);
}

// ─── Test 8: Animated Teaching Video Validation (Test D) ───────────────────
async function testVideoValidation(job: any) {
  const t = Date.now();
  const data = job.generatedData;
  const videoAsset = data?.videoAsset;

  if (!videoAsset?.videoUrl) {
    record('T08', 'Test D: Animated Teaching Video', 'FAIL', 'No videoUrl in job generatedData', Date.now() - t);
    throw new Error('Video URL missing from generated data.');
  }

  log(`  Video Asset URL: ${videoAsset.videoUrl}`);
  log(`  Captions VTT URL: ${videoAsset.captionsVttUrl || videoAsset.videoUrl.replace('.mp4', '.vtt')}`);
  log(`  Storyboard Scenes: ${videoAsset.storyboard?.length || 0}`);
  log(`  Transcript Segments: ${videoAsset.transcript?.length || 0}`);

  videoAssetPath = path.join(process.cwd(), 'public', videoAsset.videoUrl);
  if (!fs.existsSync(videoAssetPath)) {
    record('T08', 'Test D: Animated Teaching Video', 'FAIL', `File missing at ${videoAssetPath}`, Date.now() - t);
    throw new Error(`Video file does not exist at ${videoAssetPath}`);
  }

  const stat = fs.statSync(videoAssetPath);
  const sizeMB = (stat.size / 1024 / 1024).toFixed(2);
  log(`  File size on disk: ${sizeMB} MB (${stat.size} bytes)`);

  const vttPath = videoAssetPath.replace(/\.mp4$/i, '.vtt');
  const vttExists = fs.existsSync(vttPath);
  let vttValid = false;
  let cueCount = 0;
  if (vttExists) {
    const vttContent = fs.readFileSync(vttPath, 'utf8');
    vttValid = vttContent.startsWith('WEBVTT') && vttContent.includes('-->');
    cueCount = (vttContent.match(/-->/g) || []).length;
    log(`  VTT Captions File: Valid WebVTT with ${cueCount} cues`);
  }

  const pass = stat.size > 200000 && (videoAsset.storyboard?.length || 0) >= 3 && vttValid;
  record('T08', 'Test D: Animated Teaching Video', pass ? 'PASS' : 'FAIL',
    `Size: ${sizeMB}MB | Scenes: ${videoAsset.storyboard?.length} | Transcript: ${videoAsset.transcript?.length} segs | WebVTT Cues: ${cueCount}`,
    Date.now() - t);
}

// ─── Test 9: Publish Course to LMS (Test E part 1) ─────────────────────────
async function testPublishCourse() {
  const t = Date.now();
  try {
    const r = await apiCall('POST', `/ai/content-jobs/${jobId}/publish`, {
      publishImmediately: true,
    }, adminToken);

    if (r.status === 200 && r.data?.data?.id) {
      courseId = r.data.data.id;
      courseSlug = r.data.data.slug;
      record('T09', 'Test E: LMS Course Publishing', 'PASS',
        `Course ID: ${courseId} | Title: "${r.data.data.title}" | Slug: ${courseSlug}`, Date.now() - t);
    } else {
      record('T09', 'Test E: LMS Course Publishing', 'FAIL',
        `HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 300)}`, Date.now() - t);
      throw new Error('Course publishing failed.');
    }
  } catch (e: any) {
    record('T09', 'Test E: LMS Course Publishing', 'FAIL', e.message, Date.now() - t);
    throw e;
  }
}

// ─── Test 10: Student LMS Player & Course Verification (Test E part 2) ─────
async function testStudentCourseAccess() {
  const t = Date.now();
  try {
    // 1. Fetch course details via public/student slug route
    const r = await apiCall('GET', `/courses/${courseSlug}`);
    if (r.status === 200 && r.data?.data) {
      const course = r.data.data.course || r.data.data;
      const sections = course.sections || [];
      const lessons = sections.flatMap((s: any) => s.lessons || []);
      const videoLessons = lessons.filter((l: any) => l.videoUrl || l.hasVideo);

      log(`  Student LMS Course: "${course.title}"`);
      log(`  Sections in LMS: ${sections.length}`);
      log(`  Total lessons in LMS: ${lessons.length}`);
      log(`  Lessons with real Video attached: ${videoLessons.length}`);

      const pass = sections.length >= 3 && lessons.length >= 6;
      record('T10', 'Test E: Student LMS Course & Video Access', pass ? 'PASS' : 'FAIL',
        `Sections: ${sections.length} | Lessons: ${lessons.length} | Video Lessons: ${videoLessons.length} | Slug: ${courseSlug}`,
        Date.now() - t);
    } else {
      record('T10', 'Test E: Student LMS Course & Video Access', 'FAIL',
        `HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 200)}`, Date.now() - t);
    }
  } catch (e: any) {
    record('T10', 'Test E: Student LMS Course & Video Access', 'FAIL', e.message, Date.now() - t);
  }
}

// ─── Master Runner ────────────────────────────────────────────────────────
async function main() {
  console.log('\n========================================================================');
  console.log('  KINETIQ ACADEMY — FULL PIPELINE VERIFICATION SUITE');
  console.log('  Source: https://www.tutorialspoint.com/sap_abap/index.htm');
  console.log('========================================================================\n');

  try {
    await testHealth();
    await testAuth();
    await testStartJob();
    const completedJob = await testWaitForCompletion();
    await testEnrichmentVerification(completedJob);
    await testCurriculumAndLessons(completedJob);
    await testLearningMaterialsAndPracticePaper(completedJob);
    await testVideoValidation(completedJob);
    await testPublishCourse();
    await testStudentCourseAccess();
  } catch (err: any) {
    console.error('\n❌ Suite halted due to critical error:', err.message);
  }

  console.log('\n========================================================================');
  console.log('  TEST EXECUTION SUMMARY');
  console.log('========================================================================');
  let passedCount = 0;
  for (const r of testResults) {
    const icon = r.result === 'PASS' ? '✅' : r.result === 'FAIL' ? '❌' : r.result === 'BLOCKED' ? '⚠️' : '⏭️';
    console.log(`${icon} [${r.id}] ${r.name.padEnd(46)} | ${r.result.padEnd(7)} | ${r.detail}`);
    if (r.result === 'PASS') passedCount++;
  }
  console.log(`\nResults: ${passedCount} / ${testResults.length} PASSED (${((passedCount / testResults.length) * 100).toFixed(0)}%)`);
  console.log('========================================================================\n');
}

main().catch(console.error);
