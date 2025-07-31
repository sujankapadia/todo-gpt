// Load environment variables first
require('dotenv').config();

const { OpenAIService } = require('./dist/services/OpenAIService');
const { ListService } = require('./dist/services/ListService');
const { DatabaseService } = require('./dist/services/DatabaseService');
const { TodoService } = require('./dist/services/TodoService');

async function testDataAnalysis() {
  console.log('🧪 Testing Improved Data Analysis...\n');
  
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
    
    console.log('✅ OpenAI configured, setting up test data...\n');
    
    // Create some test todos to mimic the user's scenario
    const currentList = listService.getCurrentList();
    if (currentList) {
      // Clear existing todos and add test data
      listService.clearCurrentList();
      
      // Add test todos that match the user's scenario
      const todo1 = todoService.createTodo('complete I-130 for GC', { 
        dueDate: new Date('2025-08-03'), 
        completed: false 
      });
      const todo2 = todoService.createTodo('order items on Amazon', { 
        dueDate: new Date('2025-08-03'), 
        completed: true 
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
    
    // Create test context with our test data
    const context = {
      currentList: listService.getCurrentList(),
      availableLists: listService.getAllLists()
    };
    
    console.log('Test data setup complete. Current todos:');
    if (context.currentList) {
      context.currentList.todos.forEach((todo, i) => {
        const status = todo.completed ? '✓' : '○';
        console.log(`  ${i+1}. ${status} ${todo.title} (due: ${todo.dueDate ? new Date(todo.dueDate).toLocaleDateString() : 'no date'})`);
      });
    }
    console.log('');
    
    // Test 1: The specific question from the user's scenario
    console.log('Test 1: Data Analysis Question (User\'s Scenario)');
    console.log('Input: "Which todos explicitly mention Riya?"');
    try {
      const response1 = await openAIService.chatWithAI(
        'Which todos explicitly mention Riya?', 
        context, 
        []
      );
      console.log('Response:', response1.message || JSON.stringify(response1, null, 2));
      console.log('✅ Response received');
      console.log('');
    } catch (error) {
      console.log('❌ Test 1 failed:', error.message);
      console.log('');
    }
    
    // Test 2: Another data analysis question
    console.log('Test 2: Completed Tasks Analysis');
    console.log('Input: "What have I completed?"');
    try {
      const response2 = await openAIService.chatWithAI(
        'What have I completed?', 
        context, 
        []
      );
      console.log('Response:', response2.message || JSON.stringify(response2, null, 2));
      console.log('✅ Response received');
      console.log('');
    } catch (error) {
      console.log('❌ Test 2 failed:', error.message);
      console.log('');
    }
    
    // Test 3: Count-based analysis
    console.log('Test 3: Count Analysis');
    console.log('Input: "How many tasks are incomplete?"');
    try {
      const response3 = await openAIService.chatWithAI(
        'How many tasks are incomplete?', 
        context, 
        []
      );
      console.log('Response:', response3.message || JSON.stringify(response3, null, 2));
      console.log('✅ Response received');
      console.log('');
    } catch (error) {
      console.log('❌ Test 3 failed:', error.message);
      console.log('');
    }
    
    console.log('🧪 Data Analysis testing complete!');
    
  } catch (error) {
    console.log('❌ Test setup failed:', error.message);
  }
}

testDataAnalysis().catch(console.error);