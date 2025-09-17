export const ERROR_GUIDANCE = {
  'Failed to evaluate source reliability': {
    description: 'AI model failed during source evaluation',
    debugSteps: [
      'Check debug-logs with type="errors" for AI model errors',
      'Verify API keys are set correctly',
      'Check if rate limits were exceeded',
      'Look for network connectivity issues'
    ],
    logOperations: ['source_evaluation', 'ai_model_call']
  },
  
  'Firecrawl search failed': {
    description: 'External search service error',
    debugSteps: [
      'Check debug-logs with operation="firecrawl_search"',
      'Verify local Firecrawl instance is running on localhost:3002',
      'If local fails, check cloud API credits and quota',
      'Verify FIRECRAWL_KEY is valid for cloud fallback'
    ],
    logOperations: ['firecrawl_search']
  },
  
  'credits exhausted': {
    description: 'Firecrawl cloud API credits depleted',
    debugSteps: [
      'Start local Firecrawl instance: docker-compose up firecrawl',
      'Check debug-logs for local connection attempts',
      'Add credits to Firecrawl cloud account',
      'Verify FIRECRAWL_BASE_URL points to local instance'
    ],
    logOperations: ['firecrawl_search']
  },
  
  'Query execution error': {
    description: 'Error during search query processing',
    debugSteps: [
      'Check debug-logs with operation="query_execution"',
      'Look for timeout errors in recent logs',
      'Check concurrent request limits',
      'Verify search API quotas'
    ],
    logOperations: ['query_execution', 'serp_processing']
  },
  
  'Research failed': {
    description: 'General research operation failure',
    debugSteps: [
      'Check debug-logs with type="errors" for recent failures',
      'Look at operation="deep_research" logs',
      'Check token budget exhaustion',
      'Verify all required API keys are available'
    ],
    logOperations: ['deep_research', 'research_sources']
  },
  
  'No Firecrawl instance available': {
    description: 'Neither local nor cloud Firecrawl is accessible',
    debugSteps: [
      'Start local Firecrawl: docker-compose up firecrawl',
      'Check debug-logs with operation="firecrawl_search"',
      'Verify FIRECRAWL_BASE_URL and FIRECRAWL_KEY configuration',
      'Check network connectivity to both local and cloud'
    ],
    logOperations: ['firecrawl_search', 'server_startup']
  }
};

export function getErrorGuidance(errorMessage: string) {
  for (const [pattern, guidance] of Object.entries(ERROR_GUIDANCE)) {
    if (errorMessage.includes(pattern)) {
      return guidance;
    }
  }
  
  return {
    description: 'Unknown error occurred',
    debugSteps: [
      'Check debug-logs with type="errors" for recent error details',
      'Look at debug-logs with type="recent" for context',
      'Check application configuration and API keys'
    ],
    logOperations: ['server_startup', 'deep_research']
  };
}