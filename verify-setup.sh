#!/bin/bash

echo "🔍 Deep Research MCP Server Setup Verification"
echo "=============================================="

# Check configuration file
echo "📋 1. Claude Desktop Configuration:"
if [ -f ~/.config/Claude/claude_desktop_config.json ]; then
    echo "   ✅ Configuration file exists"
    echo "   📄 Contents:"
    cat ~/.config/Claude/claude_desktop_config.json | jq . 2>/dev/null || cat ~/.config/Claude/claude_desktop_config.json
else
    echo "   ❌ Configuration file missing"
    exit 1
fi

echo ""

# Check server build
echo "🔧 2. Server Build:"
if [ -f dist/mcp-server.js ]; then
    echo "   ✅ Server built successfully"
    echo "   📊 Size: $(ls -lh dist/mcp-server.js | awk '{print $5}')"
else
    echo "   ❌ Server not built - run 'npm run build'"
    exit 1
fi

echo ""

# Check environment file
echo "🌍 3. Environment Configuration:"
if [ -f .env.local ]; then
    echo "   ✅ Environment file exists"
    echo "   🔑 API Keys configured:"
    grep -E "(GOOGLE_API_KEY|FIRECRAWL_KEY)" .env.local | sed 's/=.*/=***/' || echo "   ⚠️  No API keys found"
else
    echo "   ❌ Environment file missing"
fi

echo ""

# Test server startup
echo "🚀 4. Server Startup Test:"
timeout 3s node dist/mcp-server.js >/dev/null 2>&1
if [ $? -eq 124 ]; then
    echo "   ✅ Server starts correctly (timeout expected)"
else
    echo "   ❌ Server startup failed"
fi

echo ""
echo "📋 Setup Summary:"
echo "   • Configuration: ~/.config/Claude/claude_desktop_config.json"
echo "   • Server: /home/siya/deep-research-mcp/dist/mcp-server.js"
echo "   • Tools: research-sources, debug-logs, connection-status"
echo ""
echo "🎯 Next Steps:"
echo "   1. Restart Claude Desktop completely"
echo "   2. Look for 'deep-research' server in Claude Desktop"
echo "   3. Test with connection-status tool"
echo ""
echo "✅ Setup verification complete!"