import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { Config } from './config.js';
import { deepResearch, writeFinalReport } from './deep-research.js';
import { getModel } from './ai/providers.js';
import { logger } from './infrastructure/logging/Logger.js';
import { LogReader } from './infrastructure/logging/LogReader.js';
import { getErrorGuidance } from './infrastructure/logging/ErrorGuidance.js';
import { FirecrawlManager } from './infrastructure/search/FirecrawlManager.js';

// Helper function to log to stderr for MCP
const log = (...args: any[]) => {
  process.stderr.write(
    args
      .map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
      .join(' ') + '\n',
  );
};

// Log environment check
logger.info('MCP Server environment check', {
  operation: 'server_startup',
  hasOpenAiKey: !!Config.openai.apiKey,
  hasGoogleKey: !!Config.google.apiKey,
  hasAnthropicKey: !!Config.anthropic.apiKey,
  hasXaiKey: !!Config.xai.apiKey,
  hasFirecrawlKey: !!Config.firecrawl.apiKey,
  firecrawlBaseUrl: Config.firecrawl.baseUrl || '(using API)',
  firecrawlConcurrency: Config.firecrawl.concurrency,
});

// Generate initial log entry for debug-logs tool
logger.info('MCP Server initialized successfully', {
  operation: 'server_startup',
  timestamp: new Date().toISOString(),
  version: '1.0.0'
});

// Ensure local Firecrawl is running
if (Config.firecrawl.baseUrl) {
  FirecrawlManager.ensureLocalFirecrawl().then(isRunning => {
    if (isRunning) {
      logger.info('Local Firecrawl ready', { operation: 'server_startup' });
    } else {
      logger.warn('Local Firecrawl unavailable, will use cloud fallback', { operation: 'server_startup' });
    }
  });
}

const server = new McpServer({
  name: 'deep-research',
  version: '1.0.0',
}, { capabilities: { logging: {} } });

// Connection status tool
server.tool(
  'connection-status',
  'Check MCP server connection status and health',
  {},
  async () => {
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();
    
    logger.info('Connection status checked', {
      operation: 'connection_status',
      uptime,
      memoryMB: Math.round(memUsage.heapUsed / 1024 / 1024)
    });
    
    return {
      content: [{
        type: 'text',
        text: `🟢 **MCP Server Status: CONNECTED**\n\n**Health Info:**\n- Uptime: ${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s\n- Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB\n- PID: ${process.pid}\n- Node: ${process.version}\n\n**Services:**\n- Firecrawl: ${Config.firecrawl.baseUrl ? 'Local + Cloud Fallback' : 'Cloud Only'}\n- AI Models: ${!!Config.google.apiKey ? 'Google ' : ''}${!!Config.openai.apiKey ? 'OpenAI ' : ''}${!!Config.anthropic.apiKey ? 'Anthropic ' : ''}${!!Config.xai.apiKey ? 'xAI' : ''}\n\n✅ Server is healthy and ready for research operations.`
      }],
      metadata: {
        connected: true,
        uptime,
        memory: memUsage,
        services: {
          firecrawl: !!Config.firecrawl.baseUrl || !!Config.firecrawl.apiKey,
          ai_models: [
            Config.google.apiKey && 'google',
            Config.openai.apiKey && 'openai', 
            Config.anthropic.apiKey && 'anthropic',
            Config.xai.apiKey && 'xai'
          ].filter(Boolean)
        }
      }
    };
  }
);

// Debug logs tool for error analysis
server.tool(
  'debug-logs',
  'Access and analyze application logs for debugging errors and performance issues',
  {
    type: z.enum(['recent', 'errors', 'operation']).describe('Type of logs to retrieve'),
    lines: z.number().min(1).max(200).default(50).describe('Number of recent log lines (for recent type)'),
    operation: z.string().optional().describe('Specific operation to filter logs (for operation type)'),
    since: z.string().optional().describe('ISO timestamp to filter logs since (optional)'),
  },
  async ({ type, lines, operation, since }) => {
    try {
      const logReader = new LogReader();
      const sinceDate = since ? new Date(since) : undefined;
      
      let logs;
      switch (type) {
        case 'recent':
          logs = logReader.getRecentLogs(lines);
          break;
        case 'errors':
          logs = logReader.getErrorLogs(sinceDate);
          break;
        case 'operation':
          if (!operation) {
            return {
              content: [{ type: 'text', text: 'Operation parameter required for operation type' }],
              isError: true
            };
          }
          logs = logReader.getOperationLogs(operation, sinceDate);
          break;
      }
      
      if (logs.length === 0) {
        // Provide debug info when no logs found
        const logReader = new LogReader();
        const fileExists = require('fs').existsSync(logReader['logFile']);
        const fileSize = fileExists ? require('fs').statSync(logReader['logFile']).size : 0;
        
        return {
          content: [{ 
            type: 'text', 
            text: `No ${type} logs found\n\nDebug Info:\n- Log file exists: ${fileExists}\n- Log file size: ${fileSize} bytes\n- Log file path: ${logReader['logFile']}\n\nTip: Try running a research operation first to generate logs.`
          }]
        };
      }
      
      const logSummary = logs.map(log => {
        const timestamp = new Date(log.time).toISOString();
        const level = log.level >= 50 ? 'ERROR' : log.level >= 40 ? 'WARN' : 'INFO';
        const context = Object.entries(log)
          .filter(([key]) => !['level', 'time', 'msg', 'pid', 'hostname'].includes(key))
          .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
          .join(' ');
        
        return `[${timestamp}] ${level}: ${log.msg}${context ? ` | ${context}` : ''}`;
      }).join('\n');
      
      return {
        content: [{
          type: 'text',
          text: `## ${type.toUpperCase()} LOGS (${logs.length} entries)\n\n\`\`\`\n${logSummary}\n\`\`\``
        }],
        metadata: { logs, count: logs.length, type }
      };
    } catch (error) {
      logger.error('Failed to read logs', error as Error, { operation: 'debug_logs' });
      return {
        content: [{
          type: 'text',
          text: `Error reading logs: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

// Backward compatibility: traditional report generation
server.tool(
  'deep-research',
  'Generate AI-summarized research report (legacy mode - consider using research-sources for better context preservation)',
  {
    query: z.string().min(1).describe("The research query to investigate"),
    depth: z.number().min(1).max(5).describe("How deep to go in the research tree (1-5)"),
    breadth: z.number().min(1).max(5).describe("How broad to make each research level (1-5)"),
    model: z.string().optional().describe('Model specifier (use list-models tool to see options)'),
    tokenBudget: z.number().optional().describe('Optional soft cap for total research-phase tokens'),
    sourcePreferences: z.string().optional().describe('Natural-language preferences for sources to avoid'),
  },
  async ({ query, depth, breadth, model: modelSpec, tokenBudget, sourcePreferences }, { sendNotification }) => {
    try {
      let currentProgress = '';
      const model = getModel(modelSpec);
      logger.info('Starting legacy research', {
        operation: 'legacy_research',
        model: modelSpec || 'auto (best available)',
        query,
        depth,
        breadth
      });

      const result = await deepResearch({
        query, depth, breadth, model, tokenBudget, sourcePreferences,
        onProgress: async progress => {
          const progressMsg = `Depth ${progress.currentDepth}/${progress.totalDepth}, Query ${progress.completedQueries}/${progress.totalQueries}: ${progress.currentQuery || ''}`;
          if (progressMsg !== currentProgress) {
            currentProgress = progressMsg;
            log(progressMsg);
            try {
              await sendNotification({
                method: 'notifications/message',
                params: { level: 'info', data: progressMsg },
              });
            } catch (error) {
              logger.error('Progress notification failed', error as Error, {
                operation: 'progress_notification'
              });
            }
          }
        },
      });

      const report = await writeFinalReport({
        prompt: query,
        learnings: result.learnings,
        visitedUrls: result.visitedUrls,
        sourceMetadata: result.sourceMetadata,
        model
      });

      return {
        content: [{ type: 'text', text: report }],
        metadata: {
          learnings: result.learnings,
          visitedUrls: result.visitedUrls,
          stats: {
            totalLearnings: result.learnings.length,
            totalSources: result.visitedUrls.length,
            averageReliability: result.weightedLearnings.length > 0 
              ? result.weightedLearnings.reduce((acc, curr) => acc + curr.reliability, 0) / result.weightedLearnings.length
              : 0
          },
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Legacy research failed', error as Error, {
        operation: 'legacy_research',
        query
      });
      
      const guidance = getErrorGuidance(errorMsg);
      return {
        content: [{
          type: 'text',
          text: `Error performing research: ${errorMsg}\n\n**Debug Steps:**\n${guidance.debugSteps.map(step => `- ${step}`).join('\n')}\n\n**Relevant Log Operations:** ${guidance.logOperations.join(', ')}\n\nUse the debug-logs tool to investigate further.`,
        }],
        isError: true,
      };
    }
  },
);

// List available models tool
server.tool(
  'list-models',
  'List all available AI models with their capabilities and intelligence ratings',
  {},
  async () => {
    try {
      const { getAvailableProviders } = await import('./ai/providers.js');
      const providers = getAvailableProviders();
      
      if (providers.length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'No models available. Please set at least one API key: OPENAI_API_KEY, GOOGLE_API_KEY, ANTHROPIC_API_KEY, or XAI_API_KEY'
          }]
        };
      }
      
      const modelList = providers.map(p => 
        `${p.provider}:${p.model} (Intelligence: ${p.intelligence}/100)`
      ).join('\n');
      
      return {
        content: [{
          type: 'text', 
          text: `Available Models:\n${modelList}\n\nUsage: Use format "provider:model" (e.g., "google:gemini-2.5-pro") or leave empty for best available model.`
        }],
        metadata: { providers }
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error listing models: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

// Define the deep research tool
server.tool(
  'research-sources',
  'Collect comprehensive raw research data on a topic - returns structured source data for LLM synthesis with full user context',
  {
    query: z.string().min(1).describe("The research query to investigate"),
    depth: z.number().min(1).max(5).describe("How deep to go in the research tree (1-5)"),
    breadth: z.number().min(1).max(5).describe("How broad to make each research level (1-5)"),
    model: z.string().optional().describe('Model specifier (use list-models tool to see options). Format: "provider:model" (e.g. "google:gemini-2.5-pro", "openai:o1", "anthropic:claude-3-5-sonnet-20241022"). Leave empty for best available model.'),
    tokenBudget: z.number().optional().describe('Optional soft cap for total research-phase tokens; final report not counted'),
    sourcePreferences: z.string().optional().describe('Natural-language preferences for sources to avoid (e.g., "avoid SEO top 10 listicles, forums, affiliate reviews")'),
  },
  async ({ query, depth, breadth, model: modelSpec, tokenBudget, sourcePreferences }, { sendNotification }) => {
    try {
      let currentProgress = '';

      const model = getModel(modelSpec);
      logger.info('Starting research', {
        operation: 'research_sources',
        model: modelSpec || 'auto (best available)',
        query,
        depth,
        breadth
      });
      const result = await deepResearch({
        query,
        depth,
        breadth,
        model,
        tokenBudget,
        sourcePreferences,
        onProgress: async progress => {
          const progressMsg = `Depth ${progress.currentDepth}/${progress.totalDepth}, Query ${progress.completedQueries}/${progress.totalQueries}: ${progress.currentQuery || ''}`;
          if (progressMsg !== currentProgress) {
            currentProgress = progressMsg;
            log(progressMsg);

            try {
              await sendNotification({
                method: 'notifications/message',
                params: {
                  level: 'info',
                  data: progressMsg,
                },
              });
            } catch (error) {
              logger.error('Progress notification failed', error as Error, {
                operation: 'progress_notification'
              });
            }
          }
        },
      });

      // Return raw research data for LLM synthesis with full user context
      const researchData = {
        research_session: {
          query,
          parameters: { depth, breadth, tokenBudget, sourcePreferences },
          model_used: modelSpec || 'auto',
          execution_time: new Date().toISOString(),
          total_sources: result.visitedUrls.length
        },
        raw_sources: result.sourceMetadata.map((source, index) => ({
          id: `src_${String(index + 1).padStart(3, '0')}`,
          url: source.url,
          title: source.title,
          content: null, // Content not stored in SourceMetadata, would need to be fetched separately
          metadata: {
            word_count: 0, // Would need separate content fetch to calculate
            domain: source.domain,
            content_type: 'unknown'
          },
          reliability_assessment: {
            score: source.reliabilityScore,
            reasoning: source.reliabilityReasoning
          }
        })),
        research_coverage: {
          total_sources: result.visitedUrls.length,
          average_reliability: result.weightedLearnings.length > 0 
            ? result.weightedLearnings.reduce((acc, curr) => acc + curr.reliability, 0) / result.weightedLearnings.length
            : 0,
          high_reliability_sources: result.sourceMetadata.filter(s => s.reliabilityScore >= 0.7).length,
          visited_urls: result.visitedUrls
        }
      };

      return {
        content: [
          {
            type: 'text',
            text: `Research completed: Found ${result.visitedUrls.length} sources with average reliability ${result.visitedUrls.length > 0 ? (researchData.research_coverage.average_reliability * 100).toFixed(1) : '0'}%\n\nRaw research data provided below for synthesis with your full conversation context.`,
          },
        ],
        metadata: researchData,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error('Research failed', error as Error, {
        operation: 'research_sources',
        query
      });
      
      const guidance = getErrorGuidance(errorMsg);
      return {
        content: [
          {
            type: 'text',
            text: `Error performing research: ${errorMsg}\n\n**Debug Steps:**\n${guidance.debugSteps.map(step => `- ${step}`).join('\n')}\n\n**Relevant Log Operations:** ${guidance.logOperations.join(', ')}\n\nUse the debug-logs tool to investigate further.`,
          },
        ],
        isError: true,
      };
    }
  },
);

async function main() {
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  
  async function connectWithRetry() {
    try {
      const transport = new StdioServerTransport();
      await server.connect(transport);
      
      logger.info('MCP Server connected', {
        operation: 'server_startup',
        transport: 'stdio',
        attempt: reconnectAttempts + 1
      });
      
      reconnectAttempts = 0; // Reset on successful connection
      
      // Monitor connection health
      const healthInterval = setInterval(() => {
        logger.debug('Server health check', {
          operation: 'health_check',
          connected: true,
          uptime: process.uptime()
        });
      }, 30000); // Every 30 seconds
      
      // Handle transport errors
      transport.onclose = () => {
        clearInterval(healthInterval);
        logger.warn('Transport connection closed', {
          operation: 'connection_lost'
        });
        
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          logger.info('Attempting reconnection', {
            operation: 'reconnection',
            attempt: reconnectAttempts
          });
          setTimeout(connectWithRetry, 2000 * reconnectAttempts);
        } else {
          logger.error('Max reconnection attempts reached', new Error('Connection failed'), {
            operation: 'reconnection_failed'
          });
          process.exit(1);
        }
      };
      
    } catch (error) {
      logger.error('Server connection failed', error as Error, {
        operation: 'server_startup',
        attempt: reconnectAttempts + 1
      });
      
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        setTimeout(connectWithRetry, 2000 * reconnectAttempts);
      } else {
        process.exit(1);
      }
    }
  }
  
  await connectWithRetry();
}

// Handle server shutdown
process.on('SIGINT', async () => {
  logger.info('Server shutting down', {
    operation: 'server_shutdown'
  });
  await server.close();
  process.exit(0);
});

main().catch(error => {
  logger.error('Fatal server error', error as Error, {
    operation: 'server_main'
  });
  process.exit(1);
});