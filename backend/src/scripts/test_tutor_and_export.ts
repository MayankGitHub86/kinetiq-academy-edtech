const BASE = 'http://localhost:4000/api/v1';

async function login(email: string, password = 'Password123!') {
  const res = await fetch(BASE + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data: any = await res.json();
  if (!res.ok) {
    throw new Error(`Login failed for ${email} (${res.status}): ${JSON.stringify(data)}`);
  }
  return data.data.accessToken;
}

async function test() {
  const adminToken = await login('instructor@kinetiqacademy.com');
  const s1Token = await login('student@kinetiqacademy.com');
  const s2Token = await login('student2@kinetiqacademy.com');

  // Get active published project
  const list: any = await fetch(BASE + '/learning-projects', { headers: { Authorization: 'Bearer ' + adminToken } }).then(r => r.json());
  const proj = list.data[0];
  console.log('Testing with Project:', proj.id, proj.title);

  // 1. AI Tutor for Assigned Student 1
  const t1 = await fetch(BASE + '/learning-projects/' + proj.id + '/tutor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s1Token },
    body: JSON.stringify({ query: 'What is the quorum requirement in Raft consensus?' })
  });
  const t1Data: any = await t1.json();
  console.log('✅ AI Tutor (Student 1): Status', t1.status, 'Answer snippet:', (t1Data.data?.answer || '').slice(0, 100));

  // 2. AI Tutor for Unassigned Student 2 (Expected 403)
  const t2 = await fetch(BASE + '/learning-projects/' + proj.id + '/tutor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s2Token },
    body: JSON.stringify({ query: 'What is the quorum requirement?' })
  });
  console.log('✅ AI Tutor (Student 2 - Unassigned): Status', t2.status, '(Expected 403)');

  // 3. Export Study Pack for Assigned Student 1
  const exp1 = await fetch(BASE + '/learning-projects/' + proj.id + '/export', {
    headers: { Authorization: 'Bearer ' + s1Token }
  });
  console.log('✅ Export (Student 1): Status', exp1.status, 'Content-Type:', exp1.headers.get('content-type'));

  // 4. Export Study Pack for Unassigned Student 2 (Expected 403)
  const exp2 = await fetch(BASE + '/learning-projects/' + proj.id + '/export', {
    headers: { Authorization: 'Bearer ' + s2Token }
  });
  console.log('✅ Export (Student 2 - Unassigned): Status', exp2.status, '(Expected 403)');

  process.exit(0);
}
test().catch(e => { console.error(e); process.exit(1); });
