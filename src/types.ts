export interface TodoItem {
  id: string;
  title: string;
  description?: string;
  dueDate?: Date;
  priority?: 'high' | 'medium' | 'low';
  completed: boolean;
  categories?: string[];
  tags?: string[];
  subtasks?: TodoItem[];
  dependencies?: string[]; // IDs of other todos
  createdAt: Date;
  updatedAt: Date;
}

export interface TodoList {
  id: string;
  name: string;
  todos: TodoItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AppState {
  lists: TodoList[];
  currentListId: string | null;
}