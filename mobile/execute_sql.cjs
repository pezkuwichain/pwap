/**
 * Execute SQL Files on Supabase
 *
 * This script runs SQL files directly on Supabase database
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://vsyrpfiwhjvahofxwytr.supabase.co';
const supabaseServiceKey = 'sb_secret_oXy8Diay2J_u8dKPZLxdcQ_hq69Mrb6';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function executeSQLFile(filename) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📄 Executing: ${filename}`);
  console.log('='.repeat(70));

  try {
    const sqlContent = fs.readFileSync(path.join(__dirname, filename), 'utf8');

    // Split SQL by semicolons (simple parser)
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.match(/^\/\*/));

    console.log(`\n📊 Found ${statements.length} SQL statements\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip comments and empty statements
      if (statement.startsWith('--') || statement.length < 5) {
        continue;
      }

      // Show first 80 chars of statement
      const preview = statement.substring(0, 80).replace(/\s+/g, ' ');
      process.stdout.write(`   [${i + 1}/${statements.length}] ${preview}...`);

      try {
        // Execute using RPC query function (if available)
        // Note: This requires a custom RPC function in Supabase
        // Alternative: Use REST API directly

        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({ sql: statement })
        });

        if (response.ok) {
          console.log(' ✅');
          successCount++;
        } else {
          const error = await response.text();
          console.log(` ❌ ${error}`);
          errorCount++;
        }
      } catch (error) {
        console.log(` ❌ ${error.message}`);
        errorCount++;
      }
    }

    console.log(`\n${'='.repeat(70)}`);
    console.log(`📊 Results: ${successCount} succeeded, ${errorCount} failed`);
    console.log('='.repeat(70));

    return { success: successCount, errors: errorCount };

  } catch (error) {
    console.error(`❌ Error reading file: ${error.message}`);
    return { success: 0, errors: 1 };
  }
}

async function main() {
  console.log('\n🚀 Starting SQL Execution...\n');

  // Step 1: Fix schema compatibility
  console.log('📝 Step 1: Fixing schema compatibility...');
  const result1 = await executeSQLFile('FIX_SCHEMA_COMPATIBILITY.sql');

  // Step 2: Create missing tables
  console.log('\n📝 Step 2: Creating missing tables...');
  const result2 = await executeSQLFile('SUPABASE_SCHEMA.sql');

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('🎉 EXECUTION SUMMARY');
  console.log('='.repeat(70));
  console.log(`\nStep 1 (Compatibility Fix):`);
  console.log(`   ✅ Success: ${result1.success}`);
  console.log(`   ❌ Errors: ${result1.errors}`);
  console.log(`\nStep 2 (Create Tables):`);
  console.log(`   ✅ Success: ${result2.success}`);
  console.log(`   ❌ Errors: ${result2.errors}`);
  console.log('\n' + '='.repeat(70));

  if (result1.errors === 0 && result2.errors === 0) {
    console.log('\n✅ ALL OPERATIONS COMPLETED SUCCESSFULLY!\n');
    console.log('📝 Next step: Run verification script');
    console.log('   node check_schema_compatibility.cjs\n');
  } else {
    console.log('\n⚠️  Some operations failed. Check errors above.\n');
  }
}

// Alternative: Use Management API
async function executeViaManagementAPI() {
  console.log('\n📝 Attempting to execute via Management API...\n');

  // Supabase doesn't have a public SQL execution API
  // Best option is to use Supabase Dashboard SQL Editor
  console.log('⚠️  Supabase JS SDK does not support direct SQL execution');
  console.log('ℹ️  SQL must be executed via Supabase Dashboard\n');
  console.log('📋 Instructions:');
  console.log('   1. Go to: https://app.supabase.com');
  console.log('   2. Select project: vsyrpfiwhjvahofxwytr');
  console.log('   3. Open: SQL Editor (left menu)');
  console.log('   4. Copy contents of: FIX_SCHEMA_COMPATIBILITY.sql');
  console.log('   5. Paste and click: Run');
  console.log('   6. Repeat for: SUPABASE_SCHEMA.sql\n');

  return false;
}

// Check if we can execute SQL programmatically
executeViaManagementAPI().then(canExecute => {
  if (!canExecute) {
    console.log('⚠️  Manual execution required via Supabase Dashboard\n');
    process.exit(1);
  } else {
    main().then(() => process.exit(0));
  }
});
