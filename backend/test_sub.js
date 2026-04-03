const axios = require('axios');
(async () => {
    try {
        const payload = {
            subscription: {
                endpoint: "https://fcm.googleapis.com/fcm/send/fake-endpoint",
                keys: {
                    p256dh: "BM_...",
                    auth: "AUTH..."
                }
            }
        };
        
        // We need a valid user token. Let's get one from the db directly or login
        const res = await axios.post('http://localhost:5001/api/auth/login', {
            email: 'test@test.com', // wait I don't know the test email.
            password: 'password'
        });
        console.log("Logged in");
    } catch(e) { console.log(e.response ? e.response.statusText : e); }
})();
