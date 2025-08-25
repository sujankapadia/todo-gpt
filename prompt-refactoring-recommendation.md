# Prompt Refactoring Recommendation

## Problem Statement

I've noticed that both prompts (in `getChatSystemPrompt` and `parseNaturalLanguage`) are getting large and unwieldy. The current implementation has significant issues:

- **Duplication**: Similar examples and rules are repeated across prompts
- **Maintainability**: Changes require updating multiple locations
- **Size**: Prompts are becoming unwieldy (300+ lines each)
- **Testing**: Difficult to test individual prompt components
- **Flexibility**: Hard to customize prompts for different use cases

## Recommended Solution: Modular Prompt Architecture

### Architecture Overview

Create a `PromptBuilder` service with reusable components that can be mixed and matched for different prompt purposes.

```
src/services/prompts/
├── PromptBuilder.ts          # Main orchestrator
├── components/
│   ├── ContextComponent.ts   # Current list, date, todos formatting
│   ├── ActionsComponent.ts   # Available actions & schemas
│   ├── ExamplesComponent.ts  # Reusable examples by category
│   └── RulesComponent.ts     # Decision rules, parsing guidelines
└── templates/
    ├── ParsingTemplate.ts    # For parseNaturalLanguage
    └── ChatTemplate.ts       # For chat system prompt
```

### Component Breakdown

#### 1. ContextComponent
- Current list information
- Available lists
- Today's date
- Todo formatting for context
- Conversation history (for chat mode)

#### 2. ActionsComponent
- Available actions list
- JSON schemas for each action
- Action-specific instructions

#### 3. ExamplesComponent
Categories of examples:
- `'completion'` → "I bought groceries" → complete todo #3
- `'editing'` → "Make dentist high priority" → edit todo #2
- `'adding'` → "Add buy milk tomorrow"
- `'deletion'` → "Remove the Amazon task"
- `'multiple_todos'` → "I need to buy groceries, call dentist, finish report"
- `'reference_resolution'` → "Mark those as done", "complete what we discussed"

#### 4. RulesComponent
Rule categories:
- `'date_parsing'` → Guidelines for "today", "tomorrow", "next Monday"
- `'priority_rules'` → How to interpret "high priority", "urgent"
- `'reference_resolution'` → How to match user statements to specific todos
- `'decision_rules'` → When to return JSON vs conversational response

### Implementation Pattern

```typescript
class PromptBuilder {
  static forParsing(context: any): string {
    return [
      ContextComponent.render(context),
      ActionsComponent.render(['add_todo', 'complete_todo', 'edit_todo', 'delete_todo']),
      RulesComponent.render(['date_parsing', 'reference_resolution']),
      ExamplesComponent.render(['completion', 'editing', 'adding', 'deletion'])
    ].join('\n\n');
  }

  static forChat(context: any, conversationHistory: string[] = []): string {
    return [
      'You are a helpful AI assistant for a todo list application...',
      ContextComponent.render(context, conversationHistory),
      RulesComponent.render(['decision_rules', 'reference_resolution']),
      ActionsComponent.render(['add_todo', 'complete_todo', 'edit_todo', 'delete_todo', 'command_sequence']),
      ExamplesComponent.render(['completion', 'editing', 'adding', 'complex_operations'])
    ].join('\n\n');
  }
}
```

### Example Component Implementation

```typescript
class ExamplesComponent {
  private static examples = {
    completion: [
      '"I bought groceries" → {"action": "complete_todo", "todoNumber": 3}',
      '"Already returned Amazon package" → {"action": "complete_todo", "todoNumber": 4}',
      '"Finished going to the dentist" → {"action": "complete_todo", "todoNumber": 2}'
    ],
    editing: [
      '"Make dentist high priority" → {"action": "edit_todo", "todoNumber": 2, "priority": "high"}',
      '"Change deadline to tomorrow" → {"action": "edit_todo", "todoNumber": 1, "dueDate": "2025-08-15"}',
      '"Update Amazon return title" → {"action": "edit_todo", "todoNumber": 4, "title": "return Amazon package today"}'
    ]
  };

  static render(categories: string[]): string {
    return categories
      .map(cat => this.examples[cat]?.join('\n'))
      .filter(Boolean)
      .join('\n\n');
  }
}
```

## Benefits

### 1. DRY Principle
- Eliminate duplication between `parseNaturalLanguage` and `getChatSystemPrompt`
- Single source of truth for examples, rules, and schemas

### 2. Maintainability
- Update examples/rules in one place
- Clear separation of concerns
- Easier to add new action types or examples

### 3. Testability
- Unit test individual components
- Test prompt assembly logic separately
- Validate example format consistency

### 4. Flexibility
- Mix/match components for different use cases
- Easy to create specialized prompts (e.g., mobile-optimized, enterprise features)
- A/B test different prompt variations

### 5. Performance
- OpenAI can cache stable prompt segments
- Reduce token usage through better structure
- Keep variable context separate from static instructions

## Best Practices

1. **Caching Optimization**: Keep stable content at the top of prompts
2. **Separation**: Separate variable context from static instructions
3. **Versioning**: Version components for A/B testing and rollbacks
4. **Structure**: Use clear section headers and consistent formatting
5. **Documentation**: Document component purposes and usage patterns

## Migration Strategy

1. **Phase 1**: Extract existing examples into `ExamplesComponent`
2. **Phase 2**: Create `ContextComponent` and `ActionsComponent`
3. **Phase 3**: Build `PromptBuilder` and update service methods
4. **Phase 4**: Add comprehensive tests
5. **Phase 5**: Optimize for caching and performance

This modular approach will make prompt engineering much more manageable as the system grows and evolves.