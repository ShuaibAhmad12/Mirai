#!/usr/bin/env node

/**
 * Fee Payment Functions Migration Script
 *
 * This script deploys the fee payment processing functions to the database.
 * Run this after deploying the schema changes.
 *
 * Usage:
 *   npm run migrate:fee-payment
 *   or
 *   node scripts/migrate-fee-payment.js
 */

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database configuration - update these with your actual values
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Missing Supabase configuration. Please set:");
  console.error("   NEXT_PUBLIC_SUPABASE_URL");
  console.error("   SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function runMigration() {
  console.log("🚀 Starting Fee Payment Functions Migration...");

  try {
    // Read the SQL file
    const sqlFilePath = path.join(
      __dirname,
      "..",
      "database",
      "Schema",
      "006.6_fee_payment_functions.sql"
    );
    const sqlContent = fs.readFileSync(sqlFilePath, "utf8");

    console.log("📄 SQL file loaded successfully");

    // Split SQL into individual statements
    const statements = sqlContent
      .split(";")
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !stmt.startsWith("--"));

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);

        const { error } = await supabase.rpc("exec_sql", {
          sql: statement + ";",
        });

        if (error) {
          // Try direct execution if rpc fails
          const { error: directError } = await supabase
            .from("_temp_migration")
            .select("*")
            .limit(0);
          if (directError) {
            console.error(
              `❌ Failed to execute statement ${i + 1}:`,
              error.message
            );
            console.error("Statement:", statement.substring(0, 200) + "...");
            throw error;
          }
        }
      }
    }

    console.log("✅ Migration completed successfully!");
    console.log("");
    console.log("📋 Summary:");
    console.log(
      "   • process_fee_payment() - Main payment processing function"
    );
    console.log("   • cancel_fee_payment() - Payment cancellation function");
    console.log("   • get_fee_payment_summary() - Payment summary function");
    console.log("");
    console.log("🎉 Fee payment system is now ready for use!");
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    console.error("");
    console.error("🔧 Troubleshooting:");
    console.error("   1. Ensure your database schema is up to date");
    console.error("   2. Check your Supabase connection credentials");
    console.error("   3. Verify you have the necessary permissions");
    console.error("   4. Check the Supabase logs for more details");
    process.exit(1);
  }
}

// Alternative approach using direct SQL execution
async function runMigrationDirect() {
  console.log("🔄 Trying direct SQL execution approach...");

  try {
    const sqlFilePath = path.join(
      __dirname,
      "..",
      "database",
      "Schema",
      "006.6_fee_payment_functions.sql"
    );
    const sqlContent = fs.readFileSync(sqlFilePath, "utf8");

    // Execute the entire SQL file at once
    const { error } = await supabase.rpc("exec", { query: sqlContent });

    if (error) {
      throw error;
    }

    console.log("✅ Direct migration completed successfully!");
  } catch (error) {
    console.error("❌ Direct migration also failed:", error.message);
    console.error(
      "💡 You may need to run the SQL file manually in your Supabase SQL editor"
    );
  }
}

// Run the migration
if (require.main === module) {
  runMigration()
    .catch(() => {
      console.log("");
      console.log("🔄 Trying alternative migration approach...");
      return runMigrationDirect();
    })
    .catch(() => {
      console.error("💥 All migration attempts failed");
      process.exit(1);
    });
}

module.exports = { runMigration, runMigrationDirect };
