# Framework & Technology Recommendations

## Current Stack Analysis

### ✅ Good Choices
- **TypeScript**: Excellent type safety for complex research logic
- **Zod**: Perfect for MCP tool parameter validation
- **AI SDK**: Clean abstraction over multiple AI providers
- **Vitest**: Modern, fast testing framework
- **MCP SDK**: Proper protocol implementation

### ⚠️ Areas for Improvement

## 1. Dependency Injection & IoC Container

**Problem**: Manual dependency wiring, hard to test, tight coupling

**Solution**: Add lightweight DI container

```bash
npm install inversify reflect-metadata
```

```typescript
// src/container.ts
import { Container } from 'inversify';
import { TYPES } from './types';

const container = new Container();
container.bind<SearchClient>(TYPES.SearchClient).to(FirecrawlSearchClient);
container.bind<ModelProvider>(TYPES.ModelProvider).to(AISDKModelProvider);
container.bind<ResearchService>(TYPES.ResearchService).to(ResearchService);

export { container };
```

## 2. Structured Logging & Observability

**Problem**: Console.log scattered throughout, no structured data

**Solution**: Replace with structured logging

```bash
npm install pino pino-pretty
```

```typescript
// src/infrastructure/logging/Logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

// Usage
logger.info({ 
  query: 'AI research', 
  depth: 3, 
  sources: 5,
  duration: 1200 
}, 'Research completed');
```

## 3. Error Handling & Result Types

**Problem**: Inconsistent error handling, exceptions bubble up

**Solution**: Result pattern for predictable error handling

```typescript
// src/shared/Result.ts
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

export const Ok = <T>(data: T): Result<T> => ({ success: true, data });
export const Err = <E>(error: E): Result<never, E> => ({ success: false, error });

// Usage in services
async search(query: string): Promise<Result<SearchResult, SearchError>> {
  try {
    const result = await this.client.search(query);
    return Ok(result);
  } catch (error) {
    return Err(new SearchError('Search failed', error));
  }
}
```

## 4. Configuration Management

**Problem**: Environment variables scattered, no validation

**Solution**: Centralized config with validation

```typescript
// src/config/AppConfig.ts
import { z } from 'zod';

const configSchema = z.object({
  ai: z.object({
    openai: z.object({
      apiKey: z.string().optional(),
      model: z.string().default('gpt-4')
    }),
    google: z.object({
      apiKey: z.string().optional(),
      model: z.string().default('gemini-pro')
    })
  }),
  search: z.object({
    provider: z.enum(['firecrawl']).default('firecrawl'),
    concurrency: z.number().default(2),
    timeout: z.number().default(15000)
  }),
  research: z.object({
    maxDepth: z.number().default(5),
    maxBreadth: z.number().default(5),
    defaultTokenBudget: z.number().optional()
  })
});

export type AppConfig = z.infer<typeof configSchema>;
export const config = configSchema.parse(process.env);
```

## 5. Caching Layer

**Problem**: Repeated searches for same queries, expensive AI calls

**Solution**: Add Redis-compatible caching

```bash
npm install ioredis
```

```typescript
// src/infrastructure/cache/CacheService.ts
export interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
}

export class RedisCacheService implements CacheService {
  // Redis implementation
}

export class InMemoryCacheService implements CacheService {
  // In-memory fallback for development
}
```

## 6. Rate Limiting & Circuit Breaker

**Problem**: No protection against API rate limits or failures

**Solution**: Add resilience patterns

```bash
npm install opossum p-retry
```

```typescript
// src/infrastructure/resilience/CircuitBreaker.ts
import CircuitBreaker from 'opossum';

export class ResilientSearchClient implements SearchClient {
  private breaker: CircuitBreaker<[string], SearchResult>;

  constructor(private client: SearchClient) {
    this.breaker = new CircuitBreaker(this.client.search.bind(this.client), {
      timeout: 15000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000
    });
  }

  async search(query: string): Promise<SearchResult> {
    return this.breaker.fire(query);
  }
}
```

## 7. Validation & Sanitization

**Problem**: Input validation only at MCP boundary

**Solution**: Domain-level validation

```typescript
// src/domain/research/validators.ts
export const researchRequestSchema = z.object({
  query: z.string()
    .min(3, 'Query too short')
    .max(500, 'Query too long')
    .refine(q => !q.includes('<script'), 'Invalid characters'),
  depth: z.number().int().min(1).max(5),
  breadth: z.number().int().min(1).max(10),
  sourcePreferences: z.string().optional()
});

export type ResearchRequest = z.infer<typeof researchRequestSchema>;
```

## 8. Testing Strategy

**Current**: Basic unit tests
**Recommended**: Comprehensive testing pyramid

```typescript
// Integration tests with test containers
// src/__tests__/integration/research.integration.test.ts
import { container } from '../../container';
import { ResearchOrchestrator } from '../../application/ResearchOrchestrator';

describe('Research Integration', () => {
  let orchestrator: ResearchOrchestrator;

  beforeEach(() => {
    // Setup test container with mocks
    orchestrator = container.get<ResearchOrchestrator>(TYPES.ResearchOrchestrator);
  });

  it('should conduct end-to-end research', async () => {
    const result = await orchestrator.executeResearch({
      query: 'AI safety research',
      depth: 2,
      breadth: 3
    });

    expect(result.success).toBe(true);
    expect(result.data.sources).toHaveLength(6);
  });
});
```

## Implementation Priority

1. **High Priority**: Result types, structured logging, config management
2. **Medium Priority**: Dependency injection, caching, validation
3. **Low Priority**: Circuit breakers, advanced observability

## Migration Steps

1. Add Result types to existing functions
2. Replace console.log with structured logger
3. Centralize configuration
4. Introduce DI container gradually
5. Add caching layer for expensive operations
6. Implement resilience patterns

This approach maintains backward compatibility while improving maintainability and reliability.