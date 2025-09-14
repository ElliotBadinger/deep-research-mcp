# Proposed Architecture Refactor

## Current Issues
1. Monolithic `deepResearch` function (600+ lines)
2. Mixed concerns in single files
3. No clear domain boundaries
4. Tight coupling between search, processing, and reporting
5. Limited testability due to large functions

## Proposed Layered Architecture

```
┌─────────────────────────────────────────┐
│              MCP Interface              │
│  (mcp-server.ts, http-server.ts)       │
└─────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────┐
│           Application Layer             │
│     (ResearchOrchestrator)              │
└─────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────┐
│            Domain Layer                 │
│  ┌─────────────┬─────────────────────┐  │
│  │   Research  │    Source           │  │
│  │   Service   │    Evaluation       │  │
│  └─────────────┴─────────────────────┘  │
└─────────────────────────────────────────┘
                    │
┌─────────────────────────────────────────┐
│         Infrastructure Layer            │
│  ┌─────────┬─────────┬─────────────────┐│
│  │ Search  │   AI    │   Observability ││
│  │ Client  │ Models  │     Client      ││
│  └─────────┴─────────┴─────────────────┘│
└─────────────────────────────────────────┘
```

## Refactored Structure

### 1. Domain Services
```typescript
// src/domain/research/ResearchService.ts
export class ResearchService {
  async conductResearch(params: ResearchParams): Promise<ResearchResult>
  async generateQueries(context: QueryContext): Promise<SearchQuery[]>
  async evaluateDepth(current: number, max: number): Promise<boolean>
}

// src/domain/sources/SourceEvaluationService.ts  
export class SourceEvaluationService {
  async evaluateReliability(source: Source): Promise<ReliabilityScore>
  async filterByPreferences(sources: Source[], prefs: string): Promise<Source[]>
  async rankSources(sources: Source[]): Promise<RankedSource[]>
}
```

### 2. Infrastructure Adapters
```typescript
// src/infrastructure/search/SearchClient.ts
export interface SearchClient {
  search(query: string, options?: SearchOptions): Promise<SearchResult>
}

export class FirecrawlSearchClient implements SearchClient {
  // Firecrawl-specific implementation
}

// src/infrastructure/ai/ModelProvider.ts
export interface ModelProvider {
  generateObject<T>(params: GenerationParams): Promise<T>
  getCapabilities(): ModelCapabilities
}
```

### 3. Application Orchestrator
```typescript
// src/application/ResearchOrchestrator.ts
export class ResearchOrchestrator {
  constructor(
    private researchService: ResearchService,
    private sourceService: SourceEvaluationService,
    private searchClient: SearchClient,
    private modelProvider: ModelProvider
  ) {}

  async executeResearch(request: ResearchRequest): Promise<ResearchResponse> {
    // Coordinate between services
    // Handle progress reporting
    // Manage token budgets
    // Control recursion depth
  }
}
```

## Benefits of This Architecture

1. **Single Responsibility**: Each service has one clear purpose
2. **Testability**: Small, focused units easy to test in isolation
3. **Flexibility**: Easy to swap implementations (different search providers, AI models)
4. **Maintainability**: Changes isolated to specific domains
5. **Scalability**: Services can be optimized independently

## Migration Strategy

1. Extract `SourceEvaluationService` first (lowest risk)
2. Create `SearchClient` interface and `FirecrawlSearchClient`
3. Extract query generation to `ResearchService`
4. Build `ResearchOrchestrator` to coordinate
5. Refactor MCP server to use orchestrator
6. Add comprehensive tests for each service

## File Structure
```
src/
├── domain/
│   ├── research/
│   │   ├── ResearchService.ts
│   │   ├── types.ts
│   │   └── __tests__/
│   └── sources/
│       ├── SourceEvaluationService.ts
│       ├── types.ts
│       └── __tests__/
├── infrastructure/
│   ├── search/
│   │   ├── SearchClient.ts
│   │   ├── FirecrawlSearchClient.ts
│   │   └── __tests__/
│   ├── ai/
│   │   ├── ModelProvider.ts
│   │   ├── providers/
│   │   └── __tests__/
│   └── observability/
├── application/
│   ├── ResearchOrchestrator.ts
│   ├── types.ts
│   └── __tests__/
└── interfaces/
    ├── mcp/
    │   └── mcp-server.ts
    └── http/
        └── http-server.ts
```