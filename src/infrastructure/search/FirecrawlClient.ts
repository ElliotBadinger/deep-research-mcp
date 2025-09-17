import FirecrawlApp from '@mendable/firecrawl-js';
import { logger } from '../logging/Logger.js';
import { firecrawl as firecrawlConfig } from '../../config.js';

export class FirecrawlClient {
  private localClient?: FirecrawlApp;
  private cloudClient?: FirecrawlApp;
  private useLocal: boolean = true;

  constructor() {
    // Try local first
    if (firecrawlConfig.baseUrl) {
      this.localClient = new FirecrawlApp({
        apiKey: null,
        apiUrl: firecrawlConfig.baseUrl,
      });
    }
    
    // Cloud fallback
    if (firecrawlConfig.apiKey) {
      this.cloudClient = new FirecrawlApp({
        apiKey: firecrawlConfig.apiKey,
      });
    }
  }

  async search(query: string, options: any) {
    // Try local first
    if (this.localClient && this.useLocal) {
      try {
        const result = await this.localClient.search(query, options);
        logger.info('Local Firecrawl search successful', {
          operation: 'firecrawl_search',
          query,
          source: 'local'
        });
        return result;
      } catch (error: any) {
        logger.warn('Local Firecrawl failed, trying cloud fallback', {
          operation: 'firecrawl_search',
          query,
          error: error.message
        });
        this.useLocal = false; // Disable local for this session
      }
    }

    // Fallback to cloud
    if (this.cloudClient) {
      try {
        const result = await this.cloudClient.search(query, options);
        logger.info('Cloud Firecrawl search successful', {
          operation: 'firecrawl_search',
          query,
          source: 'cloud'
        });
        return result;
      } catch (error: any) {
        if (error.message?.includes('credits') || error.message?.includes('quota')) {
          logger.error('Firecrawl cloud credits exhausted', error, {
            operation: 'firecrawl_search',
            query
          });
          throw new Error('Firecrawl cloud credits exhausted. Please start local Firecrawl instance or add credits.');
        }
        throw error;
      }
    }

    throw new Error('No Firecrawl instance available. Please start local instance or configure cloud API key.');
  }
}