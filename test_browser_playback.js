import { chromium } from 'playwright';
import path from 'path';

async function testPlayback() {
  console.log('Launching Chromium/Edge browser...');
  const browser = await chromium.launch({ channel: 'msedge', headless: true }).catch(() => chromium.launch({ channel: 'chrome', headless: true }));
  const context = await browser.newContext();
  const page = await context.newPage();

  const url = 'http://localhost:5500/course_lms_player/index.html?slug=sap-abap-tutorial-4';
  console.log(`Navigating to ${url}...`);

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Check titles
  const courseTitle = await page.textContent('#course-breadcrumb-course').catch(() => null);
  const lessonTitle = await page.textContent('#current-lesson-title').catch(() => null);
  console.log('Header Course Title:', courseTitle);
  console.log('Header Lesson Title:', lessonTitle);

  // Inspect video element
  const videoState = await page.evaluate(() => {
    const v = document.getElementById('main-video-player');
    if (!v) return null;
    return {
      src: v.src,
      currentSrc: v.currentSrc,
      paused: v.paused,
      currentTime: v.currentTime,
      duration: v.duration,
      readyState: v.readyState,
      networkState: v.networkState,
      videoWidth: v.videoWidth,
      videoHeight: v.videoHeight,
    };
  });
  console.log('Initial Video State:', videoState);

  // Click center play or play button
  console.log('Clicking play button...');
  await page.click('#video-btn-play');
  await page.waitForTimeout(3000);

  // Check state after playing
  const playingState = await page.evaluate(() => {
    const v = document.getElementById('main-video-player');
    return {
      paused: v.paused,
      currentTime: v.currentTime,
      duration: v.duration,
      readyState: v.readyState,
      videoWidth: v.videoWidth,
      videoHeight: v.videoHeight,
    };
  });
  console.log('Playing Video State:', playingState);

  // Test seeking forward 10s
  console.log('Clicking forward 10s...');
  await page.click('#video-btn-forward');
  await page.waitForTimeout(1000);

  const seekedState = await page.evaluate(() => {
    const v = document.getElementById('main-video-player');
    return {
      paused: v.paused,
      currentTime: v.currentTime,
      duration: v.duration,
    };
  });
  console.log('Seeked Video State:', seekedState);

  // Test selecting Lesson 2 to confirm multi-lesson video works
  console.log('Selecting Lesson 2 from curriculum sidebar...');
  const secondLessonBtn = await page.$('.sidebar-lesson-item:nth-of-type(2)');
  if (secondLessonBtn) {
    await secondLessonBtn.click();
    await page.waitForTimeout(2000);
    const lesson2State = await page.evaluate(() => {
      const v = document.getElementById('main-video-player');
      const noVid = document.getElementById('no-video-placeholder');
      return {
        hasVideoEl: !!v,
        videoHidden: v ? v.classList.contains('hidden') : true,
        placeholderHidden: noVid ? noVid.classList.contains('hidden') : false,
        paused: v ? v.paused : true,
        currentTime: v ? v.currentTime : 0,
        src: v ? v.src : '',
      };
    });
    console.log('Lesson 2 Video State:', lesson2State);
  }

  // Take screenshot as proof
  const screenshotPath = path.join(process.cwd(), 'scratch', 'browser_verified_playback.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`Saved screenshot to: ${screenshotPath}`);

  await browser.close();

  const success = (playingState && !playingState.paused && playingState.currentTime > 0) || (videoState && !videoState.paused);
  console.log(`\n========================================`);
  console.log(`PLAYBACK VERIFICATION RESULT: ${success ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(`========================================\n`);
  process.exit(success ? 0 : 1);
}

testPlayback().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
