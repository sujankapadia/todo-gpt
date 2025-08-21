import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { TodoCommand, type TodoCommandType } from '../schemas/todoCommandsSimple';

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

Current Todos in "${context.currentList?.name || 'No List'}":
${this.formatTodosForContext(context)}

IMPORTANT: For completion requests, look at the current todos above and match the user's statement to the specific todo number. Consider:
- Exact title matches: "I returned the Amazon package" matches "return an Amazon package" 
- Partial matches: "went to dentist" matches "go to the dentist"
- Past tense variations: "bought groceries" matches "buy groceries"
- Action completion: "finished the report" matches "finish the report"

Parse the user's input and determine what action they want to take. Respond with valid JSON only.

Available actions:
- "add_todo": Add a single todo item
- "add_multiple_todos": Add multiple todo items from a paragraph or list
- "list_todos": Show todos (can be filtered)
- "complete_todo": Mark a todo as completed  
- "uncomplete_todo": Mark a todo as not completed
- "edit_todo": Modify an existing todo
- "delete_todo": Delete a todo
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

Completion examples (match to specific todo numbers from current list):
"Complete the first task" -> {"action": "complete_todo", "todoNumber": 1}
"I bought the groceries" -> {"action": "complete_todo", "todoNumber": 3} (if todo 3 is "buy groceries")
"Already returned the Amazon package" -> {"action": "complete_todo", "todoNumber": 4} (if todo 4 is "return an Amazon package")
"Finished going to the dentist" -> {"action": "complete_todo", "todoNumber": 2} (if todo 2 is "go to the dentist")
"I've completed the FSA enrollment" -> {"action": "complete_todo", "todoNumber": 1} (if todo 1 is "Enroll in FSA")
"Done with the PECO bill" -> {"action": "complete_todo", "todoNumber": 3} (if todo 3 is "pay the PECO bill")

Edit examples (match to specific todo numbers and modify properties):
"Make the dentist appointment high priority" -> {"action": "edit_todo", "todoNumber": 2, "priority": "high"} (if todo 2 is "go to the dentist")
"Change FSA deadline to tomorrow" -> {"action": "edit_todo", "todoNumber": 1, "dueDate": "2025-08-15"} (if todo 1 is "Enroll in FSA")
"Update the Amazon return title" -> {"action": "edit_todo", "todoNumber": 4, "title": "return Amazon package today"} (if todo 4 is "return an Amazon package")
"Make PECO bill medium priority" -> {"action": "edit_todo", "todoNumber": 3, "priority": "medium"} (if todo 3 is "pay the PECO bill")

Delete examples (match to specific todo numbers):
"Delete the dentist appointment" -> {"action": "delete_todo", "todoNumber": 2} (if todo 2 is "go to the dentist")
"Remove the Amazon return task" -> {"action": "delete_todo", "todoNumber": 4} (if todo 4 is "return an Amazon package")
"Get rid of the PECO bill todo" -> {"action": "delete_todo", "todoNumber": 3} (if todo 3 is "pay the PECO bill")

Uncomplete examples (match to specific todo numbers):
"Mark FSA as not done" -> {"action": "uncomplete_todo", "todoNumber": 1} (if todo 1 is "Enroll in FSA")
"Uncomplete the grocery task" -> {"action": "uncomplete_todo", "todoNumber": 3} (if todo 3 is "buy groceries")
"I need to redo the dentist appointment" -> {"action": "uncomplete_todo", "todoNumber": 2} (if todo 2 is "go to the dentist")

Other examples:
"Show me my work todos" -> {"action": "list_todos", "filter": {"category": "work"}}
"Create shopping list" -> {"action": "create_list", "name": "shopping"}
"Switch to work list" -> {"action": "switch_list", "name": "work"}`;

    try {
      const response = await this.client.chat.completions.parse({
        model: 'gpt-4o-2024-08-06', // Structured outputs require gpt-4o
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: input }
        ],
        response_format: zodResponseFormat(TodoCommand, "todo_command"),
        max_tokens: 200,
        temperature: 0.1
      });

      const parsed = response.choices[0]?.message?.parsed;
      if (!parsed) {
        throw new Error('Failed to parse response or request was refused');
      }

      return parsed as TodoCommandType;
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

DECISION RULE: Does the user's message request a specific action or structured command?

**YES → Return JSON command to execute**
This includes:
- **Data changes**: "complete task 1", "mark as high priority", "add new task"
- **Implicit actions**: "I bought X", "finished Y", "already did Z", "got the groceries"
- **Reference-based**: "mark those done", "complete what we discussed"
- **Status updates**: "I've done the report", "actually completed that yesterday"
- **List/display requests**: "show current list", "list todos", "show items", "display tasks"
- **Filtering requests**: "show high priority", "list completed items", "show work todos"

**NO → Return conversational response**
This includes:
- **Analysis questions**: "how many tasks left?", "what percentage complete?"
- **Strategy questions**: "what should I focus on?", "how to organize?", "what's most urgent?"
- **Search questions**: "which todos mention X?", "what's due today?"
- **General help**: "how does this work?", "what can you do?"

Available JSON Actions:
- "add_todo": Add a single todo
- "add_multiple_todos": Add multiple todos
- "complete_todo": Mark todo completed  
- "uncomplete_todo": Mark todo as not completed
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
- uncomplete_todo: {"action": "uncomplete_todo", "todoNumber": number}
- edit_todo: {"action": "edit_todo", "todoNumber": number, "title": "string", "priority": "high|medium|low", "dueDate": "YYYY-MM-DD"}

**EXAMPLES:**

**Change Requests (→ JSON Command):**

**Add Examples:**
- "Add buy groceries" → {"action": "add_todo", "title": "buy groceries"}
- "Add high priority task due tomorrow" → {"action": "add_todo", "title": "task", "priority": "high", "dueDate": "2025-08-15"}

**Complete Examples (match to specific todo numbers):**
- "Complete task 1" → {"action": "complete_todo", "todoNumber": 1}
- "I've bought Riya a new lunch bag, actually" → {"action": "complete_todo", "todoNumber": 1}
- "Already returned the Amazon package" → {"action": "complete_todo", "todoNumber": 4} (if todo 4 is "return an Amazon package")
- "Finished going to the dentist" → {"action": "complete_todo", "todoNumber": 2} (if todo 2 is "go to the dentist")
- "I finished the report yesterday" → {"action": "complete_todo", "todoNumber": X} (match to specific todo)

**Edit Examples (match and modify properties):**
- "Make the dentist appointment high priority" → {"action": "edit_todo", "todoNumber": 2, "priority": "high"}
- "Change FSA deadline to tomorrow" → {"action": "edit_todo", "todoNumber": 1, "dueDate": "2025-08-15"}
- "Update the Amazon return title to be more specific" → {"action": "edit_todo", "todoNumber": 4, "title": "return Amazon package today"}

**Delete Examples (match to specific todos):**
- "Delete the dentist appointment" → {"action": "delete_todo", "todoNumber": 2}
- "Remove the Amazon return task" → {"action": "delete_todo", "todoNumber": 4}
- "Get rid of the PECO bill todo" → {"action": "delete_todo", "todoNumber": 3}

**Uncomplete Examples (match to specific todos):**
- "Mark FSA as not done" → {"action": "uncomplete_todo", "todoNumber": 1}
- "I need to redo the dentist appointment" → {"action": "uncomplete_todo", "todoNumber": 2}
- "Uncomplete the grocery task" → {"action": "uncomplete_todo", "todoNumber": 3}

**List/Display Examples (use list_todos command):**
- "Show current list" → {"action": "list_todos"}
- "Show the items in this list" → {"action": "list_todos"}
- "List todos" → {"action": "list_todos"}
- "Display my tasks" → {"action": "list_todos"}
- "Show high priority items" → {"action": "list_todos", "filter": {"priority": "high"}}
- "List completed tasks" → {"action": "list_todos", "filter": {"status": "completed"}}

**Complex Operations:**
- "Mark those as high priority" → {"action": "command_sequence", "commands": [...]}

**Information Requests (→ Conversational Response):**
- "Which todos mention Riya?" → "2 todos mention Riya: 'buy Riya a new lunch bag' and 'Register Riya for belt test'"
- "What's due today?" → "3 tasks are due today: [list specific tasks]"
- "How many tasks left?" → "You have 4 incomplete tasks: [list them]"
- "What should I focus on?" → "Based on priorities and due dates, I recommend..."

**CRITICAL INSTRUCTIONS:**
1. **Confidently resolve references** using conversation history - if context is clear, execute directly
2. Apply the simple decision rule: Change request = JSON, Information request = Conversational  
3. For implicit completions like "I bought X", find the matching todo and mark it complete
4. NEVER return JSON as text in conversational responses - execute it or don't mention it

**Reference Resolution Confidence:**
- If previous message mentioned specific todos and user says "those", "them" → directly act on those todos
- Only ask for clarification if the reference is genuinely ambiguous
- "Change due date for those" after listing high priority todos → directly edit those high priority todos

Use both todo data and conversation history for accurate responses.`;
  }

  async chatWithAI(message: string, context: any, conversationHistory: string[] = []): Promise<any> {
    if (!this.client) {
      throw new Error('OpenAI client not configured. Please set OPENAI_API_KEY environment variable.');
    }

    const systemPrompt = this.getChatSystemPrompt(context, conversationHistory);

    try {
      // First try with structured output
      const response = await this.client.chat.completions.parse({
        model: 'gpt-4o-2024-08-06',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        response_format: zodResponseFormat(TodoCommand, "todo_command"),
        max_tokens: 600,
        temperature: 0.3
      });

      const parsed = response.choices[0]?.message?.parsed;
      if (parsed) {
        return parsed as TodoCommandType;
      }
      
      // If parsing was refused, fall back to conversational
      const content = response.choices[0]?.message?.content;
      if (content) {
        return {
          action: 'conversational',
          message: content
        };
      }

      throw new Error('No response from OpenAI');
    } catch (error) {
      // If structured parsing fails, try conversational fallback
      try {
        const response = await this.client.chat.completions.create({
          model: 'gpt-4o-2024-08-06',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ],
          max_tokens: 600,
          temperature: 0.3
        });

        const content = response.choices[0]?.message?.content;
        return {
          action: 'conversational', 
          message: content || 'Sorry, I couldn\'t understand that request.'
        };
      } catch (fallbackError) {
        console.error('OpenAI chat error:', fallbackError);
        throw new Error(`Chat failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`);
      }
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