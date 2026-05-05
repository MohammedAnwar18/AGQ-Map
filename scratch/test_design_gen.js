import axios from 'axios';

async function testDesignGen() {
    try {
        console.log("Testing AI Design Generation...");
        const response = await axios.post('http://localhost:5001/api/ai/generate-design', {
            prompt: "أريد تصميم بسيط"
        });
        console.log("Response Success:", JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error("Response Error:", error.response?.data || error.message);
    }
}

testDesignGen();
