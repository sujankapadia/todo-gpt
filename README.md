# Todo-GPT

An intelligent command-line todo application powered by AI that understands natural language and helps you manage your tasks effortlessly.

## Features

### 🤖 AI-Powered Natural Language Processing
- **GPT-4o-mini Integration**: Advanced natural language understanding for todo management
- Add todos using natural language: "Add buy groceries with high priority tomorrow"
- Create multiple todos from paragraph text: "I need to call the dentist, pick up dry cleaning, and finish the report by Friday"
- Smart date parsing: "tomorrow", "next Monday", "in 3 days", etc.
- Debug output to see how AI interprets your requests

### 📝 Comprehensive Todo Management
- Multiple todo lists with easy switching
- Priority levels (high, medium, low)
- Due dates with timezone-aware parsing
- Categories for organization
- Todo completion tracking

### 💾 Persistent Storage
- SQLite database for reliable data persistence
- Automatic database initialization
- Data stored in `~/.todo-gpt/data.db`

### 🎯 Flexible Interface
- Interactive CLI mode with command history
- Slash commands for precise control
- Arrow key navigation and autocomplete
- Both natural language and structured commands

## Installation

### Prerequisites
- Node.js (version 14 or higher)
- npm or yarn

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd todo-gpt
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Set up OpenAI API (Optional but recommended)**
   ```bash
   cp .env.example .env
   # Edit .env and add your OpenAI API key
   ```

5. **Run the application**
   ```bash
   node dist/index.js
   ```

## Configuration

### OpenAI API Setup

To enable AI-powered natural language parsing:

1. Get an API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Copy `.env.example` to `.env`
3. Replace `sk-your-api-key-here` with your actual API key
4. Restart the application

Without an API key, you can still use all slash commands.

## Usage

### Natural Language Commands

With OpenAI configured, you can use natural language directly:

```bash
> Add buy groceries with high priority tomorrow
🤖 Processing your request...
🔍 DEBUG INFO:
   Request Type Detected: add_todo
   Raw LLM Response: {
     "action": "add_todo",
     "title": "buy groceries",
     "priority": "high",
     "dueDate": "2025-08-13"
   }

✅ Added "buy groceries" to Personal list (priority: high) (due: Tue Aug 13 2025)

> I need to call the dentist, pick up dry cleaning, and finish the report by Friday
🤖 Processing your request...
🔍 DEBUG INFO:
   Request Type Detected: add_multiple_todos
   Raw LLM Response: {
     "action": "add_multiple_todos",
     "todos": [
       {"title": "call the dentist"},
       {"title": "pick up dry cleaning"},
       {"title": "finish the report", "dueDate": "2025-08-15"}
     ]
   }

✅ Added 3 todos to Personal list:
  1. "call the dentist"
  2. "pick up dry cleaning"
  3. "finish the report" (due: 8/15/2025)
```

### Slash Commands

For precise control, use slash commands:

#### List Management
```bash
/create <name>        # Create a new list
/switch <name>        # Switch to a different list
/lists                # Show all lists
/delete-list <name>   # Delete a list
/clear                # Clear all todos from current list
```

#### Todo Management
```bash
/add <title>          # Add a todo
  --priority high|medium|low
  --due YYYY-MM-DD
  --category <name>

/list                 # Show todos in current list
/complete <number>    # Mark todo as completed
/uncomplete <number>  # Mark todo as not completed
/delete <number>      # Delete a todo
/edit <number>        # Edit a todo
  --title "new title"
  --priority high|medium|low
  --due YYYY-MM-DD
  --category <name>

/filter               # Filter todos
  --status completed|active
  --priority high|medium|low
  --category <name>
```

#### AI & Debug Commands
```bash
/prompt               # Show current AI system prompt
/config               # Show AI configuration instructions
/help                 # Show help
/history              # Show command history
/exit                 # Exit the application
```

### Examples

#### Adding Todos
```bash
# Natural language
> Add finish presentation with high priority due next Friday

# Slash command
> /add "finish presentation" --priority high --due 2025-08-15
```

#### Multiple Todos
```bash
# Natural language parsing:
> Weekend chores: clean the house, do laundry, water plants, and pay bills
> Add these tasks: 1) review code 2) update documentation 3) send email
> Tomorrow I need to pick up dry cleaning, go to the bank, and schedule a haircut
```

#### Managing Lists
```bash
> /create work
> /switch work
> Add prepare quarterly report with high priority
> /switch personal
> /lists
```

#### Debugging AI Responses
```bash
> /prompt
📝 Current AI System Prompt:
============================================================
You are a helpful assistant that parses natural language todo requests into structured JSON.

Current context:
- Current list: Personal
- Available lists: Personal, Work
- Today's date: 2025-08-12
...
============================================================
```

## Project Structure

```
todo-gpt/
├── src/
│   ├── index.ts              # Main CLI application
│   ├── types.ts              # TypeScript type definitions
│   └── services/
│       ├── DatabaseService.ts   # SQLite database operations
│       ├── ListService.ts       # Todo list management
│       ├── TodoService.ts       # Todo item operations
│       └── OpenAIService.ts     # AI natural language processing
├── dist/                     # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
├── .env.example             # Environment variables template
├── .gitignore
└── README.md
```

## Development

### Building
```bash
npm run build
```

### Running in Development
```bash
# Build and run
npm run build && node dist/index.js

# Or directly run TypeScript (if ts-node is installed)
npx ts-node src/index.ts
```

### Database

The application automatically creates a SQLite database at `~/.todo-gpt/data.db`. The database includes:

- **lists**: Todo list metadata
- **todos**: Individual todo items
- **todo_categories**: Many-to-many relationship for categories

## Features in Detail

### AI Natural Language Processing
- **Powered by OpenAI GPT-4o-mini** for reliable and cost-effective natural language understanding
- **Debug Output**: See exactly how the AI interprets your requests with detailed response logging
- **Structured JSON Responses**: AI returns structured data for reliable command execution
- Supports complex multi-todo requests
- Smart date parsing with timezone awareness

### Date Parsing
The application understands various date formats:
- Relative: "today", "tomorrow", "next week"
- Named days: "Monday", "next Friday"
- Relative offsets: "in 3 days", "in 2 weeks"
- Absolute dates: "2025-08-15", "August 15, 2025"

### Command History
- Automatic command history storage
- Arrow key navigation (↑/↓)
- Persistent across sessions
- History file: `~/.todo-gpt/history`

### Debug Features
- **Request Type Detection**: See what action the AI identified
- **Raw LLM Response**: View the complete JSON response from OpenAI
- **System Prompt Inspection**: Use `/prompt` to see the current AI instructions

## Troubleshooting

### Common Issues

**AI features not working:**
- Check that your OpenAI API key is correctly set in `.env`
- Verify you have internet connectivity
- Ensure your API key has sufficient credits

**Database errors:**
- Check that `~/.todo-gpt/` directory is writable
- Try deleting the database file to reset: `rm ~/.todo-gpt/data.db`

**Build errors:**
- Ensure you have Node.js 14+ installed
- Try clearing node_modules: `rm -rf node_modules && npm install`

### Debug Mode
This version includes debug output that shows:
- What action type the AI detected
- The complete JSON response from the AI
- Use this information to understand how your natural language is being interpreted

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- Built with TypeScript and Node.js
- Uses OpenAI GPT-4o-mini for natural language processing
- SQLite for data persistence
- Commander.js for CLI framework