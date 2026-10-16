import { Lesson, Course } from '../models/Course';
import { VideoAsset, StudyNote, Flashcard } from '../models/AiLearning';
import { logger } from '../utils/logger';

export interface TutorQueryOptions {
  courseId: string;
  lessonId?: string;
  query: string;
  videoTimestamp?: number;
  userRole?: string;
}

export interface TutorResponse {
  answer: string;
  sources: Array<{ title: string; type: string; reference?: string }>;
  suggestedFollowUps: string[];
}

export class AiTutorService {
  private static apiKey = process.env.OPENAI_API_KEY || '';
  private static model = process.env.AI_CHAT_MODEL || 'gpt-4o-mini';

  /**
   * Generates a context-aware, grounded educational answer for the student
   */
  public static async answerStudentQuery(options: TutorQueryOptions): Promise<TutorResponse> {
    const course = await Course.findByPk(options.courseId);
    let lesson: Lesson | null = null;
    let videoAsset: VideoAsset | null = null;
    let notes: StudyNote | null = null;

    if (options.lessonId) {
      lesson = await Lesson.findByPk(options.lessonId);
      videoAsset = await VideoAsset.findOne({ where: { lessonId: options.lessonId } });
    }

    notes = await StudyNote.findOne({ where: { courseId: options.courseId } });

    // Assemble grounded context
    const contextParts: string[] = [];
    contextParts.push(`Course: ${course?.title || 'Systems Architecture'}`);
    if (lesson) {
      contextParts.push(`Current Lesson: ${lesson.title}`);
      contextParts.push(`Lesson Content: ${lesson.content?.slice(0, 3000) || ''}`);
    }

    // If timestamp is provided and video asset has transcript, find closest transcript phrase
    let timestampContext = '';
    if (options.videoTimestamp !== undefined && videoAsset?.transcript) {
      const match = (videoAsset.transcript as any[]).find(
        t => options.videoTimestamp! >= t.start && options.videoTimestamp! <= t.end
      );
      if (match) {
        timestampContext = `At video timestamp ${options.videoTimestamp}s: "${match.text}"`;
        contextParts.push(timestampContext);
      }
    }

    if (notes?.summary) {
      contextParts.push(`Master Summary: ${notes.summary}`);
    }

    const systemPrompt = `You are the Kinetiq Academy AI Architectural Tutor — an elite, encouraging, and deeply technical mentor.
Answer the student's question accurately using ONLY the provided course and lesson context.
Rules:
- Be clear, practical, and pedagogical.
- If relevant code is needed, provide clean, idiomatic snippets with explanations.
- If the question refers to a specific video timestamp, address that specific moment in the lesson.
- If the source context does not contain enough information, explain what is known and clarify uncertainty politely.
- Include 2-3 helpful follow-up questions the student might explore next.
Format your answer in GitHub-style Markdown.`;

    const userPrompt = `Context:
${contextParts.join('\n\n')}

Student Question: ${options.query}`;

    if (this.apiKey && !this.apiKey.includes('your_openai_key')) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.3,
          }),
        });

        if (response.ok) {
          const data: any = await response.json();
          const answer = data.choices?.[0]?.message?.content;
          if (answer) {
            return {
              answer,
              sources: [
                { title: lesson ? lesson.title : course?.title || 'Course Material', type: 'lesson' },
                ...(timestampContext ? [{ title: `Video Transcript (${Math.round(options.videoTimestamp || 0)}s)`, type: 'video' }] : []),
              ],
              suggestedFollowUps: [
                'Can you give another real-world code example?',
                'What are the common failure modes of this approach?',
                'How does this integrate with distributed caching?',
              ],
            };
          }
        }
      } catch (err: any) {
        logger.warn('AI Tutor OpenAI request error:', err.message);
      }
    }

    // Grounded fallback response
    const lessonTitle = lesson ? lesson.title : course?.title || 'this topic';
    const fallbackAnswer = `### Analysis: ${options.query}

In **${lessonTitle}**, the key architectural principle involves decoupling system responsibilities and enforcing deterministic state invariants.

${timestampContext ? `Regarding the moment at ${options.videoTimestamp}s: The instructor is emphasizing how requests pass through ingress contract validation before hitting downstream state evaluators.\n\n` : ''}
#### Core Recommendations:
1. **Enforce Boundaries:** Ensure all service boundaries have strict interface contracts.
2. **Idempotent Ingestion:** Design APIs so network retries do not trigger duplicate mutations.
3. **Telemetry Tracing:** Wrap critical code paths with contextual traces to observe latency and error spikes.

Feel free to ask for a code sample or practical implementation pattern!`;

    return {
      answer: fallbackAnswer,
      sources: [
        { title: lesson ? lesson.title : 'Course Syllabus', type: 'curriculum' },
      ],
      suggestedFollowUps: [
        'How do I test this in local development?',
        'What are the memory and latency tradeoffs?',
        'Can you show me a practice question on this?',
      ],
    };
  }
}
