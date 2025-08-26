#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');

async function testSimpleInteraction() {
  console.log('🧪 SIMPLE LIVE APPLICATION TEST\n');

  let app;
  let output = '';

  try {
    console.log('🚀 Starting application...');
    
    app = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let ready = false;
    
    // Capture all output
    app.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stdout.write(text); // Echo to our console
      
      // Look for readiness indicators
      if (text.includes('📝') || text.includes('>')) {
        if (!ready) {
          ready = true;
          console.log('\n✅ Application appears ready, starting tests...\n');
          runTests();
        }
      }
    });

    app.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stderr.write(text);
    });

    async function runTests() {
      console.log('🧪 Running quick tests...\n');
      
      // Test 1: Create list
      console.log('📝 Test 1: Creating test list');
      app.stdin.write('/create "Test List"\n');
      
      setTimeout(() => {
        // Test 2: Add item
        console.log('📝 Test 2: Adding test item');
        app.stdin.write('/add "Test Item 1"\n');
        
        setTimeout(() => {
          // Test 3: Add more items
          console.log('📝 Test 3: Adding more items');  
          app.stdin.write('/add "Test Item 2"\n');
          
          setTimeout(() => {
            app.stdin.write('/add "Test Item 3"\n');
            
            setTimeout(() => {
              // Test 4: Show list (should show shortIds)
              console.log('📝 Test 4: Showing list with shortIds');
              app.stdin.write('/list\n');
              
              setTimeout(() => {
                // Test 5: Try natural language
                console.log('📝 Test 5: Testing natural language parsing');
                app.stdin.write('I completed the first test item\n');
                
                setTimeout(() => {
                  // Test 6: Show final state
                  console.log('📝 Test 6: Final list state');
                  app.stdin.write('/list\n');
                  
                  setTimeout(() => {
                    console.log('\n✅ Tests completed, shutting down...');
                    app.stdin.write('/exit\n');
                    
                    setTimeout(() => {
                      if (!app.killed) {
                        app.kill();
                      }
                    }, 1000);
                  }, 1000);
                }, 1500);
              }, 1000);
            }, 1000);
          }, 1000);
        }, 1000);
      }, 1000);
    }

    // Auto-kill after 30 seconds
    setTimeout(() => {
      if (app && !app.killed) {
        console.log('\n⏰ Test timeout, killing application');
        app.kill();
      }
    }, 30000);

    app.on('exit', (code) => {
      console.log(`\n🏁 Application exited with code ${code}`);
      analyzeOutput();
    });

    function analyzeOutput() {
      console.log('\n📊 ANALYZING OUTPUT...');
      console.log('=' .repeat(50));
      
      // Check for key indicators
      const hasShortIds = /\{[a-f0-9]{8}\}/.test(output);
      const hasSuccessMessages = output.includes('✅');
      const hasErrorMessages = output.includes('❌');
      const hasNaturalLanguageResponse = output.includes('completed') || output.includes('Complete');
      
      console.log(`🔍 Short IDs found: ${hasShortIds ? '✅ YES' : '❌ NO'}`);
      console.log(`✅ Success messages: ${hasSuccessMessages ? '✅ YES' : '❌ NO'}`);  
      console.log(`❌ Error messages: ${hasErrorMessages ? '⚠️ YES' : '✅ NO'}`);
      console.log(`🤖 Natural language processed: ${hasNaturalLanguageResponse ? '✅ YES' : '❌ NO'}`);
      
      if (hasShortIds) {
        console.log('\n🎉 SUCCESS: Application is showing short IDs in todo lists!');
        const shortIdMatches = output.match(/\{[a-f0-9]{8}\}/g);
        if (shortIdMatches) {
          console.log(`📋 Found ${shortIdMatches.length} short ID references`);
          console.log(`📝 Sample short IDs: ${shortIdMatches.slice(0, 3).join(', ')}`);
        }
      }
      
      if (hasNaturalLanguageResponse) {
        console.log('🤖 SUCCESS: Natural language processing is working!');
      }
      
      // Save full log
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const logFile = `test-simple-${timestamp}.log`;
      fs.writeFileSync(logFile, output);
      console.log(`📝 Full output saved to: ${logFile}`);
      
      console.log('\n🎯 CONCLUSION:');
      if (hasShortIds && hasSuccessMessages && !hasErrorMessages) {
        console.log('✅ STABLE IDENTIFICATION IS WORKING IN LIVE APPLICATION!');
      } else {
        console.log('⚠️ Some issues detected - check the log file for details');
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    if (app && !app.killed) {
      app.kill();
    }
  }
}

testSimpleInteraction();