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
}