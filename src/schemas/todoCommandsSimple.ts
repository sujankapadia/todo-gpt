import { z } from "zod";

// Simple schema that works with OpenAI structured output
export const TodoCommand = z.object({
  action: z.enum([
    "add_todo",
    "add_multiple_todos", 
    "complete_todo",
    "uncomplete_todo",
    "create_list",
    "switch_list",
    "delete_todo",
    "list_todos",
    "edit_todo",
    "command_sequence"
  ]),
  
  // Fields for add_todo and add_multiple_todos
  title: z.string().nullable(),
  description: z.string().nullable(),
  priority: z.enum(["high", "medium", "low"]).nullable(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  categories: z.array(z.string()).nullable(),
  
  // Field for add_multiple_todos
  items: z.array(z.object({
    title: z.string(),
    description: z.string().nullable(),
    priority: z.enum(["high", "medium", "low"]).nullable(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    categories: z.array(z.string()).nullable()
  })).nullable(),
  
  // Fields for todo operations (complete, edit, delete, uncomplete)
  todoNumber: z.number().int().min(1).nullable(),
  
  // Fields for list operations
  name: z.string().nullable(),
  
  // Field for list_todos filter
  filter: z.object({
    status: z.enum(["all", "completed", "incomplete"]).nullable(),
    priority: z.enum(["high", "medium", "low"]).nullable(),
    category: z.string().nullable(),
    dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    dueBefore: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    dueAfter: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    query: z.string().nullable()
  }).nullable(),
  
  // Field for command_sequence
  commands: z.array(z.object({
    action: z.enum([
      "add_todo",
      "add_multiple_todos", 
      "complete_todo",
      "uncomplete_todo",
      "create_list",
      "switch_list",
      "delete_todo",
      "list_todos",
      "edit_todo"
    ]),
    title: z.string().nullable(),
    description: z.string().nullable(),
    priority: z.enum(["high", "medium", "low"]).nullable(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    categories: z.array(z.string()).nullable(),
    items: z.array(z.object({
      title: z.string(),
      description: z.string().nullable(),
      priority: z.enum(["high", "medium", "low"]).nullable(),
      dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
      categories: z.array(z.string()).nullable()
    })).nullable(),
    todoNumber: z.number().int().min(1).nullable(),
    name: z.string().nullable(),
    filter: z.object({
      status: z.enum(["all", "completed", "incomplete"]).nullable(),
      priority: z.enum(["high", "medium", "low"]).nullable(),
      category: z.string().nullable(),
      dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
      dueBefore: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
      dueAfter: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
      query: z.string().nullable()
    }).nullable()
  })).nullable()
});

export type TodoCommandType = z.infer<typeof TodoCommand>;