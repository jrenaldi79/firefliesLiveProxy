import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function checkSupabaseConnection() {
  console.log('🧪 Checking Supabase connection from Node.js...');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Error: SUPABASE_URL or SUPABASE_ANON_KEY not found in .env file.');
    process.exit(1);
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false }
    });

    // Perform a simple query to test the connection
    const { data, error } = await supabase.from('transcription_requests').select('id').limit(1);

    if (error) {
      // If the error is specifically that the table doesn't exist, the connection is likely fine.
      if (error.code === '42P01') { 
        console.warn('⚠️ Warning: Connection seems OK, but "transcription_requests" table does not exist or is not accessible with ANON_KEY.');
        console.warn('   This script primarily tests connectivity. Table-specific access depends on RLS policies.');
        // Let's try an even simpler query that doesn't depend on any table
        const { error: rpcError } = await supabase.rpc('echo', { message: 'hello' });
        if (rpcError) {
            console.error('❌ Error performing a simple RPC call:', rpcError.message);
            process.exit(1);
        } else {
            console.log('✅ Supabase connection and basic RPC call successful!');
        }
      } else {
        throw error;
      }
    } else {
      console.log('✅ Supabase connection and basic query successful!');
      if (data) {
        console.log(`   Found ${data.length} record(s) in transcription_requests (limit 1).`);
      }
    }
  } catch (err) {
    console.error('❌ Failed to connect to Supabase or execute query:', err.message);
    if (err.details) console.error('   Details:', err.details);
    process.exit(1);
  }
}

checkSupabaseConnection();
