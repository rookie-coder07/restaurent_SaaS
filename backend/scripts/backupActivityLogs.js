const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function backup() {
  try {
    console.log('Creating backup of activity_logs...');
    
    // Get all data
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*');
    
    if (error) throw error;
    
    console.log(`✅ Backed up ${data?.length || 0} records`);
    
    // Save to file
    const fs = require('fs');
    fs.writeFileSync(
      './activity_logs_backup.json', 
      JSON.stringify(data, null, 2)
    );
    console.log('✅ Backup saved to activity_logs_backup.json');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Backup failed:', error.message);
    process.exit(1);
  }
}

backup();
