// Load environment variables first
require('dotenv').config();

const { OpenAIService } = require('./dist/services/OpenAIService');
const { ListService } = require('./dist/services/ListService');
const { DatabaseService } = require('./dist/services/DatabaseService');
const { TodoService } = require('./dist/services/TodoService');

async function testReferenceResolution() {
  console.log('🧪 Testing Reference Resolution and Conversation History...\n');
  
  // Initialize services
  const db = new DatabaseService();
  const listService = new ListService(db);
  const todoService = new TodoService();
  const openAIService = new OpenAIService();
  
  try {
    listService.initialize();
    
    // Check if AI is configured
    if (!openAIService.isConfigured()) {
      console.log('❌ OpenAI not configured. Set OPENAI_API_KEY to test.');
      return;
    }
    
    console.log('✅ OpenAI configured, setting up test scenario...\n');
    
    // Create test context matching user's scenario
    const currentList = listService.getCurrentList();
    if (currentList) {
      listService.clearCurrentList();
      
      const todo1 = todoService.createTodo('complete I-130 for GC', { 
        dueDate: new Date('2025-08-03'), 
        completed: false 
      });
      const todo2 = todoService.createTodo('order items on Amazon', { 
        dueDate: new Date('2025-08-03'), 
        completed: false 
      });
      const todo3 = todoService.createTodo('buy Riya a new lunch bag', { 
        dueDate: new Date('2025-08-03'), 
        completed: false 
      });
      const todo4 = todoService.createTodo('Register Riya for belt test', { 
        dueDate: new Date('2025-08-03'), 
        completed: false 
      });
      
      listService.addTodoToCurrentList(todo1);
      listService.addTodoToCurrentList(todo2);
      listService.addTodoToCurrentList(todo3);
      listService.addTodoToCurrentList(todo4);
    }
    
    const context = {
      currentList: listService.getCurrentList(),
      availableLists: listService.getAllLists()
    };
    
    // Simulate the conversation sequence
    const conversationHistory = [];
    
    // Step 1: Initial question about Riya todos
    console.log('Step 1: Initial Data Analysis');
    console.log('Input: "Which todos do I need to complete for Riya?"');
    
    const response1 = await openAIService.chatWithAI(
      'Which todos do I need to complete for Riya?', 
      context, 
      conversationHistory
    );
    
    console.log('Response 1:', response1.message || JSON.stringify(response1, null, 2));
    console.log('');
    
    // Add to conversation history
    conversationHistory.push('User: Which todos do I need to complete for Riya?');
    conversationHistory.push(`Assistant: ${response1.message || 'Executed ' + response1.action}`);
    
    // Step 2: Reference resolution - "mark those"
    console.log('Step 2: Reference Resolution Test');
    console.log('Input: "Can you mark those as high priority please?"');

    const response2 = await openAIService.chatWithAI(
      'Can you mark those as high priority please?', 
      context, 
      conversationHistory
    );
    
    console.log('Response 2:', response2.message || JSON.stringify(response2, null, 2));
    console.log('Expected: Should reference only the 2 Riya todos from previous response');
    console.log('');
    
    // Add to conversation history  
    conversationHistory.push('User: Can you mark those as high priority please?');
    conversationHistory.push(`Assistant: ${response2.message || 'Executed ' + response2.action}`);
    
    // Step 3: Another reference resolution test
    console.log('Step 3: Follow-up Reference Test');
    console.log('Conversation so far:');
    conversationHistory.slice(-4).forEach(msg => console.log('  ' + msg));
    console.log('');
    console.log('Input: "Actually, just do it for the lunch bag one"');
    
    const response3 = await openAIService.chatWithAI(
      'Actually, just do it for the lunch bag one', 
      context, 
      conversationHistory
    );
    
    console.log('Response 3:', response3.message || JSON.stringify(response3, null, 2));
    console.log('Expected: Should understand "lunch bag one" refers to "buy Riya a new lunch bag"');
    console.log('');
    
    console.log('🧪 Reference Resolution testing complete!');
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

testReferenceResolution().catch(console.error);