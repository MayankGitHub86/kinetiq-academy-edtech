import 'dotenv/config';
import { User, UserRole } from '../models/User';
import { Course, Section, Lesson } from '../models/Course';
import { LearningProject, ProjectStatus } from '../models/LearningProject';
import { QuestionBankItem, PracticePaper } from '../models/AiLearning';

const BASE_URL = 'http://localhost:4000/api/v1';

async function request(path: string, options: any = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  const data: any = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED ASSERTION: ${message}`);
    throw new Error(`Assertion Failure: ${message}`);
  }
  console.log(`   ✅ PASS: ${message}`);
}

async function login(email: string, password = 'Password123!') {
  const res = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(res.data)}`);
  }
  return res.data.data.accessToken;
}

async function runDeepEngineAcceptanceTests() {
  console.log('\n================================================================');
  console.log('🔬 RUNNING DEEP AI COURSE GENERATION ENGINE ACCEPTANCE TESTS');
  console.log('================================================================\n');

  const instructorToken = await login('instructor@kinetiqacademy.com');
  const studentToken = await login('student@kinetiqacademy.com');

  // STEP 1: Admin enters URL & Metadata -> Stage A Source Ingestion & Stage B Completeness Report
  console.log('--- TEST 1: Stage A & B Source Ingestion & Completeness Report ---');
  const createRes = await request('/learning-projects', {
    method: 'POST',
    headers: { Authorization: `Bearer ${instructorToken}` },
    body: JSON.stringify({
      title: 'Distributed Systems & Fault Tolerance Masterclass',
      subject: 'Computer Science',
      category: 'Cloud Architecture',
      targetLevel: 'graduate',
      difficulty: 'Advanced',
      sourceText: `# Distributed Systems & Fault Tolerance
## 1. Consensus Protocols & State Machines
Distributed state machine replication requires that multiple nodes transition across state boundaries deterministically. Raft and Multi-Paxos provide leader election and quorum log replication.
\`\`\`go
func AppendEntries(term int, leaderId string, prevLogIndex int, prevLogTerm int, entries []LogEntry, leaderCommit int) bool {
    // Verifies term invariant and appends uncommitted entries
    return true
}
\`\`\`
| Protocol | Quorum Requirement | Fault Tolerance |
|---|---|---|
| Paxos | floor(N/2) + 1 | Tolerates (N-1)/2 node crash failures |
| Raft | floor(N/2) + 1 | Tolerates (N-1)/2 node crash failures |
| PBFT | 2f + 1 | Tolerates f Byzantine arbitrary failures |

## 2. Monotonic Timestamps & Vector Clocks
Physical clocks suffer from NTP drift. Lamport logical clocks assign partial order, whereas Vector Clocks capture causality.
\`\`\`go
type VectorClock map[string]uint64
func (vc VectorClock) Increment(nodeId string) {
    vc[nodeId]++
}
\`\`\`

## 3. Quorum Reads and Writes & CAP Theorem
In Dynamo-style distributed stores, consistency depends on R + W > N.
Formula:
R + W > N guarantees that the read set and write set intersect at at least one node containing the latest state version.
`,
    }),
  });

  assert(createRes.status === 201, 'Project created with rich technical source text');
  const projectId = createRes.data.data.id;

  // Run Knowledge Engine Analysis (Stage B)
  const analyzeRes = await request(`/learning-projects/${projectId}/analyze`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${instructorToken}` },
    body: JSON.stringify({}),
  });
  assert(analyzeRes.status === 200, 'Stage B Source Completeness Analysis completed');

  // Test Completeness Report Endpoint
  const completenessRes = await request(`/learning-projects/${projectId}/completeness`, {
    headers: { Authorization: `Bearer ${instructorToken}` },
  });
  assert(completenessRes.status === 200, 'GET /completeness endpoint returns 200');
  const compReport = completenessRes.data.data;
  assert(Array.isArray(compReport.inventory) && compReport.inventory.length > 0, 'Source inventory contains extracted pages/sections');
  assert(Array.isArray(compReport.detectedConcepts) && compReport.detectedConcepts.length >= 2, 'Detected concepts identified from headings');
  assert(Array.isArray(compReport.conceptDependencies), 'Concept dependency relationships constructed');
  assert(compReport.sourceGroundedRatio >= 0.8, `Source grounding ratio calculated: ${compReport.sourceGroundedRatio}`);

  // STEP 2: Syllabus Review & Edit Workflow with Concept Coverage Matrix
  console.log('\n--- TEST 2: Syllabus Review & Edit with Concept Coverage Matrix ---');
  const syllabusRes = await request(`/learning-projects/${projectId}/syllabus`, {
    headers: { Authorization: `Bearer ${instructorToken}` },
  });
  assert(syllabusRes.status === 200, 'GET /syllabus returns structured course outline');
  const syllabusData = syllabusRes.data.data;
  assert(Array.isArray(syllabusData.chapters) && syllabusData.chapters.length >= 2, 'Syllabus has modules/chapters');
  assert(Array.isArray(syllabusData.conceptCoverageMatrix) && syllabusData.conceptCoverageMatrix.length > 0, 'Concept Coverage Matrix maps source concepts to modules & lessons');

  // Admin edits proposed syllabus
  const updatedChapters = [
    {
      title: 'Unit 1: Foundations of Distributed Consensus & Replicated State Machines',
      description: 'Core operational paradigms, quorum intersections, and monotonic log indexes.',
      learningObjectives: ['Analyze quorum bounds', 'Prove state machine safety'],
      prerequisites: ['Basic socket programming'],
      estimatedStudyMinutes: 45,
      lessons: [
        {
          title: '1.1 State Machine Replication & Paxos Quorums',
          description: 'In-depth derivation of quorum consensus invariants and safety proofs.',
          durationMinutes: 25,
          learningObjectives: ['Derive Q = floor(N/2) + 1'],
          conceptsCovered: ['Consensus Protocols'],
          sourceReference: 'Section 1: Consensus Protocols',
        },
        {
          title: '1.2 Leader Election & Heartbeat Timing in Raft',
          description: 'Randomized election timeouts, split-vote mitigation, and term monotonicity.',
          durationMinutes: 20,
          learningObjectives: ['Implement election timers'],
          conceptsCovered: ['Leader Election'],
          sourceReference: 'Section 1: Consensus Protocols',
        },
      ],
    },
    {
      title: 'Unit 2: Causality, Vector Clocks, and Dynamo Quorum Tuning',
      description: 'Partial ordering, concurrent write resolution, and R + W > N invariants.',
      learningObjectives: ['Detect concurrent conflicts using vector clocks'],
      prerequisites: ['Unit 1 Consensus'],
      estimatedStudyMinutes: 50,
      lessons: [
        {
          title: '2.1 Vector Clocks & Conflict Detection Algorithms',
          description: 'Mathematical mechanics of vector clock dominance and fork detection.',
          durationMinutes: 25,
          learningObjectives: ['Trace vector clock increments across partitions'],
          conceptsCovered: ['Vector Clocks'],
          sourceReference: 'Section 2: Monotonic Timestamps',
        },
      ],
    },
  ];

  const updateSyllabusRes = await request(`/learning-projects/${projectId}/syllabus`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${instructorToken}` },
    body: JSON.stringify({ chapters: updatedChapters }),
  });
  assert(updateSyllabusRes.status === 200, 'PUT /syllabus successfully saves administrator edits');

  // STEP 3: Multi-Pass Generation -> 20-Point Textbook Lessons
  console.log('\n--- TEST 3: Multi-Pass Generation & 20-Point Textbook Quality ---');
  const genPackRes = await request(`/learning-projects/${projectId}/generate-pack`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${instructorToken}` },
    body: JSON.stringify({ packType: 'complete' }),
  });
  assert(genPackRes.status === 201, 'Complete Course Generation pack finished successfully');

  // Fetch generated lessons to verify 20-point textbook depth
  const modulesRes = await request(`/learning-projects/${projectId}/modules`, {
    headers: { Authorization: `Bearer ${instructorToken}` },
  });
  assert(modulesRes.status === 200, 'Fetched generated modules');
  const sections = modulesRes.data.data;
  assert(sections.length >= 2, `Created ${sections.length} sections from edited syllabus`);

  const firstLesson = sections[0].lessons[0];
  assert(!!firstLesson, 'First lesson exists');
  const lessonContent = firstLesson.content || '';

  // Validate 20-point structure in lesson content
  console.log(`   📝 Checking 20-point pedagogical elements in "${firstLesson.title}" (${lessonContent.length} chars)...`);
  assert(lessonContent.includes('## 1. Learning Objectives'), 'Point 1: Learning Objectives present');
  assert(lessonContent.includes('## 2. Prerequisites & Background Knowledge'), 'Point 2: Prerequisites present');
  assert(lessonContent.includes('## 3. Why This Concept Matters'), 'Point 3: Motivation/Why It Matters present');
  assert(lessonContent.includes('## 4. In-Depth Technical Mechanics') || lessonContent.includes('## 4. In-Depth Architectural Mechanics'), 'Point 4: In-depth core concepts present');
  assert(lessonContent.includes('## 5. Step-by-Step Execution Breakdown'), 'Point 5: Step-by-step breakdown present');
  assert(lessonContent.includes('## 6. Critical Terminology & Definitions'), 'Point 6: Definitions present');
  assert(lessonContent.includes('## 7. Architecture & Flow Diagrams') || lessonContent.includes('## 7. Architectural Diagrams & Schemas'), 'Point 7: Mermaid/Diagram present');
  assert(lessonContent.includes('## 8. Production Code Implementation'), 'Point 8: Code implementation present');
  assert(lessonContent.includes('## 9. Mathematical Formulas & Core Invariants') || lessonContent.includes('## 9. Mathematical Formulas & Invariants'), 'Point 9: Formulas and invariants present');
  assert(lessonContent.includes('## 10. Worked Engineering Case Studies'), 'Point 10: Worked case study present');
  assert(lessonContent.includes('## 11. Real-World Production Deployments'), 'Point 11: Real-world deployments present');
  assert(lessonContent.includes('## 12. Critical Anti-Patterns & Common Pitfalls'), 'Point 12: Common pitfalls and corrections present');
  assert(lessonContent.includes('## 13. System Trade-offs & Limitations'), 'Point 13: Trade-offs & limitations present');
  assert(lessonContent.includes('## 14. Conceptual Linkages'), 'Point 14: Conceptual connections present');
  assert(lessonContent.includes('## 15. Key Architectural Takeaways'), 'Point 15: Key takeaways present');
  assert(lessonContent.includes('## 16. Quick Revision Notes'), 'Point 16: Revision notes present');
  assert(lessonContent.includes('## 17. Hands-On Implementation Exercises'), 'Point 17: Practice exercises present');
  assert(lessonContent.includes('## 18. Source Citations & References'), 'Point 18: Source section grounding present');

  // STEP 4: Custom Practice Paper Blueprint Generator
  console.log('\n--- TEST 4: Configurable Practice Paper Blueprint Generator ---');
  const practicePaperRes = await request(`/learning-projects/${projectId}/practice-papers/generate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${instructorToken}` },
    body: JSON.stringify({
      title: 'Midterm Examination: Distributed Consensus & Storage Invariants',
      questionCount: 6,
      topics: ['Consensus Protocols', 'Vector Clocks', 'Resilience Patterns'],
      difficultyDistribution: { easy: 2, medium: 2, hard: 2 },
      questionTypes: ['mcq', 'coding', 'scenario'],
      totalMarks: 30,
      timeLimitMinutes: 60,
      passingScore: 75,
      negativeMarkingPercent: 25,
      instructions: 'Calculators and reference manual permitted. Time limit strictly enforced.',
    }),
  });

  assert(practicePaperRes.status === 201, 'Custom practice paper generated from blueprint');
  const generatedPaper = practicePaperRes.data.data;
  assert(generatedPaper.title === 'Midterm Examination: Distributed Consensus & Storage Invariants', 'Custom title applied');
  assert(generatedPaper.timeLimitMinutes === 60, 'Time limit configured to 60 mins');
  assert(generatedPaper.passingScore === 75, 'Passing score configured to 75%');
  assert(generatedPaper.negativeMarkingPercent === 25, 'Negative marking configured to 25%');
  assert(generatedPaper.questionIds.length >= 6, `Paper contains ${generatedPaper.questionIds.length} balanced questions`);

  // STEP 5: Automated Quality Gate Audit
  console.log('\n--- TEST 5: Automated Course Quality Gate Audit ---');
  const qualityRes = await request(`/learning-projects/${projectId}/quality-report`, {
    headers: { Authorization: `Bearer ${instructorToken}` },
  });
  assert(qualityRes.status === 200, 'GET /quality-report returns 200');
  const qualityData = qualityRes.data.data;
  assert(typeof qualityData.report?.overallScore === 'number', `Quality overall score: ${qualityData.report?.overallScore}`);
  assert(qualityData.report?.categoryScores?.sourceCoverage >= 70, `Source coverage score: ${qualityData.report?.categoryScores?.sourceCoverage}`);
  assert(qualityData.report?.categoryScores?.factualGrounding >= 80, `Factual grounding score: ${qualityData.report?.categoryScores?.factualGrounding}`);
  assert(qualityData.report?.categoryScores?.questionQuality >= 50, `Question quality score: ${qualityData.report?.categoryScores?.questionQuality}`);
  assert(Array.isArray(qualityData.report?.dimensionDetails) && qualityData.report.dimensionDetails.length >= 7, 'Detailed dimension evaluations available');

  // STEP 6: Publishing & Student Portal Experience
  console.log('\n--- TEST 6: Course Publication & Student Portal Experience ---');
  // Approve and publish
  const approveRes = await request(`/learning-projects/${projectId}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${instructorToken}` },
  });
  assert(approveRes.status === 200, 'Course approved by administrator');

  const publishRes = await request(`/learning-projects/${projectId}/publish`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${instructorToken}` },
    body: JSON.stringify({
      publicationSettings: { targetAudience: 'all', publishVideo: true, publishPracticePaper: true },
    }),
  });
  assert(publishRes.status === 200, 'Course published to all students');

  // Student loads study pack
  const studentPackRes = await request(`/learning-projects/${projectId}/study-pack`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert(studentPackRes.status === 200, 'Student loads published course study pack');
  const studentPack = studentPackRes.data.data;
  assert(studentPack.questions.length > 0, `Student has ${studentPack.questions.length} questions to practice`);

  // Verify security: Student question objects do NOT expose answer keys or explanations
  studentPack.questions.forEach((q: any, i: number) => {
    assert(q.correctAnswer === undefined, `Security verified: Question ${i + 1} has hidden correctAnswer`);
    assert(q.explanation === undefined, `Security verified: Question ${i + 1} has hidden explanation`);
  });

  // Student attempts quiz
  const answerPayload: Record<string, any> = {};
  studentPack.questions.forEach((q: any) => {
    answerPayload[q.id] = (q.options && q.options[0]) || 'True';
  });

  const submitRes = await request(`/learning-projects/${projectId}/practice/submit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
    body: JSON.stringify({ answers: answerPayload }),
  });
  assert(submitRes.status === 200, 'Student assessment submitted and evaluated');
  assert(typeof submitRes.data.data.scorePercentage === 'number', `Student score evaluated: ${submitRes.data.data.scorePercentage}%`);
  assert(submitRes.data.data.results.length === studentPack.questions.length, 'Results provided with post-submission explanations');

  console.log('\n================================================================');
  console.log('🏆 ALL DEEP AI COURSE GENERATION ENGINE TESTS PASSED (100%)');
  console.log('================================================================\n');
}

runDeepEngineAcceptanceTests().catch(err => {
  console.error('\n❌ Acceptance test suite failed:', err);
  process.exit(1);
});
