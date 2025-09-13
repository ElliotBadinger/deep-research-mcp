#!/usr/bin/env node

// Test the new raw research data approach
const { spawn } = require('child_process');

console.log('🧪 Testing Raw Research Data Approach...\n');

const testQuery = 'latest developments in quantum computing 2024';

// Test the new research-sources tool
const mcpProcess = spawn('node', ['dist/src/mcp-server.js'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

const request = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: {
    name: 'research-sources',
    arguments: {
      query: testQuery,
      depth: 2,
      breadth: 2,
      model: 'google:gemini-2.5-flash'
    }
  }
};

mcpProcess.stdin.write(JSON.stringify(request) + '\n');
mcpProcess.stdin.end();

let output = '';
mcpProcess.stdout.on('data', (data) => {
  output += data.toString();
});

mcpProcess.on('close', (code) => {
  console.log(`\n📊 Raw Research Test Results:`);
  console.log(`Exit code: ${code}`);
  
  try {
    const response = JSON.parse(output.split('\n').find(line => line.includes('"result"')));
    const metadata = response.result.metadata;
    
    console.log(`\n✅ Research Session:`);
    console.log(`- Query: ${metadata.research_session.query}`);
    console.log(`- Model: ${metadata.research_session.model_used}`);
    console.log(`- Total Sources: ${metadata.research_session.total_sources}`);
    
    console.log(`\n📚 Raw Sources Found: ${metadata.raw_sources.length}`);
    metadata.raw_sources.slice(0, 3).forEach((source, i) => {
      console.log(`${i + 1}. ${source.title || 'No title'}`);
      console.log(`   URL: ${source.url}`);
      console.log(`   Reliability: ${source.reliability_assessment.score.toFixed(2)} - ${source.reliability_assessment.reasoning}`);
      console.log(`   Domain: ${source.metadata.domain}`);
    });
    
    console.log(`\n📈 Research Coverage:`);
    console.log(`- Average Reliability: ${(metadata.research_coverage.average_reliability * 100).toFixed(1)}%`);
    console.log(`- High Reliability Sources: ${metadata.research_coverage.high_reliability_sources}`);
    
    console.log(`\n🎯 Success! Raw research data approach working correctly.`);
    console.log(`📝 Original LLM now receives comprehensive source data for context-aware synthesis.`);
    
  } catch (error) {
    console.error('❌ Error parsing response:', error.message);
    console.log('Raw output:', output);
  }
});

setTimeout(() => {
  mcpProcess.kill();
  console.log('\n⏰ Test timeout - killing process');
}, 120000); // 2 minute timeout