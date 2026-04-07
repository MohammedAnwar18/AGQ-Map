const pool = require('../config/database');

const tables = [
  'friend_requests', 'friendships', 'posts', 'users', 'messages',
  'communities', 'comments', 'community_members', 'local_news',
  'likes', 'notifications', 'shop_followers', 'shop_products',
  'shops'
];

async function enableRLS() {
  try {
    console.log('Starting RLS enablement...');
    for (const table of tables) {
      await pool.query(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
      console.log(`✅ RLS enabled for public.${table}`);
      
      // We will also add a permissive policy just in case any client later uses Supabase anon key
      // This is optional if they only use backend pg, but just in case, let's keep it clean or not.
      // Wait, if they don't use it, doing `ENABLE ROW LEVEL SECURITY` without policies means Anon key gets DENY ALL. 
      // Which is EXACTLY what the linter wants (to protect public tables from unauthorized Anon API access).
      // So I will just enable it.
    }
    console.log('🎉 Done fixing Supabase Linter warnings!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

enableRLS();
