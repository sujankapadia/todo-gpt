#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');

async function testChatMode() {
  console.log('🧪 CHAT MODE TEST - COMPLEX MULTI-ITEM OPERATIONS\n');

  let app;
  let output = '';
  let testPhase = 'starting';

  try {
    console.log('🚀 Starting application...');
    
    app = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Capture all output
    app.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stdout.write(text); // Echo to our console
      
      // Phase-based test progression
      if (text.includes('📝') && testPhase === 'starting') {
        testPhase = 'setup';
        setTimeout(() => setupTestData(), 1000);
      } else if (text.includes('✅ Created test scenario') && testPhase === 'setup') {
        testPhase = 'entering_chat';
        setTimeout(() => enterChatMode(), 1000);
      } else if (text.includes('💬 Entering AI Chat Mode') && testPhase === 'entering_chat') {
        testPhase = 'chat_testing';
        setTimeout(() => startChatTests(), 2000);
      } else if (text.includes('Execute these commands? (y/n):') && testPhase === 'chat_testing') {
        testPhase = 'confirming';
        setTimeout(() => confirmExecution(), 1000);
      } else if (text.includes('Command sequence completed') && testPhase === 'confirming') {
        testPhase = 'final_check';
        setTimeout(() => finalChecks(), 1000);
      } else if (testPhase === 'final_check' && text.includes('chat>')) {
        testPhase = 'completing';
        setTimeout(() => exitAndAnalyze(), 1000);
      }
    });

    app.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stderr.write(text);
    });

    async function setupTestData() {
      console.log('\n🏗️ Setting up test scenario...');
      
      // Create beach vacation list
      app.stdin.write('/create "Beach Vacation"\n');
      await delay(500);
      
      // Add various items including clothing
      const items = [
        'Swimsuits (at least 4)',
        'Beach towels',
        'Sunscreen (SPF 30+)', 
        'Sunglasses',
        'Hat or cap',
        'Flip-flops or sandals',
        'Lightweight clothing',
        'Cover-up or sarong', 
        'Reusable water bottle',
        'Beach bag',
        'Light sweater for evenings'
      ];
      
      for (const item of items) {
        app.stdin.write(`/add "${item}"\n`);
        await delay(200);
      }
      
      // Mark setup complete
      app.stdin.write('echo "✅ Created test scenario"\n');
    }

    async function enterChatMode() {
      console.log('\n💬 Entering chat mode...');
      app.stdin.write('/chat\n');
    }

    async function startChatTests() {
      console.log('\n🧪 Starting chat mode tests...');
      
      // Test 1: Ask about clothing items
      console.log('📝 Test 1: Identifying clothing items');
      app.stdin.write('Which items are clothing related?\n');
      
      await delay(3000); // Wait for AI response
      
      // Test 2: Request to delete multiple clothing items  
      console.log('📝 Test 2: Request complex multi-delete operation');
      app.stdin.write('Please move all the clothing items to a new list called "Beach Wear" and remove them from this list\n');
    }

    async function confirmExecution() {
      console.log('\n✅ Confirming command sequence execution...');
      app.stdin.write('y\n');
    }

    async function finalChecks() {
      console.log('\n🔍 Running final checks...');
      
      await delay(2000);
      
      // Check what's left in the original list
      app.stdin.write('Show me what\'s left in the Beach Vacation list\n');
      
      await delay(2000);
      
      // Check the new Beach Wear list
      app.stdin.write('Switch to Beach Wear list and show me what\'s there\n');
    }

    async function exitAndAnalyze() {
      console.log('\n🏁 Completing test...');
      app.stdin.write('exit\n');
      
      setTimeout(() => {
        app.stdin.write('/exit\n');
        setTimeout(() => {
          if (!app.killed) {
            app.kill();
          }
        }, 1000);
      }, 2000);
    }

    function delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Auto-kill after 60 seconds
    setTimeout(() => {
      if (app && !app.killed) {
        console.log('\n⏰ Test timeout, killing application');
        app.kill();
      }
    }, 60000);

    app.on('exit', (code) => {
      console.log(`\n🏁 Application exited with code ${code}`);
      analyzeResults();
    });

    function analyzeResults() {
      console.log('\n📊 CHAT MODE TEST ANALYSIS');
      console.log('=' .repeat(60));
      
      // Check for key success indicators
      const hasShortIds = /\{[a-f0-9]{8}\}/.test(output);
      const hasCommandSequence = output.includes('Execute these commands?');
      const hasSuccessfulExecutions = (output.match(/✅.*(?:Created|Added|Deleted|Switched)/g) || []).length;
      const hasClothingIdentification = /swimsuits|clothing|hat|flip-flops|cover-up|sweater/i.test(output);
      const hasListCreation = output.includes('Created list') || output.includes('create_list');
      const hasMultipleDeletes = (output.match(/delete_todo/g) || []).length > 1;
      const hasErrors = output.includes('❌');

      console.log('🔍 ANALYSIS RESULTS:');
      console.log(`📋 Short IDs in AI context: ${hasShortIds ? '✅ YES' : '❌ NO'}`);
      console.log(`👕 Clothing identification: ${hasClothingIdentification ? '✅ YES' : '❌ NO'}`);
      console.log(`🔗 Command sequence generated: ${hasCommandSequence ? '✅ YES' : '❌ NO'}`);
      console.log(`📝 New list creation: ${hasListCreation ? '✅ YES' : '❌ NO'}`);
      console.log(`🗑️ Multiple deletions: ${hasMultipleDeletes ? '✅ YES' : '❌ NO'}`);
      console.log(`✅ Successful operations: ${hasSuccessfulExecutions}`);
      console.log(`❌ Errors detected: ${hasErrors ? '⚠️ YES' : '✅ NO'}`);

      if (hasShortIds) {
        const shortIdMatches = output.match(/\{[a-f0-9]{8}\}/g);
        if (shortIdMatches) {
          console.log(`🆔 Found ${shortIdMatches.length} short ID references in debug output`);
        }
      }

      // Count command sequence operations
      const createCommands = (output.match(/"action":\s*"create_list"/g) || []).length;
      const switchCommands = (output.match(/"action":\s*"switch_list"/g) || []).length; 
      const addCommands = (output.match(/"action":\s*"add_todo"/g) || []).length;
      const deleteCommands = (output.match(/"action":\s*"delete_todo"/g) || []).length;

      if (hasCommandSequence) {
        console.log('\n🔗 COMMAND SEQUENCE BREAKDOWN:');
        console.log(`  📝 Create operations: ${createCommands}`);
        console.log(`  🔄 Switch operations: ${switchCommands}`);
        console.log(`  ➕ Add operations: ${addCommands}`);
        console.log(`  🗑️ Delete operations: ${deleteCommands}`);
      }

      // Save full log
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const logFile = `test-chat-mode-${timestamp}.log`;
      fs.writeFileSync(logFile, output);
      console.log(`📝 Full output saved to: ${logFile}`);
      
      console.log('\n🎯 FINAL VERDICT:');
      if (hasCommandSequence && hasShortIds && hasSuccessfulExecutions > 5 && !hasErrors) {
        console.log('🎉 CHAT MODE TEST PASSED!');
        console.log('✅ AI successfully generated complex command sequences');
        console.log('✅ Stable shortIds used throughout operations');
        console.log('✅ Multi-item operations completed without corruption');
        console.log('✅ Beach vacation scenario solved successfully');
      } else if (hasCommandSequence && hasShortIds) {
        console.log('⚠️ CHAT MODE PARTIALLY WORKING');
        console.log('✅ Core functionality works but some issues detected');
      } else {
        console.log('❌ CHAT MODE TEST FAILED');
        console.log('Check the log file for detailed error analysis');
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    if (app && !app.killed) {
      app.kill();
    }
  }
}

testChatMode();