import { execSync } from 'child_process';
import { logger } from '../logging/Logger.js';

export class FirecrawlManager {
  static async ensureLocalFirecrawl(): Promise<boolean> {
    try {
      // Check if local Firecrawl is already running
      const response = await fetch('http://localhost:3002/health').catch(() => null);
      if (response?.ok) {
        logger.info('Local Firecrawl already running', { operation: 'firecrawl_check' });
        return true;
      }

      // Try to start local Firecrawl with docker-compose
      logger.info('Starting local Firecrawl with docker-compose', { operation: 'firecrawl_startup' });
      
      execSync('docker-compose up -d firecrawl', { 
        stdio: 'pipe',
        timeout: 30000 
      });

      // Wait for startup
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Verify it's running
      const healthCheck = await fetch('http://localhost:3002/health').catch(() => null);
      if (healthCheck?.ok) {
        logger.info('Local Firecrawl started successfully', { operation: 'firecrawl_startup' });
        return true;
      }

      logger.warn('Local Firecrawl failed to start', { operation: 'firecrawl_startup' });
      return false;
    } catch (error) {
      logger.warn('Could not start local Firecrawl: ' + (error as Error).message, { operation: 'firecrawl_startup' });
      return false;
    }
  }
}