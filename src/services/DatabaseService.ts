import Database from 'better-sqlite3';
import { TodoList, TodoItem } from '../types';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

export class DatabaseService {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(dbPath?: string) {
    // Default to ~/.todo-gpt/data.db if not specified
    this.dbPath = dbPath || path.join(os.homedir(), '.todo-gpt', 'data.db');
    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists(): void {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  initialize(): void {
    this.db = new Database(this.dbPath);
    this.createTables();
  }

  private createTables(): void {
    if (!this.db) throw new Error('Database not initialized');

    // Create lists table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS lists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create todos table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS todos (
        id TEXT PRIMARY KEY,
        list_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        due_date DATETIME,
        priority TEXT CHECK(priority IN ('high', 'medium', 'low')),
        completed BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(list_id) REFERENCES lists(id) ON DELETE CASCADE
      )
    `);

    // Create todos_categories table for many-to-many relationship
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS todo_categories (
        todo_id TEXT NOT NULL,
        category TEXT NOT NULL,
        PRIMARY KEY(todo_id, category),
        FOREIGN KEY(todo_id) REFERENCES todos(id) ON DELETE CASCADE
      )
    `);

    // Create todos_tags table for many-to-many relationship
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS todo_tags (
        todo_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        PRIMARY KEY(todo_id, tag),
        FOREIGN KEY(todo_id) REFERENCES todos(id) ON DELETE CASCADE
      )
    `);
  }

  getAllLists(): TodoList[] {
    if (!this.db) throw new Error('Database not initialized');

    // Get all lists first
    const lists = this.db.prepare(`
      SELECT id, name, created_at, updated_at 
      FROM lists 
      ORDER BY created_at
    `).all() as any[];

    // Load categories for all todos once
    const allCategories = this.db.prepare(`
      SELECT todo_id, GROUP_CONCAT(category) as categories 
      FROM todo_categories 
      GROUP BY todo_id
    `).all() as any[];
    
    const categoryMap = new Map<string, string[]>();
    allCategories.forEach((row: any) => {
      categoryMap.set(row.todo_id, row.categories.split(','));
    });

    // For each list, get its todos
    return lists.map((listRow: any) => {
      const todos = this.getTodosForList(listRow.id, categoryMap);
      
      return {
        id: listRow.id,
        name: listRow.name,
        createdAt: new Date(listRow.created_at),
        updatedAt: new Date(listRow.updated_at),
        todos: todos
      };
    });
  }

  private getTodosForList(listId: string, categoryMap: Map<string, string[]>): TodoItem[] {
    if (!this.db) throw new Error('Database not initialized');

    const todos = this.db.prepare(`
      SELECT id, title, description, due_date, priority, completed, created_at, updated_at
      FROM todos 
      WHERE list_id = ?
      ORDER BY created_at
    `).all(listId) as any[];

    return todos.map((todo: any) => ({
      id: todo.id,
      title: todo.title,
      description: todo.description || undefined,
      dueDate: todo.due_date ? new Date(todo.due_date) : undefined,
      priority: todo.priority || undefined,
      completed: todo.completed === 1,
      categories: categoryMap.get(todo.id) || [],
      tags: [], // TODO: Load from junction table
      subtasks: [], // TODO: Implement subtasks
      dependencies: [], // TODO: Implement dependencies
      createdAt: new Date(todo.created_at),
      updatedAt: new Date(todo.updated_at)
    }));
  }


  createList(name: string, id: string): void {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT INTO lists (id, name, created_at, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    stmt.run(id, name);
  }

  createTodo(todo: TodoItem, listId: string): void {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      INSERT INTO todos (id, list_id, title, description, due_date, priority, completed, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      todo.id,
      listId,
      todo.title,
      todo.description || null,
      todo.dueDate ? todo.dueDate.toISOString() : null,
      todo.priority || null,
      todo.completed ? 1 : 0,
      todo.createdAt.toISOString(),
      todo.updatedAt.toISOString()
    );
    
    // Insert categories if any
    if (todo.categories && todo.categories.length > 0) {
      const categoryStmt = this.db.prepare(`
        INSERT INTO todo_categories (todo_id, category) VALUES (?, ?)
      `);
      for (const category of todo.categories) {
        categoryStmt.run(todo.id, category);
      }
    }
  }

  updateTodo(todo: TodoItem): void {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`
      UPDATE todos 
      SET title = ?, description = ?, due_date = ?, priority = ?, completed = ?, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(
      todo.title,
      todo.description || null,
      todo.dueDate ? todo.dueDate.toISOString() : null,
      todo.priority || null,
      todo.completed ? 1 : 0,
      todo.updatedAt.toISOString(),
      todo.id
    );
    
    // Update categories - first delete existing, then insert new ones
    const deleteCategoriesStmt = this.db.prepare(`DELETE FROM todo_categories WHERE todo_id = ?`);
    deleteCategoriesStmt.run(todo.id);
    
    if (todo.categories && todo.categories.length > 0) {
      const categoryStmt = this.db.prepare(`
        INSERT INTO todo_categories (todo_id, category) VALUES (?, ?)
      `);
      for (const category of todo.categories) {
        categoryStmt.run(todo.id, category);
      }
    }
  }

  deleteTodo(todoId: string): void {
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(`DELETE FROM todos WHERE id = ?`);
    stmt.run(todoId);
  }

  clearList(listId: string): void {
    if (!this.db) throw new Error('Database not initialized');

    // Delete all todo categories for todos in this list
    const deleteCategoriesStmt = this.db.prepare(`
      DELETE FROM todo_categories 
      WHERE todo_id IN (SELECT id FROM todos WHERE list_id = ?)
    `);
    deleteCategoriesStmt.run(listId);

    // Delete all todos in the list
    const deleteTodosStmt = this.db.prepare(`DELETE FROM todos WHERE list_id = ?`);
    deleteTodosStmt.run(listId);
  }

  deleteList(listId: string): void {
    if (!this.db) throw new Error('Database not initialized');

    // First clear all todos in the list (including their categories)
    this.clearList(listId);

    // Then delete the list itself
    const deleteListStmt = this.db.prepare(`DELETE FROM lists WHERE id = ?`);
    deleteListStmt.run(listId);
  }

  close(): void {
    if (this.db) {
      this.db.close();
    }
  }
}