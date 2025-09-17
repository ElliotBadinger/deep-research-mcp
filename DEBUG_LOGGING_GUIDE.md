# Debug Logging MCP Tool Guide

## Overview

The Deep Research MCP server now includes a `debug-logs` tool that enables automatic error diagnosis and debugging through structured log analysis.

## MCP Tool: debug-logs

### Purpose
- Access application logs for debugging errors
- Analyze performance issues and operation failures  
- Provide structured log data for automatic error diagnosis

### Parameters

| Parameter | Type | Description | Required |
|-----------|------|-------------|----------|
| `type` | enum | Type of logs: `recent`, `errors`, `operation` | Yes |
| `lines` | number | Number of recent log lines (1-200, default: 50) | No |
| `operation` | string | Specific operation to filter (required for `operation` type) | Conditional |
| `since` | string | ISO timestamp to filter logs since | No |

### Usage Examples

#### Get Recent Logs
```json
{
  "type": "recent",
  "lines": 100
}
```

#### Get Error Logs
```json
{
  "type": "errors",
  "since": "2024-01-15T10:00:00Z"
}
```

#### Get Operation-Specific Logs
```json
{
  "type": "operation", 
  "operation": "firecrawl_search",
  "since": "2024-01-15T10:00:00Z"
}
```

## Automatic Error Guidance

When errors occur in research operations, the system now provides:

1. **Error Description**: Clear explanation of what went wrong
2. **Debug Steps**: Specific actions to diagnose the issue
3. **Relevant Log Operations**: Which log operations to examine
4. **Tool Recommendation**: Direct guidance to use `debug-logs`

### Example Error Response
```
Error performing research: Failed to evaluate source reliability

**Debug Steps:**
- Check debug-logs with type="errors" for AI model errors
- Verify API keys are set correctly  
- Check if rate limits were exceeded
- Look for network connectivity issues

**Relevant Log Operations:** source_evaluation, ai_model_call

Use the debug-logs tool to investigate further.
```

## Log Operations Available

| Operation | Description |
|-----------|-------------|
| `server_startup` | MCP server initialization |
| `firecrawl_search` | External search API calls |
| `serp_processing` | Search result processing |
| `deep_research` | Recursive research operations |
| `query_execution` | Search query processing |
| `source_evaluation` | Source reliability assessment |
| `ai_model_call` | AI model interactions |
| `research_sources` | Raw source collection |
| `legacy_research` | Traditional report generation |
| `report_generation` | Final report creation |
| `progress_notification` | Progress updates |

## Debugging Workflow

### For Users
1. When an error occurs, read the automatic guidance provided
2. Use the `debug-logs` tool with suggested parameters
3. Examine log entries for specific error details
4. Follow debug steps to resolve issues

### For Models
1. When encountering errors, automatically suggest using `debug-logs`
2. Analyze log patterns to identify root causes
3. Provide specific recommendations based on log data
4. Guide users through systematic debugging process

## Log File Location

- **Development**: Logs output to console with pretty formatting
- **Production**: Logs written to `app.log` in project root
- **Access**: LogReader service reads from `app.log` or specified file

## Benefits

1. **Automatic Diagnosis**: Models can analyze logs to identify issues
2. **Structured Debugging**: Consistent approach to error investigation  
3. **Performance Analysis**: Duration and metrics tracking in logs
4. **Error Correlation**: Operation-based log filtering and analysis
5. **User Guidance**: Clear steps for resolving common issues

## Integration with Existing Tools

The debug logging integrates seamlessly with existing research tools:
- All research operations generate structured logs
- Error responses include automatic debugging guidance
- Log operations align with tool functionality
- Performance metrics captured for optimization