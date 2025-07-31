// Load environment variables first
require('dotenv').config();

const { OpenAIService } = require('./dist/services/OpenAIService');
const { ListService } = require('./dist/services/ListService');
const { DatabaseService } = require('./dist/services/DatabaseService');
const { TodoService } = require('./dist/services/TodoService');

async function testDebugOutput() {
  console.log('🧪 Testing Debug Output for Request Type Detection...\n');
  
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
    
    console.log('✅ Testing different request types with debug output...\n');
    
    // Set up test data
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
    
    // Test 1: Data Analysis Request
    console.log('=== TEST 1: Data Analysis Request ===');
    console.log('Input: "Which todos mention Riya?"');
    const response1 = await openAIService.chatWithAI('Which todos mention Riya?', context, conversationHistory);
    console.log('🔍 DEBUG INFO:');
    console.log(`   Request Type Detected: ${response1.action || response1.type || 'unknown'}`);
    console.log(`   Raw LLM Response: ${JSON.stringify(response1, null, 2)}`);
    console.log('');
    
    // Test 2: Command Request  
    console.log('=== TEST 2: Command Request ===');
    console.log('Input: "Add buy groceries with high priority"');
    const response2 = await openAIService.chatWithAI('Add buy groceries with high priority', context, conversationHistory);
    console.log('🔍 DEBUG INFO:');
    console.log(`   Request Type Detected: ${response2.action || response2.type || 'unknown'}`);
    console.log(`   Raw LLM Response: ${JSON.stringify(response2, null, 2)}`);
    console.log('');
    
    // Test 3: Reference Request (with conversation history)
    conversationHistory.push('User: Which todos mention Riya?');
    conversationHistory.push('Assistant: 2 todos mention Riya: buy Riya a new lunch bag and Register Riya for belt test');
    
    console.log('=== TEST 3: Reference Request (with history) ===');
    console.log('Input: "Mark those as high priority"');
    const response3 = await openAIService.chatWithAI('Mark those as high priority', context, conversationHistory);
    console.log('🔍 DEBUG INFO:');
    console.log(`   Request Type Detected: ${response3.action || response3.type || 'unknown'}`);
    console.log(`   Raw LLM Response: ${JSON.stringify(response3, null, 2)}`);
    console.log('');
    
    console.log('🧪 Debug output testing complete!');
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

testDebugOutput().catch(console.error);