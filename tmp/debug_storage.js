const supabase = require('../backend/config/supabase');

async function checkStorage() {
    try {
        console.log('Checking Supabase Storage...');
        const { data, error } = await supabase.storage.listBuckets();
        if (error) {
            console.error('Bucket list error:', error);
        } else {
            console.log('Buckets:', data.map(b => b.name));
            const hasMedia = data.find(b => b.name === 'agq_media');
            if (hasMedia) {
                console.log('agq_media bucket FOUND');
            } else {
                console.log('agq_media bucket MISSING');
            }
        }
    } catch (e) {
        console.error('Check failed:', e);
    }
    process.exit(0);
}

checkStorage();
