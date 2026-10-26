# Kinetiq Academy — Real AI Video Generation E2E Test Report
  
**Date:** 2026-10-26T05:52:26.957Z  
**Source URL:** https://developer.mozilla.org/en-US/docs/Learn/JavaScript/First_steps/What_is_JavaScript  
**Job ID:** fd65ea85-fad7-42d8-b58b-02302be4870e  
**Course ID:** 11fa2aa1-87cb-4fa3-a5b6-596ba2c58456 | **Slug:** what-is-javascript-learn-web-development-or-mdn-1  
**Video File:** D:\edtechproject\backend\public\uploads\videos\ff68dd33-249c-4d7b-871d-e4fac2f8a8e5.mp4  

## Results

| Test | Name | Result | Detail |
|------|------|--------|--------|
| T01 | Backend Health & AI Diagnostics | PASS | Backend: online | Active AI: Kinetiq Grounded Pedagogical Engine (Deterministic Source Synthesis) | FFmpeg: installed |
| T02 | Admin Authentication | PASS | Token obtained for admin@kinetiqacademy.com |
| T03 | Start Content Generation Job | PASS | Job ID: fd65ea85-fad7-42d8-b58b-02302be4870e |
| T04 | Wait for Job Completion | PASS | Completed in 20s | Curriculum: true | Video: true |
| T05 | Generated Content Quality | PASS | Passed: hasTopic, hasModules, hasLessons, hasStudyNotes, hasFlashcards, hasQuestions, hasVideoAsset, hasStoryboard, hasCaptions, hasTranscript | Failed: none |
| T06 | MP4 File Validation | PASS | ffprobe unavailable. File size: 0.93MB |
| T07 | VTT Captions File | PASS | WEBVTT header: true | Timestamps: true | Cue count: 3 |
| T08 | Publish Course to LMS | PASS | Course ID: 11fa2aa1-87cb-4fa3-a5b6-596ba2c58456 | Slug: what-is-javascript-learn-web-development-or-mdn-1 |
| T09 | Student LMS Player Access | PASS | Course: "What is JavaScript? Learn web development | MDN" | Sections: 2 | Video on L1: /uploads/videos/ff68dd33-249c-4d7b-871d-e4fac2f8a8e5.mp4 |
| T10 | Video HTTP Stream Access | PASS | HTTP 200 | Content-Type: video/mp4 | Size: 953 KB | URL: http://localhost:4000/uploads/videos/ff68dd33-249c-4d7b-871d-e4fac2f8a8e5.mp4 |

## Summary
- **PASS:** 10/10
- **FAIL:** 0
- **BLOCKED:** 0
- **Overall:** ✅ ALL TESTS PASSED

## Student Player URL
http://localhost:5500/course_lms_player/index.html?slug=what-is-javascript-learn-web-development-or-mdn-1
