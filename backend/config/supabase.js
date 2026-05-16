const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://ybrgvpubwnlskcledlaq.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
    console.warn('⚠️ SUPABASE_ANON_KEY is missing!');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
