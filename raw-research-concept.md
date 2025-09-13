# Raw Research Data Framework

## Core Philosophy: Preserve Context, Eliminate Bottlenecks

### The Fundamental Problem
**Information Bottleneck**: Secondary AI makes relevance judgments without user context
- ❌ Research AI decides what's "important" 
- ❌ Loses nuanced user needs from conversation history
- ❌ Pre-filters information before original LLM can evaluate
- ❌ Creates summary bias and information loss

### Refined Approach: Context-Preserving Research

**Principle**: Research tools should be **information gatherers**, not **information interpreters**

## Framework Design

### 1. Multi-Granularity Data Structure
```json
{
  "research_session": {
    "query": "original user query",
    "parameters": { "depth": 3, "breadth": 3 },
    "execution_time": "2025-01-13T10:30:00Z",
    "total_duration_seconds": 180
  },
  "search_strategy": {
    "queries_generated": ["query1", "query2", "query3"],
    "search_tree": {
      "level_1": ["initial queries"],
      "level_2": ["follow-up queries"],
      "level_3": ["deep dive queries"]
    }
  },
  "raw_sources": [
    {
      "id": "src_001",
      "url": "https://example.com/article",
      "title": "Article Title",
      "content": "Full extracted content...",
      "metadata": {
        "word_count": 1500,
        "publish_date": "2024-12-01",
        "author": "Dr. Jane Smith",
        "domain": "academic",
        "content_type": "research_paper"
      },
      "discovery": {
        "search_query": "specific query that found this",
        "search_engine": "brave",
        "result_position": 3,
        "research_depth_level": 2
      },
      "reliability_assessment": {
        "score": 0.85,
        "factors": {
          "domain_authority": 0.9,
          "content_freshness": 0.8,
          "source_type": "peer_reviewed",
          "citation_count": 45
        },
        "reasoning": "Academic source with peer review process"
      }
    }
  ],
  "research_coverage": {
    "topics_explored": ["topic1", "topic2"],
    "perspectives_found": ["academic", "industry", "regulatory"],
    "time_periods_covered": ["2023-2024", "2020-2022"],
    "geographic_coverage": ["US", "EU", "Global"]
  }
}
```

### 2. Layered Information Architecture

**Layer 1: Raw Content** (Full fidelity)
- Complete extracted text
- Original formatting preserved
- All metadata captured

**Layer 2: Structural Analysis** (No interpretation)
- Content type identification
- Section/heading extraction
- Citation/reference mapping

**Layer 3: Factual Extraction** (No judgment)
- Key entities (people, places, dates)
- Quantitative data points
- Direct quotes with attribution

### 3. Benefits of This Approach

**For Original LLM:**
- ✅ Full context preservation
- ✅ Can apply user's specific needs
- ✅ Cross-reference sources intelligently
- ✅ Make relevance judgments with conversation history
- ✅ Ask user for clarification when needed

**For Research Quality:**
- ✅ No information loss through summarization
- ✅ Transparent source discovery process
- ✅ Reliability scoring without content filtering
- ✅ Comprehensive coverage tracking

**For User Experience:**
- ✅ LLM can explain reasoning for source selection
- ✅ User can request deeper dives into specific sources
- ✅ Maintains conversational flow and context

## Implementation Strategy

### Phase 1: Core Data Collection
- Remove `writeFinalReport` function
- Restructure output to raw data format
- Preserve all source content and metadata

### Phase 2: Enhanced Metadata
- Add content analysis (structure, not interpretation)
- Improve reliability scoring methodology
- Track research coverage gaps

### Phase 3: Advanced Features
- Source relationship mapping
- Content freshness tracking
- Multi-perspective identification

## Alternative Tool Architectures

### Option A: Single Comprehensive Tool
- `research-sources` - Returns complete raw dataset
- Original LLM handles all synthesis

### Option B: Modular Tool Suite
- `search-web` - Basic web search and extraction
- `evaluate-sources` - Reliability scoring only
- `expand-research` - Find related sources
- `extract-entities` - Factual data extraction

### Option C: Streaming Research
- `start-research` - Initialize research session
- `get-next-sources` - Stream sources as found
- `research-status` - Check progress
- `finalize-research` - Complete session

## Recommendation: Option A with Enhanced Metadata
Single tool that returns comprehensive raw data with rich metadata for original LLM to synthesize with full user context.