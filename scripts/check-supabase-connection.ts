import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// Optionally import your Database type if you want strict types for responses
// import { Database } from '../src/services/database.service';

async function checkSupabaseConnection(): Promise<void> {
  console.log('🧪 Checking Supabase connection from Node.js (TypeScript)...');

  const supabaseUrl: string | undefined = process.env.SUPABASE_URL;
  const supabaseAnonKey: string | undefined = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Error: SUPABASE_URL or SUPABASE_ANON_KEY not found in .env file.');
    process.exit(1);
  }

  try {
    // You can add <Database> as a generic if you want strict table typing
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false }
    });

    // Perform a simple query to test the connection
    const { data, error } = await supabase.from('transcription_requests').select('id').limit(1);

    if (error) {
      if ((error as any).code === '42P01') {
        console.warn('⚠️ Warning: Connection seems OK, but "transcription_requests" table does not exist or is not accessible with ANON_KEY.');
        console.warn('   This script primarily tests connectivity. Table-specific access depends on RLS policies.');
        // Try a simple RPC call if available
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
  } catch (err: any) {
    console.error('❌ Failed to connect to Supabase or execute query:', err.message);
    if (err.details) console.error('   Details:', err.details);
    process.exit(1);
  }
}

checkSupabaseConnection();
