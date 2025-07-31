import OpenAI from 'openai';

export class OpenAIService {
  private client: OpenAI | null = null;
  private configured: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (apiKey) {
      this.client = new OpenAI({
        apiKey: apiKey
      });
      this.configured = true;
    }
  }

  isConfigured(): boolean {
    return this.configured && this.client !== null;
  }

  async parseNaturalLanguage(input: string, context: any): Promise<any> {
    if (!this.client) {
      throw new Error('OpenAI client not configured. Please set OPENAI_API_KEY environment variable.');
    }

    const systemPrompt = `You are a helpful assistant that parses natural language todo requests into structured JSON.

Current context:
- Current list: ${context.currentList?.name || 'None'}
- Available lists: ${context.availableLists?.map((l: any) => l.name).join(', ') || 'None'}
- Today's date: ${new Date().toISOString().split('T')[0]}

Parse the user's input and determine what action they want to take. Respond with valid JSON only.

Available actions:
- "add_todo": Add a single todo item
- "add_multiple_todos": Add multiple todo items from a paragraph or list
- "list_todos": Show todos (can be filtered)
- "complete_todo": Mark a todo as completed  
- "edit_todo": Modify an existing todo
- "create_list": Create a new todo list
- "switch_list": Switch to a different list
- "unknown": Unable to parse the request

JSON Schema for add_todo:
{
  "action": "add_todo",
  "title": "string (required)",
  "description": "string (optional)",
  "priority": "high|medium|low (optional)",
  "dueDate": "YYYY-MM-DD format (optional)",
  "categories": ["array of strings (optional)"]
}

JSON Schema for add_multiple_todos:
{
  "action": "add_multiple_todos",
  "todos": [
    {
      "title": "string (required)",
      "description": "string (optional)",
      "priority": "high|medium|low (optional)",
      "dueDate": "YYYY-MM-DD format (optional)",
      "categories": ["array of strings (optional)"]
    }
  ]
}

Date parsing guidelines:
- "today" -> use today's date
- "tomorrow" -> add 1 day to today's date
- "next week" -> add 7 days to today's date
- "Monday", "Tuesday", etc. -> find the next occurrence of that day
- "next Monday" -> find the Monday after next Monday
- "in 3 days" -> add 3 days to today's date
- "2024-01-15" -> use as-is in YYYY-MM-DD format

Examples:
"Add buy groceries with high priority" -> {"action": "add_todo", "title": "buy groceries", "priority": "high"}
"Add get milk tomorrow" -> {"action": "add_todo", "title": "get milk", "dueDate": "${new Date(Date.now() + 24*60*60*1000).toISOString().split('T')[0]}"}
"Add call doctor next Monday" -> {"action": "add_todo", "title": "call doctor", "dueDate": "2024-XX-XX"}
"Add finish project with high priority due Friday" -> {"action": "add_todo", "title": "finish project", "priority": "high", "dueDate": "2024-XX-XX"}

Multiple todos examples:
"I need to buy groceries, call the dentist, and finish the report by Friday" -> {"action": "add_multiple_todos", "todos": [{"title": "buy groceries"}, {"title": "call the dentist"}, {"title": "finish the report", "dueDate": "2025-XX-XX"}]}
"Add these tasks: 1) review code 2) update documentation 3) send email to team" -> {"action": "add_multiple_todos", "todos": [{"title": "review code"}, {"title": "update documentation"}, {"title": "send email to team"}]}
"Tomorrow I need to pick up dry cleaning, go to the bank, and schedule a haircut" -> {"action": "add_multiple_todos", "todos": [{"title": "pick up dry cleaning", "dueDate": "${new Date(Date.now() + 24*60*60*1000).toISOString().split('T')[0]}"}, {"title": "go to the bank", "dueDate": "${new Date(Date.now() + 24*60*60*1000).toISOString().split('T')[0]}"}, {"title": "schedule a haircut", "dueDate": "${new Date(Date.now() + 24*60*60*1000).toISOString().split('T')[0]}"}]}
"High priority tasks: fix the bug in login system and deploy to production" -> {"action": "add_multiple_todos", "todos": [{"title": "fix the bug in login system", "priority": "high"}, {"title": "deploy to production", "priority": "high"}]}

Other examples:
"Show me my work todos" -> {"action": "list_todos", "filter": {"category": "work"}}
"Complete the first task" -> {"action": "complete_todo", "todoNumber": 1}
"Create shopping list" -> {"action": "create_list", "name": "shopping"}
"Switch to work list" -> {"action": "switch_list", "name": "work"}`;

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: input }
        ],
        max_tokens: 200,
        temperature: 0.1 // Low temperature for consistent parsing
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      return JSON.parse(content);
    } catch (error) {
      console.error('OpenAI parsing error:', error);
      // Fallback to unknown action
      return {
        action: 'unknown',
        originalInput: input,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  getConfigurationInstructions(): string {
    return `To enable AI-powered todo parsing:

Option 1: Create a .env file (recommended)
1. Copy .env.example to .env: cp .env.example .env
2. Get an OpenAI API key from https://platform.openai.com/api-keys
3. Edit .env and replace 'sk-your-api-key-here' with your actual key
4. Restart the application

Option 2: Environment variable
1. Set it directly: export OPENAI_API_KEY=your_api_key_here
2. Run the app: node dist/index.js

Without an API key, you can still use slash commands like /add, /list, etc.`;
  }

  private formatTodosForContext(context: any): string {
    if (!context.currentList || !context.currentList.todos || context.currentList.todos.length === 0) {
      return '- No todos in current list';
    }

    const todos = context.currentList.todos.slice(0, 20); // Limit for context size
    return todos.map((todo: any, index: number) => {
      const status = todo.completed ? '✓' : ' ';
      const priority = todo.priority ? ` [${todo.priority}]` : '';
      const dueDate = todo.dueDate ? ` (due: ${new Date(todo.dueDate).toISOString().split('T')[0]})` : '';
      const categories = todo.categories && todo.categories.length > 0 ? ` {${todo.categories.join(', ')}}` : '';
      return `  ${index + 1}. [${status}] ${todo.title}${priority}${dueDate}${categories}`;
    }).join('\n');
  }

  getChatSystemPrompt(context: any, conversationHistory: string[] = []): string {
    if (!this.isConfigured()) {
      return 'AI is not configured. Set OPENAI_API_KEY to use chat mode.';
    }

    const historyContext = conversationHistory.length > 0 
      ? `\n\nRecent Conversation:\n${conversationHistory.slice(-3).join('\n')}\n`
      : '';

    return `You are a helpful AI assistant for a todo list application. Help users manage tasks, provide insights, and suggest command sequences for complex operations.

Current Context:
- Current list: ${context.currentList?.name || 'None'}
- Available lists: ${context.availableLists?.map((l: any) => `${l.name} (${l.todos.length} items)`).join(', ') || 'None'}
- Today's date: ${new Date().toISOString().split('T')[0]}

Current Todos in "${context.currentList?.name || 'No List'}":
${this.formatTodosForContext(context)}${historyContext}

IMPORTANT: You have full access to the user's current todos shown above. Use this data to answer questions directly.

Response Types:
1. **Structured JSON** (for modifying todo list): Return JSON to execute the action
2. **Data Analysis** (for questions about existing todos): Answer directly using provided context
3. **Advice/Strategy** (for recommendations): Provide helpful guidance based on context

CRITICAL: For questions about existing todos, analyze the provided data directly and give specific answers. 
Do NOT tell users to "search" or "look for" - YOU have the data and should analyze it immediately.

Available JSON Actions:
- "add_todo": Add a single todo
- "add_multiple_todos": Add multiple todos
- "complete_todo": Mark todo completed  
- "create_list": Create new list
- "switch_list": Switch to different list
- "delete_todo": Delete a todo
- "command_sequence": Execute multiple commands in sequence
- "list_todos": Show/filter todos
- "edit_todo": Modify existing todo

For complex operations requiring multiple steps, use command_sequence:
{
  "action": "command_sequence",
  "description": "Brief explanation of what this accomplishes",
  "commands": [
    {"action": "create_list", "name": "listname"},
    {"action": "switch_list", "name": "listname"}, 
    {"action": "add_todo", "title": "task", "priority": "high", "dueDate": "2025-07-31"},
    {"action": "switch_list", "name": "originallist"},
    {"action": "delete_todo", "todoNumber": 1}
  ]
}

Command Types:
- create_list: {"action": "create_list", "name": "string"}
- switch_list: {"action": "switch_list", "name": "string"}  
- delete_todo: {"action": "delete_todo", "todoNumber": number}
- add_todo: {"action": "add_todo", "title": "string", "priority": "high|medium|low", "dueDate": "YYYY-MM-DD", "categories": ["array"]}
- complete_todo: {"action": "complete_todo", "todoNumber": number}
- edit_todo: {"action": "edit_todo", "todoNumber": number, "title": "string", "priority": "high|medium|low", "dueDate": "YYYY-MM-DD"}

**JSON Command Examples (use structured JSON):**
- "Add buy groceries" → {"action": "add_todo", "title": "buy groceries"}
- "Complete task 1" → {"action": "complete_todo", "todoNumber": 1}
- "Move high priority items to new Urgent list" → {"action": "command_sequence", "commands": [...]}

**Data Analysis Examples (answer directly using provided context):**
- "Which todos mention Riya?" → "2 todos mention Riya: 'buy Riya a new lunch bag' and 'Register Riya for belt test'"
- "What's due today?" → "3 tasks are due today: [list specific tasks with titles]"
- "How many high priority tasks do I have?" → "You have 2 high priority tasks: [list specific titles]"
- "What have I completed?" → "You've completed 1 task: 'order items on Amazon'"
- "Which tasks are overdue?" → "Based on today's date, [specific analysis of due dates]"
- "Show me work-related todos" → "I found 3 work-related tasks: [list specific matches]"

**Strategy/Advice Examples (provide recommendations):**
- "What should I focus on today?" → Analyze current todos, priorities, and due dates to suggest specific focus
- "How should I organize my week?" → Provide organizational strategy based on current workload

**Key Decision Rules:**
1. **Modification requests** (add, complete, delete, edit, create) → Return JSON commands
2. **Analysis questions** (which, what, how many, show me) → Answer directly using provided todo context
3. **Strategy questions** (what should I focus on, how to organize) → Provide advice based on context

**Context Usage Guidelines:**
- Always reference specific todo titles, due dates, and priorities from the provided context
- Count and enumerate todos precisely when asked for quantities
- When filtering (e.g., "work-related", "high priority"), scan all todos and list matches
- Compare due dates against today's date (${new Date().toISOString().split('T')[0]}) for overdue analysis

CRITICAL: You have the complete todo list above - use it to answer questions immediately and specifically.`;
  }

  async chatWithAI(message: string, context: any, conversationHistory: string[] = []): Promise<any> {
    if (!this.client) {
      throw new Error('OpenAI client not configured. Please set OPENAI_API_KEY environment variable.');
    }

    const systemPrompt = this.getChatSystemPrompt(context, conversationHistory);

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        max_tokens: 600,
        temperature: 0.3
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      // Try to parse as JSON first, if it fails return as conversational text
      try {
        return JSON.parse(content);
      } catch {
        // Return as conversational response
        return {
          action: 'conversational',
          message: content
        };
      }
    } catch (error) {
      console.error('OpenAI chat error:', error);
      throw new Error(`AI chat failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getCurrentSystemPrompt(context: any): string {
    if (!this.isConfigured()) {
      return 'AI is not configured. Set OPENAI_API_KEY to see the system prompt.';
    }

    return `You are a helpful assistant that parses natural language todo requests into structured JSON.

Current context:
- Current list: ${context.currentList?.name || 'None'}
- Available lists: ${context.availableLists?.map((l: any) => l.name).join(', ') || 'None'}
- Today's date: ${new Date().toISOString().split('T')[0]}

Parse the user's input and determine what action they want to take. Respond with valid JSON only.

Available actions:
- "add_todo": Add a single todo item
- "add_multiple_todos": Add multiple todo items from a paragraph or list
- "list_todos": Show todos (can be filtered)
- "complete_todo": Mark a todo as completed  
- "edit_todo": Modify an existing todo
- "create_list": Create a new todo list
- "switch_list": Switch to a different list
- "unknown": Unable to parse the request

JSON Schema for add_todo:
{
  "action": "add_todo",
  "title": "string (required)",
  "description": "string (optional)",
  "priority": "high|medium|low (optional)",
  "dueDate": "YYYY-MM-DD format (optional)",
  "categories": ["array of strings (optional)"]
}

JSON Schema for add_multiple_todos:
{
  "action": "add_multiple_todos",
  "todos": [
    {
      "title": "string (required)",
      "description": "string (optional)",
      "priority": "high|medium|low (optional)",
      "dueDate": "YYYY-MM-DD format (optional)",
      "categories": ["array of strings (optional)"]
    }
  ]
}

Date parsing guidelines:
- "today" -> use today's date
- "tomorrow" -> add 1 day to today's date
- "next week" -> add 7 days to today's date
- "Monday", "Tuesday", etc. -> find the next occurrence of that day
- "next Monday" -> find the Monday after next Monday
- "in 3 days" -> add 3 days to today's date
- "2024-01-15" -> use as-is in YYYY-MM-DD format

Examples:
"Add buy groceries with high priority" -> {"action": "add_todo", "title": "buy groceries", "priority": "high"}
"Add get milk tomorrow" -> {"action": "add_todo", "title": "get milk", "dueDate": "${new Date(Date.now() + 24*60*60*1000).toISOString().split('T')[0]}"}
"Add call doctor next Monday" -> {"action": "add_todo", "title": "call doctor", "dueDate": "2024-XX-XX"}
"Add finish project with high priority due Friday" -> {"action": "add_todo", "title": "finish project", "priority": "high", "dueDate": "2024-XX-XX"}

Multiple todos examples:
"I need to buy groceries, call the dentist, and finish the report by Friday" -> {"action": "add_multiple_todos", "todos": [{"title": "buy groceries"}, {"title": "call the dentist"}, {"title": "finish the report", "dueDate": "2025-XX-XX"}]}
"Add these tasks: 1) review code 2) update documentation 3) send email to team" -> {"action": "add_multiple_todos", "todos": [{"title": "review code"}, {"title": "update documentation"}, {"title": "send email to team"}]}
"Tomorrow I need to pick up dry cleaning, go to the bank, and schedule a haircut" -> {"action": "add_multiple_todos", "todos": [{"title": "pick up dry cleaning", "dueDate": "${new Date(Date.now() + 24*60*60*1000).toISOString().split('T')[0]}"}, {"title": "go to the bank", "dueDate": "${new Date(Date.now() + 24*60*60*1000).toISOString().split('T')[0]}"}, {"title": "schedule a haircut", "dueDate": "${new Date(Date.now() + 24*60*60*1000).toISOString().split('T')[0]}"}]}
"High priority tasks: fix the bug in login system and deploy to production" -> {"action": "add_multiple_todos", "todos": [{"title": "fix the bug in login system", "priority": "high"}, {"title": "deploy to production", "priority": "high"}]}

Other examples:
"Show me my work todos" -> {"action": "list_todos", "filter": {"category": "work"}}
"Complete the first task" -> {"action": "complete_todo", "todoNumber": 1}
"Create shopping list" -> {"action": "create_list", "name": "shopping"}
"Switch to work list" -> {"action": "switch_list", "name": "work"}`;
  }
}