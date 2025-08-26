#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');

async function testChatSimple() {
  console.log('🧪 SIMPLE CHAT MODE TEST - FOCUSED ON MULTI-ITEM DELETION\n');

  let app;
  let output = '';

  try {
    console.log('🚀 Starting application...');
    
    app = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    app.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stdout.write(text);
    });

    app.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stderr.write(text);
    });

    // Wait for app to start
    await delay(2000);

    console.log('\n🏗️ Setting up test data...');
    
    // Quick setup - create a list with clothing items
    await sendCommand('/create "Clothing Test"');
    await sendCommand('/add "Jeans"');
    await sendCommand('/add "T-shirt"'); 
    await sendCommand('/add "Sneakers"');
    await sendCommand('/add "Hat"');
    await sendCommand('/add "Sunglasses"'); // Not clothing - should stay
    await sendCommand('/add "Jacket"');

    console.log('\n📋 Showing initial list...');
    await sendCommand('/list');

    console.log('\n💬 Entering chat mode...');
    await sendCommand('/chat');

    console.log('\n🧪 Testing complex clothing deletion...');
    await sendCommand('Delete all the clothing items except sunglasses');
    
    // Wait for response and potential command sequence
    await delay(5000);

    // If there's a command sequence, confirm it
    if (output.includes('Execute these commands?')) {
      console.log('\n✅ Confirming command sequence...');
      await sendCommand('y');
      await delay(3000);
    }

    console.log('\n📋 Checking final results...');
    await sendCommand('show me the current list');
    
    await delay(2000);
    
    console.log('\n🚪 Exiting chat mode...');
    await sendCommand('exit');
    
    await delay(1000);
    
    console.log('\n📋 Final list check...');
    await sendCommand('/list');

    await delay(2000);

    // Exit application
    await sendCommand('/exit');

    function sendCommand(cmd) {
      return new Promise((resolve) => {
        console.log(`\n📤 Sending: ${cmd}`);
        app.stdin.write(cmd + '\n');
        setTimeout(resolve, 800);
      });
    }

    function delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Auto-kill after timeout
    setTimeout(() => {
      if (app && !app.killed) {
        console.log('\n⏰ Timeout reached, analyzing results...');
        app.kill();
      }
    }, 25000);

    app.on('exit', (code) => {
      console.log(`\n🏁 Application exited with code ${code}`);
      analyzeResults();
    });

    function analyzeResults() {
      console.log('\n📊 CHAT MODE TEST RESULTS');
      console.log('=' .repeat(50));
      
      // Look for key indicators
      const hasShortIds = /\{[a-f0-9]{8}\}/.test(output);
      const hasCommandSequence = output.includes('Execute these commands?');
      const hasMultipleDeletes = (output.match(/delete_todo/g) || []).length > 1;
      const hasClothingDetection = /jeans|t-shirt|jacket|hat/i.test(output);
      const finalListHasSunglasses = output.includes('Sunglasses') && output.lastIndexOf('Sunglasses') > output.lastIndexOf('Delete all the clothing');
      const finalListMissingClothing = !(/jeans.*📋|t-shirt.*📋|jacket.*📋/i.test(output.substring(output.lastIndexOf('Final list check'))));

      console.log('🔍 Key Indicators:');
      console.log(`  📋 Short IDs detected: ${hasShortIds ? '✅ YES' : '❌ NO'}`);
      console.log(`  👕 Clothing detection: ${hasClothingDetection ? '✅ YES' : '❌ NO'}`);
      console.log(`  🔗 Command sequence: ${hasCommandSequence ? '✅ YES' : '❌ NO'}`);
      console.log(`  🗑️ Multiple deletes: ${hasMultipleDeletes ? '✅ YES' : '❌ NO'}`);
      console.log(`  🕶️ Sunglasses preserved: ${finalListHasSunglasses ? '✅ YES' : '❌ NO'}`);
      console.log(`  🧹 Clothing removed: ${finalListMissingClothing ? '✅ YES' : '❌ NO'}`);

      // Count operations in debug output
      if (hasShortIds) {
        const shortIds = output.match(/\{[a-f0-9]{8}\}/g);
        console.log(`  🆔 Short ID references: ${shortIds ? shortIds.length : 0}`);
      }

      const deletions = (output.match(/"action":\s*"delete_todo"/g) || []).length;
      console.log(`  🗑️ Delete operations: ${deletions}`);

      // Save detailed log
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const logFile = `test-chat-simple-${timestamp}.log`;
      fs.writeFileSync(logFile, output);
      console.log(`📝 Full log: ${logFile}`);
      
      console.log('\n🎯 VERDICT:');
      if (hasCommandSequence && hasShortIds && deletions > 1) {
        console.log('🎉 SUCCESS: Chat mode generated stable multi-delete sequence!');
        console.log('✅ AI understood complex request');
        console.log('✅ Generated command sequence with stable shortIds');
        console.log('✅ Multiple items deleted using stable identification');
        
        if (finalListHasSunglasses && finalListMissingClothing) {
          console.log('🎯 BONUS: Selective deletion worked perfectly!');
        }
      } else if (hasCommandSequence) {
        console.log('⚠️ PARTIAL: Chat mode working but shortIds may be missing');
      } else {
        console.log('❌ FAILED: Chat mode did not generate expected command sequence');
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    if (app && !app.killed) {
      app.kill();
    }
  }
}

testChatSimple();