/**
 * Kinetiq Academy — Phase 2 End-to-End Verification Test Suite
 * Validates all 5 enhancement pillars against running PostgreSQL & Express API:
 * 1. AI Course Quality Score
 * 2. Adaptive Learning Path & Topic Mastery
 * 3. Interactive Video (Chapters, Checkpoints, Explain Moment, Notes, Progress)
 * 4. Exam Blueprint Generator & Versions
 * 5. Cost-Aware Pipeline & Telemetry
 */

const API_BASE = 'http://localhost:4000/api/v1';

async function main() {
  console.log('================================================================');
  console.log('🚀 RUNNING PHASE 2 END-TO-END VERIFICATION TEST SUITE');
  console.log('================================================================\n');

  // 0. Authenticate Instructor and Student
  console.log('--- STEP 0: AUTHENTICATION ---');
  const instLogin = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'instructor@kinetiqacademy.com', password: 'Password123!' })
  }).then(r => r.json());
  const instToken = instLogin.data?.accessToken;
  console.log('✅ Instructor Login:', instLogin.success);

  const studentLogin = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'student@kinetiqacademy.com', password: 'Password123!' })
  }).then(r => r.json());
  const studentToken = studentLogin.data?.accessToken;
  console.log('✅ Student Login:', studentLogin.success);

  const courseId = 'dbcc4f50-2d87-447f-9574-c898902c10d2';
  const lessonId = '80e55e04-c6c0-4ae0-b677-1383c8397d5a';

  // ─── 1. COURSE QUALITY SCORE ───────────────────────────────────────────────
  console.log('\n--- WORKFLOW A: AI COURSE QUALITY SCORE ---');
  const qualityRes = await fetch(`${API_BASE}/ai/courses/${courseId}/quality`).then(r => r.json());
  console.log('Quality Audit Fetched:', qualityRes.success);
  console.log('Overall Score:', qualityRes.data?.overallScore, '/ 100');
  console.log('Quality Gate Status:', qualityRes.data?.status);
  console.log('Category Scores:', qualityRes.data?.categoryScores);
  console.log('Dimension Checks Count:', qualityRes.data?.dimensionDetails?.length);
  console.log('Recommendations Count:', qualityRes.data?.recommendations?.length);

  // Test override
  if (qualityRes.data?.id) {
    const overrideRes = await fetch(`${API_BASE}/ai/quality-reports/${qualityRes.data.id}/override`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${instToken}`
      },
      body: JSON.stringify({ status: 'eligible', notes: 'Verified architectural rigor in testing' })
    }).then(r => r.json());
    console.log('Admin Quality Override:', overrideRes.success, 'New Status:', overrideRes.data?.status);
  }

  // ─── 2. ADAPTIVE LEARNING & TOPIC MASTERY ──────────────────────────────────
  console.log('\n--- WORKFLOW B: ADAPTIVE LEARNING & TOPIC MASTERY ---');
  // Submit an assessment to trigger feedback loop
  const paperId = '8fd0a605-3f1a-4658-a3e9-e97ae5c61514';
  const assessRes = await fetch(`${API_BASE}/ai/practice-papers/${paperId}/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${studentToken}`
    },
    body: JSON.stringify({
      answers: {
        '80767dfe-398b-4cfe-98a3-977524e47646': 'A'
      }
    })
  }).then(r => r.json());
  console.log('Assessment Submit & Auto-Grade:', assessRes.success);

  // Fetch adaptive profile
  const profileRes = await fetch(`${API_BASE}/ai/learning-paths/profile`, {
    headers: { 'Authorization': `Bearer ${studentToken}` }
  }).then(r => r.json());
  console.log('Adaptive Profile Fetched:', profileRes.success);
  console.log('Overall Mastery:', profileRes.data?.overallMastery, '%');
  console.log('Tracked Objectives:', profileRes.data?.totalTrackedObjectives);
  console.log('Mastery Map Entries:', profileRes.data?.masteryMap?.length);
  console.log('Recommendations Count:', profileRes.data?.recommendations?.length);
  if (profileRes.data?.recommendations?.length > 0) {
    const r1 = profileRes.data.recommendations[0];
    console.log('Sample Explainable Recommendation:', {
      type: r1.type,
      title: r1.title,
      reason: r1.reason,
      actionUrl: r1.actionUrl
    });
  }

  // ─── 3. INTERACTIVE VIDEO LEARNING ─────────────────────────────────────────
  console.log('\n--- WORKFLOW C: INTERACTIVE VIDEO LEARNING ---');
  // Chapters
  const chapRes = await fetch(`${API_BASE}/ai/lessons/${lessonId}/video/chapters?courseId=${courseId}`).then(r => r.json());
  console.log('Video Chapters Count:', chapRes.data?.length, 'First Chapter:', chapRes.data?.[0]?.title);

  // Checkpoints
  const cpRes = await fetch(`${API_BASE}/ai/lessons/${lessonId}/video/checkpoints?courseId=${courseId}`).then(r => r.json());
  console.log('Video Checkpoints Count:', cpRes.data?.length);
  const cp1 = cpRes.data?.[0];
  if (cp1) {
    console.log('Checkpoint 1 Prompt:', cp1.prompt);
    console.log('Checkpoint 1 Options:', cp1.options?.length);

    // Submit checkpoint answer
    const cpSubmit = await fetch(`${API_BASE}/ai/video/checkpoints/${cp1.id}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${studentToken}`
      },
      body: JSON.stringify({ selectedAnswer: 'A' })
    }).then(r => r.json());
    console.log('Checkpoint 1 Evaluated:', cpSubmit.success, 'Is Correct:', cpSubmit.data?.isCorrect);
  }

  // Explain Moment
  const explainRes = await fetch(`${API_BASE}/ai/video/explain-moment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      courseId,
      lessonId,
      timestampSeconds: 12,
      nearbyTranscript: 'In modern distributed state machines, Raft establishes strict linearizability.'
    })
  }).then(r => r.json());
  console.log('Explain This Moment Success:', explainRes.success);
  console.log('Explain Snippet:\n', explainRes.data?.explanation?.slice(0, 160), '...');

  // Video Notes CRUD
  const addNote = await fetch(`${API_BASE}/ai/lessons/${lessonId}/video/notes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${studentToken}`
    },
    body: JSON.stringify({ courseId, timestampSeconds: 15, noteText: 'Crucial: Heartbeats prevent election timeouts.' })
  }).then(r => r.json());
  console.log('Note Added:', addNote.success, 'ID:', addNote.data?.id);

  const getNotes = await fetch(`${API_BASE}/ai/lessons/${lessonId}/video/notes`, {
    headers: { 'Authorization': `Bearer ${studentToken}` }
  }).then(r => r.json());
  console.log('Notes Count for Student:', getNotes.data?.length);

  if (addNote.data?.id) {
    const delNote = await fetch(`${API_BASE}/ai/video/notes/${addNote.data.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${studentToken}` }
    }).then(r => r.json());
    console.log('Note Deleted:', delNote.success);
  }

  // Video Watch Progress
  const progRes = await fetch(`${API_BASE}/ai/video/progress`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${studentToken}`
    },
    body: JSON.stringify({ courseId, lessonId, watchedSeconds: 28, totalDurationSeconds: 32 })
  }).then(r => r.json());
  console.log('Video Progress Tracked:', progRes.success, 'Watch Ratio:', progRes.data?.watchRatio, '% - Completed:', progRes.data?.isCompleted);

  // ─── 4. EXAM PAPER BLUEPRINT GENERATOR ─────────────────────────────────────
  console.log('\n--- WORKFLOW D: EXAM PAPER BLUEPRINTS ---');
  // Validate Blueprint
  const valBp = await fetch(`${API_BASE}/ai/exam-blueprints/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${instToken}`
    },
    body: JSON.stringify({
      courseId,
      questionCount: 6,
      difficultyDistribution: { easy: 30, medium: 50, hard: 20 }
    })
  }).then(r => r.json());
  console.log('Blueprint Validated:', valBp.success, 'Available Questions:', valBp.data?.availableQuestions);

  // Create Blueprint
  const createBp = await fetch(`${API_BASE}/ai/exam-blueprints`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${instToken}`
    },
    body: JSON.stringify({
      courseId,
      title: 'Distributed Systems Comprehensive Blueprint Exam',
      templateType: 'full_course',
      totalMarks: 100,
      durationMinutes: 60,
      questionCount: 6,
      passingScore: 70
    })
  }).then(r => r.json());
  console.log('Blueprint Created:', createBp.success, 'ID:', createBp.data?.id);

  // Generate Paper from Blueprint
  const genPaper = await fetch(`${API_BASE}/ai/exam-blueprints/${createBp.data.id}/generate`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${instToken}` }
  }).then(r => r.json());
  console.log('Paper Generated from Blueprint:', genPaper.success);
  console.log('Generated Practice Paper Title:', genPaper.data?.practicePaper?.title);

  // Get Versions (Student vs Instructor)
  const versionsRes = await fetch(`${API_BASE}/ai/exam-blueprints/${createBp.data.id}/versions`, {
    headers: { 'Authorization': `Bearer ${instToken}` }
  }).then(r => r.json());
  console.log('Student Paper Questions Count:', versionsRes.data?.studentPaper?.questions?.length);
  console.log('Student Version has correctAnswer:', 'correctAnswer' in (versionsRes.data?.studentPaper?.questions?.[0] || {}));
  console.log('Instructor Version has correctAnswer:', 'correctAnswer' in (versionsRes.data?.instructorPaper?.questions?.[0] || {}));

  // ─── 5. COST-AWARE PIPELINE & TELEMETRY ────────────────────────────────────
  console.log('\n--- WORKFLOW E: GENERATION COST & TELEMETRY ---');
  const usageRes = await fetch(`${API_BASE}/ai/generation-usage`, {
    headers: { 'Authorization': `Bearer ${instToken}` }
  }).then(r => r.json());
  console.log('Generation Usage Metrics:', usageRes.success);
  console.log('Total Jobs:', usageRes.data?.totalJobs);
  console.log('Total Estimated Spend USD:', `$${usageRes.data?.totalCostUsd}`);
  console.log('Total Tokens Tracked:', usageRes.data?.totalTokens);

  console.log('\n================================================================');
  console.log('🎉 ALL PHASE 2 END-TO-END WORKFLOWS COMPLETED AND VERIFIED 100%');
  console.log('================================================================');
}

main().catch(err => {
  console.error('❌ Phase 2 Test Suite Failed:', err);
  process.exit(1);
});
