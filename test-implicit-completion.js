// Load environment variables first
require('dotenv').config();

const { OpenAIService } = require('./dist/services/OpenAIService');
const { ListService } = require('./dist/services/ListService');
const { DatabaseService } = require('./dist/services/DatabaseService');
const { TodoService } = require('./dist/services/TodoService');

async function testImplicitCompletion() {
  console.log('🧪 Testing Simplified Prompt with Implicit Completion...\n');
  
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
    
    console.log('✅ Testing with simplified decision tree...\n');
    
    // Set up the exact scenario from user's issue
    const currentList = listService.getCurrentList();
    if (currentList) {
      listService.clearCurrentList();
      
      const todo1 = todoService.createTodo('buy Riya a new lunch bag', { 
        dueDate: new Date('2025-08-03'), 
        completed: false 
      });
      const todo2 = todoService.createTodo('Register Riya for belt test', { 
        dueDate: new Date('2025-08-03'), 
        completed: false 
      });
      
      listService.addTodoToCurrentList(todo1);
      listService.addTodoToCurrentList(todo2);
    }
    
    const context = {
      currentList: listService.getCurrentList(),
      availableLists: listService.getAllLists()
    };
    
    const conversationHistory = [];
    
    // Test 1: List todos (should be conversational)
    console.log('=== TEST 1: Information Request ===');
    console.log('Input: "list todos"');
    const response1 = await openAIService.chatWithAI('list todos', context, conversationHistory);
    console.log('🔍 DEBUG INFO:');
    console.log(`   Request Type Detected: ${response1.action || response1.type || 'unknown'}`);
    console.log(`   Response: ${response1.message ? response1.message.substring(0, 100) + '...' : JSON.stringify(response1, null, 2)}`);
    console.log('Expected: conversational (information request)');
    console.log('');
    
    // Add to history
    conversationHistory.push('User: list todos');
    conversationHistory.push(`Assistant: ${response1.message || 'Listed todos'}`);
    
    // Test 2: Implicit completion (should be JSON command)
    console.log('=== TEST 2: Implicit Completion Statement ===');
    console.log('Input: "I\'ve bought Riya a new lunch bag, actually."');
    const response2 = await openAIService.chatWithAI("I've bought Riya a new lunch bag, actually.", context, conversationHistory);
    console.log('🔍 DEBUG INFO:');
    console.log(`   Request Type Detected: ${response2.action || response2.type || 'unknown'}`);
    console.log(`   Raw LLM Response: ${JSON.stringify(response2, null, 2)}`);
    console.log('Expected: JSON command (complete_todo for lunch bag task)');
    console.log('');
    
    // Test 3: Another implicit completion
    console.log('=== TEST 3: Another Implicit Completion ===');
    console.log('Input: "Already finished the belt test registration too"');
    const response3 = await openAIService.chatWithAI('Already finished the belt test registration too', context, conversationHistory);
    console.log('🔍 DEBUG INFO:');
    console.log(`   Request Type Detected: ${response3.action || response3.type || 'unknown'}`);
    console.log(`   Raw LLM Response: ${JSON.stringify(response3, null, 2)}`);
    console.log('Expected: JSON command (complete_todo for belt test task)');
    console.log('');
    
    console.log('🧪 Simplified prompt testing complete!');
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

testImplicitCompletion().catch(console.error);