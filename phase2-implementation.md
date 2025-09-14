# Phase 2 Implementation Guide

## Day 11-12: Search Client Interface

### Step 1: Create Search Client Interface

```typescript
// src/infrastructure/search/types.ts
export interface SearchOptions {
  timeout?: number;
  limit?: number;
  scrapeOptions?: {
    formats?: string[];
  };
}

export interface SearchResult {
  data: SearchItem[];
  success: boolean;
  total?: number;
}

export interface SearchItem {
  url?: string | null;
  title?: string | null;
  markdown?: string | null;
  publishDate?: string;
}

export interface SearchClient {
  search(query: string, options?: SearchOptions): Promise<Result<SearchResult, SearchError>>;
  healthCheck(): Promise<Result<boolean, SearchError>>;
}
```

### Step 2: Implement Firecrawl Client

```typescript
// src/infrastructure/search/FirecrawlSearchClient.ts
import FirecrawlApp from '@mendable/firecrawl-js';
import { Result, Ok, Err } from '../../shared/Result.js';
import { SearchError } from '../../shared/errors.js';
import { logger } from '../logging/Logger.js';
import type { SearchClient, SearchOptions, SearchResult } from './types.js';

export class FirecrawlSearchClient implements SearchClient {
  private client: FirecrawlApp;
  private requestCount = 0;
  private lastRequestTime = 0;

  constructor(
    private config: {
      apiKey?: string;
      baseUrl?: string;
      timeout: number;
    }
  ) {
    this.client = new FirecrawlApp({
      apiKey: config.apiKey,
      apiUrl: config.baseUrl,
    });
  }

  async search(query: string, options: SearchOptions = {}): Promise<Result<SearchResult, SearchError>> {
    const correlationId = `search_${Date.now()}_${++this.requestCount}`;
    const start = Date.now();

    try {
      // Rate limiting - simple implementation
      await this.enforceRateLimit();

      logger.info('Starting Firecrawl search', {
        correlationId,
        query,
        options,
        operation: 'firecrawl_search'
      });

      const result = await this.client.search(query, {
        timeout: options.timeout || this.config.timeout,
        limit: options.limit || 5,
        scrapeOptions: options.scrapeOptions || { formats: ['markdown'] },
      });

      const duration = Date.now() - start;
      this.lastRequestTime = Date.now();

      logger.info('Firecrawl search completed', {
        correlationId,
        duration,
        resultCount: result.data?.length || 0,
        success: result.success
      });

      return Ok({
        data: result.data || [],
        success: result.success,
        total: result.data?.length
      });

    } catch (error) {
      const duration = Date.now() - start;
      
      logger.error('Firecrawl search failed', error as Error, {
        correlationId,
        query,
        duration,
        operation: 'firecrawl_search'
      });

      return Err(new SearchError(`Search failed for query: ${query}`, error as Error));
    }
  }

  async healthCheck(): Promise<Result<boolean, SearchError>> {
    try {
      // Simple health check - try a basic search
      const result = await this.search('test', { limit: 1, timeout: 5000 });
      return Ok(result.success);
    } catch (error) {
      return Err(new SearchError('Health check failed', error as Error));
    }
  }

  private async enforceRateLimit(): Promise<void> {
    const minInterval = 100; // 100ms between requests
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;
    
    if (timeSinceLastRequest < minInterval) {
      const delay = minInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### Step 3: Add Connection Pooling

```typescript
// src/infrastructure/search/PooledSearchClient.ts
import { Result, Ok, Err } from '../../shared/Result.js';
import { SearchError } from '../../shared/errors.js';
import { logger } from '../logging/Logger.js';
import type { SearchClient, SearchOptions, SearchResult } from './types.js';

export class PooledSearchClient implements SearchClient {
  private pool: SearchClient[] = [];
  private available: SearchClient[] = [];
  private waiting: Array<(client: SearchClient) => void> = [];
  private activeConnections = 0;

  constructor(
    private factory: () => SearchClient,
    private poolSize: number = 3
  ) {
    this.initializePool();
  }

  async search(query: string, options?: SearchOptions): Promise<Result<SearchResult, SearchError>> {
    const client = await this.acquireClient();
    
    try {
      const result = await client.search(query, options);
      return result;
    } finally {
      this.releaseClient(client);
    }
  }

  async healthCheck(): Promise<Result<boolean, SearchError>> {
    if (this.available.length === 0 && this.activeConnections === 0) {
      return Err(new SearchError('No clients available'));
    }
    
    // Check one available client
    const client = this.available[0];
    return client ? client.healthCheck() : Ok(true);
  }

  private initializePool(): void {
    for (let i = 0; i < this.poolSize; i++) {
      const client = this.factory();
      this.pool.push(client);
      this.available.push(client);
    }
    
    logger.info('Search client pool initialized', {
      poolSize: this.poolSize,
      operation: 'pool_init'
    });
  }

  private async acquireClient(): Promise<SearchClient> {
    if (this.available.length > 0) {
      const client = this.available.pop()!;
      this.activeConnections++;
      return client;
    }

    // Wait for a client to become available
    return new Promise((resolve) => {
      this.waiting.push((client) => {
        this.activeConnections++;
        resolve(client);
      });
    });
  }

  private releaseClient(client: SearchClient): void {
    this.activeConnections--;
    
    if (this.waiting.length > 0) {
      const waiter = this.waiting.shift()!;
      waiter(client);
    } else {
      this.available.push(client);
    }
  }
}
```

## Day 13-14: Streaming Content Processing

### Step 1: Create Content Manager

```typescript
// src/infrastructure/content/types.ts
export interface ContentChunk {
  id: string;
  content: string;
  metadata: {
    url: string;
    chunkIndex: number;
    totalChunks: number;
    wordCount: number;
  };
}

export interface ProcessedContent {
  summary: string;
  keyPoints: string[];
  wordCount: number;
  chunks: ContentChunk[];
}

export interface ContentProcessor {
  processContent(url: string, content: string): Promise<Result<ProcessedContent, Error>>;
  processChunk(chunk: string, metadata: any): Promise<Result<ContentChunk, Error>>;
}
```

### Step 2: Implement Streaming Processor

```typescript
// src/infrastructure/content/StreamingContentProcessor.ts
import { Result, Ok, Err } from '../../shared/Result.js';
import { logger } from '../logging/Logger.js';
import type { ContentProcessor, ContentChunk, ProcessedContent } from './types.js';

export class StreamingContentProcessor implements ContentProcessor {
  private readonly maxChunkSize = 5000; // 5KB chunks
  private readonly maxTotalSize = 100000; // 100KB total per document

  async processContent(url: string, content: string): Promise<Result<ProcessedContent, Error>> {
    try {
      const correlationId = `content_${Date.now()}`;
      
      logger.debug('Starting content processing', {
        correlationId,
        url,
        contentLength: content.length,
        operation: 'content_processing'
      });

      // Truncate if too large
      const truncatedContent = content.length > this.maxTotalSize 
        ? content.slice(0, this.maxTotalSize)
        : content;

      // Split into chunks
      const chunks = await this.createChunks(url, truncatedContent);
      
      // Process chunks in parallel
      const processedChunks = await Promise.all(
        chunks.map((chunk, index) => 
          this.processChunk(chunk, {
            url,
            chunkIndex: index,
            totalChunks: chunks.length
          })
        )
      );

      // Filter successful results
      const successfulChunks = processedChunks
        .filter((result): result is { success: true; data: ContentChunk } => result.success)
        .map(result => result.data);

      // Generate summary from chunks
      const summary = this.generateSummary(successfulChunks);
      const keyPoints = this.extractKeyPoints(successfulChunks);

      const result: ProcessedContent = {
        summary,
        keyPoints,
        wordCount: this.countWords(truncatedContent),
        chunks: successfulChunks
      };

      logger.debug('Content processing completed', {
        correlationId,
        chunksProcessed: successfulChunks.length,
        wordCount: result.wordCount
      });

      return Ok(result);

    } catch (error) {
      logger.error('Content processing failed', error as Error, { url });
      return Err(error as Error);
    }
  }

  async processChunk(chunk: string, metadata: any): Promise<Result<ContentChunk, Error>> {
    try {
      const chunkId = `${metadata.url}_chunk_${metadata.chunkIndex}`;
      
      // Basic processing - could be enhanced with AI summarization
      const processedChunk: ContentChunk = {
        id: chunkId,
        content: chunk.trim(),
        metadata: {
          url: metadata.url,
          chunkIndex: metadata.chunkIndex,
          totalChunks: metadata.totalChunks,
          wordCount: this.countWords(chunk)
        }
      };

      return Ok(processedChunk);

    } catch (error) {
      return Err(error as Error);
    }
  }

  private async createChunks(url: string, content: string): Promise<string[]> {
    const chunks: string[] = [];
    let currentIndex = 0;

    while (currentIndex < content.length) {
      const chunkEnd = Math.min(currentIndex + this.maxChunkSize, content.length);
      
      // Try to break at word boundaries
      let actualEnd = chunkEnd;
      if (chunkEnd < content.length) {
        const lastSpace = content.lastIndexOf(' ', chunkEnd);
        if (lastSpace > currentIndex) {
          actualEnd = lastSpace;
        }
      }

      chunks.push(content.slice(currentIndex, actualEnd));
      currentIndex = actualEnd;
    }

    return chunks;
  }

  private generateSummary(chunks: ContentChunk[]): string {
    // Simple summary - take first sentence from each chunk
    const sentences = chunks
      .map(chunk => {
        const firstSentence = chunk.content.split('.')[0];
        return firstSentence ? firstSentence.trim() + '.' : '';
      })
      .filter(Boolean)
      .slice(0, 3); // Max 3 sentences

    return sentences.join(' ');
  }

  private extractKeyPoints(chunks: ContentChunk[]): string[] {
    // Simple key point extraction - look for bullet points or numbered lists
    const keyPoints: string[] = [];
    
    for (const chunk of chunks) {
      const lines = chunk.content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.match(/^[-*•]\s+/) || trimmed.match(/^\d+\.\s+/)) {
          keyPoints.push(trimmed);
        }
      }
    }

    return keyPoints.slice(0, 10); // Max 10 key points
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).length;
  }
}
```

### Step 3: Add LRU Cache

```typescript
// src/infrastructure/content/ContentCache.ts
interface CacheEntry<T> {
  value: T;
  timestamp: number;
  accessCount: number;
}

export class LRUContentCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number = 100, ttlMs: number = 30 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttl = ttlMs;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Update access count and move to end (most recently used)
    entry.accessCount++;
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    return entry.value;
  }

  set(key: string, value: T): void {
    // Remove if already exists
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict least recently used if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    // Add new entry
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      accessCount: 1
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}
```

## Day 15-16: Adaptive Concurrency Control

### Step 1: Performance Metrics Collection

```typescript
// src/infrastructure/metrics/PerformanceMetrics.ts
export interface OperationMetrics {
  name: string;
  count: number;
  totalDuration: number;
  errors: number;
  lastError?: string;
  durations: number[];
}

export interface MetricsSummary {
  name: string;
  count: number;
  errors: number;
  errorRate: number;
  avgDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
}

export class PerformanceMetrics {
  private metrics = new Map<string, OperationMetrics>();
  private readonly maxDurations = 1000; // Keep last 1000 measurements

  recordSuccess(operation: string, duration: number): void {
    const metric = this.getOrCreateMetric(operation);
    metric.count++;
    metric.totalDuration += duration;
    metric.durations.push(duration);
    
    // Keep only recent measurements
    if (metric.durations.length > this.maxDurations) {
      metric.durations = metric.durations.slice(-this.maxDurations);
    }
  }

  recordError(operation: string, error: Error, duration?: number): void {
    const metric = this.getOrCreateMetric(operation);
    metric.count++;
    metric.errors++;
    metric.lastError = error.message;
    
    if (duration !== undefined) {
      metric.totalDuration += duration;
      metric.durations.push(duration);
    }
  }

  getMetrics(operation: string): MetricsSummary | null {
    const metric = this.metrics.get(operation);
    if (!metric || metric.count === 0) return null;

    const sortedDurations = [...metric.durations].sort((a, b) => a - b);
    
    return {
      name: operation,
      count: metric.count,
      errors: metric.errors,
      errorRate: metric.errors / metric.count,
      avgDuration: metric.totalDuration / metric.count,
      p50Duration: this.percentile(sortedDurations, 0.5),
      p95Duration: this.percentile(sortedDurations, 0.95),
      p99Duration: this.percentile(sortedDurations, 0.99)
    };
  }

  getAllMetrics(): MetricsSummary[] {
    return Array.from(this.metrics.keys())
      .map(key => this.getMetrics(key))
      .filter((m): m is MetricsSummary => m !== null);
  }

  private getOrCreateMetric(operation: string): OperationMetrics {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, {
        name: operation,
        count: 0,
        totalDuration: 0,
        errors: 0,
        durations: []
      });
    }
    return this.metrics.get(operation)!;
  }

  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil(sortedArray.length * p) - 1;
    return sortedArray[Math.max(0, index)];
  }
}
```

### Step 2: Adaptive Search Client

```typescript
// src/infrastructure/search/AdaptiveSearchClient.ts
import pLimit from 'p-limit';
import { Result } from '../../shared/Result.js';
import { SearchError } from '../../shared/errors.js';
import { logger } from '../logging/Logger.js';
import { PerformanceMetrics } from '../metrics/PerformanceMetrics.js';
import type { SearchClient, SearchOptions, SearchResult } from './types.js';

export class AdaptiveSearchClient implements SearchClient {
  private concurrency = 2;
  private limit = pLimit(this.concurrency);
  private metrics = new PerformanceMetrics();
  private lastAdjustment = Date.now();
  private readonly adjustmentInterval = 10000; // 10 seconds
  private readonly minConcurrency = 1;
  private readonly maxConcurrency = 8;

  constructor(private baseClient: SearchClient) {}

  async search(query: string, options?: SearchOptions): Promise<Result<SearchResult, SearchError>> {
    return this.limit(async () => {
      const start = Date.now();
      
      try {
        const result = await this.baseClient.search(query, options);
        const duration = Date.now() - start;
        
        if (result.success) {
          this.metrics.recordSuccess('search', duration);
        } else {
          this.metrics.recordError('search', new Error('Search returned success=false'), duration);
        }
        
        this.adjustConcurrencyIfNeeded();
        return result;

      } catch (error) {
        const duration = Date.now() - start;
        this.metrics.recordError('search', error as Error, duration);
        this.adjustConcurrencyIfNeeded();
        throw error;
      }
    });
  }

  async healthCheck(): Promise<Result<boolean, SearchError>> {
    return this.baseClient.healthCheck();
  }

  private adjustConcurrencyIfNeeded(): void {
    const now = Date.now();
    if (now - this.lastAdjustment < this.adjustmentInterval) {
      return;
    }

    const metrics = this.metrics.getMetrics('search');
    if (!metrics || metrics.count < 5) {
      return; // Need more data
    }

    const oldConcurrency = this.concurrency;
    
    // Adjust based on error rate and performance
    if (metrics.errorRate > 0.2) {
      // High error rate - reduce concurrency
      this.concurrency = Math.max(this.minConcurrency, this.concurrency - 1);
    } else if (metrics.errorRate < 0.05 && metrics.p95Duration < 5000) {
      // Low error rate and good performance - increase concurrency
      this.concurrency = Math.min(this.maxConcurrency, this.concurrency + 1);
    } else if (metrics.p95Duration > 10000) {
      // Slow responses - reduce concurrency
      this.concurrency = Math.max(this.minConcurrency, this.concurrency - 1);
    }

    if (this.concurrency !== oldConcurrency) {
      this.limit = pLimit(this.concurrency);
      this.lastAdjustment = now;
      
      logger.info('Adjusted search concurrency', {
        oldConcurrency,
        newConcurrency: this.concurrency,
        errorRate: metrics.errorRate,
        p95Duration: metrics.p95Duration,
        operation: 'concurrency_adjustment'
      });
    }
  }

  getConcurrency(): number {
    return this.concurrency;
  }

  getMetrics(): any {
    return this.metrics.getMetrics('search');
  }
}
```

## Day 17-18: Multi-Level Caching

### Step 1: Cache Service Interface

```typescript
// src/infrastructure/cache/CacheService.ts
export interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
}
```

### Step 2: Redis Cache Implementation

```typescript
// src/infrastructure/cache/RedisCache.ts
import Redis from 'ioredis';
import { Result, Ok, Err } from '../../shared/Result.js';
import { logger } from '../logging/Logger.js';
import type { CacheService, CacheStats } from './CacheService.js';

export class RedisCache implements CacheService {
  private redis: Redis;
  private stats = { hits: 0, misses: 0 };

  constructor(config: { host?: string; port?: number; password?: string }) {
    this.redis = new Redis({
      host: config.host || 'localhost',
      port: config.port || 6379,
      password: config.password,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    this.redis.on('error', (error) => {
      logger.error('Redis connection error', error);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (value === null) {
        this.stats.misses++;
        return null;
      }
      
      this.stats.hits++;
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Redis get error', error as Error, { key });
      this.stats.misses++;
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number = 3600): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      await this.redis.setex(key, ttlSeconds, serialized);
    } catch (error) {
      logger.error('Redis set error', error as Error, { key, ttlSeconds });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      logger.error('Redis delete error', error as Error, { key });
    }
  }

  async clear(): Promise<void> {
    try {
      await this.redis.flushdb();
    } catch (error) {
      logger.error('Redis clear error', error as Error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis exists error', error as Error, { key });
      return false;
    }
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      size: -1 // Redis doesn't easily provide this
    };
  }
}
```

### Step 3: Multi-Level Cache

```typescript
// src/infrastructure/cache/MultiLevelCache.ts
import { logger } from '../logging/Logger.js';
import type { CacheService, CacheStats } from './CacheService.js';

export class MultiLevelCache implements CacheService {
  private stats = {
    l1: { hits: 0, misses: 0 },
    l2: { hits: 0, misses: 0 },
    l3: { hits: 0, misses: 0 }
  };

  constructor(
    private l1: CacheService, // Fast, small (memory)
    private l2: CacheService, // Medium, shared (Redis)
    private l3?: CacheService // Slow, persistent (Database)
  ) {}

  async get<T>(key: string): Promise<T | null> {
    // L1: Memory cache (fastest)
    let value = await this.l1.get<T>(key);
    if (value !== null) {
      this.stats.l1.hits++;
      return value;
    }
    this.stats.l1.misses++;

    // L2: Redis cache (fast, shared)
    value = await this.l2.get<T>(key);
    if (value !== null) {
      this.stats.l2.hits++;
      // Populate L1 with shorter TTL
      await this.l1.set(key, value, 300); // 5 minutes
      return value;
    }
    this.stats.l2.misses++;

    // L3: Database cache (persistent)
    if (this.l3) {
      value = await this.l3.get<T>(key);
      if (value !== null) {
        this.stats.l3.hits++;
        // Populate L2 and L1
        await this.l2.set(key, value, 3600); // 1 hour
        await this.l1.set(key, value, 300);  // 5 minutes
        return value;
      }
      this.stats.l3.misses++;
    }

    return null;
  }

  async set<T>(key: string, value: T, ttlSeconds: number = 3600): Promise<void> {
    // Set in all levels with appropriate TTLs
    const promises: Promise<void>[] = [
      this.l1.set(key, value, Math.min(ttlSeconds, 300)), // Max 5 min in L1
      this.l2.set(key, value, ttlSeconds)
    ];

    if (this.l3) {
      promises.push(this.l3.set(key, value, ttlSeconds * 2)); // Longer in L3
    }

    await Promise.allSettled(promises);
  }

  async delete(key: string): Promise<void> {
    const promises = [
      this.l1.delete(key),
      this.l2.delete(key)
    ];

    if (this.l3) {
      promises.push(this.l3.delete(key));
    }

    await Promise.allSettled(promises);
  }

  async clear(): Promise<void> {
    const promises = [
      this.l1.clear(),
      this.l2.clear()
    ];

    if (this.l3) {
      promises.push(this.l3.clear());
    }

    await Promise.allSettled(promises);
  }

  async exists(key: string): Promise<boolean> {
    // Check L1 first, then L2, then L3
    if (await this.l1.exists(key)) return true;
    if (await this.l2.exists(key)) return true;
    if (this.l3 && await this.l3.exists(key)) return true;
    return false;
  }

  getStats(): { l1: CacheStats; l2: CacheStats; l3?: CacheStats } {
    const calculateStats = (stats: { hits: number; misses: number }) => {
      const total = stats.hits + stats.misses;
      return {
        hits: stats.hits,
        misses: stats.misses,
        hitRate: total > 0 ? stats.hits / total : 0,
        size: -1
      };
    };

    return {
      l1: calculateStats(this.stats.l1),
      l2: calculateStats(this.stats.l2),
      l3: this.l3 ? calculateStats(this.stats.l3) : undefined
    };
  }
}
```

## Day 19-20: Research Service Extraction

### Step 1: Research Service Interface

```typescript
// src/domain/research/types.ts
export interface ResearchParams {
  query: string;
  depth: number;
  breadth: number;
  tokenBudget?: number;
  sourcePreferences?: string;
}

export interface ResearchContext {
  learnings: string[];
  learningReliabilities: number[];
  visitedUrls: string[];
  researchDirections: ResearchDirection[];
}

export interface ResearchDirection {
  question: string;
  priority: number;
  parentGoal?: string;
}

export interface ResearchResult {
  learnings: string[];
  learningReliabilities: number[];
  visitedUrls: string[];
  sourceMetadata: SourceMetadata[];
  weightedLearnings: LearningWithReliability[];
  budget?: BudgetInfo;
}

export interface ResearchService {
  conductResearch(params: ResearchParams): Promise<Result<ResearchResult, ResearchError>>;
  generateQueries(context: QueryGenerationContext): Promise<Result<SearchQuery[], ResearchError>>;
}
```

### Step 2: Implement Research Service

```typescript
// src/domain/research/DefaultResearchService.ts
import { Result, Ok, Err } from '../../shared/Result.js';
import { ResearchError } from '../../shared/errors.js';
import { logger } from '../../infrastructure/logging/Logger.js';
import type { 
  ResearchService, 
  ResearchParams, 
  ResearchResult,
  ResearchContext 
} from './types.js';
import type { SearchClient } from '../../infrastructure/search/types.js';
import type { ModelProvider } from '../../infrastructure/ai/ModelProvider.js';
import type { SourceEvaluationService } from '../sources/SourceEvaluationService.js';

export class DefaultResearchService implements ResearchService {
  constructor(
    private searchClient: SearchClient,
    private modelProvider: ModelProvider,
    private sourceEvaluationService: SourceEvaluationService,
    private config: {
      maxConcurrency: number;
      defaultTimeout: number;
    }
  ) {}

  async conductResearch(params: ResearchParams): Promise<Result<ResearchResult, ResearchError>> {
    const correlationId = `research_${Date.now()}`;
    const start = Date.now();

    try {
      logger.info('Starting research', {
        correlationId,
        ...params,
        operation: 'conduct_research'
      });

      const context: ResearchContext = {
        learnings: [],
        learningReliabilities: [],
        visitedUrls: [],
        researchDirections: []
      };

      const result = await this.executeResearchDepth(
        params,
        context,
        params.depth,
        correlationId
      );

      const duration = Date.now() - start;
      
      logger.info('Research completed', {
        correlationId,
        duration,
        totalSources: result.visitedUrls.length,
        totalLearnings: result.learnings.length
      });

      return Ok(result);

    } catch (error) {
      const duration = Date.now() - start;
      
      logger.error('Research failed', error as Error, {
        correlationId,
        duration,
        ...params
      });

      return Err(new ResearchError('Research execution failed', error as Error));
    }
  }

  private async executeResearchDepth(
    params: ResearchParams,
    context: ResearchContext,
    remainingDepth: number,
    correlationId: string
  ): Promise<ResearchResult> {
    if (remainingDepth <= 0) {
      return {
        learnings: context.learnings,
        learningReliabilities: context.learningReliabilities,
        visitedUrls: context.visitedUrls,
        sourceMetadata: [],
        weightedLearnings: context.learnings.map((learning, i) => ({
          content: learning,
          reliability: context.learningReliabilities[i] || 0.5
        }))
      };
    }

    // Generate search queries for current depth
    const queriesResult = await this.generateQueries({
      query: params.query,
      context,
      breadth: params.breadth,
      sourcePreferences: params.sourcePreferences
    });

    if (!queriesResult.success) {
      throw queriesResult.error;
    }

    // Execute searches in parallel
    const searchResults = await this.executeSearches(
      queriesResult.data,
      correlationId
    );

    // Process and evaluate results
    const processedResults = await this.processSearchResults(
      searchResults,
      params,
      correlationId
    );

    // Update context with new findings
    const updatedContext: ResearchContext = {
      learnings: [...context.learnings, ...processedResults.newLearnings],
      learningReliabilities: [...context.learningReliabilities, ...processedResults.newReliabilities],
      visitedUrls: [...context.visitedUrls, ...processedResults.newUrls],
      researchDirections: processedResults.followUpDirections
    };

    // Recurse to next depth if needed
    if (remainingDepth > 1) {
      return this.executeResearchDepth(
        params,
        updatedContext,
        remainingDepth - 1,
        correlationId
      );
    }

    return {
      learnings: updatedContext.learnings,
      learningReliabilities: updatedContext.learningReliabilities,
      visitedUrls: updatedContext.visitedUrls,
      sourceMetadata: processedResults.sourceMetadata,
      weightedLearnings: updatedContext.learnings.map((learning, i) => ({
        content: learning,
        reliability: updatedContext.learningReliabilities[i] || 0.5
      }))
    };
  }

  async generateQueries(context: QueryGenerationContext): Promise<Result<SearchQuery[], ResearchError>> {
    // Implementation for query generation using AI model
    // This would use the ModelProvider to generate targeted search queries
    // based on the current research context
    
    try {
      const result = await this.modelProvider.generateObject({
        // ... query generation logic
      });
      
      return Ok(result.data);
    } catch (error) {
      return Err(new ResearchError('Query generation failed', error as Error));
    }
  }

  private async executeSearches(queries: SearchQuery[], correlationId: string): Promise<SearchResult[]> {
    // Execute searches with concurrency control
    const limit = pLimit(this.config.maxConcurrency);
    
    return Promise.all(
      queries.map(query => 
        limit(async () => {
          const result = await this.searchClient.search(query.query, {
            timeout: this.config.defaultTimeout,
            limit: query.limit || 5
          });
          
          if (!result.success) {
            logger.warn('Search failed', { 
              correlationId, 
              query: query.query, 
              error: result.error.message 
            });
            return { data: [], success: false };
          }
          
          return result.data;
        })
      )
    );
  }

  private async processSearchResults(
    searchResults: SearchResult[],
    params: ResearchParams,
    correlationId: string
  ): Promise<{
    newLearnings: string[];
    newReliabilities: number[];
    newUrls: string[];
    sourceMetadata: SourceMetadata[];
    followUpDirections: ResearchDirection[];
  }> {
    // Process search results, evaluate sources, extract learnings
    // This would integrate with SourceEvaluationService and ModelProvider
    
    // Placeholder implementation
    return {
      newLearnings: [],
      newReliabilities: [],
      newUrls: [],
      sourceMetadata: [],
      followUpDirections: []
    };
  }
}
```

## Testing Strategy for Phase 2

### Integration Tests Example

```typescript
// src/__tests__/integration/research-pipeline.integration.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { DefaultResearchService } from '../../domain/research/DefaultResearchService.js';
import { FirecrawlSearchClient } from '../../infrastructure/search/FirecrawlSearchClient.js';
import { BatchedModelProvider } from '../../infrastructure/ai/BatchedModelProvider.js';

describe('Research Pipeline Integration', () => {
  let researchService: DefaultResearchService;

  beforeEach(() => {
    // Setup with real or mock dependencies
    const searchClient = new FirecrawlSearchClient(/* config */);
    const modelProvider = new BatchedModelProvider();
    const sourceEvaluationService = new DefaultSourceEvaluationService();
    
    researchService = new DefaultResearchService(
      searchClient,
      modelProvider,
      sourceEvaluationService,
      { maxConcurrency: 2, defaultTimeout: 15000 }
    );
  });

  it('should conduct end-to-end research', async () => {
    const result = await researchService.conductResearch({
      query: 'AI safety research trends 2024',
      depth: 2,
      breadth: 3,
      tokenBudget: 50000
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.learnings.length).toBeGreaterThan(0);
      expect(result.data.visitedUrls.length).toBeGreaterThan(0);
      expect(result.data.sourceMetadata.length).toBeGreaterThan(0);
    }
  }, 60000); // 60 second timeout
});
```

## Migration Checklist for Phase 2

- [ ] Search client interface implemented
- [ ] Streaming content processing added
- [ ] Adaptive concurrency control working
- [ ] Multi-level caching operational
- [ ] Research service extracted and tested
- [ ] Performance metrics collection active
- [ ] Memory usage optimized
- [ ] Integration tests passing
- [ ] Performance benchmarks met
- [ ] Documentation updated