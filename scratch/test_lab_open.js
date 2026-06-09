const puppeteer = require('puppeteer');
const axios = require('axios');
const path = require('path');

// Load backend environment variables for database pool connection
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const pool = require('../backend/config/database');

(async () => {
  console.log('--- STARTING PALNOVAA LAB OPEN TEST WITH CORRECT MENU CLICK ---');
  
  // 1. Register a test user locally
  const username = 'testuser_' + Math.floor(Math.random() * 100000);
  const email = username + '@test.com';
  const password = 'Password123!';
  let token = '';
  let user = null;
  
  try {
    const regRes = await axios.post('http://localhost:5001/api/auth/register', {
      username,
      email,
      password,
      full_name: 'Test Puppeteer User',
      gender: 'male',
      date_of_birth: '1995-05-15'
    });
    console.log('User registered...');
    
    // 2. Mark the user as verified directly in the database
    await pool.query('UPDATE users SET is_verified = TRUE WHERE username = $1', [username]);
    
    // 3. Login to get the auth token
    const loginRes = await axios.post('http://localhost:5001/api/auth/login', {
      username,
      password
    });
    token = loginRes.data.token;
    user = loginRes.data.user;
    console.log('Logged in successfully.');
  } catch (err) {
    console.error('Authentication setup failed:', err.response ? err.response.data : err.message);
    await pool.end();
    process.exit(1);
  }

  // 4. Launch browser
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  // Grant geolocation permission in browser context
  const context = browser.defaultBrowserContext();
  await context.overridePermissions('http://localhost:5173', ['geolocation']);
  
  const page = await browser.newPage();
  
  // Set mock geolocation coordinates
  await page.setGeolocation({ latitude: 31.9038, longitude: 35.2034 });
  
  // Set viewport to desktop to bypass isMobileDevice check
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', msg => {
    console.log('BROWSER LOG:', msg.text());
  });
  
  page.on('pageerror', error => {
    console.error('BROWSER RUNTIME ERROR:', error.stack || error.message);
  });

  // Navigate to login page first to establish base URL
  console.log('Navigating to login page...');
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });

  // Seed localStorage
  if (token && user) {
    console.log('Seeding authentication token and cache in localStorage...');
    await page.evaluate((t, u) => {
      localStorage.setItem('token', t);
      localStorage.setItem('user_cache', JSON.stringify(u));
    }, token, user);
  }

  // Go to /map page
  console.log('Navigating to map page...');
  await page.goto('http://localhost:5173/map', { waitUntil: 'networkidle2' });
  
  console.log('Current URL after navigation:', page.url());
  
  // Wait a bit for map and modals to render
  await new Promise(resolve => setTimeout(resolve, 6000));
  
  // Dismiss GPS guide if open
  console.log('Checking for GPS guide modal to dismiss...');
  const dismissedGPS = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const closeBtn = buttons.find(b => b.textContent.includes('إغلاق'));
    if (closeBtn) {
      closeBtn.click();
      return true;
    }
    return false;
  });
  console.log('Dismissed GPS modal:', dismissedGPS);
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Dismiss onboarding modal if open ("تخطي الآن")
  console.log('Checking for onboarding profile setup modal to dismiss...');
  const dismissedOnboarding = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const skipBtn = buttons.find(b => b.textContent.includes('تخطي الآن'));
    if (skipBtn) {
      skipBtn.click();
      return true;
    }
    return false;
  });
  console.log('Dismissed Onboarding modal:', dismissedOnboarding);
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Open the "More" menu (hamburger menu)
  console.log('Opening hamburger menu (more menu)...');
  const menuClicked = await page.evaluate(() => {
    const icons = Array.from(document.querySelectorAll('.top-nav-icon'));
    if (icons.length >= 5) {
      icons[4].click(); // Hamburger menu is the fifth top-nav-icon in Map.jsx
      return true;
    }
    return false;
  });
  console.log('Hamburger menu clicked:', menuClicked);
  
  // Wait for dropdown transition
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Trigger opening the lab modal
  console.log('Clicking "مختبر بالنوفا" button...');
  const labClicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const labButton = buttons.find(b => b.textContent.includes('مختبر بالنوفا'));
    if (labButton) {
      labButton.click();
      return true;
    }
    const spans = Array.from(document.querySelectorAll('span'));
    const labSpan = spans.find(s => s.textContent.includes('مختبر بالنوفا'));
    if (labSpan) {
      const btn = labSpan.closest('button');
      if (btn) {
        btn.click();
        return true;
      }
    }
    return false;
  });
  console.log('Lab button click triggered:', labClicked);
  
  // Wait to see if any console errors show up during mount/render
  await new Promise(resolve => setTimeout(resolve, 8000));
  
  // Check if the laboratory modal is in the DOM
  const modalPresent = await page.evaluate(() => {
    return !!document.querySelector('.lab-modal') || !!document.querySelector('.lab-container') || document.body.textContent.includes('مختبر بالنوفا المتقدم');
  });
  console.log('Is lab modal present in DOM?', modalPresent);
  
  // Take a screenshot of the state
  console.log('Taking screenshot...');
  await page.screenshot({ path: 'scratch/lab_screen.png' });
  
  await browser.close();
  await pool.end();
  console.log('--- TEST FINISHED ---');
})();
