#!/bin/bash

# Supabase Database Connection
DB_HOST="db.vsyrpfiwhjvahofxwytr.supabase.co"
DB_PORT="5432"
DB_NAME="postgres"
DB_USER="postgres"
DB_PASS="SqM210305yBkB@#nm90"

CONNECTION_STRING="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

echo "======================================================================"
echo "🚀 Executing SQL Scripts on Supabase"
echo "======================================================================"

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo ""
    echo "❌ psql not found. Installing PostgreSQL client..."
    echo ""

    # Try to install psql
    if command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y postgresql-client
    elif command -v yum &> /dev/null; then
        sudo yum install -y postgresql
    else
        echo "❌ Cannot install PostgreSQL client automatically"
        echo ""
        echo "📋 Manual Setup Required:"
        echo "   Go to: https://app.supabase.com/project/vsyrpfiwhjvahofxwytr/sql"
        echo "   Run the SQL from: QUICK_SETUP_GUIDE.md"
        echo ""
        exit 1
    fi
fi

echo ""
echo "📝 Step 1: Fixing schema compatibility..."
echo "======================================================================"

psql "${CONNECTION_STRING}" -f FIX_SCHEMA_COMPATIBILITY.sql

if [ $? -eq 0 ]; then
    echo "✅ Schema compatibility fix completed!"
else
    echo "❌ Error in schema fix"
    exit 1
fi

echo ""
echo "📝 Step 2: Creating missing tables..."
echo "======================================================================"

psql "${CONNECTION_STRING}" -f SUPABASE_SCHEMA.sql

if [ $? -eq 0 ]; then
    echo "✅ Table creation completed!"
else
    echo "❌ Error in table creation"
    exit 1
fi

echo ""
echo "======================================================================"
echo "🎉 ALL SQL SCRIPTS EXECUTED SUCCESSFULLY!"
echo "======================================================================"
echo ""
echo "📝 Next step: Verify schema compatibility"
echo "   node check_schema_compatibility.cjs"
echo ""
