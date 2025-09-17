# Claude Desktop MCP Server Setup Guide

## ✅ Issue Identified

**Problem**: Claude Desktop logs show "Extension ozamatash-deep-research not found in installed extensions"

**Root Cause**: Missing or incorrect MCP server configuration in Claude Desktop

## 🔧 Solution

### 1. Configuration File Created
Location: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "deep-research": {
      "command": "node",
      "args": ["/home/siya/deep-research-mcp/dist/mcp-server.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### 2. Setup Steps

1. **Build the server**:
   ```bash
   cd /home/siya/deep-research-mcp
   npm run build
   ```

2. **Install configuration** (already done):
   ```bash
   mkdir -p ~/.config/Claude
   cp claude_desktop_config.json ~/.config/Claude/claude_desktop_config.json
   ```

3. **Restart Claude Desktop** completely:
   - Close Claude Desktop
   - Kill any remaining processes: `pkill -f claude`
   - Restart Claude Desktop

### 3. Verification

After restart, Claude Desktop should:
- ✅ Find the "deep-research" MCP server
- ✅ Connect automatically
- ✅ Show available tools: `research-sources`, `debug-logs`, `connection-status`

### 4. Troubleshooting

If still not working:

1. **Check file permissions**:
   ```bash
   ls -la ~/.config/Claude/claude_desktop_config.json
   ```

2. **Verify server builds**:
   ```bash
   cd /home/siya/deep-research-mcp
   npm run build
   ls -la dist/mcp-server.js
   ```

3. **Test server manually**:
   ```bash
   node dist/mcp-server.js
   ```

4. **Check Claude Desktop logs** for connection attempts

### 5. Alternative Configuration Locations

If `~/.config/Claude/` doesn't work, try:
- `~/.claude/claude_desktop_config.json`
- `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
- `%APPDATA%\Claude\claude_desktop_config.json` (Windows)

## 📊 Expected Behavior

Once configured correctly:
- Claude Desktop will automatically start the MCP server
- Server will appear as "connected" in Claude Desktop
- Tools will be available: research-sources, debug-logs, connection-status
- No more "extension not found" warnings in logs

## 🎯 Next Steps

1. Restart Claude Desktop completely
2. Check for "deep-research" server in Claude Desktop settings
3. Test with `connection-status` tool
4. Use `debug-logs` to verify logging is working
5. Try `research-sources` for actual research operations