#!/usr/bin/env node

import 'dotenv/config';
import { Command } from 'commander';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ListService } from './services/ListService';
import { TodoService } from './services/TodoService';
import { DatabaseService } from './services/DatabaseService';
import { OpenAIService } from './services/OpenAIService';

const program = new Command();
let listService: ListService;
let todoService: TodoService;
let openAIService: OpenAIService;

program
  .name('todo-gpt')
  .description('LLM-powered todo list application')
  .version('1.0.0');

// Helper function to display all lists
function displayLists() {
  const lists = listService.getAllLists();
  const currentList = listService.getCurrentList();
  
  console.log('Available lists:');
  lists.forEach(list => {
    const isCurrent = currentList?.id === list.id;
    const marker = isCurrent ? '*' : ' ';
    const currentText = isCurrent ? ' (current)' : '';
    console.log(`  ${marker} ${list.name}${currentText}    [${list.todos.length} items]`);
  });
  console.log();
}

// Simple argument parser for enhanced commands
function parseArgs(input: string): { title: string; flags: { [key: string]: string } } {
  const flags: { [key: string]: string } = {};
  const titleParts: string[] = [];
  
  // Use regex to properly handle quoted strings and flags
  const regex = /--(\w+)\s+"([^"]+)"|--(\w+)\s+(\S+)|"([^"]+)"|(\S+)/g;
  let match;
  
  while ((match = regex.exec(input)) !== null) {
    if (match[1] && match[2]) {
      // Flag with quoted value: --flag "value"
      flags[match[1]] = match[2];
    } else if (match[3] && match[4]) {
      // Flag with unquoted value: --flag value
      flags[match[3]] = match[4];
    } else if (match[5]) {
      // Quoted title part: "title part"
      titleParts.push(match[5]);
    } else if (match[6]) {
      // Unquoted title part (only if not a flag)
      if (!match[6].startsWith('--')) {
        titleParts.push(match[6]);
      }
    }
  }
  
  return {
    title: titleParts.join(' ').trim(),
    flags
  };
}

// Initialize services
function initializeServices(): void {
  const db = new DatabaseService();
  listService = new ListService(db);
  todoService = new TodoService();
  openAIService = new OpenAIService();
  listService.initialize();
}

// Interactive mode function
function startInteractiveMode() {
  console.log('Welcome to Todo-GPT!\n');
  console.log('Initializing database...');
  
  try {
    initializeServices();
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
  
  console.log('Database initialized!\n');
  
  // Check AI configuration
  if (openAIService.isConfigured()) {
    console.log('🤖 AI-powered natural language parsing is enabled!');
    console.log('   You can type requests like "add buy groceries with high priority"');
  } else {
    console.log('💡 AI features not configured. Use slash commands like /add, /list, etc.');
    console.log('   To enable AI: Use /config command for setup instructions');
  }
  console.log();
  
  displayLists();
  
  const currentList = listService.getCurrentList();
  console.log(`Currently in '${currentList?.name}' list. How can I help you today?`);
  
  // Set up command history file
  const historyDir = path.join(os.homedir(), '.todo-gpt');
  const historyFile = path.join(historyDir, 'history');
  
  // Ensure history directory exists
  if (!fs.existsSync(historyDir)) {
    fs.mkdirSync(historyDir, { recursive: true });
  }
  
  // Available slash commands for autocomplete
  const slashCommands = ['/help', '/exit', '/lists', '/create', '/switch', '/add', '/list', '/complete', '/uncomplete', '/delete', '/edit', '/filter', '/clear', '/delete-list', '/history', '/config', '/prompt', '/chat'];
  
  // Detect if we're in a proper TTY environment
  const isRealTTY = process.stdin.isTTY === true && process.stdout.isTTY === true;
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
    historySize: 100,
    terminal: isRealTTY
  });

  // Provide user feedback about terminal capabilities  
  if (!isRealTTY) {
    console.log('💡 Tip: For best experience with arrow key history navigation,');
    console.log('   run this app directly in your terminal: `node dist/index.js`');
    console.log('   Use `/history` command to see recent commands.\n');
  }

  // Load command history if it exists
  if (fs.existsSync(historyFile)) {
    try {
      const historyData = fs.readFileSync(historyFile, 'utf8');
      const historyLines = historyData.trim().split('\n').filter(line => line.length > 0);
      historyLines.forEach(line => {
        (rl as any).history.unshift(line);
      });
    } catch (error) {
      // Silently ignore history loading errors
    }
  }

  // Chat mode variables  
  let chatMode = false;
  const conversationHistory: string[] = [];
  const maxConversationHistory = 10;
  let awaitingCommandConfirmation = false;

  // Function to handle single chat messages
  async function handleChatMessage(message: string): Promise<void> {
    try {
      console.log('🤖 Processing your message...');
      
      const context = {
        currentList: listService.getCurrentList(),
        availableLists: listService.getAllLists()
      };
      
      const response = await openAIService.chatWithAI(message, context, conversationHistory);
      
      // DEBUG: Show request type detection and raw response
      console.log('🔍 DEBUG INFO:');
      console.log(`   Request Type Detected: ${response.action || response.type || 'unknown'}`);
      console.log(`   Raw LLM Response: ${JSON.stringify(response, null, 2)}`);
      console.log('');
      
      // Add to conversation history
      conversationHistory.push(`User: ${message}`);
      
      if (response.action === 'conversational') {
        console.log(`🤖 ${response.message}\n`);
        conversationHistory.push(`Assistant: ${response.message}`);
      } else {
        // Handle structured command response
        await handleParsedCommand(response);
        conversationHistory.push(`Assistant: Executed ${response.action} command`);
      }
      
      // Keep conversation history manageable
      while (conversationHistory.length > maxConversationHistory) {
        conversationHistory.shift();
      }
      
    } catch (error) {
      console.log(`❌ Chat failed: ${error}\n`);
    }
  }

  // Function to handle AI-parsed commands
  async function handleParsedCommand(parsed: any): Promise<void> {
    switch (parsed.action) {
      case 'add_todo':
        await handleAddTodo(parsed);
        break;
      case 'add_multiple_todos':
        await handleAddMultipleTodos(parsed);
        break;
      case 'list_todos':
        handleListTodos(parsed);
        break;
      case 'complete_todo':
        handleCompleteTodo(parsed);
        break;
      case 'edit_todo':
        handleEditTodo(parsed);
        break;
      case 'create_list':
        handleCreateList(parsed);
        break;
      case 'switch_list':
        handleSwitchList(parsed);
        break;
      case 'delete_todo':
        handleDeleteTodo(parsed);
        break;
      case 'command_sequence':
        await handleCommandSequence(parsed);
        break;
      case 'conversational':
        console.log(`🤖 ${parsed.message}\n`);
        break;
      case 'unknown':
      default:
        console.log(`❓ I couldn't understand your request: "${parsed.originalInput || 'unknown'}"`);
        if (parsed.error) {
          console.log(`   Error: ${parsed.error}`);
        }
        console.log('💡 Try rephrasing or use a slash command like /add, /list, etc.\n');
        break;
    }
  }

  // Helper functions for each action type
  async function handleAddTodo(parsed: any): Promise<void> {
    const currentList = listService.getCurrentList();
    if (!currentList) {
      console.log('❌ No current list selected. Use /create to create a list first.\n');
      return;
    }

    if (!parsed.title) {
      console.log('❌ Missing todo title in your request.\n');
      return;
    }

    try {
      const options: any = {};
      if (parsed.priority && ['high', 'medium', 'low'].includes(parsed.priority)) {
        options.priority = parsed.priority;
      }
      if (parsed.dueDate) {
        // Parse date in local timezone to avoid UTC conversion issues
        const dateParts = parsed.dueDate.split('-');
        const year = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]) - 1; // Month is 0-indexed
        const day = parseInt(dateParts[2]);
        const dueDate = new Date(year, month, day);
        if (!isNaN(dueDate.getTime())) {
          options.dueDate = dueDate;
        }
      }
      if (parsed.categories && Array.isArray(parsed.categories)) {
        options.categories = parsed.categories;
      }
      if (parsed.description) {
        options.description = parsed.description;
      }

      const newTodo = todoService.createTodo(parsed.title, options);
      listService.addTodoToCurrentList(newTodo);
      
      let message = `✅ Added "${newTodo.title}" to ${currentList.name} list`;
      if (options.priority) message += ` (priority: ${options.priority})`;
      if (options.dueDate) message += ` (due: ${options.dueDate.toDateString()})`;
      if (options.categories) message += ` (categories: ${options.categories.join(', ')})`;
      console.log(message + '\n');
    } catch (error) {
      console.log(`❌ Failed to add todo: ${error}\n`);
    }
  }

  async function handleAddMultipleTodos(parsed: any): Promise<void> {
    const currentList = listService.getCurrentList();
    if (!currentList) {
      console.log('❌ No current list selected. Use /create to create a list first.\n');
      return;
    }

    if (!parsed.todos || !Array.isArray(parsed.todos) || parsed.todos.length === 0) {
      console.log('❌ No todos found in your request.\n');
      return;
    }

    try {
      let successCount = 0;
      let failureCount = 0;
      const addedTodos: string[] = [];

      for (const todoData of parsed.todos) {
        if (!todoData.title) {
          failureCount++;
          continue;
        }

        try {
          const options: any = {};
          if (todoData.priority && ['high', 'medium', 'low'].includes(todoData.priority)) {
            options.priority = todoData.priority;
          }
          if (todoData.dueDate) {
            // Parse date in local timezone to avoid UTC conversion issues
            const dateParts = todoData.dueDate.split('-');
            const year = parseInt(dateParts[0]);
            const month = parseInt(dateParts[1]) - 1; // Month is 0-indexed
            const day = parseInt(dateParts[2]);
            const dueDate = new Date(year, month, day);
            if (!isNaN(dueDate.getTime())) {
              options.dueDate = dueDate;
            }
          }
          if (todoData.categories && Array.isArray(todoData.categories)) {
            options.categories = todoData.categories;
          }
          if (todoData.description) {
            options.description = todoData.description;
          }

          const newTodo = todoService.createTodo(todoData.title, options);
          listService.addTodoToCurrentList(newTodo);
          
          let todoDescription = `"${newTodo.title}"`;
          if (options.priority) todoDescription += ` (${options.priority})`;
          if (options.dueDate) todoDescription += ` (due: ${options.dueDate.toLocaleDateString()})`;
          if (options.categories) todoDescription += ` [${options.categories.join(', ')}]`;
          
          addedTodos.push(todoDescription);
          successCount++;
        } catch (error) {
          console.log(`❌ Failed to add "${todoData.title}": ${error}`);
          failureCount++;
        }
      }

      // Display results
      if (successCount > 0) {
        console.log(`✅ Added ${successCount} todo${successCount > 1 ? 's' : ''} to ${currentList.name} list:`);
        addedTodos.forEach((todo, index) => {
          console.log(`  ${index + 1}. ${todo}`);
        });
      }
      
      if (failureCount > 0) {
        console.log(`❌ Failed to add ${failureCount} todo${failureCount > 1 ? 's' : ''}`);
      }
      
      console.log();
    } catch (error) {
      console.log(`❌ Failed to process multiple todos: ${error}\n`);
    }
  }

  function handleListTodos(parsed: any): void {
    const currentList = listService.getCurrentList();
    if (!currentList) {
      console.log('❌ No current list selected. Use /create to create a list first.\n');
      return;
    }

    let filteredTodos = currentList.todos;
    let filterDescription = [];

    // Apply filters if specified
    if (parsed.filter) {
      if (parsed.filter.status === 'completed') {
        filteredTodos = filteredTodos.filter(todo => todo.completed);
        filterDescription.push('completed');
      } else if (parsed.filter.status === 'active') {
        filteredTodos = filteredTodos.filter(todo => !todo.completed);
        filterDescription.push('active');
      }
      
      if (parsed.filter.priority) {
        filteredTodos = filteredTodos.filter(todo => todo.priority === parsed.filter.priority);
        filterDescription.push(`${parsed.filter.priority} priority`);
      }
      
      if (parsed.filter.category) {
        filteredTodos = filteredTodos.filter(todo => 
          todo.categories && todo.categories.includes(parsed.filter.category)
        );
        filterDescription.push(`category: ${parsed.filter.category}`);
      }
    }

    const filterText = filterDescription.length > 0 ? ` (${filterDescription.join(', ')})` : '';
    console.log(`\nTodos in '${currentList.name}' list${filterText}:`);
    
    if (filteredTodos.length === 0) {
      console.log('  (no todos match the criteria)\n');
    } else {
      filteredTodos.forEach((todo, index) => {
        const originalIndex = currentList.todos.findIndex(t => t.id === todo.id) + 1;
        console.log(`  ${originalIndex}. ${todoService.formatTodoForDisplay(todo)}`);
      });
      console.log();
    }
  }

  function handleCompleteTodo(parsed: any): void {
    const currentList = listService.getCurrentList();
    if (!currentList) {
      console.log('❌ No current list selected. Use /create to create a list first.\n');
      return;
    }

    const todoIndex = (parsed.todoNumber || parsed.index) - 1;
    if (isNaN(todoIndex) || todoIndex < 0 || todoIndex >= currentList.todos.length) {
      console.log('❌ Invalid todo number. Use /list to see available todos.\n');
      return;
    }

    try {
      const todo = currentList.todos[todoIndex];
      todoService.completeTodo(currentList.todos, todo.id);
      listService.updateTodoInCurrentList(todo);
      console.log(`✅ Completed "${todo.title}"\n`);
    } catch (error) {
      console.log(`❌ Failed to complete todo: ${error}\n`);
    }
  }

  function handleEditTodo(parsed: any): void {
    const currentList = listService.getCurrentList();
    if (!currentList) {
      console.log('❌ No current list selected. Use /create to create a list first.\n');
      return;
    }

    const todoIndex = (parsed.todoNumber || parsed.index) - 1;
    if (isNaN(todoIndex) || todoIndex < 0 || todoIndex >= currentList.todos.length) {
      console.log('❌ Invalid todo number. Use /list to see available todos.\n');
      return;
    }

    try {
      const todo = currentList.todos[todoIndex];
      const updates: any = {};
      let hasUpdates = false;

      // Check for title update
      if (parsed.title) {
        updates.title = parsed.title;
        hasUpdates = true;
      }

      // Check for priority update
      if (parsed.priority) {
        if (['high', 'medium', 'low'].includes(parsed.priority)) {
          updates.priority = parsed.priority;
          hasUpdates = true;
        } else {
          console.log('❌ Priority must be one of: high, medium, low\n');
          return;
        }
      }

      // Check for due date update
      if (parsed.dueDate) {
        const dueDate = new Date(parsed.dueDate);
        if (isNaN(dueDate.getTime())) {
          console.log('❌ Due date must be in YYYY-MM-DD format\n');
          return;
        }
        updates.dueDate = dueDate;
        hasUpdates = true;
      }

      // Check for category update
      if (parsed.categories && Array.isArray(parsed.categories)) {
        updates.categories = parsed.categories;
        hasUpdates = true;
      }

      if (!hasUpdates) {
        console.log('❌ No updates specified in the edit request.\n');
        return;
      }

      // Apply updates
      todoService.updateTodo(currentList.todos, todo.id, updates);
      listService.updateTodoInCurrentList(todo);

      let message = `✅ Updated "${todo.title}"`;
      if (updates.title) message += ` (title updated)`;
      if (updates.priority) message += ` (priority: ${updates.priority})`;
      if (updates.dueDate) message += ` (due: ${updates.dueDate.toDateString()})`;
      if (updates.categories) message += ` (categories: ${updates.categories.join(', ')})`;
      console.log(message + '\n');

    } catch (error) {
      console.log(`❌ Failed to edit todo: ${error}\n`);
    }
  }

  function handleCreateList(parsed: any): void {
    if (!parsed.name) {
      console.log('❌ Missing list name in your request.\n');
      return;
    }

    if (listService.findListByName(parsed.name)) {
      console.log(`❌ List '${parsed.name}' already exists!\n`);
      return;
    }

    try {
      const newList = listService.createList(parsed.name);
      console.log(`✅ Created list '${newList.name}'\n`);
    } catch (error) {
      console.log(`❌ Failed to create list: ${error}\n`);
    }
  }

  function handleSwitchList(parsed: any): void {
    if (!parsed.name) {
      console.log('❌ Missing list name in your request.\n');
      return;
    }

    if (listService.setCurrentListByName(parsed.name)) {
      console.log(`✅ Switched to '${parsed.name}' list\n`);
    } else {
      console.log(`❌ List '${parsed.name}' not found. Use /lists to see available lists.\n`);
    }
  }

  function handleDeleteTodo(parsed: any): void {
    const currentList = listService.getCurrentList();
    if (!currentList) {
      console.log('❌ No current list selected. Use /create to create a list first.\n');
      return;
    }

    const todoIndex = (parsed.todoNumber || parsed.index) - 1;
    if (isNaN(todoIndex) || todoIndex < 0 || todoIndex >= currentList.todos.length) {
      console.log('❌ Invalid todo number. Use /list to see available todos.\n');
      return;
    }

    try {
      const todo = currentList.todos[todoIndex];
      listService.deleteTodoFromCurrentList(todo.id);
      console.log(`✅ Deleted "${todo.title}"\n`);
    } catch (error) {
      console.log(`❌ Failed to delete todo: ${error}\n`);
    }
  }

  // Handle command sequences with confirmation
  async function handleCommandSequence(parsed: any): Promise<void> {
    if (!parsed.commands || !Array.isArray(parsed.commands)) {
      console.log('❌ Invalid command sequence format.\n');
      return;
    }

    console.log('\n🤖 I suggest the following sequence of commands:');
    if (parsed.description) {
      console.log(`   ${parsed.description}`);
    }
    console.log();

    // Pretty print the command sequence
    parsed.commands.forEach((cmd: any, index: number) => {
      console.log(`   ${index + 1}. ${formatCommandForDisplay(cmd)}`);
    });

    console.log();
    
    // Ask for confirmation using existing readline interface
    return new Promise((resolve) => {
      console.log('Execute these commands? (y/n): ');
      
      // Set flags to handle confirmation
      const originalPrompt = rl.getPrompt();
      rl.setPrompt('');
      awaitingCommandConfirmation = true;
      
      const confirmationHandler = async (answer: string) => {
        // Remove this specific listener and reset flags
        rl.removeListener('line', confirmationHandler);
        rl.setPrompt(originalPrompt);
        awaitingCommandConfirmation = false;
        
        const trimmedAnswer = answer.trim().toLowerCase();
        
        // If answer is empty, ignore it
        if (trimmedAnswer === '') {
          resolve();
          return;
        }
        
        if (trimmedAnswer === 'y' || trimmedAnswer === 'yes') {
          console.log('\n🔄 Executing command sequence...\n');
          
          for (let i = 0; i < parsed.commands.length; i++) {
            const cmd = parsed.commands[i];
            console.log(`   ${i + 1}/${parsed.commands.length}: ${formatCommandForDisplay(cmd)}`);
            
            try {
              await handleParsedCommand(cmd);
            } catch (error) {
              console.log(`   ❌ Command ${i + 1} failed: ${error}`);
              console.log('   ⚠️  Stopping sequence execution.\n');
              resolve();
              return;
            }
          }
          
          console.log('✅ Command sequence completed successfully!\n');
        } else {
          console.log('❌ Command sequence cancelled.\n');
        }
        
        resolve();
      };
      
      // Add listener for the confirmation
      rl.once('line', confirmationHandler);
    });
  }

  // Format command for display
  function formatCommandForDisplay(cmd: any): string {
    switch (cmd.action) {
      case 'create_list':
        return `/create "${cmd.name}"`;
      case 'switch_list':
        return `/switch "${cmd.name}"`;
      case 'add_todo':
        let addCmd = `/add "${cmd.title}"`;
        if (cmd.priority) addCmd += ` --priority ${cmd.priority}`;
        if (cmd.dueDate) addCmd += ` --due ${cmd.dueDate}`;
        if (cmd.categories && cmd.categories.length > 0) addCmd += ` --category "${cmd.categories.join(',')}"`;
        return addCmd;
      case 'delete_todo':
        return `/delete ${cmd.todoNumber}`;
      case 'complete_todo':
        return `/complete ${cmd.todoNumber}`;
      case 'edit_todo':
        let editCmd = `/edit ${cmd.todoNumber}`;
        if (cmd.title) editCmd += ` --title "${cmd.title}"`;
        if (cmd.priority) editCmd += ` --priority ${cmd.priority}`;
        if (cmd.dueDate) editCmd += ` --due ${cmd.dueDate}`;
        return editCmd;
      default:
        return JSON.stringify(cmd);
    }
  }

  rl.prompt();

  rl.on('line', async (input) => {
    const trimmedInput = input.trim();
    
    
    // Handle chat mode exit
    if (chatMode && (trimmedInput === '/exit' || trimmedInput === 'exit')) {
      console.log('💬 Exiting chat mode...\n');
      chatMode = false;
      rl.setPrompt('> ');
      rl.prompt();
      return;
    }
    
    // Skip processing if we're awaiting command confirmation
    if (awaitingCommandConfirmation) {
      // Let the confirmation handler deal with this input
      return;
    }
    
    // Handle chat mode messages
    if (chatMode && trimmedInput !== '') {
      await handleChatMessage(trimmedInput);
      rl.prompt();
      return;
    }
    
    // Manually add non-empty, non-exit commands to history (avoiding duplicates)
    if (trimmedInput && trimmedInput !== '/exit' && trimmedInput !== 'exit') {
      const history = (rl as any).history;
      // Remove the command if it already exists in history to avoid duplicates
      const existingIndex = history.indexOf(trimmedInput);
      if (existingIndex > -1) {
        history.splice(existingIndex, 1);
      }
      // Add the command to the front of history
      history.unshift(trimmedInput);
      
      // Keep history size manageable
      if (history.length > 100) {
        history.length = 100;
      }
    }
    
    if (trimmedInput === '/exit' || trimmedInput === 'exit') {
      console.log('Goodbye!');
      rl.close();
      return;
    }
    
    if (trimmedInput === '/help') {
      console.log('\nAvailable commands:');
      console.log('  List Management:');
      console.log('    /create <name>   - Create a new list');
      console.log('    /switch <name>   - Switch to a different list');
      console.log('    /lists           - Show all lists');
      console.log('  Todo Management:');
      console.log('    /add <title>     - Add a todo to current list');
      console.log('                      Options: --priority high|medium|low --due YYYY-MM-DD --category <name>');
      console.log('    /list            - Show todos in current list');
      console.log('    /complete <id>   - Mark a todo as completed');
      console.log('    /uncomplete <id> - Mark a todo as not completed');
      console.log('    /delete <id>     - Delete a todo');
      console.log('    /edit <id>       - Edit a todo');
      console.log('                      Options: --title <text> --priority high|medium|low --due YYYY-MM-DD --category <name>');
      console.log('    /filter          - Filter todos by criteria');
      console.log('                      Options: --status completed|active --priority high|medium|low --category <name>');
      console.log('    /clear           - Clear all todos from current list');
      console.log('    /delete-list     - Delete a list: /delete-list <name>');
      console.log('  Other:');
      console.log('    /history         - Show recent command history');
      console.log('    /config          - Show AI configuration instructions');
      console.log('    /prompt          - Show current AI system prompt');
      console.log('    /chat [message]  - Enter AI chat mode or send single message');
      console.log('  General:');
      console.log('    /help            - Show this help');
      console.log('    /exit            - Exit interactive mode\n');
      rl.prompt();
      return;
    }
    
    if (trimmedInput === '/lists') {
      console.log();
      displayLists();
      rl.prompt();
      return;
    }
    
    if (trimmedInput.startsWith('/create ')) {
      const listName = trimmedInput.substring(8).trim();
      if (!listName) {
        console.log('Please specify a list name: /create <name>\n');
        rl.prompt();
        return;
      }
      
      // Check if list already exists
      if (listService.findListByName(listName)) {
        console.log(`List '${listName}' already exists!\n`);
        rl.prompt();
        return;
      }
      
      try {
        const newList = listService.createList(listName);
        console.log(`✓ Created list '${newList.name}'\n`);
      } catch (error) {
        console.log(`Failed to create list: ${error}\n`);
      }
      rl.prompt();
      return;
    }
    
    if (trimmedInput.startsWith('/switch ')) {
      const listName = trimmedInput.substring(8).trim();
      if (!listName) {
        console.log('Please specify a list name: /switch <name>\n');
        rl.prompt();
        return;
      }
      
      if (listService.setCurrentListByName(listName)) {
        console.log(`✓ Switched to '${listName}' list\n`);
      } else {
        console.log(`List '${listName}' not found. Use /lists to see available lists.\n`);
      }
      rl.prompt();
      return;
    }
    
    // Todo commands
    if (trimmedInput.startsWith('/add ')) {
      const addArgs = trimmedInput.substring(5).trim();
      if (!addArgs) {
        console.log('Please specify a todo title: /add <title>\n');
        rl.prompt();
        return;
      }
      
      const currentList = listService.getCurrentList();
      if (!currentList) {
        console.log('No current list selected. Use /create to create a list first.\n');
        rl.prompt();
        return;
      }
      
      try {
        const { title, flags } = parseArgs(addArgs);
        if (!title) {
          console.log('Please specify a todo title\n');
          rl.prompt();
          return;
        }
        
        // Parse enhanced options
        const options: any = {};
        
        if (flags.priority) {
          if (['high', 'medium', 'low'].includes(flags.priority)) {
            options.priority = flags.priority;
          } else {
            console.log('Priority must be one of: high, medium, low\n');
            rl.prompt();
            return;
          }
        }
        
        if (flags.due) {
          const dueDate = new Date(flags.due);
          if (isNaN(dueDate.getTime())) {
            console.log('Due date must be in YYYY-MM-DD format\n');
            rl.prompt();
            return;
          }
          options.dueDate = dueDate;
        }
        
        if (flags.category) {
          options.categories = [flags.category];
        }
        
        const newTodo = todoService.createTodo(title, options);
        listService.addTodoToCurrentList(newTodo);
        
        let message = `✓ Added "${newTodo.title}" to ${currentList.name} list`;
        if (options.priority) message += ` (priority: ${options.priority})`;
        if (options.dueDate) message += ` (due: ${options.dueDate.toDateString()})`;
        if (options.categories) message += ` (category: ${options.categories[0]})`;
        console.log(message + '\n');
        
      } catch (error) {
        console.log(`Failed to add todo: ${error}\n`);
      }
      rl.prompt();
      return;
    }
    
    if (trimmedInput === '/list') {
      const currentList = listService.getCurrentList();
      if (!currentList) {
        console.log('No current list selected. Use /create to create a list first.\n');
        rl.prompt();
        return;
      }
      
      console.log(`\nTodos in '${currentList.name}' list:`);
      if (currentList.todos.length === 0) {
        console.log('  (no todos yet)\n');
      } else {
        currentList.todos.forEach((todo, index) => {
          console.log(`  ${index + 1}. ${todoService.formatTodoForDisplay(todo)}`);
        });
        console.log();
      }
      rl.prompt();
      return;
    }
    
    if (trimmedInput.startsWith('/complete ')) {
      const todoIndex = parseInt(trimmedInput.substring(10).trim()) - 1;
      if (isNaN(todoIndex)) {
        console.log('Please specify a valid todo number: /complete <number>\n');
        rl.prompt();
        return;
      }
      
      const currentList = listService.getCurrentList();
      if (!currentList) {
        console.log('No current list selected. Use /create to create a list first.\n');
        rl.prompt();
        return;
      }
      
      if (todoIndex < 0 || todoIndex >= currentList.todos.length) {
        console.log(`Todo number ${todoIndex + 1} not found. Use /list to see available todos.\n`);
        rl.prompt();
        return;
      }
      
      try {
        const todo = currentList.todos[todoIndex];
        todoService.completeTodo(currentList.todos, todo.id);
        listService.updateTodoInCurrentList(todo);
        console.log(`✓ Completed "${todo.title}"\n`);
      } catch (error) {
        console.log(`Failed to complete todo: ${error}\n`);
      }
      rl.prompt();
      return;
    }
    
    if (trimmedInput.startsWith('/uncomplete ')) {
      const todoIndex = parseInt(trimmedInput.substring(12).trim()) - 1;
      if (isNaN(todoIndex)) {
        console.log('Please specify a valid todo number: /uncomplete <number>\n');
        rl.prompt();
        return;
      }
      
      const currentList = listService.getCurrentList();
      if (!currentList) {
        console.log('No current list selected. Use /create to create a list first.\n');
        rl.prompt();
        return;
      }
      
      if (todoIndex < 0 || todoIndex >= currentList.todos.length) {
        console.log(`Todo number ${todoIndex + 1} not found. Use /list to see available todos.\n`);
        rl.prompt();
        return;
      }
      
      try {
        const todo = currentList.todos[todoIndex];
        todoService.uncompleteTodo(currentList.todos, todo.id);
        listService.updateTodoInCurrentList(todo);
        console.log(`✓ Marked "${todo.title}" as not completed\n`);
      } catch (error) {
        console.log(`Failed to uncomplete todo: ${error}\n`);
      }
      rl.prompt();
      return;
    }
    
    if (trimmedInput.startsWith('/delete ')) {
      const todoIndex = parseInt(trimmedInput.substring(8).trim()) - 1;
      if (isNaN(todoIndex)) {
        console.log('Please specify a valid todo number: /delete <number>\n');
        rl.prompt();
        return;
      }
      
      const currentList = listService.getCurrentList();
      if (!currentList) {
        console.log('No current list selected. Use /create to create a list first.\n');
        rl.prompt();
        return;
      }
      
      if (todoIndex < 0 || todoIndex >= currentList.todos.length) {
        console.log(`Todo number ${todoIndex + 1} not found. Use /list to see available todos.\n`);
        rl.prompt();
        return;
      }
      
      try {
        const todo = currentList.todos[todoIndex];
        listService.deleteTodoFromCurrentList(todo.id);
        console.log(`✓ Deleted "${todo.title}"\n`);
      } catch (error) {
        console.log(`Failed to delete todo: ${error}\n`);
      }
      rl.prompt();
      return;
    }
    
    if (trimmedInput.startsWith('/edit ')) {
      const editArgs = trimmedInput.substring(6).trim();
      if (!editArgs) {
        console.log('Please specify a todo number: /edit <number>\\n');
        rl.prompt();
        return;
      }
      
      const currentList = listService.getCurrentList();
      if (!currentList) {
        console.log('No current list selected. Use /create to create a list first.\\n');
        rl.prompt();
        return;
      }
      
      // Parse the todo index and flags
      const { title: indexStr, flags } = parseArgs(editArgs);
      const todoIndex = parseInt(indexStr) - 1;
      
      if (isNaN(todoIndex)) {
        console.log('Please specify a valid todo number: /edit <number>\\n');
        rl.prompt();
        return;
      }
      
      if (todoIndex < 0 || todoIndex >= currentList.todos.length) {
        console.log(`Todo number ${todoIndex + 1} not found. Use /list to see available todos.\\n`);
        rl.prompt();
        return;
      }
      
      try {
        const todo = currentList.todos[todoIndex];
        const updates: any = {};
        let hasUpdates = false;
        
        // Check for title update
        if (flags.title) {
          updates.title = flags.title;
          hasUpdates = true;
        }
        
        // Check for priority update
        if (flags.priority) {
          if (['high', 'medium', 'low'].includes(flags.priority)) {
            updates.priority = flags.priority;
            hasUpdates = true;
          } else {
            console.log('Priority must be one of: high, medium, low\\n');
            rl.prompt();
            return;
          }
        }
        
        // Check for due date update
        if (flags.due) {
          const dueDate = new Date(flags.due);
          if (isNaN(dueDate.getTime())) {
            console.log('Due date must be in YYYY-MM-DD format\\n');
            rl.prompt();
            return;
          }
          updates.dueDate = dueDate;
          hasUpdates = true;
        }
        
        // Check for category update
        if (flags.category) {
          updates.categories = [flags.category];
          hasUpdates = true;
        }
        
        if (!hasUpdates) {
          console.log('No updates specified. Use --title, --priority, --due, or --category to modify the todo.\\n');
          rl.prompt();
          return;
        }
        
        // Apply updates
        todoService.updateTodo(currentList.todos, todo.id, updates);
        listService.updateTodoInCurrentList(todo);
        
        let message = `✓ Updated \"${todo.title}\"`;
        if (updates.title) message += ` (title updated)`;
        if (updates.priority) message += ` (priority: ${updates.priority})`;
        if (updates.dueDate) message += ` (due: ${updates.dueDate.toDateString()})`;
        if (updates.categories) message += ` (category: ${updates.categories[0]})`;
        console.log(message + '\\n');
        
      } catch (error) {
        console.log(`Failed to edit todo: ${error}\\n`);
      }
      rl.prompt();
      return;
    }
    
    if (trimmedInput.startsWith('/filter')) {
      const currentList = listService.getCurrentList();
      if (!currentList) {
        console.log('No current list selected. Use /create to create a list first.\\n');
        rl.prompt();
        return;
      }
      
      const filterArgs = trimmedInput.substring(7).trim();
      const { flags } = parseArgs(filterArgs);
      
      let filteredTodos = currentList.todos;
      let filterDescription = [];
      
      // Apply status filter
      if (flags.status) {
        if (flags.status === 'completed') {
          filteredTodos = filteredTodos.filter(todo => todo.completed);
          filterDescription.push('completed');
        } else if (flags.status === 'active') {
          filteredTodos = filteredTodos.filter(todo => !todo.completed);
          filterDescription.push('active');
        } else {
          console.log('Status must be one of: completed, active\\n');
          rl.prompt();
          return;
        }
      }
      
      // Apply priority filter
      if (flags.priority) {
        if (['high', 'medium', 'low'].includes(flags.priority)) {
          filteredTodos = filteredTodos.filter(todo => todo.priority === flags.priority);
          filterDescription.push(`${flags.priority} priority`);
        } else {
          console.log('Priority must be one of: high, medium, low\\n');
          rl.prompt();
          return;
        }
      }
      
      // Apply category filter
      if (flags.category) {
        filteredTodos = filteredTodos.filter(todo => 
          todo.categories && todo.categories.includes(flags.category)
        );
        filterDescription.push(`category: ${flags.category}`);
      }
      
      // Display results
      const filterText = filterDescription.length > 0 ? ` (${filterDescription.join(', ')})` : '';
      console.log(`\\nFiltered todos in '${currentList.name}' list${filterText}:`);
      
      if (filteredTodos.length === 0) {
        console.log('  (no todos match the filter criteria)\\n');
      } else {
        filteredTodos.forEach((todo, index) => {
          // Find the original index for reference
          const originalIndex = currentList.todos.findIndex(t => t.id === todo.id) + 1;
          console.log(`  ${originalIndex}. ${todoService.formatTodoForDisplay(todo)}`);
        });
        console.log();
      }
      
      rl.prompt();
      return;
    }
    
    if (trimmedInput === '/history') {
      const history = (rl as any).history;
      console.log('\nRecent command history:');
      if (history && history.length > 0) {
        history.slice(0, 10).forEach((cmd: string, index: number) => {
          console.log(`  ${index + 1}. ${cmd}`);
        });
        console.log('\nTip: Copy and paste commands to reuse them.\n');
      } else {
        console.log('  (no command history yet)\n');
      }
      rl.prompt();
      return;
    }
    
    if (trimmedInput === '/config') {
      console.log('\n' + openAIService.getConfigurationInstructions() + '\n');
      rl.prompt();
      return;
    }
    
    if (trimmedInput === '/prompt') {
      const currentList = listService.getCurrentList();
      const availableLists = listService.getAllLists();
      const context = {
        currentList,
        availableLists
      };
      
      console.log('\n📝 Current AI System Prompt:');
      console.log('=' .repeat(60));
      console.log(openAIService.getCurrentSystemPrompt(context));
      console.log('=' .repeat(60) + '\n');
      rl.prompt();
      return;
    }
    
    if (trimmedInput.startsWith('/chat')) {
      if (!openAIService.isConfigured()) {
        console.log('\n❌ AI is not configured. Use /config for setup instructions.\n');
        rl.prompt();
        return;
      }

      const chatMessage = trimmedInput.slice(5).trim(); // Remove '/chat'
      
      if (chatMessage) {
        // Single chat message
        await handleChatMessage(chatMessage);
        rl.prompt();
        return;
      } else {
        // Enter chat mode
        console.log('\n💬 Entering AI Chat Mode. Type "exit" to return to normal mode.\n');
        chatMode = true;
        console.log('🤖 How can I help you manage your todos today?');
        rl.setPrompt('chat> ');
        rl.prompt();
        return;
      }
    }
    
    if (trimmedInput === '/clear') {
      const currentList = listService.getCurrentList();
      if (!currentList) {
        console.log('No current list selected. Use /create to create a list first.\n');
        rl.prompt();
        return;
      }
      
      if (currentList.todos.length === 0) {
        console.log(`List '${currentList.name}' is already empty.\n`);
        rl.prompt();
        return;
      }
      
      listService.clearCurrentList();
      console.log(`✅ Cleared all todos from '${currentList.name}' list.\n`);
      rl.prompt();
      return;
    }
    
    if (trimmedInput.startsWith('/delete-list ')) {
      const listName = trimmedInput.substring(13).trim();
      if (!listName) {
        console.log('Please specify a list name: /delete-list <name>\n');
        rl.prompt();
        return;
      }
      
      const targetList = listService.findListByName(listName);
      if (!targetList) {
        console.log(`List '${listName}' not found.\n`);
        rl.prompt();
        return;
      }
      
      // Check if there are multiple lists
      const allLists = listService.getAllLists();
      if (allLists.length === 1) {
        console.log(`Cannot delete '${listName}' - it's the only list remaining.\n`);
        rl.prompt();
        return;
      }
      
      const success = listService.deleteList(targetList.id);
      if (success) {
        console.log(`✅ Deleted list '${listName}'.`);
        const newCurrentList = listService.getCurrentList();
        if (newCurrentList) {
          console.log(`   Switched to '${newCurrentList.name}' list.\n`);
        } else {
          console.log('   No lists remaining.\n');
        }
      } else {
        console.log(`❌ Failed to delete list '${listName}'.\n`);
      }
      rl.prompt();
      return;
    }
    
    if (trimmedInput === '') {
      rl.prompt();
      return;
    }
    
    // Try AI-powered natural language processing
    if (openAIService.isConfigured()) {
      try {
        console.log('🤖 Processing your request...');
        
        const context = {
          currentList: listService.getCurrentList(),
          availableLists: listService.getAllLists()
        };
        
        const parsed = await openAIService.parseNaturalLanguage(trimmedInput, context);
        await handleParsedCommand(parsed);
        
      } catch (error) {
        console.log(`❌ AI processing failed: ${error}`);
        console.log('💡 Try using a slash command like /add, /list, etc.\n');
      }
    } else {
      console.log(`❓ I don't understand "${trimmedInput}"`);
      console.log('💡 Use /help to see available commands, or /config to set up AI features.\n');
    }
    
    rl.prompt();
  });

  // Function to save command history
  const saveHistory = () => {
    try {
      const history = (rl as any).history;
      if (history && history.length > 0) {
        // Take the last 100 commands and reverse to get chronological order
        const historyToSave = history.slice(0, 100).reverse();
        fs.writeFileSync(historyFile, historyToSave.join('\n') + '\n');
      }
    } catch (error) {
      // Silently ignore history saving errors
    }
  };

  rl.on('close', () => {
    saveHistory();
    console.log('\nGoodbye!');
    process.exit(0);
  });
}

// Default to interactive mode if no arguments
if (process.argv.length <= 2) {
  startInteractiveMode();
} else {
  // Parse commands
  program.parse();
}