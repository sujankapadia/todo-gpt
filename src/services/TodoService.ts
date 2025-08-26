import { TodoItem } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class TodoService {
  
  createTodo(title: string, options: {
    description?: string;
    dueDate?: Date;
    priority?: 'high' | 'medium' | 'low';
    categories?: string[];
    tags?: string[];
  } = {}): TodoItem {
    return {
      id: uuidv4(),
      title,
      description: options.description,
      dueDate: options.dueDate,
      priority: options.priority,
      completed: false,
      categories: options.categories,
      tags: options.tags,
      subtasks: [],
      dependencies: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  addTodoToList(todos: TodoItem[], title: string, options?: {
    description?: string;
    dueDate?: Date;
    priority?: 'high' | 'medium' | 'low';
    categories?: string[];
    tags?: string[];
  }): TodoItem {
    const newTodo = this.createTodo(title, options);
    todos.push(newTodo);
    return newTodo;
  }

  findTodoById(todos: TodoItem[], todoId: string): TodoItem | null {
    return todos.find(todo => todo.id === todoId) || null;
  }

  findTodoByTitle(todos: TodoItem[], title: string): TodoItem | null {
    return todos.find(todo => 
      todo.title.toLowerCase().includes(title.toLowerCase())
    ) || null;
  }

  findTodoByShortId(todos: TodoItem[], shortId: string): TodoItem | null {
    if (!shortId || shortId.length < 8) return null;
    return todos.find(todo => todo.id.startsWith(shortId.toLowerCase())) || null;
  }

  resolveTodoReference(todos: TodoItem[], reference: {
    shortId?: string;
    todoNumber?: number;
    confirmTitle?: string;
  }): { todo: TodoItem | null; error?: string } {
    let todo: TodoItem | null = null;

    // Try shortId first (preferred method)
    if (reference.shortId) {
      todo = this.findTodoByShortId(todos, reference.shortId);
      if (!todo) {
        return { todo: null, error: `No todo found with shortId: ${reference.shortId}` };
      }
    }
    // Fall back to position-based (legacy support)
    else if (reference.todoNumber !== undefined) {
      const todoIndex = reference.todoNumber - 1;
      if (todoIndex < 0 || todoIndex >= todos.length) {
        return { todo: null, error: `Invalid todo number: ${reference.todoNumber}` };
      }
      todo = todos[todoIndex];
    }
    else {
      return { todo: null, error: 'No todo identifier provided (shortId or todoNumber required)' };
    }

    // Verify with confirmTitle if provided (safety check)
    if (reference.confirmTitle && todo) {
      if (!todo.title.toLowerCase().includes(reference.confirmTitle.toLowerCase())) {
        return { 
          todo: null, 
          error: `Title mismatch: expected "${reference.confirmTitle}", found "${todo.title}"` 
        };
      }
    }

    return { todo };
  }

  completeTodo(todos: TodoItem[], todoId: string): boolean {
    const todo = this.findTodoById(todos, todoId);
    if (todo) {
      todo.completed = true;
      todo.updatedAt = new Date();
      return true;
    }
    return false;
  }

  uncompleteTodo(todos: TodoItem[], todoId: string): boolean {
    const todo = this.findTodoById(todos, todoId);
    if (todo) {
      todo.completed = false;
      todo.updatedAt = new Date();
      return true;
    }
    return false;
  }

  deleteTodo(todos: TodoItem[], todoId: string): boolean {
    const index = todos.findIndex(todo => todo.id === todoId);
    if (index >= 0) {
      todos.splice(index, 1);
      return true;
    }
    return false;
  }

  updateTodo(todos: TodoItem[], todoId: string, updates: Partial<TodoItem>): boolean {
    const todo = this.findTodoById(todos, todoId);
    if (todo) {
      Object.assign(todo, updates, { updatedAt: new Date() });
      return true;
    }
    return false;
  }

  getActiveTodos(todos: TodoItem[]): TodoItem[] {
    return todos.filter(todo => !todo.completed);
  }

  getCompletedTodos(todos: TodoItem[]): TodoItem[] {
    return todos.filter(todo => todo.completed);
  }

  formatTodoForDisplay(todo: TodoItem): string {
    const completedIcon = todo.completed ? '✓' : '○';
    const priorityIcon = todo.priority === 'high' ? '🔴' : 
                        todo.priority === 'medium' ? '🟡' : 
                        todo.priority === 'low' ? '🟢' : '';
    
    let display = `${completedIcon} ${todo.title}`;
    
    if (priorityIcon) {
      display = `${priorityIcon} ${display}`;
    }
    
    if (todo.dueDate && !isNaN(todo.dueDate.getTime())) {
      const dateStr = todo.dueDate.toLocaleDateString();
      display += ` (due: ${dateStr})`;
    }
    
    if (todo.categories && todo.categories.length > 0) {
      display += ` [${todo.categories.join(', ')}]`;
    }
    
    if (todo.description) {
      display += ` - ${todo.description}`;
    }
    
    return display;
  }
}