const fs = require('fs');
const path = require('path');

// ===================================================================
// EXTRACT GROUP IDs FROM N8N WORKFLOW
// ===================================================================

console.log('🔍 Extracting WhatsApp Group IDs from n8n workflow...\n');

try {
  // Read n8n workflow JSON
  const workflowPath = path.join(__dirname, '../json/WhatsApp Valuation.json');
  const workflowData = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));

  // Extract nodes with "Send to" in their name
  const sendNodes = workflowData.nodes.filter(node =>
    node.name && node.name.startsWith('Send to')
  );

  console.log(`Found ${sendNodes.length} "Send to" nodes\n`);

  // Group IDs by banker
  const bankerGroups = {};

  sendNodes.forEach(node => {
    const bankerName = node.name.replace('Send to ', '').trim();

    // Find groupId parameter
    const groupIdParam = node.parameters?.bodyParametersUi?.parameter?.find(
      p => p.name === 'groupId'
    );

    if (groupIdParam) {
      let groupId = groupIdParam.value;

      // Remove n8n expression syntax if present
      if (groupId.startsWith('=')) {
        groupId = groupId.substring(1);
      }

      // Remove quotes if present
      groupId = groupId.replace(/['"]/g, '');

      if (!bankerGroups[bankerName]) {
        bankerGroups[bankerName] = groupId;
      }
    }
  });

  // Display results
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📋 EXTRACTED GROUP IDs BY BANKER');
  console.log('═══════════════════════════════════════════════════════════\n');

  const bankerMapping = {
    'Premas Group': 'Yvonne',
    'DBS Group': 'Ethan',
    'MBB Hui Hui': 'Hui Hui',
    'MBB Vikram': 'Vikram',
    'MBB April': 'April',
    'OCBC Eunice': 'Eunice',
    'OCBC Jewel': 'Jewel',
    'OCBC Eunice Ong': 'Eunice Ong',
    'SCB Ying Feng': 'Ying Feng',
    'UOB Bret': 'Bret',
    'UOB Xin Jie': 'Xin Jie',
    'UOB James': 'James',
    'Bot Testing': 'Nat',
    'Yvonne': 'Yvonne'
  };

  Object.entries(bankerGroups).forEach(([fullName, groupId]) => {
    const bankerName = bankerMapping[fullName] || fullName;
    console.log(`${fullName.padEnd(30)} → ${bankerName.padEnd(20)} → ${groupId}`);
  });

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('📝 SQL UPDATE STATEMENTS');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('-- Copy and paste these SQL statements into Supabase SQL Editor:\n');

  Object.entries(bankerGroups).forEach(([fullName, groupId]) => {
    const bankerName = bankerMapping[fullName];

    if (bankerName && groupId && !groupId.includes('{{')) {
      console.log(`UPDATE bankers SET whatsapp_group_id = '${groupId}' WHERE name = '${bankerName}';`);
    }
  });

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✅ EXTRACTION COMPLETE');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('Next steps:');
  console.log('1. Copy the SQL UPDATE statements above');
  console.log('2. Go to Supabase Dashboard → SQL Editor');
  console.log('3. Paste and run the UPDATE statements');
  console.log('4. Verify with: SELECT name, whatsapp_group_id FROM bankers;\n');

  // Save to file
  const outputPath = path.join(__dirname, '../database/update_group_ids.sql');
  let sqlStatements = '-- AUTO-GENERATED SQL UPDATES FOR BANKER GROUP IDs\n';
  sqlStatements += '-- Generated: ' + new Date().toISOString() + '\n\n';

  Object.entries(bankerGroups).forEach(([fullName, groupId]) => {
    const bankerName = bankerMapping[fullName];

    if (bankerName && groupId && !groupId.includes('{{')) {
      sqlStatements += `UPDATE bankers SET whatsapp_group_id = '${groupId}' WHERE name = '${bankerName}';\n`;
    }
  });

  fs.writeFileSync(outputPath, sqlStatements);
  console.log(`💾 SQL updates saved to: ${outputPath}\n`);

} catch (error) {
  console.error('❌ Error extracting group IDs:', error.message);
  process.exit(1);
}
