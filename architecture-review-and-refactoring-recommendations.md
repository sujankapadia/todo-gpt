# TypeScript/Node.js Architecture Review

## TypeScript/Node.js Idioms: Good ✅

### Strengths:
- Proper TypeScript setup: tsconfig.json is well-configured with strict mode, proper module resolution
- Good type definitions: Clear interfaces in types.ts, proper use of optional properties
- Dependency injection: Services take dependencies in constructors (DatabaseService → ListService)
- Error handling: Proper error throwing and try/catch blocks
- Node.js patterns: Appropriate use of fs, path, os modules for file operations
- Package structure: Logical separation into services, clear entry point

### Minor improvements needed:
- Consider using readonly for array properties that shouldn't be mutated externally
- Could use more specific return types instead of any in database queries

## Architecture: Mixed ⚠️

### Good architecture patterns:
- Separation of concerns: Clear service layer separation (Database, List, Todo, OpenAI)
- Single responsibility: Each service has a focused purpose
- Data persistence: Proper SQLite integration with normalized schema
- Command pattern: CLI commands are well-structured

### Architecture concerns:

1. **Tight coupling in main file**: index.ts is massive (1000+ lines) and handles too many responsibilities:
   - CLI argument parsing
   - Interactive mode management
   - All command implementations
   - AI response handling
   - History management

2. **Service layer inconsistencies**:
   - TodoService operates on arrays but doesn't persist
   - ListService handles both memory and persistence
   - Mixed concerns between data operations and persistence

3. **Missing abstractions**:
   - No repository pattern or data access layer
   - Direct SQL in service classes
   - No command/handler pattern for CLI operations

4. **Database design issues**:
   - Categories stored as normalized junction table but tags/subtasks/dependencies are just interface properties
   - Inconsistent data modeling

## Recommended Refactoring 🔄

```
src/
├── commands/           # CLI command handlers
├── handlers/          # Business logic handlers
├── repositories/      # Data access layer
├── services/          # Pure business services
└── cli/              # CLI-specific code
```

### Key improvements:
1. Extract command handlers from main file
2. Add repository layer between services and database
3. Implement command pattern for CLI operations
4. Consistent data modeling across all entity relationships
5. Add input validation and sanitization

The code follows TypeScript/Node.js conventions well but would benefit from better architectural separation and reducing the monolithic main file.

---

## What is the difference between "business logic handlers" and "pure business services"?

The distinction is about where business rules live vs how data flows:

### Pure Business Services

- **What they do**: Core domain logic, business rules, validation
- **What they don't do**: Know about HTTP requests, CLI commands, databases, or external systems
- **Example**: `TodoService.calculateDueStatus(todo)` or `TodoService.validatePriorityRules()`

### Business Logic Handlers

- **What they do**: Orchestrate services, coordinate between layers, handle application flow
- **What they don't do**: Contain core business rules (delegate to services)
- **Example**: AddTodoHandler that validates input → calls TodoService → calls Repository → returns formatted response

## In Your Current Code:

```typescript
// This is mixed - handler + service logic together
if (trimmedInput.startsWith('/add ')) {
  const addArgs = trimmedInput.substring(5).trim();
  // Input parsing (handler concern)
  const { title, flags } = parseArgs(addArgs);

  // Business logic (service concern)
  const newTodo = todoService.createTodo(title, options);

  // Persistence (repository concern)
  listService.addTodoToCurrentList(newTodo);

  // Response formatting (handler concern)
  console.log(`✓ Added "${newTodo.title}"`);
}
```

## Better Separation:

```typescript
// handlers/AddTodoHandler.ts
export class AddTodoHandler {
  constructor(
    private todoService: TodoService,
    private listService: ListService
  ) {}

  async handle(input: string): Promise<void> {
    const { title, options } = this.parseInput(input);  // Handler responsibility
    const todo = await this.todoService.createTodo(title, options);  // Delegate to service
    await this.listService.addTodo(todo);  // Delegate to service
    this.formatResponse(todo);  // Handler responsibility
  }
}

// services/TodoService.ts
export class TodoService {
  createTodo(title: string, options: TodoOptions): TodoItem {
    // Pure business logic: validation, rules, domain logic
    this.validateTitle(title);
    this.validatePriority(options.priority);

    return {
      id: this.generateId(),
      title: this.sanitizeTitle(title),
      // ... business rules for todo creation
    };
  }
}
```

**Key insight**: Services should be testable in isolation without knowing about CLI, web requests, or databases. Handlers orchestrate the flow but don't contain business rules.