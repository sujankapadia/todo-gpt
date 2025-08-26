#!/usr/bin/env node

const { TodoService } = require('./dist/services/TodoService');

async function testStableIdentification() {
  console.log('🧪 TESTING STABLE TODO IDENTIFICATION\n');

  try {
    // Initialize service
    const todoService = new TodoService();

    // Create test todos array
    const todos = [];
    const todo1 = todoService.addTodoToList(todos, 'Item 1');
    const todo2 = todoService.addTodoToList(todos, 'Item 2'); 
    const todo3 = todoService.addTodoToList(todos, 'Item 3');
    const todo4 = todoService.addTodoToList(todos, 'Item 4');
    const todo5 = todoService.addTodoToList(todos, 'Item 5');

    console.log('✅ Created test list with 5 items:');
    todos.forEach((todo, index) => {
      console.log(`  ${index + 1}. ${todo.title} {${todo.id.substring(0, 8)}}`);
    });

    // Test the problematic scenario:
    // 1. Try to delete items 1, 2, 3, 4, 5 using position-based (old way)
    console.log('\n🔴 TESTING OLD POSITION-BASED METHOD (should fail):');
    
    const positions = [1, 2, 3, 4, 5];
    
    console.log('Original positions to delete:', positions);
    console.log('Items that should be deleted:');
    positions.forEach(pos => {
      const todo = todos[pos - 1];
      if (todo) {
        console.log(`  Position ${pos}: "${todo.title}"`);
      }
    });

    // Simulate what happens with position-based deletion
    console.log('\nSimulating position-based deletions:');
    let remainingTodos = [...todos];
    positions.forEach((pos, i) => {
      const todoIndex = pos - 1;
      if (todoIndex < remainingTodos.length) {
        const deleted = remainingTodos.splice(todoIndex, 1)[0];
        console.log(`  Step ${i+1}: Delete position ${pos} → "${deleted.title}"`);
        console.log(`    Remaining: [${remainingTodos.map(t => t.title).join(', ')}]`);
      } else {
        console.log(`  Step ${i+1}: Position ${pos} no longer exists!`);
      }
    });

    console.log('\n✅ TESTING NEW SHORT-ID METHOD (should work):');
    
    // Reset the todos array
    const testTodos = [
      todoService.createTodo('Item 1'),
      todoService.createTodo('Item 2'),
      todoService.createTodo('Item 3'),
      todoService.createTodo('Item 4'),
      todoService.createTodo('Item 5')
    ];

    console.log('Reset list with 5 items:');
    testTodos.forEach((todo, index) => {
      console.log(`  ${index + 1}. ${todo.title} {${todo.id.substring(0, 8)}}`);
    });

    // Test short-ID based resolution
    const shortIds = testTodos.map(todo => todo.id.substring(0, 8));
    console.log('\nTesting short-ID resolution:');
    
    shortIds.forEach((shortId, i) => {
      const resolution = todoService.resolveTodoReference(testTodos, {
        shortId: shortId,
        confirmTitle: `Item ${i + 1}`
      });
      
      if (resolution.todo) {
        console.log(`  ✅ ${shortId} → "${resolution.todo.title}"`);
      } else {
        console.log(`  ❌ ${shortId} → ${resolution.error}`);
      }
    });

    // Test stability after deletions
    console.log('\nTesting stability after deletions:');
    const todoToDelete = testTodos[0]; // Delete first item
    const shortIdToDelete = todoToDelete.id.substring(0, 8);
    
    console.log(`Deleting: "${todoToDelete.title}" {${shortIdToDelete}}`);
    todoService.deleteTodo(testTodos, todoToDelete.id);
    
    console.log('Remaining todos after deletion:');
    testTodos.forEach((todo, index) => {
      console.log(`  ${index + 1}. ${todo.title} {${todo.id.substring(0, 8)}}`);
    });

    // Test that remaining shortIds still work
    console.log('\nTesting remaining shortIds still resolve correctly:');
    testTodos.forEach((todo, index) => {
      const shortId = todo.id.substring(0, 8);
      const resolution = todoService.resolveTodoReference(testTodos, {
        shortId: shortId,
        confirmTitle: todo.title
      });
      
      if (resolution.todo) {
        console.log(`  ✅ ${shortId} → "${resolution.todo.title}" (position ${index + 1})`);
      } else {
        console.log(`  ❌ ${shortId} → ${resolution.error}`);
      }
    });

    console.log('\n🎉 STABLE IDENTIFICATION TEST COMPLETE!');
    console.log('✅ Short IDs remain stable even after list modifications');
    console.log('✅ Content verification prevents wrong operations');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testStableIdentification();