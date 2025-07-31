// Load environment variables first
require('dotenv').config();

const { OpenAIService } = require('./dist/services/OpenAIService');
const { ListService } = require('./dist/services/ListService');
const { DatabaseService } = require('./dist/services/DatabaseService');
const { TodoService } = require('./dist/services/TodoService');

async function testComprehensiveChatScenarios() {
  console.log('🧪 COMPREHENSIVE CHAT MODE TEST - GPT-4.1\n');
  
  // Initialize services
  const db = new DatabaseService();
  const listService = new ListService(db);
  const todoService = new TodoService();
  const openAIService = new OpenAIService();
  
  try {
    listService.initialize();
    
    if (!openAIService.isConfigured()) {
      console.log('❌ OpenAI not configured. Set OPENAI_API_KEY to test.');
      return;
    }
    
    console.log('✅ Setting up comprehensive test scenario...\n');
    
    // Set up realistic test data
    const currentList = listService.getCurrentList();
    if (currentList) {
      listService.clearCurrentList();
      
      // Mix of completed and incomplete todos with different priorities
      const todos = [
        { title: 'complete I-130 for GC', dueDate: new Date('2025-08-03'), priority: 'high', completed: false },
        { title: 'order items on Amazon', dueDate: new Date('2025-08-03'), priority: 'medium', completed: true },
        { title: 'buy Riya a new lunch bag', dueDate: new Date('2025-08-03'), priority: 'low', completed: false },
        { title: 'Register Riya for belt test', dueDate: new Date('2025-08-03'), priority: 'low', completed: false },
        { title: 'call dentist appointment', dueDate: new Date('2025-08-05'), priority: 'medium', completed: false },
        { title: 'submit expense reports', dueDate: new Date('2025-07-30'), priority: 'high', completed: false }
      ];
      
      todos.forEach(todoData => {
        const todo = todoService.createTodo(todoData.title, {
          dueDate: todoData.dueDate,
          priority: todoData.priority,
          completed: todoData.completed
        });
        listService.addTodoToCurrentList(todo);
      });
    }
    
    const context = {
      currentList: listService.getCurrentList(),
      availableLists: listService.getAllLists()
    };
    
    const conversationHistory = [];
    let testResults = { passed: 0, failed: 0, tests: [] };
    
    // Helper function to run a test
    async function runTest(testName, input, expectedType, expectedBehavior) {
      console.log(`=== ${testName} ===`);
      console.log(`Input: "${input}"`);
      
      try {
        const response = await openAIService.chatWithAI(input, context, conversationHistory);
        const detectedType = response.action || response.type || 'unknown';
        
        console.log('🔍 DEBUG INFO:');
        console.log(`   Request Type Detected: ${detectedType}`);
        console.log(`   Raw Response: ${JSON.stringify(response, null, 2)}`);
        console.log(`   Expected: ${expectedType} (${expectedBehavior})`);
        
        const passed = detectedType === expectedType;
        console.log(passed ? '✅ PASS' : '❌ FAIL');
        console.log('');
        
        // Add to conversation history for reference resolution tests
        conversationHistory.push(`User: ${input}`);
        if (response.message) {
          conversationHistory.push(`Assistant: ${response.message}`);
        } else {
          conversationHistory.push(`Assistant: Executed ${response.action} command`);
        }
        
        // Keep history manageable
        if (conversationHistory.length > 10) {
          conversationHistory.splice(0, 2);
        }
        
        testResults.tests.push({ name: testName, input, expected: expectedType, actual: detectedType, passed });
        if (passed) testResults.passed++; else testResults.failed++;
        
        return response;
        
      } catch (error) {
        console.log(`❌ ERROR: ${error.message}`);
        console.log('');
        testResults.tests.push({ name: testName, input, expected: expectedType, actual: 'ERROR', passed: false });
        testResults.failed++;
      }
    }
    
    // === DATA ANALYSIS TESTS ===
    console.log('🔍 TESTING DATA ANALYSIS CAPABILITIES\n');
    
    await runTest(
      'TEST 1: Direct Data Query',
      'Which todos mention Riya?',
      'conversational',
      'should list specific Riya todos'
    );
    
    await runTest(
      'TEST 2: Count Analysis',
      'How many high priority tasks do I have?',
      'conversational',
      'should count and list high priority tasks'
    );
    
    await runTest(
      'TEST 3: Completion Status',
      'What have I completed so far?',
      'conversational',
      'should list completed tasks'
    );
    
    await runTest(
      'TEST 4: Due Date Analysis',
      'What\'s due today?',
      'conversational',
      'should analyze due dates against today'
    );
    
    // === IMPLICIT COMPLETION TESTS ===
    console.log('🎯 TESTING IMPLICIT COMPLETION DETECTION\n');
    
    await runTest(
      'TEST 5: Past Tense Completion',
      'I\'ve bought Riya a new lunch bag, actually.',
      'complete_todo',
      'should mark lunch bag todo as complete'
    );
    
    await runTest(
      'TEST 6: "Already" Statement',
      'Already finished the belt test registration too',
      'complete_todo',
      'should mark belt test todo as complete'
    );
    
    await runTest(
      'TEST 7: "Got" Statement',
      'Got the dentist appointment scheduled',
      'complete_todo',
      'should mark dentist todo as complete'
    );
    
    await runTest(
      'TEST 8: "Done" Statement',
      'Done with the expense reports',
      'complete_todo',
      'should mark expense reports as complete'
    );
    
    // === REFERENCE RESOLUTION TESTS ===
    console.log('🔗 TESTING REFERENCE RESOLUTION\n');
    
    // First establish context
    const riyaResponse = await runTest(
      'TEST 9: Context Setup',
      'Show me the Riya-related tasks',
      'conversational',
      'should list Riya tasks for reference'
    );
    
    await runTest(
      'TEST 10: Reference Resolution',
      'Mark those as high priority',
      'command_sequence',
      'should resolve "those" to Riya tasks and mark as high priority'
    );
    
    await runTest(
      'TEST 11: Previous Context Reference',
      'Actually, just the first one',
      'edit_todo',
      'should reference first item from previous response'
    );
    
    // === CONFIDENT REFERENCE RESOLUTION TESTS ===
    console.log('🎯 TESTING CONFIDENT REFERENCE RESOLUTION\n');
    
    // Establish context for confident resolution
    await runTest(
      'TEST 12: High Priority Context Setup',
      'Show me my high priority tasks',
      'conversational',
      'should list high priority tasks for confident reference'
    );
    
    await runTest(
      'TEST 13: Confident Reference Resolution',
      'Can you change the due date for those to August 15th?',
      'command_sequence',
      'should confidently resolve "those" to high priority tasks without asking for clarification'
    );
    
    await runTest(
      'TEST 14: Direct Reference After List',
      'Update them all to medium priority',
      'command_sequence',
      'should resolve "them all" to previously mentioned tasks'
    );
    
    // === EXPLICIT COMMAND TESTS ===
    console.log('⚡ TESTING EXPLICIT COMMANDS\n');
    
    await runTest(
      'TEST 15: Direct Add Command',
      'Add buy groceries with high priority due tomorrow',
      'add_todo',
      'should create new todo with specified attributes'
    );
    
    await runTest(
      'TEST 16: Direct Complete Command',
      'Complete task number 1',
      'complete_todo',
      'should mark specified task as complete'
    );
    
    await runTest(
      'TEST 17: Multiple Todos',
      'Add these tasks: review code, send email, update docs',
      'add_multiple_todos',
      'should create multiple todos from list'
    );
    
    // === COMPLEX SCENARIOS ===
    console.log('🧠 TESTING COMPLEX SCENARIOS\n');
    
    await runTest(
      'TEST 18: Command Sequence',
      'Move all high priority items to a new Urgent list',
      'command_sequence',
      'should create list and move high priority items'
    );
    
    await runTest(
      'TEST 19: Mixed Request',
      'I finished the I-130 form yesterday, but what else is overdue?',
      'complete_todo',
      'should complete I-130 (prioritize the action over the question)'
    );
    
    // === EDIT FUNCTIONALITY TESTS ===
    console.log('✏️ TESTING EDIT FUNCTIONALITY\n');
    
    await runTest(
      'TEST 20: Edit Todo Command',
      'Edit task 1 to have high priority and due date August 20th',
      'edit_todo',
      'should update todo with new priority and due date'
    );
    
    await runTest(
      'TEST 21: Edit Todo Title',
      'Change the title of task 2 to "submit Q3 expense reports"',
      'edit_todo',
      'should update todo title'
    );
    
    // === CONVERSATION FLOW ===
    console.log('💬 TESTING CONVERSATION FLOW\n');
    
    await runTest(
      'TEST 22: Strategy Question',
      'What should I focus on today?',
      'conversational',
      'should provide strategic advice based on priorities and due dates'
    );
    
    await runTest(
      'TEST 23: Follow-up Question',
      'Why did you recommend that?',
      'conversational',
      'should explain reasoning from previous response'
    );
    
    // === RESULTS SUMMARY ===
    console.log('📊 TEST RESULTS SUMMARY\n');
    console.log(`Total Tests: ${testResults.tests.length}`);
    console.log(`Passed: ${testResults.passed} ✅`);
    console.log(`Failed: ${testResults.failed} ❌`);
    console.log(`Success Rate: ${Math.round((testResults.passed / testResults.tests.length) * 100)}%\n`);
    
    if (testResults.failed > 0) {
      console.log('❌ Failed Tests:');
      testResults.tests.filter(t => !t.passed).forEach(test => {
        console.log(`   ${test.name}: Expected ${test.expected}, got ${test.actual}`);
      });
    } else {
      console.log('🎉 ALL TESTS PASSED! GPT-4.1 is working perfectly!');
    }
    
  } catch (error) {
    console.log('❌ Test setup failed:', error.message);
  }
}

testComprehensiveChatScenarios().catch(console.error);