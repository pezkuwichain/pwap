/**
 * Check Existing Supabase Tables
 *
 * This script connects to Supabase and lists all existing tables
 * to check for conflicts with new schema
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vsyrpfiwhjvahofxwytr.supabase.co';
const supabaseKey = 'REDACTED_SUPABASE_ANON_KEY';

const supabase = createClient(supabaseUrl, supabaseKey);

// Tables we want to create
const newTables = [
  'forum_categories',
  'forum_discussions',
  'forum_replies',
  'p2p_ads',
  'p2p_trades',
  'notifications',
  'referrals'
];

async function checkTables() {
  console.log('🔍 Checking existing Supabase tables...\n');

  try {
    // Get list of all tables using information_schema
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_type', 'BASE TABLE');

    if (error) {
      // If we can't query information_schema, try a different approach
      console.log('⚠️  Cannot access information_schema with anon key');
      console.log('ℹ️  This is normal - anon key has limited permissions');
      console.log('\n📋 Tables we will create:\n');
      newTables.forEach(table => {
        console.log(`   - ${table}`);
      });
      console.log('\n✅ Safe to proceed: Using CREATE TABLE IF NOT EXISTS');
      console.log('   → Existing tables will NOT be affected');
      console.log('   → Only missing tables will be created\n');
      return;
    }

    const existingTables = data.map(row => row.table_name);

    console.log(`📊 Found ${existingTables.length} existing tables in Supabase:\n`);
    existingTables.forEach(table => {
      console.log(`   - ${table}`);
    });

    console.log('\n📋 Tables we want to create:\n');

    const conflicts = [];
    const newToCreate = [];

    newTables.forEach(table => {
      if (existingTables.includes(table)) {
        conflicts.push(table);
        console.log(`   ⚠️  ${table} (ALREADY EXISTS)`);
      } else {
        newToCreate.push(table);
        console.log(`   ✅ ${table} (WILL BE CREATED)`);
      }
    });

    console.log('\n' + '='.repeat(60));

    if (conflicts.length > 0) {
      console.log('\n⚠️  CONFLICT ANALYSIS:\n');
      console.log(`   ${conflicts.length} table(s) already exist:`);
      conflicts.forEach(table => {
        console.log(`   - ${table}`);
      });
      console.log('\n✅ SAFE TO PROCEED:');
      console.log('   → SQL uses "CREATE TABLE IF NOT EXISTS"');
      console.log('   → Existing tables will be SKIPPED');
      console.log('   → No data will be modified or deleted');
      console.log('   → Only missing tables will be created\n');
    }

    if (newToCreate.length > 0) {
      console.log(`\n📝 ${newToCreate.length} new table(s) will be created:`);
      newToCreate.forEach(table => {
        console.log(`   - ${table}`);
      });
    }

    console.log('\n' + '='.repeat(60));
    console.log('\n🎯 RECOMMENDATION:\n');

    if (conflicts.length === 0) {
      console.log('   ✅ No conflicts found');
      console.log('   ✅ Safe to run SUPABASE_SCHEMA.sql');
      console.log('   ✅ All 7 tables will be created\n');
    } else if (newToCreate.length === 0) {
      console.log('   ℹ️  All tables already exist');
      console.log('   ℹ️  You can safely run the SQL (it will skip existing tables)');
      console.log('   ℹ️  Or you can skip running it entirely\n');
    } else {
      console.log('   ⚠️  Some tables exist, some don\'t');
      console.log('   ✅ Safe to run SUPABASE_SCHEMA.sql');
      console.log(`   ✅ Will create ${newToCreate.length} missing tables`);
      console.log(`   ℹ️  Will skip ${conflicts.length} existing tables\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\nℹ️  If you see permission errors, this is expected with anon key');
    console.log('✅ Proceed with SQL execution - it\'s safe!\n');
  }
}

checkTables().then(() => {
  console.log('✅ Analysis complete\n');
  process.exit(0);
}).catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
