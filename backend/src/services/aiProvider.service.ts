import { logger } from '../utils/logger';
import { ExtractedContent } from './contentIngestion.service';

export interface AiProviderConfig {
  name: 'openai' | 'groq' | 'gemini' | 'anthropic' | 'grounded_engine';
  isAvailable: boolean;
  model: string;
  reason?: string;
}

export interface AiCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export class AiProviderService {
  private static openaiKey = process.env.OPENAI_API_KEY || '';
  private static groqKey = process.env.GROQ_API_KEY || '';
  private static geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  private static anthropicKey = process.env.ANTHROPIC_API_KEY || '';
  private static openAiQuotaExhausted = false;

  /**
   * Diagnostic check of available AI providers
   */
  public static getProviderDiagnostics(): AiProviderConfig[] {
    const diagnostics: AiProviderConfig[] = [];

    // OpenAI
    const hasOpenAiKey = !!this.openaiKey && !this.openaiKey.includes('your_openai_key');
    diagnostics.push({
      name: 'openai',
      isAvailable: hasOpenAiKey && !this.openAiQuotaExhausted,
      model: process.env.AI_CHAT_MODEL || 'gpt-4o-mini',
      reason: !hasOpenAiKey
        ? 'OPENAI_API_KEY not configured in .env'
        : this.openAiQuotaExhausted
        ? 'OpenAI credit balance exhausted (HTTP 429). Add credits or use alternative provider.'
        : 'Active & configured',
    });

    // Groq (fast free tier)
    const hasGroqKey = !!this.groqKey && !this.groqKey.includes('your_groq_key');
    diagnostics.push({
      name: 'groq',
      isAvailable: hasGroqKey,
      model: 'llama-3.3-70b-versatile',
      reason: hasGroqKey ? 'Active & configured' : 'GROQ_API_KEY not configured in .env',
    });

    // Gemini
    const hasGeminiKey = !!this.geminiKey && !this.geminiKey.includes('your_gemini_key');
    diagnostics.push({
      name: 'gemini',
      isAvailable: hasGeminiKey,
      model: 'gemini-1.5-flash',
      reason: hasGeminiKey ? 'Active & configured' : 'GEMINI_API_KEY / GOOGLE_API_KEY not configured in .env',
    });

    // Anthropic
    const hasAnthropicKey = !!this.anthropicKey && !this.anthropicKey.includes('your_anthropic_key');
    diagnostics.push({
      name: 'anthropic',
      isAvailable: hasAnthropicKey,
      model: 'claude-3-5-sonnet-20241022',
      reason: hasAnthropicKey ? 'Active & configured' : 'ANTHROPIC_API_KEY not configured in .env',
    });

    // Grounded Synthesis Engine (Always Available Zero-Credit Fallback)
    diagnostics.push({
      name: 'grounded_engine',
      isAvailable: true,
      model: 'kinetiq-grounded-pedagogical-v2',
      reason: 'Deterministic educational content synthesis engine grounded in extracted source material.',
    });

    return diagnostics;
  }

  /**
   * Identifies the primary active AI provider
   */
  public static getActiveProviderName(): string {
    const diags = this.getProviderDiagnostics();
    const active = diags.find(d => d.isAvailable && d.name !== 'grounded_engine');
    return active ? `${active.name} (${active.model})` : 'Kinetiq Grounded Pedagogical Engine (Deterministic Source Synthesis)';
  }

  /**
   * Unified JSON completion across available AI providers with graceful fallback
   */
  public static async generateJson<T>(
    systemPrompt: string,
    userPrompt: string,
    fallbackGenerator: () => T,
    options: AiCompletionOptions = {}
  ): Promise<{ data: T; provider: string }> {
    // 1. Try OpenAI if available and not marked exhausted
    if (this.openaiKey && !this.openaiKey.includes('your_openai_key') && !this.openAiQuotaExhausted) {
      try {
        const result = await this.callOpenAiJson<T>(systemPrompt, userPrompt, options);
        if (result) {
          return { data: result, provider: `openai (${process.env.AI_CHAT_MODEL || 'gpt-4o-mini'})` };
        }
      } catch (err: any) {
        if (err.message?.includes('429') || err.message?.includes('insufficient_quota') || err.message?.includes('credit_balance_exhausted')) {
          this.openAiQuotaExhausted = true;
          logger.warn('⚠️ OpenAI credit quota exhausted. Automatically failing over to secondary provider or grounded synthesis engine.');
        } else {
          logger.warn(`OpenAI call failed: ${err.message}. Trying next provider...`);
        }
      }
    }

    // 2. Try Groq if configured
    if (this.groqKey && !this.groqKey.includes('your_groq_key')) {
      try {
        const result = await this.callGroqJson<T>(systemPrompt, userPrompt, options);
        if (result) {
          return { data: result, provider: 'groq (llama-3.3-70b-versatile)' };
        }
      } catch (err: any) {
        logger.warn(`Groq call failed: ${err.message}. Trying next provider...`);
      }
    }

    // 3. Try Gemini if configured
    if (this.geminiKey && !this.geminiKey.includes('your_gemini_key')) {
      try {
        const result = await this.callGeminiJson<T>(systemPrompt, userPrompt);
        if (result) {
          return { data: result, provider: 'gemini (gemini-1.5-flash)' };
        }
      } catch (err: any) {
        logger.warn(`Gemini call failed: ${err.message}. Failing over to grounded synthesis engine...`);
      }
    }

    // 4. Grounded Pedagogical Synthesis Engine
    logger.info('Using Kinetiq Grounded Pedagogical Engine for deterministic source-grounded synthesis.');
    const synthesized = fallbackGenerator();
    return { data: synthesized, provider: 'grounded_engine (source-grounded)' };
  }

  /**
   * OpenAI Chat Completion (JSON mode)
   */
  private static async callOpenAiJson<T>(systemPrompt: string, userPrompt: string, options: AiCompletionOptions): Promise<T | null> {
    const model = process.env.AI_CHAT_MODEL || 'gpt-4o-mini';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openaiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: options.temperature ?? 0.25,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI HTTP ${response.status}: ${errorText}`);
      }

      const json: any = await response.json();
      const content = json.choices?.[0]?.message?.content;
      if (!content) return null;
      return JSON.parse(content) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Groq OpenAI-compatible Chat Completion
   */
  private static async callGroqJson<T>(systemPrompt: string, userPrompt: string, options: AiCompletionOptions): Promise<T | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.groqKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: `${systemPrompt}\nYou MUST return a single valid JSON object strictly matching the requested format.` },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: options.temperature ?? 0.2,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq HTTP ${response.status}: ${errorText}`);
      }

      const json: any = await response.json();
      const content = json.choices?.[0]?.message?.content;
      if (!content) return null;
      return JSON.parse(content) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Google Gemini REST completion (JSON mode)
   */
  private static async callGeminiJson<T>(systemPrompt: string, userPrompt: string): Promise<T | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            response_mime_type: 'application/json',
            temperature: 0.2,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini HTTP ${response.status}: ${errorText}`);
      }

      const json: any = await response.json();
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return null;
      return JSON.parse(text) as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}
