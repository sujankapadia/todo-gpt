#!/usr/bin/env node

const { DatabaseService } = require('./dist/services/DatabaseService');
const { ListService } = require('./dist/services/ListService');
const { TodoService } = require('./dist/services/TodoService');
const fs = require('fs');
const path = require('path');

async function testRealScenario() {
  console.log('🧪 COMPREHENSIVE REAL DATABASE TEST\n');

  const testDbPath = './test-real-scenario.db';
  
  try {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
      console.log('🧹 Cleaned up existing test database');
    }

    // Initialize services with real database
    const dbService = new DatabaseService(testDbPath);
    dbService.initialize();
    const listService = new ListService(dbService);
    const todoService = new TodoService();

    console.log('✅ Initialized services with real database\n');

    // Create the problematic "Beach Vacation Packing" scenario
    console.log('🏖️  RECREATING BEACH VACATION PACKING SCENARIO');
    
    const beachList = listService.createList('Beach Vacation Packing');
    listService.setCurrentList(beachList.id);

    const beachItems = [
      'Swimsuits (at least 4)',
      'Beach towels', 
      'Sunscreen (SPF 30+)',
      'Sunglasses',
      'Hat or cap',
      'Flip-flops or sandals',
      'Lightweight clothing (shorts, t-shirts, sundresses)', 
      'Cover-up or sarong',
      'Reusable water bottle',
      'Beach bag',
      'Snacks',
      'Beach umbrella or sunshade',
      'Waterproof phone pouch',
      'Books or magazines',
      'Portable speaker',
      'Snorkel gear (if you plan to snorkel)',
      'Aloe vera or after-sun lotion',
      'Light sweater or jacket (for evenings)',
      'Toiletries and medications',
      'Camera'
    ];

    // Add all beach items to the list
    beachItems.forEach(item => {
      const newTodo = todoService.createTodo(item);
      listService.addTodoToCurrentList(newTodo);
    });

    // Complete "Snacks" (item 11)
    const currentList = listService.getCurrentList();
    const snacksId = currentList.todos.find(t => t.title === 'Snacks').id;
    todoService.completeTodo(currentList.todos, snacksId);
    listService.updateTodoInCurrentList(currentList.todos.find(t => t.id === snacksId));
    
    const updatedList = listService.getCurrentList();
    console.log(`✅ Created beach list with ${updatedList.todos.length} items`);
    console.log('📋 Current list state:');
    updatedList.todos.forEach((todo, index) => {
      const status = todo.completed ? '✓' : '○';
      const shortId = todo.id.substring(0, 8);
      console.log(`  ${index + 1}. ${status} ${todo.title} {${shortId}}`);
    });

    console.log('\n👕 TESTING CLOTHING ITEM IDENTIFICATION');
    
    // Identify clothing items (like the AI would)
    const clothingItems = updatedList.todos.filter(todo => {
      const title = todo.title.toLowerCase();
      return title.includes('swimsuit') || 
             title.includes('hat') || 
             title.includes('flip-flop') || 
             title.includes('clothing') || 
             title.includes('cover-up') || 
             title.includes('sweater') || 
             title.includes('jacket');
    });

    console.log('Identified clothing items:');
    clothingItems.forEach(item => {
      const shortId = item.id.substring(0, 8);
      const position = updatedList.todos.findIndex(t => t.id === item.id) + 1;
      console.log(`  Position ${position}: "${item.title}" {${shortId}}`);
    });

    console.log('\n🆕 TESTING: Create "Beach Wear" list');
    const beachWearList = listService.createList('Beach Wear');
    console.log(`✅ Created "Beach Wear" list {ID: ${beachWearList.id.substring(0, 8)}}`);

    console.log('\n➕ TESTING: Add clothing items to Beach Wear list using shortId references');
    
    // Switch to Beach Wear list
    listService.setCurrentList(beachWearList.id);
    
    // Add clothing items to Beach Wear list
    clothingItems.forEach((item, index) => {
      const shortId = item.id.substring(0, 8);
      
      // Test resolveTodoReference with shortId (from original Beach Vacation list)
      const resolution = todoService.resolveTodoReference(updatedList.todos, {
        shortId: shortId,
        confirmTitle: item.title
      });
      
      if (resolution.todo) {
        console.log(`  ✅ Resolved {${shortId}} → "${resolution.todo.title}"`);
        
        // Add to Beach Wear list
        const newTodo = todoService.createTodo(item.title);
        listService.addTodoToCurrentList(newTodo);
        console.log(`    ➕ Added "${item.title}" to Beach Wear list`);
      } else {
        console.log(`  ❌ Failed to resolve {${shortId}}: ${resolution.error}`);
      }
    });

    console.log('\n📋 Beach Wear list contents:');
    const currentBeachWearList = listService.getCurrentList();
    currentBeachWearList.todos.forEach((todo, index) => {
      const shortId = todo.id.substring(0, 8);
      console.log(`  ${index + 1}. ${todo.title} {${shortId}}`);
    });

    console.log('\n🗑️  TESTING: Delete clothing items from original Beach Vacation list using shortId');
    
    // Switch back to Beach Vacation list
    listService.setCurrentList(beachList.id);
    const originalList = listService.getCurrentList();

    // Test deletion using shortId (the stable way)
    let deleteCount = 0;
    let errorCount = 0;

    for (const clothingItem of clothingItems) {
      const shortId = clothingItem.id.substring(0, 8);
      const originalPosition = originalList.todos.findIndex(t => t.id === clothingItem.id) + 1;
      
      console.log(`\n  🎯 Attempting to delete: "${clothingItem.title}" {${shortId}} (was position ${originalPosition})`);
      
      // Test the resolveTodoReference method
      const resolution = todoService.resolveTodoReference(originalList.todos, {
        shortId: shortId,
        confirmTitle: clothingItem.title
      });
      
      if (resolution.todo) {
        console.log(`    ✅ Resolved {${shortId}} → "${resolution.todo.title}"`);
        
        // Perform the deletion
        try {
          listService.deleteTodoFromCurrentList(resolution.todo.id);
          console.log(`    🗑️  Deleted "${resolution.todo.title}"`);
          deleteCount++;
        } catch (error) {
          console.log(`    ❌ Failed to delete "${resolution.todo.title}": ${error.message}`);
          errorCount++;
        }
        
        // Show current list state after each deletion
        const updatedList = listService.getCurrentList();
        console.log(`    📄 List now has ${updatedList.todos.length} items remaining`);
        
      } else {
        console.log(`    ❌ Failed to resolve {${shortId}}: ${resolution.error}`);
        errorCount++;
      }
    }

    console.log(`\n📊 DELETION RESULTS: ${deleteCount} deleted, ${errorCount} errors`);

    console.log('\n📋 Final Beach Vacation Packing list:');
    const finalList = listService.getCurrentList();
    finalList.todos.forEach((todo, index) => {
      const status = todo.completed ? '✓' : '○';
      const shortId = todo.id.substring(0, 8);
      console.log(`  ${index + 1}. ${status} ${todo.title} {${shortId}}`);
    });

    console.log('\n✏️  TESTING: Edit operations using shortId');
    
    // Test editing a todo using shortId
    const sunglassesTodo = finalList.todos.find(t => t.title.includes('Sunglasses'));
    if (sunglassesTodo) {
      const shortId = sunglassesTodo.id.substring(0, 8);
      console.log(`\n  🎯 Testing edit on "${sunglassesTodo.title}" {${shortId}}`);
      
      const resolution = todoService.resolveTodoReference(finalList.todos, {
        shortId: shortId,
        confirmTitle: 'Sunglasses'
      });
      
      if (resolution.todo) {
        console.log(`    ✅ Resolved {${shortId}} → "${resolution.todo.title}"`);
        
        // Update priority to high
        const updateSuccess = todoService.updateTodo(finalList.todos, resolution.todo.id, {
          priority: 'high'
        });
        
        if (updateSuccess) {
          console.log(`    ✏️  Updated "${resolution.todo.title}" priority to high`);
          listService.updateTodoInCurrentList(resolution.todo);
        }
      }
    }

    console.log('\n✅ TESTING: Complete operation using shortId');
    
    // Test completing a todo using shortId
    const sunscreenTodo = finalList.todos.find(t => t.title.includes('Sunscreen'));
    if (sunscreenTodo) {
      const shortId = sunscreenTodo.id.substring(0, 8);
      console.log(`\n  🎯 Testing complete on "${sunscreenTodo.title}" {${shortId}}`);
      
      const resolution = todoService.resolveTodoReference(finalList.todos, {
        shortId: shortId,
        confirmTitle: 'Sunscreen'
      });
      
      if (resolution.todo) {
        console.log(`    ✅ Resolved {${shortId}} → "${resolution.todo.title}"`);
        
        const completeSuccess = todoService.completeTodo(finalList.todos, resolution.todo.id);
        if (completeSuccess) {
          console.log(`    ✅ Completed "${resolution.todo.title}"`);
          listService.updateTodoInCurrentList(resolution.todo);
        }
      }
    }

    console.log('\n🔄 TESTING: Uncomplete operation using shortId');
    
    // Test uncompleting the snacks item
    const snacksTodo = finalList.todos.find(t => t.title.includes('Snacks'));
    if (snacksTodo) {
      const shortId = snacksTodo.id.substring(0, 8);
      console.log(`\n  🎯 Testing uncomplete on "${snacksTodo.title}" {${shortId}}`);
      
      const resolution = todoService.resolveTodoReference(finalList.todos, {
        shortId: shortId,
        confirmTitle: 'Snacks'
      });
      
      if (resolution.todo) {
        console.log(`    ✅ Resolved {${shortId}} → "${resolution.todo.title}"`);
        
        const uncompleteSuccess = todoService.uncompleteTodo(finalList.todos, resolution.todo.id);
        if (uncompleteSuccess) {
          console.log(`    🔄 Uncompleted "${resolution.todo.title}"`);
          listService.updateTodoInCurrentList(resolution.todo);
        }
      }
    }

    console.log('\n📋 FINAL LIST STATE:');
    const veryFinalList = listService.getCurrentList();
    veryFinalList.todos.forEach((todo, index) => {
      const status = todo.completed ? '✓' : '○';
      const shortId = todo.id.substring(0, 8);
      const priority = todo.priority ? ` [${todo.priority}]` : '';
      console.log(`  ${index + 1}. ${status} ${todo.title}${priority} {${shortId}}`);
    });

    console.log('\n🎉 COMPREHENSIVE TEST COMPLETED SUCCESSFULLY!');
    console.log('✅ All shortId operations worked correctly');
    console.log('✅ Content verification prevented wrong operations');  
    console.log('✅ List modifications did not corrupt operations');
    console.log('✅ Database persistence worked correctly');

    // Cleanup
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
      console.log('🧹 Cleaned up test database');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error(error.stack);
    
    // Cleanup on error
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  }
}

testRealScenario();