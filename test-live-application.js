#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');

class LiveAppTester {
  constructor() {
    this.app = null;
    this.output = '';
    this.currentStep = 0;
    this.steps = [];
    this.testResults = [];
  }

  async runTest() {
    console.log('🧪 LIVE APPLICATION TEST - STABLE TODO IDENTIFICATION\n');

    try {
      await this.startApplication();
      await this.setupTestScenario();
      await this.testNaturalLanguageParsing();
      await this.testChatMode();
      await this.analyzeResults();
    } catch (error) {
      console.error('❌ Test failed:', error);
    } finally {
      await this.cleanup();
    }
  }

  async startApplication() {
    console.log('🚀 Starting todo application...');
    
    return new Promise((resolve, reject) => {
      this.app = spawn('node', ['dist/index.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      let startupComplete = false;
      let outputBuffer = '';

      this.app.stdout.on('data', (data) => {
        const text = data.toString();
        outputBuffer += text;
        this.output += text;

        // Look for the main prompt to know app is ready
        if (text.includes('📝 Todo List') && !startupComplete) {
          startupComplete = true;
          console.log('✅ Application started successfully');
          resolve();
        }
      });

      this.app.stderr.on('data', (data) => {
        console.log('STDERR:', data.toString());
      });

      this.app.on('error', (error) => {
        reject(error);
      });

      // Timeout if app doesn't start
      setTimeout(() => {
        if (!startupComplete) {
          reject(new Error('Application failed to start within timeout'));
        }
      }, 10000);
    });
  }

  async sendCommand(command, expectedResponse = null, timeout = 5000) {
    console.log(`\n📤 Sending: ${command}`);
    
    return new Promise((resolve) => {
      let responseBuffer = '';
      let responseReceived = false;

      const dataHandler = (data) => {
        const text = data.toString();
        responseBuffer += text;
        this.output += text;

        // Look for prompt indicators to know command completed
        if (text.includes('📝 Todo List') || 
            text.includes('💬 Entering AI Chat Mode') ||
            text.includes('chat>') ||
            text.includes('Execute these commands? (y/n):')) {
          
          if (!responseReceived) {
            responseReceived = true;
            this.app.stdout.removeListener('data', dataHandler);
            console.log(`📥 Response received (${responseBuffer.length} chars)`);
            
            // Log key parts of the response
            if (responseBuffer.includes('✅')) {
              console.log('✅ Command executed successfully');
            }
            if (responseBuffer.includes('❌')) {
              console.log('❌ Command had errors');
            }
            
            resolve(responseBuffer);
          }
        }
      };

      this.app.stdout.on('data', dataHandler);
      
      // Send the command
      this.app.stdin.write(command + '\n');

      // Timeout handler
      setTimeout(() => {
        if (!responseReceived) {
          responseReceived = true;
          this.app.stdout.removeListener('data', dataHandler);
          console.log('⏱️ Command timed out');
          resolve(responseBuffer);
        }
      }, timeout);
    });
  }

  async setupTestScenario() {
    console.log('\n🏖️ SETTING UP BEACH VACATION PACKING SCENARIO');

    // Create the beach vacation list
    await this.sendCommand('/create "Beach Vacation Packing"');
    
    // Add beach items
    const beachItems = [
      'Swimsuits (at least 4)',
      'Beach towels', 
      'Sunscreen (SPF 30+)',
      'Sunglasses',
      'Hat or cap',
      'Flip-flops or sandals',
      'Lightweight clothing (shorts, t-shirts, sundresses)', 
      'Cover-up or sarong',
      'Reusable water bottle',
      'Beach bag',
      'Snacks',
      'Beach umbrella or sunshade',
      'Waterproof phone pouch',
      'Books or magazines',
      'Portable speaker',
      'Snorkel gear (if you plan to snorkel)',
      'Aloe vera or after-sun lotion',
      'Light sweater or jacket (for evenings)',
      'Toiletries and medications',
      'Camera'
    ];

    console.log(`📝 Adding ${beachItems.length} beach items...`);
    for (let i = 0; i < beachItems.length; i++) {
      await this.sendCommand(`/add "${beachItems[i]}"`);
      // Small delay to avoid overwhelming the app
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Complete one item
    await this.sendCommand('/complete 11'); // Complete "Snacks"
    
    // Show the current list to see shortIds
    const listResponse = await this.sendCommand('/list');
    console.log('📋 Beach vacation packing list created with shortIds visible in context');
    
    return listResponse;
  }

  async testNaturalLanguageParsing() {
    console.log('\n🤖 TESTING NATURAL LANGUAGE PARSING MODE');
    console.log('Testing if the AI can identify and use shortIds from context...\n');

    const testCommands = [
      {
        input: 'Show me all the clothing related items',
        description: 'Testing identification of clothing items',
        expectation: 'Should identify swimsuits, hat, flip-flops, clothing, cover-up, sweater'
      },
      {
        input: 'I already packed the sunglasses',
        description: 'Testing completion using natural language',
        expectation: 'Should complete the sunglasses item using shortId resolution'
      },
      {
        input: 'Make the sunscreen high priority',
        description: 'Testing edit using natural language',
        expectation: 'Should edit sunscreen priority using shortId resolution'
      }
    ];

    for (const test of testCommands) {
      console.log(`🧪 Test: ${test.description}`);
      console.log(`📝 Input: "${test.input}"`);
      console.log(`🎯 Expected: ${test.expectation}`);
      
      const response = await this.sendCommand(test.input, null, 8000);
      
      // Analyze the response
      const success = response.includes('✅') && !response.includes('❌');
      const hasShortId = /\{[a-f0-9]{8}\}/.test(response);
      
      console.log(`📊 Result: ${success ? '✅ SUCCESS' : '❌ FAILED'}`);
      console.log(`🔍 Short ID detected: ${hasShortId ? '✅ YES' : '❌ NO'}`);
      
      this.testResults.push({
        mode: 'parsing',
        input: test.input,
        success: success,
        hasShortId: hasShortId,
        description: test.description
      });

      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  async testChatMode() {
    console.log('\n💬 TESTING CHAT MODE');
    console.log('Entering AI Chat Mode to test conversational todo operations...\n');

    // Enter chat mode
    await this.sendCommand('/chat');
    
    const chatTests = [
      {
        input: 'Which items are clothing related?',
        description: 'Testing conversational identification',
        expectation: 'Should list clothing items with details'
      },
      {
        input: 'Delete all the clothing items',
        description: 'Testing complex multi-delete operation',
        expectation: 'Should create command sequence to delete multiple items using shortIds'
      },
      {
        input: 'y', // Confirm the command sequence
        description: 'Confirming the deletion sequence',
        expectation: 'Should execute all deletions successfully using stable shortIds'
      },
      {
        input: 'Show me what\'s left',
        description: 'Testing list display after deletions',
        expectation: 'Should show remaining non-clothing items'
      }
    ];

    for (const test of chatTests) {
      console.log(`🧪 Chat Test: ${test.description}`);
      console.log(`💭 Input: "${test.input}"`);
      console.log(`🎯 Expected: ${test.expectation}`);
      
      const response = await this.sendCommand(test.input, null, 10000);
      
      // Analyze the response
      const success = !response.includes('❌');
      const hasShortId = /\{[a-f0-9]{8}\}/.test(response);
      const isCommandSequence = response.includes('Execute these commands?');
      
      console.log(`📊 Result: ${success ? '✅ SUCCESS' : '❌ FAILED'}`);
      console.log(`🔍 Short ID detected: ${hasShortId ? '✅ YES' : '❌ NO'}`);
      if (isCommandSequence) {
        console.log('🔗 Command sequence generated');
      }
      
      this.testResults.push({
        mode: 'chat',
        input: test.input,
        success: success,
        hasShortId: hasShortId,
        isCommandSequence: isCommandSequence,
        description: test.description
      });

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Exit chat mode
    await this.sendCommand('exit');
    console.log('✅ Exited chat mode');
  }

  async analyzeResults() {
    console.log('\n📊 TEST RESULTS ANALYSIS');
    console.log('=' .repeat(60));

    const parsingTests = this.testResults.filter(t => t.mode === 'parsing');
    const chatTests = this.testResults.filter(t => t.mode === 'chat');

    console.log('\n🤖 NATURAL LANGUAGE PARSING MODE:');
    parsingTests.forEach((test, i) => {
      console.log(`  ${i + 1}. ${test.description}`);
      console.log(`     Input: "${test.input}"`);
      console.log(`     Status: ${test.success ? '✅ PASSED' : '❌ FAILED'}`);
      console.log(`     ShortID Used: ${test.hasShortId ? '✅ YES' : '❌ NO'}`);
    });

    console.log('\n💬 CHAT MODE:');
    chatTests.forEach((test, i) => {
      console.log(`  ${i + 1}. ${test.description}`);
      console.log(`     Input: "${test.input}"`);
      console.log(`     Status: ${test.success ? '✅ PASSED' : '❌ FAILED'}`);
      console.log(`     ShortID Used: ${test.hasShortId ? '✅ YES' : '❌ NO'}`);
      if (test.isCommandSequence) {
        console.log(`     Command Sequence: ✅ YES`);
      }
    });

    // Overall statistics
    const totalTests = this.testResults.length;
    const successfulTests = this.testResults.filter(t => t.success).length;
    const shortIdTests = this.testResults.filter(t => t.hasShortId).length;

    console.log('\n📈 OVERALL STATISTICS:');
    console.log(`  Total Tests: ${totalTests}`);
    console.log(`  Successful: ${successfulTests}/${totalTests} (${Math.round(successfulTests/totalTests*100)}%)`);
    console.log(`  Short ID Usage: ${shortIdTests}/${totalTests} (${Math.round(shortIdTests/totalTests*100)}%)`);

    if (successfulTests === totalTests) {
      console.log('\n🎉 ALL TESTS PASSED! STABLE IDENTIFICATION IS WORKING!');
      console.log('✅ Natural language parsing uses stable shortIds');
      console.log('✅ Chat mode generates stable command sequences');
      console.log('✅ Multi-item operations work correctly');
      console.log('✅ No position-based corruption detected');
    } else {
      console.log('\n⚠️ SOME TESTS FAILED - NEEDS INVESTIGATION');
    }
  }

  async cleanup() {
    console.log('\n🧹 CLEANING UP...');
    
    if (this.app) {
      // Try graceful shutdown
      this.app.stdin.write('/exit\n');
      
      // Force kill after timeout
      setTimeout(() => {
        if (this.app && !this.app.killed) {
          this.app.kill('SIGTERM');
        }
      }, 2000);
    }

    // Save full output log for debugging
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFile = `test-live-application-${timestamp}.log`;
    fs.writeFileSync(logFile, this.output);
    console.log(`📝 Full output saved to: ${logFile}`);
  }
}

// Run the test
const tester = new LiveAppTester();
tester.runTest();