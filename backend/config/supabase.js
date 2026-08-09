const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://ybrgvpubwnlskcledlaq.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
    console.warn('⚠️ SUPABASE_ANON_KEY is missing!');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
