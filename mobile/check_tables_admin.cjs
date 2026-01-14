/**
 * Check Existing Supabase Tables with Admin Access
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vsyrpfiwhjvahofxwytr.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'sb_secret_oXy8Diay2J_u8dKPZLxdcQ_hq69Mrb6';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

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
  console.log('🔍 Fetching existing tables with admin access...\n');

  try {
    // Use RPC to query information_schema
    const { data, error } = await supabase.rpc('get_table_list', {});

    if (error) {
      // Fallback: Direct query
      const query = `
        SELECT
          table_name,
          (SELECT COUNT(*)
           FROM information_schema.columns
           WHERE table_name = t.table_name
             AND table_schema = 'public') as column_count
        FROM information_schema.tables t
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
        ORDER BY table_name;
      `;

      const { data: tableData, error: queryError } = await supabase
        .from('_placeholder')
        .select();

      if (queryError) {
        console.log('⚠️  Cannot query information_schema directly');
        console.log('ℹ️  Will check for conflicts manually\n');
        await checkConflictsManually();
        return;
      }
    }

    // If we got data, process it
    if (data && Array.isArray(data)) {
      const existingTables = data.map(row => row.table_name);
      displayAnalysis(existingTables);
    } else {
      await checkConflictsManually();
    }

  } catch (error) {
    console.log('⚠️  Error:', error.message);
    console.log('ℹ️  Checking conflicts manually...\n');
    await checkConflictsManually();
  }
}

async function checkConflictsManually() {
  console.log('📋 Checking each table individually...\n');

  const results = {
    existing: [],
    missing: [],
    errors: []
  };

  for (const tableName of newTables) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(0);

      if (error) {
        if (error.message.includes('does not exist') || error.code === '42P01') {
          results.missing.push(tableName);
          console.log(`   ✅ ${tableName} - NOT FOUND (will be created)`);
        } else {
          results.errors.push({ table: tableName, error: error.message });
          console.log(`   ⚠️  ${tableName} - ERROR: ${error.message}`);
        }
      } else {
        results.existing.push(tableName);
        console.log(`   ⚠️  ${tableName} - ALREADY EXISTS`);
      }
    } catch (e) {
      results.errors.push({ table: tableName, error: e.message });
      console.log(`   ❌ ${tableName} - ERROR: ${e.message}`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n📊 CONFLICT ANALYSIS:\n');

  if (results.existing.length > 0) {
    console.log(`⚠️  ${results.existing.length} table(s) ALREADY EXIST:\n`);
    results.existing.forEach(table => {
      console.log(`   - ${table}`);
    });
    console.log('\n   ℹ️  These tables will be SKIPPED');
    console.log('   ℹ️  Existing data will NOT be modified\n');
  }

  if (results.missing.length > 0) {
    console.log(`✅ ${results.missing.length} table(s) WILL BE CREATED:\n`);
    results.missing.forEach(table => {
      console.log(`   - ${table}`);
    });
    console.log('');
  }

  if (results.errors.length > 0) {
    console.log(`⚠️  ${results.errors.length} error(s) encountered:\n`);
    results.errors.forEach(({ table, error }) => {
      console.log(`   - ${table}: ${error}`);
    });
    console.log('');
  }

  console.log('='.repeat(70));
  console.log('\n🎯 RECOMMENDATION:\n');

  if (results.missing.length === newTables.length) {
    console.log('   ✅ NO CONFLICTS - All tables are new');
    console.log('   ✅ Safe to run SUPABASE_SCHEMA.sql');
    console.log('   ✅ All 7 tables will be created\n');
  } else if (results.existing.length === newTables.length) {
    console.log('   ℹ️  ALL TABLES ALREADY EXIST');
    console.log('   ℹ️  SQL will skip all tables (no changes)');
    console.log('   ⚠️  Check if schemas match mobile app expectations\n');
  } else {
    console.log('   ⚠️  PARTIAL CONFLICT');
    console.log(`   ✅ ${results.missing.length} tables will be created`);
    console.log(`   ℹ️  ${results.existing.length} tables will be skipped`);
    console.log('   ✅ Safe to run SUPABASE_SCHEMA.sql\n');
  }
}

function displayAnalysis(existingTables) {
  console.log(`📊 Found ${existingTables.length} existing tables:\n`);

  existingTables.forEach(table => {
    const isConflict = newTables.includes(table);
    console.log(`   ${isConflict ? '⚠️ ' : '  '} ${table}${isConflict ? ' (CONFLICT)' : ''}`);
  });

  console.log('\n' + '='.repeat(70));
  console.log('\n📋 New tables to create:\n');

  const conflicts = [];
  const newToCreate = [];

  newTables.forEach(table => {
    if (existingTables.includes(table)) {
      conflicts.push(table);
      console.log(`   ⚠️  ${table} (ALREADY EXISTS - will be skipped)`);
    } else {
      newToCreate.push(table);
      console.log(`   ✅ ${table} (WILL BE CREATED)`);
    }
  });

  console.log('\n' + '='.repeat(70));
  console.log('\n🎯 SUMMARY:\n');
  console.log(`   Total existing tables: ${existingTables.length}`);
  console.log(`   Conflicting tables: ${conflicts.length}`);
  console.log(`   New tables to create: ${newToCreate.length}`);
  console.log(`   After SQL: ${existingTables.length + newToCreate.length} total tables\n`);

  console.log('='.repeat(70));
  console.log('\n✅ RECOMMENDATION:\n');

  if (conflicts.length === 0) {
    console.log('   ✅ NO CONFLICTS');
    console.log('   ✅ Safe to run SUPABASE_SCHEMA.sql\n');
  } else {
    console.log('   ⚠️  Some tables already exist');
    console.log('   ✅ Safe to run SQL (will skip existing tables)');
    console.log('   ℹ️  Check schemas of existing tables for compatibility\n');
  }
}

checkTables().then(() => {
  console.log('✅ Analysis complete\n');
  process.exit(0);
}).catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
