const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// ===================================================================
// MIGRATION SCRIPT: Google Sheets → Supabase
// ===================================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const GOOGLE_SHEETS_CREDENTIALS = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS || '{}');
const VALUATION_SPREADSHEET_ID = process.env.VALUATION_SPREADSHEET_ID;
const INTEREST_RATE_SPREADSHEET_ID = process.env.INTEREST_RATE_SPREADSHEET_ID;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===================================================================
// UTILITY FUNCTIONS
// ===================================================================

function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

async function getGoogleSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: GOOGLE_SHEETS_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  return google.sheets({ version: 'v4', auth });
}

// ===================================================================
// MIGRATION: VALUATION REQUESTS
// ===================================================================

async function migrateValuations() {
  log('info', '🏡 Starting valuation requests migration...');

  if (!VALUATION_SPREADSHEET_ID) {
    log('warn', 'VALUATION_SPREADSHEET_ID not configured, skipping valuation migration');
    return { migrated: 0, errors: 0 };
  }

  try {
    const sheets = await getGoogleSheetsClient();

    // Fetch all valuation data from Google Sheets
    log('info', 'Fetching valuation data from Google Sheets...');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: VALUATION_SPREADSHEET_ID,
      range: 'Valuations!A2:K1000' // Skip header row, get up to 1000 rows
    });

    const rows = response.data.values || [];
    log('info', `Found ${rows.length} valuation requests in Google Sheets`);

    if (rows.length === 0) {
      log('warn', 'No valuation data to migrate');
      return { migrated: 0, errors: 0 };
    }

    // Transform and insert into Supabase
    let migrated = 0;
    let errors = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Parse row data (columns A-K)
      const valuationData = {
        created_at: row[0] || new Date().toISOString(), // A: Timestamp
        group_id: row[1] || '', // B: GroupId
        sender_id: row[2] || '', // C: SenderId
        message_id: row[3] || '', // D: MessageId
        address: row[4] || null, // E: Address
        property_type: row[5] || null, // F: PropertyType
        bedrooms: row[6] ? parseInt(row[6]) : null, // G: Bedrooms
        floor_area: row[7] ? parseInt(row[7]) : null, // H: FloorArea
        asking_price: row[8] ? parseFloat(row[8].replace(/[,$]/g, '')) : null, // I: AskingPrice
        raw_message: row[9] || '', // J: RawMessage
        reply_message: row[10] || null, // K: ReplyMessage
        status: 'processed', // Mark as processed since they're historical
        workflow_id: null // Will be linked later if needed
      };

      // Insert into Supabase
      const { data, error } = await supabase
        .from('valuation_requests')
        .insert(valuationData)
        .select()
        .single();

      if (error) {
        log('error', `Failed to migrate row ${i + 2}:`, error);
        errors++;
      } else {
        migrated++;
        if (migrated % 10 === 0) {
          log('info', `Migrated ${migrated}/${rows.length} valuations...`);
        }
      }
    }

    log('info', `✅ Valuation migration complete: ${migrated} migrated, ${errors} errors`);
    return { migrated, errors };

  } catch (error) {
    log('error', 'Valuation migration failed:', error);
    throw error;
  }
}

// ===================================================================
// MIGRATION: BROADCAST CONTACTS
// ===================================================================

async function migrateContacts() {
  log('info', '📞 Starting broadcast contacts migration...');

  if (!INTEREST_RATE_SPREADSHEET_ID) {
    log('warn', 'INTEREST_RATE_SPREADSHEET_ID not configured, skipping contacts migration');
    return { migrated: 0, errors: 0 };
  }

  try {
    const sheets = await getGoogleSheetsClient();

    // Step 1: Create a contact list for migrated contacts
    log('info', 'Creating contact list for migrated contacts...');
    const { data: contactList, error: listError } = await supabase
      .from('contact_lists')
      .insert({
        name: 'Interest Rate Clients (Migrated)',
        description: 'Contacts migrated from Google Sheets Interest Rate spreadsheet',
        source: 'google_sheets',
        source_config: {
          spreadsheet_id: INTEREST_RATE_SPREADSHEET_ID,
          sheet_name: 'Clients',
          migrated_at: new Date().toISOString()
        },
        total_count: 0
      })
      .select()
      .single();

    if (listError) {
      // Try to get existing list
      const { data: existingList } = await supabase
        .from('contact_lists')
        .select('*')
        .eq('name', 'Interest Rate Clients (Migrated)')
        .single();

      if (!existingList) {
        throw new Error('Failed to create or find contact list');
      }
      log('info', 'Using existing contact list');
      contactList = existingList;
    }

    const listId = contactList.id;
    log('info', `Contact list created/found with ID: ${listId}`);

    // Step 2: Fetch contacts from Google Sheets
    log('info', 'Fetching contacts from Google Sheets...');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: INTEREST_RATE_SPREADSHEET_ID,
      range: 'Clients!A2:B400' // Name and Phone columns
    });

    const rows = response.data.values || [];
    log('info', `Found ${rows.length} contacts in Google Sheets`);

    if (rows.length === 0) {
      log('warn', 'No contact data to migrate');
      return { migrated: 0, errors: 0 };
    }

    // Step 3: Insert contacts into Supabase
    let migrated = 0;
    let errors = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      if (!row[0] || !row[1]) {
        log('warn', `Skipping row ${i + 2}: missing name or phone`);
        errors++;
        continue;
      }

      const contactData = {
        list_id: listId,
        name: row[0].trim(),
        phone: row[1].trim().replace(/\s+/g, ''), // Remove spaces from phone
        email: null,
        tier: 'Standard', // Default tier
        preferred_contact: 'whatsapp',
        is_active: true,
        custom_fields: {}
      };

      const { data, error } = await supabase
        .from('broadcast_contacts')
        .insert(contactData)
        .select()
        .single();

      if (error) {
        // Check if it's a duplicate
        if (error.code === '23505') { // Unique constraint violation
          log('warn', `Duplicate contact skipped: ${contactData.name} (${contactData.phone})`);
        } else {
          log('error', `Failed to migrate contact ${i + 2}:`, error);
        }
        errors++;
      } else {
        migrated++;
        if (migrated % 25 === 0) {
          log('info', `Migrated ${migrated}/${rows.length} contacts...`);
        }
      }
    }

    // Step 4: Update contact list count
    await supabase
      .from('contact_lists')
      .update({ total_count: migrated })
      .eq('id', listId);

    log('info', `✅ Contact migration complete: ${migrated} migrated, ${errors} errors`);
    return { migrated, errors, listId };

  } catch (error) {
    log('error', 'Contact migration failed:', error);
    throw error;
  }
}

// ===================================================================
// MIGRATION: PROGRESS DATA (Read-only for reference)
// ===================================================================

async function showProgressData() {
  log('info', '📊 Reading current progress data from Google Sheets...');

  if (!INTEREST_RATE_SPREADSHEET_ID) {
    log('warn', 'INTEREST_RATE_SPREADSHEET_ID not configured, skipping');
    return;
  }

  try {
    const sheets = await getGoogleSheetsClient();

    // Read current index (E2)
    const indexResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: INTEREST_RATE_SPREADSHEET_ID,
      range: 'Clients!E2'
    });
    const currentIndex = indexResponse.data.values?.[0]?.[0] || 0;

    // Read message content (F2)
    const messageResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: INTEREST_RATE_SPREADSHEET_ID,
      range: 'Clients!F2'
    });
    const messageContent = messageResponse.data.values?.[0]?.[0] || '';

    // Read image URL (H2)
    const imageResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: INTEREST_RATE_SPREADSHEET_ID,
      range: 'Clients!H2'
    });
    const imageUrl = imageResponse.data.values?.[0]?.[0] || '';

    log('info', 'Current Progress Data:', {
      currentIndex,
      messageContent: messageContent.substring(0, 100) + '...',
      imageUrl
    });

    log('info', 'ℹ️  Note: This progress data will be tracked in broadcast_executions table going forward');

  } catch (error) {
    log('error', 'Failed to read progress data:', error);
  }
}

// ===================================================================
// MAIN MIGRATION FUNCTION
// ===================================================================

async function runMigration() {
  log('info', '🚀 Starting Google Sheets → Supabase Migration');
  log('info', '================================================');

  const startTime = Date.now();
  const results = {
    valuations: { migrated: 0, errors: 0 },
    contacts: { migrated: 0, errors: 0, listId: null }
  };

  try {
    // Check Supabase connection
    log('info', 'Checking Supabase connection...');
    const { data, error } = await supabase.from('workflows').select('count').limit(1);
    if (error) throw new Error('Supabase connection failed: ' + error.message);
    log('info', '✅ Supabase connected successfully');

    // Step 1: Migrate Valuations
    log('info', '\n--- STEP 1: MIGRATE VALUATIONS ---');
    results.valuations = await migrateValuations();

    // Step 2: Migrate Contacts
    log('info', '\n--- STEP 2: MIGRATE CONTACTS ---');
    results.contacts = await migrateContacts();

    // Step 3: Show Progress Data
    log('info', '\n--- STEP 3: PROGRESS DATA ---');
    await showProgressData();

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log('info', '\n================================================');
    log('info', '✅ MIGRATION COMPLETE');
    log('info', '================================================');
    log('info', `Duration: ${duration} seconds`);
    log('info', `Valuations: ${results.valuations.migrated} migrated, ${results.valuations.errors} errors`);
    log('info', `Contacts: ${results.contacts.migrated} migrated, ${results.contacts.errors} errors`);

    if (results.contacts.listId) {
      log('info', `\n📋 Contact List ID: ${results.contacts.listId}`);
      log('info', 'Use this ID in your broadcast workflows to target these contacts');
    }

    log('info', '\n🎯 NEXT STEPS:');
    log('info', '1. Verify migrated data in Supabase dashboard');
    log('info', '2. Update workflows to use Supabase instead of Google Sheets');
    log('info', '3. Test workflows thoroughly before going live');
    log('info', '4. Consider archiving old Google Sheets data');

    process.exit(0);

  } catch (error) {
    log('error', '❌ Migration failed:', error);
    process.exit(1);
  }
}

// ===================================================================
// DRY RUN MODE (Preview without inserting)
// ===================================================================

async function dryRun() {
  log('info', '🔍 DRY RUN MODE - Preview migration without inserting data');
  log('info', '================================================');

  try {
    // Preview Valuations
    if (VALUATION_SPREADSHEET_ID) {
      const sheets = await getGoogleSheetsClient();
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: VALUATION_SPREADSHEET_ID,
        range: 'Valuations!A2:K10' // First 10 rows
      });

      const rows = response.data.values || [];
      log('info', `Preview: ${rows.length} valuation rows (showing first 10)`);
      log('info', 'Sample data:', rows.slice(0, 3));
    }

    // Preview Contacts
    if (INTEREST_RATE_SPREADSHEET_ID) {
      const sheets = await getGoogleSheetsClient();
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: INTEREST_RATE_SPREADSHEET_ID,
        range: 'Clients!A2:B10' // First 10 rows
      });

      const rows = response.data.values || [];
      log('info', `Preview: ${rows.length} contact rows (showing first 10)`);
      log('info', 'Sample data:', rows.slice(0, 3));
    }

    log('info', '\n✅ Dry run complete. Run without --dry-run flag to execute migration.');
    process.exit(0);

  } catch (error) {
    log('error', 'Dry run failed:', error);
    process.exit(1);
  }
}

// ===================================================================
// CLI ENTRY POINT
// ===================================================================

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

if (isDryRun) {
  dryRun();
} else {
  runMigration();
}
