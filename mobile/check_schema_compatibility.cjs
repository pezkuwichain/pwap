/**
 * Check Schema Compatibility
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vsyrpfiwhjvahofxwytr.supabase.co';
const supabaseServiceKey = 'sb_secret_oXy8Diay2J_u8dKPZLxdcQ_hq69Mrb6';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Expected schemas for mobile app
const expectedSchemas = {
  forum_categories: ['id', 'name', 'description', 'icon', 'created_at'],
  forum_discussions: ['id', 'category_id', 'author_address', 'author_name', 'title', 'content', 'likes', 'replies_count', 'created_at', 'updated_at'],
  forum_replies: ['id', 'discussion_id', 'author_address', 'author_name', 'content', 'likes', 'created_at'],
  notifications: ['id', 'user_address', 'type', 'title', 'message', 'read', 'metadata', 'created_at'],
};

async function checkSchema(tableName, expectedColumns) {
  console.log(`\n🔍 Checking ${tableName}...`);

  try {
    // Try to select from table with expected columns
    const selectQuery = expectedColumns.map(col => `${col}`).join(', ');
    const { data, error } = await supabase
      .from(tableName)
      .select(selectQuery)
      .limit(1);

    if (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
      console.log(`   ⚠️  Schema might be incompatible`);
      return { compatible: false, error: error.message };
    }

    console.log(`   ✅ COMPATIBLE - All expected columns found`);
    return { compatible: true };

  } catch (e) {
    console.log(`   ❌ ERROR: ${e.message}`);
    return { compatible: false, error: e.message };
  }
}

async function checkAllSchemas() {
  console.log('=' .repeat(70));
  console.log('📋 SCHEMA COMPATIBILITY CHECK');
  console.log('='.repeat(70));

  const results = {};

  for (const [tableName, columns] of Object.entries(expectedSchemas)) {
    results[tableName] = await checkSchema(tableName, columns);
  }

  console.log('\n' + '='.repeat(70));
  console.log('📊 SUMMARY:');
  console.log('='.repeat(70));

  const compatible = Object.entries(results).filter(([_, r]) => r.compatible);
  const incompatible = Object.entries(results).filter(([_, r]) => !r.compatible);

  if (compatible.length > 0) {
    console.log(`\n✅ ${compatible.length} table(s) are COMPATIBLE:\n`);
    compatible.forEach(([table]) => {
      console.log(`   ✅ ${table}`);
    });
  }

  if (incompatible.length > 0) {
    console.log(`\n⚠️  ${incompatible.length} table(s) have ISSUES:\n`);
    incompatible.forEach(([table, result]) => {
      console.log(`   ❌ ${table}`);
      console.log(`      Error: ${result.error}`);
    });

    console.log('\n🔧 RECOMMENDED ACTIONS:\n');
    incompatible.forEach(([table]) => {
      console.log(`   ${table}:`);
      console.log(`   1. Check column names and types`);
      console.log(`   2. Add missing columns with ALTER TABLE`);
      console.log(`   3. Or drop and recreate (data will be lost!)\n`);
    });
  }

  console.log('='.repeat(70));
  console.log('\n🎯 FINAL RECOMMENDATION:\n');

  if (incompatible.length === 0) {
    console.log('   ✅ All existing tables are compatible');
    console.log('   ✅ Safe to run SUPABASE_SCHEMA.sql');
    console.log('   ✅ Only missing tables will be created\n');
  } else {
    console.log('   ⚠️  Some tables have schema issues');
    console.log('   ⚠️  Fix schemas before running mobile app');
    console.log('   ✅ You can still run SQL (it will skip existing tables)\n');
  }
}

checkAllSchemas().then(() => {
  console.log('✅ Schema check complete\n');
  process.exit(0);
}).catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
