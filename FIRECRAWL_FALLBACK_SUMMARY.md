# Firecrawl Local-First Fallback Implementation

## ✅ Problem Fixed

**Original Issue**: `Found 0 sources with average reliability NaN%`

**Root Cause**: Local Firecrawl instance not running, no fallback mechanism

## 🔧 Solution Implemented

### 1. FirecrawlClient with Smart Fallback
- **Local First**: Always tries local Firecrawl (localhost:3002) first
- **Cloud Fallback**: Automatically switches to cloud API when local fails
- **Credits Detection**: Detects credit exhaustion and provides clear error messages

### 2. Automatic Firecrawl Management
- **Startup Check**: Server automatically checks if local Firecrawl is running
- **Docker Startup**: Attempts to start local Firecrawl with `docker-compose up -d firecrawl`
- **Graceful Degradation**: Falls back to cloud API if Docker unavailable

### 3. Enhanced Error Handling
- **NaN Fix**: Prevents division by zero when no sources found
- **Credit Exhaustion**: Specific error messages for quota issues
- **Connection Errors**: Clear guidance for local vs cloud failures

## 📊 Implementation Details

### FirecrawlClient Logic
```typescript
// Try local first
if (localClient && useLocal) {
  try {
    return await localClient.search(query, options);
  } catch (error) {
    useLocal = false; // Disable for session
  }
}

// Fallback to cloud
if (cloudClient) {
  return await cloudClient.search(query, options);
}
```

### Automatic Startup
```typescript
// On server start
if (Config.firecrawl.baseUrl) {
  FirecrawlManager.ensureLocalFirecrawl();
}
```

### NaN Prevention
```typescript
// Fixed reliability calculation
average_reliability: result.weightedLearnings.length > 0 
  ? result.weightedLearnings.reduce((acc, curr) => acc + curr.reliability, 0) / result.weightedLearnings.length
  : 0
```

## 🎯 Error Guidance Enhanced

### Credits Exhausted
```
**Debug Steps:**
- Start local Firecrawl instance: docker-compose up firecrawl
- Check debug-logs for local connection attempts
- Add credits to Firecrawl cloud account
- Verify FIRECRAWL_BASE_URL points to local instance
```

### No Firecrawl Available
```
**Debug Steps:**
- Start local Firecrawl: docker-compose up firecrawl
- Check debug-logs with operation="firecrawl_search"
- Verify FIRECRAWL_BASE_URL and FIRECRAWL_KEY configuration
- Check network connectivity to both local and cloud
```

## 📁 Files Created/Modified

### New Files
- `src/infrastructure/search/FirecrawlClient.ts` - Smart fallback client
- `src/infrastructure/search/FirecrawlManager.ts` - Automatic startup management
- `docker-compose.yml` - Local Firecrawl setup

### Modified Files
- `src/deep-research.ts` - Uses new FirecrawlClient
- `src/mcp-server.ts` - NaN fixes, automatic startup
- `src/infrastructure/logging/ErrorGuidance.ts` - Enhanced error guidance
- `.env.local` - Local-first configuration

## ✅ Verification Results

**Server Startup Log**:
```
[INFO] MCP Server environment check
[INFO] Starting local Firecrawl with docker-compose
[WARN] Could not start local Firecrawl: docker-compose not found
[WARN] Local Firecrawl unavailable, will use cloud fallback
[INFO] MCP Server started
```

**Behavior**:
- ✅ Detects missing docker-compose gracefully
- ✅ Falls back to cloud API automatically  
- ✅ Provides clear logging for debugging
- ✅ Prevents NaN reliability calculations
- ✅ Enhanced error guidance for common issues

## 🚀 Usage

### With Docker (Preferred)
```bash
docker-compose up -d firecrawl  # Start local instance
npm run start:stdio             # Server uses local first
```

### Without Docker (Cloud Fallback)
```bash
# Ensure FIRECRAWL_KEY is set in .env.local
npm run start:stdio  # Server automatically falls back to cloud
```

The system now provides robust Firecrawl access with intelligent fallback, preventing the "0 sources with NaN%" error and ensuring research operations continue even when local instances are unavailable.