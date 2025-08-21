import { z } from "zod";

// Base schemas for reuse
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format").nullable();
const Priority = z.enum(["high", "medium", "low"]).nullable();
const Categories = z.array(z.string().min(1)).min(1).nullable();

// Individual command schemas
const AddTodo = z.object({
  action: z.literal("add_todo"),
  title: z.string().min(1),
  description: z.string().nullable(),
  priority: Priority,
  dueDate: IsoDate,
  categories: Categories
});

const AddMultipleTodos = z.object({
  action: z.literal("add_multiple_todos"),
  items: z.array(z.object({
    title: z.string().min(1),
    description: z.string().nullable(),
    priority: Priority,
    dueDate: IsoDate,
    categories: Categories
  })).min(1)
});

const CompleteTodo = z.object({
  action: z.literal("complete_todo"),
  todoNumber: z.number().int().min(1)
});

const UncompleteTodo = z.object({
  action: z.literal("uncomplete_todo"),
  todoNumber: z.number().int().min(1)
});

const CreateList = z.object({
  action: z.literal("create_list"),
  name: z.string().min(1)
});

const SwitchList = z.object({
  action: z.literal("switch_list"),
  name: z.string().min(1)
});

const DeleteTodo = z.object({
  action: z.literal("delete_todo"),
  todoNumber: z.number().int().min(1)
});

const ListTodos = z.object({
  action: z.literal("list_todos"),
  filter: z.object({
    status: z.enum(["all", "completed", "incomplete"]).nullable(),
    priority: Priority,
    category: z.string().min(1).nullable(),
    dueOn: IsoDate,
    dueBefore: IsoDate,
    dueAfter: IsoDate,
    query: z.string().nullable()
  }).nullable()
});

const EditTodo = z.object({
  action: z.literal("edit_todo"),
  todoNumber: z.number().int().min(1),
  title: z.string().min(1).nullable(),
  description: z.string().nullable(),
  priority: Priority,
  dueDate: IsoDate,
  categories: Categories
});

const CommandSequence = z.object({
  action: z.literal("command_sequence"),
  description: z.string().nullable(),
  commands: z.array(z.union([
    AddTodo,
    AddMultipleTodos,
    CompleteTodo,
    UncompleteTodo,
    CreateList,
    SwitchList,
    DeleteTodo,
    ListTodos,
    EditTodo
  ])).min(1).max(10)
});

// Enhanced EditTodo with validation (for use when not in discriminated union)
const EditTodoWithValidation = EditTodo.refine(data => 
  data.title !== null || 
  data.description !== null || 
  data.priority !== null || 
  data.dueDate !== null || 
  data.categories !== null,
  { message: "At least one field to edit must be provided" }
);

// Main discriminated union for all commands
export const TodoCommand = z.discriminatedUnion("action", [
  AddTodo,
  AddMultipleTodos,
  CompleteTodo,
  UncompleteTodo,
  CreateList,
  SwitchList,
  DeleteTodo,
  ListTodos,
  EditTodo,
  CommandSequence
]);

// Enhanced version with additional validation
export const TodoCommandWithValidation = TodoCommand.refine((data) => {
  if (data.action === "edit_todo") {
    return data.title !== null || 
           data.description !== null || 
           data.priority !== null || 
           data.dueDate !== null || 
           data.categories !== null;
  }
  return true;
}, { message: "Edit todo must have at least one field to edit" });

// Export type for TypeScript usage
export type TodoCommandType = z.infer<typeof TodoCommand>;

// Export individual schemas if needed
export {
  AddTodo,
  AddMultipleTodos,
  CompleteTodo,
  UncompleteTodo,
  CreateList,
  SwitchList,
  DeleteTodo,
  ListTodos,
  EditTodo,
  CommandSequence,
  Priority,
  IsoDate,
  Categories
};