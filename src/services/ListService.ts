import { TodoList, TodoItem } from '../types';
import { DatabaseService } from './DatabaseService';
import { v4 as uuidv4 } from 'uuid';

export class ListService {
  private lists: TodoList[] = [];
  private currentListId: string | null = null;
  private db: DatabaseService;

  constructor(db: DatabaseService) {
    this.db = db;
  }

  initialize(): void {
    this.db.initialize();
    this.loadLists();
    
    // Auto-create Personal list if no lists exist
    if (this.lists.length === 0) {
      this.createList('Personal');
    }
  }

  private loadLists(): void {
    this.lists = this.db.getAllLists();
    
    // Set current list to first available if none set
    if (this.currentListId === null && this.lists.length > 0) {
      this.currentListId = this.lists[0].id;
    }
  }

  createList(name: string): TodoList {
    const newList: TodoList = {
      id: uuidv4(),
      name,
      todos: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.db.createList(name, newList.id);
    this.lists.push(newList);
    
    // Set as current if it's the first list
    if (this.currentListId === null) {
      this.currentListId = newList.id;
    }

    return newList;
  }

  getAllLists(): TodoList[] {
    return this.lists;
  }

  getCurrentList(): TodoList | null {
    if (!this.currentListId) return null;
    return this.lists.find(list => list.id === this.currentListId) || null;
  }

  setCurrentList(listId: string): boolean {
    const list = this.lists.find(l => l.id === listId);
    if (list) {
      this.currentListId = listId;
      return true;
    }
    return false;
  }

  setCurrentListByName(name: string): boolean {
    const list = this.lists.find(l => l.name.toLowerCase() === name.toLowerCase());
    if (list) {
      this.currentListId = list.id;
      return true;
    }
    return false;
  }

  findListByName(name: string): TodoList | null {
    return this.lists.find(l => l.name.toLowerCase() === name.toLowerCase()) || null;
  }

  addTodoToCurrentList(todo: TodoItem): void {
    const currentList = this.getCurrentList();
    if (!currentList) throw new Error('No current list selected');
    
    this.db.createTodo(todo, currentList.id);
    currentList.todos.push(todo);
  }

  updateTodoInCurrentList(todo: TodoItem): void {
    this.db.updateTodo(todo);
    // The todo object is already updated by reference in the list
  }

  deleteTodoFromCurrentList(todoId: string): void {
    const currentList = this.getCurrentList();
    if (!currentList) throw new Error('No current list selected');
    
    this.db.deleteTodo(todoId);
    
    const index = currentList.todos.findIndex(t => t.id === todoId);
    if (index >= 0) {
      currentList.todos.splice(index, 1);
    }
  }

  clearCurrentList(): void {
    const currentList = this.getCurrentList();
    if (!currentList) throw new Error('No current list selected');
    
    this.db.clearList(currentList.id);
    currentList.todos = [];
  }

  deleteList(listId: string): boolean {
    const index = this.lists.findIndex(l => l.id === listId);
    if (index === -1) return false;

    // Delete from database
    this.db.deleteList(listId);

    // Remove from in-memory list
    this.lists.splice(index, 1);
    
    // If we deleted the current list, switch to first available or null
    if (this.currentListId === listId) {
      this.currentListId = this.lists.length > 0 ? this.lists[0].id : null;
    }

    return true;
  }
}