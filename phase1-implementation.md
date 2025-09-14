# Phase 1 Implementation Guide

## Day 1-2: Result Types & Error Handling

### Step 1: Create Result Type System

```typescript
// src/shared/Result.ts
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

export const Ok = <T>(data: T): Result<T> => ({ success: true, data });
export const Err = <E>(error: E): Result<never, E> => ({ success: false, error });

export const isOk = <T, E>(result: Result<T, E>): result is { success: true; data: T } => 
  result.success;

export const isErr = <T, E>(result: Result<T, E>): result is { success: false; error: E } => 
  !result.success;
```

### Step 2: Create Domain Errors

```typescript
// src/shared/errors.ts
export class ResearchError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'ResearchError';
  }
}

export class SearchError extends ResearchError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'SearchError';
  }
}

export class AIModelError extends ResearchError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'AIModelError';
  }
}
```

### Step 3: Refactor Source Evaluation

```typescript
// In src/deep-research.ts - Update evaluateSourceReliability
async function evaluateSourceReliability({
  item, query, sourcePreferences, model, budget,
}: {
  item: { url?: string | null; title?: string | null; markdown?: string | null };
  query: string;
  sourcePreferences?: string;
  model: LanguageModelV2;
  budget?: BudgetState;
}): Promise<Result<{ score: number; reasoning: string; use: boolean; preferenceReason?: string; domain: string }, AIModelError>> {
  try {
    // ... existing logic ...
    const res = await generateObject({ model, system, prompt, schema });
    recordUsage(budget, (res as any)?.usage);
    
    return Ok({
      score: res.object.score,
      reasoning: res.object.reasoning,
      use: res.object.use,
      preferenceReason: res.object.preferenceReason,
      domain
    });
  } catch (error) {
    return Err(new AIModelError('Failed to evaluate source reliability', error as Error));
  }
}
```

## Day 3-4: Structured Logging

### Step 1: Install Dependencies

```bash
npm install pino pino-pretty
npm install --save-dev @types/pino
```

### Step 2: Create Logger Service

```typescript
// src/infrastructure/logging/Logger.ts
import pino from 'pino';

export interface LogContext {
  correlationId?: string;
  userId?: string;
  operation?: string;
  duration?: number;
  [key: string]: any;
}

class Logger {
  private logger: pino.Logger;

  constructor() {
    this.logger = pino({
      level: process.env.LOG_LEVEL || 'info',
      transport: process.env.NODE_ENV !== 'production' ? {
        target: 'pino-pretty',
        options: { colorize: true }
      } : undefined
    });
  }

  info(message: string, context?: LogContext): void {
    this.logger.info(context, message);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.logger.error({ ...context, error: error?.message, stack: error?.stack }, message);
  }

  warn(message: string, context?: LogContext): void {
    this.logger.warn(context, message);
  }

  debug(message: string, context?: LogContext): void {
    this.logger.debug(context, message);
  }
}

export const logger = new Logger();
```

### Step 3: Replace Console.log Calls

```typescript
// In src/deep-research.ts - Replace log function
import { logger } from './infrastructure/logging/Logger.js';

// Replace existing log function
function log(message: string, context?: any) {
  logger.info(message, context);
}

// Update specific logging calls
logger.info('Firecrawl search completed', {
  operation: 'firecrawl_search',
  query: serpQuery.query,
  duration: searchEnd - searchStart,
  resultCount: result.data.length
});
```

## Day 5-6: Configuration Management

### Step 1: Create Config Schema

```typescript
// src/config/schemas.ts
import { z } from 'zod';

export const aiConfigSchema = z.object({
  openai: z.object({
    apiKey: z.string().optional(),
    model: z.string().default('gpt-4'),
    endpoint: z.string().url().optional()
  }),
  google: z.object({
    apiKey: z.string().optional(),
    model: z.string().default('gemini-2.5-pro')
  }),
  anthropic: z.object({
    apiKey: z.string().optional(),
    model: z.string().default('claude-3-5-sonnet-20241022')
  }),
  xai: z.object({
    apiKey: z.string().optional(),
    model: z.string().default('grok-2-latest')
  })
});

export const searchConfigSchema = z.object({
  firecrawl: z.object({
    apiKey: z.string().optional(),
    baseUrl: z.string().url().optional(),
    concurrency: z.number().min(1).max(10).default(2),
    timeout: z.number().default(15000)
  }),
  searchApi: z.object({
    apiKey: z.string().optional()
  })
});

export const appConfigSchema = z.object({
  ai: aiConfigSchema,
  search: searchConfigSchema,
  research: z.object({
    maxDepth: z.number().min(1).max(10).default(5),
    maxBreadth: z.number().min(1).max(10).default(5),
    defaultTokenBudget: z.number().optional(),
    contextSize: z.number().default(128000)
  }),
  observability: z.object({
    langfuse: z.object({
      publicKey: z.string().optional(),
      secretKey: z.string().optional(),
      baseUrl: z.string().url().default('https://cloud.langfuse.com')
    })
  }),
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info')
  })
});
```

### Step 2: Create Config Factory

```typescript
// src/config/AppConfig.ts
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { appConfigSchema } from './schemas.js';
import type { z } from 'zod';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
config({ path: resolve(__dirname, '../../.env.local') });

export type AppConfig = z.infer<typeof appConfigSchema>;

function createConfig(): AppConfig {
  const rawConfig = {
    ai: {
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4',
        endpoint: process.env.OPENAI_ENDPOINT
      },
      google: {
        apiKey: process.env.GOOGLE_API_KEY,
        model: process.env.GOOGLE_MODEL || 'gemini-2.5-pro'
      },
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022'
      },
      xai: {
        apiKey: process.env.XAI_API_KEY,
        model: process.env.XAI_MODEL || 'grok-2-latest'
      }
    },
    search: {
      firecrawl: {
        apiKey: process.env.FIRECRAWL_KEY,
        baseUrl: process.env.FIRECRAWL_BASE_URL,
        concurrency: Number(process.env.FIRECRAWL_CONCURRENCY) || 2,
        timeout: Number(process.env.FIRECRAWL_TIMEOUT) || 15000
      },
      searchApi: {
        apiKey: process.env.SEARCHAPI_API_KEY
      }
    },
    research: {
      maxDepth: Number(process.env.MAX_DEPTH) || 5,
      maxBreadth: Number(process.env.MAX_BREADTH) || 5,
      defaultTokenBudget: process.env.DEFAULT_TOKEN_BUDGET ? Number(process.env.DEFAULT_TOKEN_BUDGET) : undefined,
      contextSize: Number(process.env.CONTEXT_SIZE) || 128000
    },
    observability: {
      langfuse: {
        publicKey: process.env.LANGFUSE_PUBLIC_KEY,
        secretKey: process.env.LANGFUSE_SECRET_KEY,
        baseUrl: process.env.LANGFUSE_BASEURL || 'https://cloud.langfuse.com'
      }
    },
    logging: {
      level: (process.env.LOG_LEVEL as any) || 'info'
    }
  };

  return appConfigSchema.parse(rawConfig);
}

export const appConfig = createConfig();
```

## Day 7-8: Source Evaluation Service

### Step 1: Create Service Interface

```typescript
// src/domain/sources/types.ts
export interface SourceItem {
  url?: string | null;
  title?: string | null;
  markdown?: string | null;
}

export interface ReliabilityAssessment {
  score: number;
  reasoning: string;
  use: boolean;
  preferenceReason?: string;
  domain: string;
}

export interface SourceEvaluationParams {
  item: SourceItem;
  query: string;
  sourcePreferences?: string;
}
```

### Step 2: Implement Service

```typescript
// src/domain/sources/SourceEvaluationService.ts
import { generateObject } from 'ai';
import type { LanguageModelV2 } from '@ai-sdk/provider';
import { z } from 'zod';
import { Result, Ok, Err } from '../../shared/Result.js';
import { AIModelError } from '../../shared/errors.js';
import { trimPrompt } from '../../ai/providers.js';
import { systemPrompt } from '../../prompt.js';
import type { SourceItem, ReliabilityAssessment, SourceEvaluationParams } from './types.js';

export interface SourceEvaluationService {
  evaluateReliability(params: SourceEvaluationParams, model: LanguageModelV2): Promise<Result<ReliabilityAssessment, AIModelError>>;
}

export class DefaultSourceEvaluationService implements SourceEvaluationService {
  async evaluateReliability(
    { item, query, sourcePreferences }: SourceEvaluationParams,
    model: LanguageModelV2
  ): Promise<Result<ReliabilityAssessment, AIModelError>> {
    try {
      const url = item.url || '';
      const title = item.title || '';
      let domain = '';
      
      try {
        domain = url ? new URL(url).hostname : '';
      } catch {
        domain = '';
      }
      
      const contentSnippet = trimPrompt(item.markdown || '', 4000);
      
      const prefBlock = sourcePreferences && sourcePreferences.trim().length > 0
        ? `User preferences to avoid (apply holistically, not via keywords):\n<preferences>${sourcePreferences}</preferences>\n\nAlso return whether this source should be USED given these preferences.`
        : 'No special user preferences provided.';

      const res = await generateObject({
        model,
        system: systemPrompt(),
        prompt: `Evaluate the reliability and suitability of this source for the research query. Provide a reliability score and a brief reasoning. If user preferences are provided, judge suitability holistically against them.\n\n${prefBlock}\n\nResearch query:\n<query>${query}</query>\n\nSource:\n- URL: ${url}\n- Domain: ${domain}\n- Title: ${title}\n- Content (truncated):\n"""\n${contentSnippet}\n"""\n\nReturn JSON: { "score": number (0..1), "reasoning": string, "use": boolean, "preferenceReason"?: string }`,
        schema: z.object({
          score: z.number(),
          reasoning: z.string(),
          use: z.boolean(),
          preferenceReason: z.string().optional(),
        }),
      });

      return Ok({
        score: res.object.score,
        reasoning: res.object.reasoning,
        use: res.object.use,
        preferenceReason: res.object.preferenceReason,
        domain
      });
    } catch (error) {
      return Err(new AIModelError('Failed to evaluate source reliability', error as Error));
    }
  }
}
```

## Day 9-10: AI Model Call Optimization

### Step 1: Create Model Provider Interface

```typescript
// src/infrastructure/ai/ModelProvider.ts
import type { LanguageModelV2 } from '@ai-sdk/provider';
import { Result } from '../../shared/Result.js';
import { AIModelError } from '../../shared/errors.js';

export interface GenerationParams {
  model: LanguageModelV2;
  system?: string;
  prompt: string;
  schema: any;
}

export interface ModelProvider {
  generateObject<T>(params: GenerationParams): Promise<Result<T, AIModelError>>;
  getUsageStats(): UsageStats;
}

export interface UsageStats {
  totalCalls: number;
  totalTokens: number;
  cacheHits: number;
  averageLatency: number;
}
```

### Step 2: Implement Batched Provider

```typescript
// src/infrastructure/ai/BatchedModelProvider.ts
import { generateObject } from 'ai';
import { Result, Ok, Err } from '../../shared/Result.js';
import { AIModelError } from '../../shared/errors.js';
import { logger } from '../logging/Logger.js';
import type { ModelProvider, GenerationParams, UsageStats } from './ModelProvider.js';

interface CacheEntry<T> {
  result: T;
  timestamp: number;
  ttl: number;
}

export class BatchedModelProvider implements ModelProvider {
  private cache = new Map<string, CacheEntry<any>>();
  private stats: UsageStats = {
    totalCalls: 0,
    totalTokens: 0,
    cacheHits: 0,
    averageLatency: 0
  };

  async generateObject<T>(params: GenerationParams): Promise<Result<T, AIModelError>> {
    const start = Date.now();
    this.stats.totalCalls++;

    try {
      // Check cache first
      const cacheKey = this.getCacheKey(params);
      const cached = this.getFromCache<T>(cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        logger.debug('Cache hit for AI generation', { cacheKey });
        return Ok(cached);
      }

      // Generate new result
      const result = await generateObject(params);
      const duration = Date.now() - start;
      
      // Update stats
      this.updateStats(duration, (result as any)?.usage);
      
      // Cache result (5 minute TTL)
      this.setCache(cacheKey, result.object, 5 * 60 * 1000);
      
      logger.debug('AI generation completed', {
        duration,
        tokens: (result as any)?.usage?.totalTokens,
        cached: false
      });

      return Ok(result.object);
    } catch (error) {
      const duration = Date.now() - start;
      this.updateStats(duration);
      
      logger.error('AI generation failed', error as Error, { duration });
      return Err(new AIModelError('Failed to generate object', error as Error));
    }
  }

  getUsageStats(): UsageStats {
    return { ...this.stats };
  }

  private getCacheKey(params: GenerationParams): string {
    const key = `${params.system || ''}|${params.prompt}|${JSON.stringify(params.schema)}`;
    return Buffer.from(key).toString('base64').slice(0, 64);
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.result;
  }

  private setCache<T>(key: string, result: T, ttl: number): void {
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
      ttl
    });
    
    // Simple cleanup - remove expired entries when cache gets large
    if (this.cache.size > 1000) {
      this.cleanupCache();
    }
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  private updateStats(duration: number, usage?: any): void {
    this.stats.averageLatency = (this.stats.averageLatency * (this.stats.totalCalls - 1) + duration) / this.stats.totalCalls;
    
    if (usage?.totalTokens) {
      this.stats.totalTokens += usage.totalTokens;
    }
  }
}
```

## Testing Strategy for Phase 1

### Unit Tests Example

```typescript
// src/shared/__tests__/Result.test.ts
import { describe, it, expect } from 'vitest';
import { Ok, Err, isOk, isErr } from '../Result.js';

describe('Result', () => {
  it('should create Ok result', () => {
    const result = Ok('success');
    expect(isOk(result)).toBe(true);
    expect(result.data).toBe('success');
  });

  it('should create Err result', () => {
    const error = new Error('failed');
    const result = Err(error);
    expect(isErr(result)).toBe(true);
    expect(result.error).toBe(error);
  });
});
```

## Migration Checklist for Phase 1

- [ ] Result types implemented and tested
- [ ] Domain errors created
- [ ] Structured logging replacing console.log
- [ ] Configuration centralized and validated
- [ ] Source evaluation service extracted
- [ ] AI model provider optimized with caching
- [ ] All tests passing
- [ ] Performance benchmarks maintained
- [ ] Documentation updated