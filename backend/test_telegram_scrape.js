const axios = require('axios');

async function testScrape() {
    try {
        console.log("Fetching Telegram channel preview...");
        const response = await axios.get('https://t.me/s/Akhbaraldfeal3agla2', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const html = response.data;
        console.log("HTML length:", html.length);

        // Split HTML by tgme_widget_message js-widget_message to isolate each message
        const blocks = html.split('class="tgme_widget_message ');
        console.log("Found message blocks:", blocks.length - 1);

        const posts = [];
        // Skip block 0 as it is the header
        for (let i = 1; i < blocks.length; i++) {
            const block = blocks[i];
            
            // Extract text
            const textMatch = block.match(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/);
            // Extract date
            const dateMatch = block.match(/<time[^>]*datetime="([^"]+)"/);

            if (textMatch) {
                // Clean HTML tags from text
                let text = textMatch[1]
                    .replace(/<br\s*\/?>/g, '\n') // keep linebreaks
                    .replace(/<[^>]+>/g, '') // remove HTML tags
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .trim();

                const date = dateMatch ? dateMatch[1] : new Date().toISOString();
                
                posts.push({
                    channel: 'أخبار الضفة العاجلة',
                    text,
                    date
                });
            }
        }

        console.log(`Successfully parsed ${posts.length} posts:`);
        posts.slice(-5).forEach((p, idx) => {
            console.log(`\n--- Post #${idx + 1} (${p.date}) ---`);
            console.log(p.text);
        });

    } catch (error) {
        console.error("Scraping failed:", error.message);
    }
}

testScrape();
