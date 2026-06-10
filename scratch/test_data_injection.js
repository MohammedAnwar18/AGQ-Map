const axios = require('axios');
const path = require('path');

// Load backend environment variables for database pool connection
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const pool = require('../backend/config/database');

(async () => {
  console.log('--- STARTING PALNOVAA DATA INJECTION API TEST ---');
  
  // 1. Register and verify a test user locally
  const username = 'testuser_' + Math.floor(Math.random() * 100000);
  const email = username + '@test.com';
  const password = 'Password123!';
  let token = '';
  
  try {
    const regRes = await axios.post('http://localhost:5001/api/auth/register', {
      username,
      email,
      password,
      full_name: 'Test Injection User',
      gender: 'male',
      date_of_birth: '1995-05-15'
    });
    console.log('User registered.');
    
    await pool.query('UPDATE users SET is_verified = TRUE WHERE username = $1', [username]);
    console.log('User verified in DB.');
    
    const loginRes = await axios.post('http://localhost:5001/api/auth/login', {
      username,
      password
    });
    token = loginRes.data.token;
    console.log('Login successful. JWT token received.');
  } catch (err) {
    console.error('Authentication setup failed:', err.response ? err.response.data : err.message);
    await pool.end();
    process.exit(1);
  }

  // 2. Test Cloud Storage Upload (the core of data injection)
  console.log('Simulating layer upload to Cloud Storage (/api/storage/upload)...');
  try {
    const uploadRes = await axios.post('http://localhost:5001/api/storage/upload', {
      geojson: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [35.2034, 31.9038] },
            properties: { name: 'Test Injection Point', description: 'Testing Balnova Lab injection capability' }
          }
        ]
      },
      layerName: 'PalNovaa_Test_Injection.geojson'
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('Upload Response Success Status:', uploadRes.data.success);
    console.log('Uploaded Cloud Storage URL:', uploadRes.data.url);
    
    if (uploadRes.data.success && uploadRes.data.url) {
      console.log('✅ SUCCESS: Cloud Storage upload works! Data injection will run smoothly.');
    } else {
      console.error('❌ FAILURE: Upload response missing URL or success status.');
    }
  } catch (err) {
    console.error('❌ FAILURE: Cloud Storage upload request failed:', err.response ? err.response.data : err.message);
  }

  await pool.end();
  console.log('--- TEST FINISHED ---');
})();
