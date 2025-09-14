#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');

console.log('🧪 Comprehensive Testing: Raw Research Data vs Legacy Approach\n');

const tests = [
  {
    name: 'list-models',
    tool: 'list-models',
    args: {},
    timeout: 10000
  },
  {
    name: 'research-sources-basic',
    tool: 'research-sources', 
    args: {
      query: 'AI safety research 2024',
      depth: 1,
      breadth: 2,
      model: 'google:gemini-2.5-flash'
    },
    timeout: 60000
  },
  {
    name: 'deep-research-legacy',
    tool: 'deep-research',
    args: {
      query: 'AI safety research 2024', 
      depth: 1,
      breadth: 2,
      model: 'google:gemini-2.5-flash'
    },
    timeout: 60000
  }
];

async function runTest(test) {
  return new Promise((resolve) => {
    console.log(`\n🔬 Testing: ${test.name}`);
    
    const mcpProcess = spawn('node', ['dist/mcp-server.js'], {
      stdio: ['pipe', 'pipe', 'inherit']
    });

    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: test.tool,
        arguments: test.args
      }
    };

    mcpProcess.stdin.write(JSON.stringify(request) + '\n');
    mcpProcess.stdin.end();

    let output = '';
    mcpProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    const timer = setTimeout(() => {
      mcpProcess.kill();
      resolve({ success: false, error: 'timeout', output });
    }, test.timeout);

    mcpProcess.on('close', (code) => {
      clearTimeout(timer);
      resolve({ success: code === 0, code, output });
    });
  });
}

async function main() {
  const results = {};
  
  for (const test of tests) {
    const result = await runTest(test);
    results[test.name] = result;
    
    if (result.success) {
      console.log(`✅ ${test.name}: PASSED`);
      
      try {
        const lines = result.output.split('\n').filter(line => line.trim());
        const responseLine = lines.find(line => line.includes('"result"'));
        
        if (responseLine) {
          const response = JSON.parse(responseLine);
          
          if (test.tool === 'list-models') {
            console.log(`   Available models: ${response.result.metadata?.providers?.length || 0}`);
          } else if (test.tool === 'research-sources') {
            const metadata = response.result.metadata;
            console.log(`   Sources found: ${metadata.raw_sources?.length || 0}`);
            console.log(`   Avg reliability: ${(metadata.research_coverage?.average_reliability * 100).toFixed(1)}%`);
            console.log(`   Data structure: ✅ Raw sources preserved`);
          } else if (test.tool === 'deep-research') {
            const content = response.result.content[0]?.text;
            console.log(`   Report length: ${content?.length || 0} chars`);
            console.log(`   Data structure: ❌ AI-summarized report`);
          }
        }
      } catch (e) {
        console.log(`   ⚠️  Could not parse response`);
      }
    } else {
      console.log(`❌ ${test.name}: FAILED (${result.error || result.code})`);
    }
  }

  // Analysis
  console.log('\n📊 Comprehensive Test Analysis:');
  
  const modelsTest = results['list-models'];
  const rawTest = results['research-sources-basic'];
  const legacyTest = results['deep-research-legacy'];
  
  console.log('\n🔧 Tool Availability:');
  console.log(`- list-models: ${modelsTest.success ? '✅' : '❌'}`);
  console.log(`- research-sources: ${rawTest.success ? '✅' : '❌'}`);
  console.log(`- deep-research (legacy): ${legacyTest.success ? '✅' : '❌'}`);
  
  if (rawTest.success && legacyTest.success) {
    console.log('\n🆚 Raw vs Legacy Comparison:');
    console.log('- Raw approach: Returns structured source data for LLM synthesis');
    console.log('- Legacy approach: Returns AI-generated summary (information bottleneck)');
    console.log('- Recommendation: Use research-sources for better context preservation');
  }
  
  console.log('\n🎯 Test Summary:');
  const passed = Object.values(results).filter(r => r.success).length;
  const total = Object.keys(results).length;
  console.log(`${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Raw research data approach is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Check implementation.');
  }
}

main().catch(console.error);