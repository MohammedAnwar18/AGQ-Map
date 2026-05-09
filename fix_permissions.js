const fs = require('fs');
const path = 'c:/Users/Moham/Desktop/APPAGQ/backend/controllers/shopController.js';
let content = fs.readFileSync(path, 'utf8');

// Pattern 1: addFacilityPost
content = content.replace(
    /if \(req\.user\.role !== 'admin' && checkRes\.rows\[0\]\.owner_id !== req\.user\.userId\) return res\.status\(403\)\.json\(\{ error: 'Unauthorized' \}\);/g,
    "const isAuthorized = req.user.role === 'admin' || String(checkRes.rows[0].owner_id) === String(req.user.userId);\n        if (!isAuthorized) return res.status(403).json({ error: 'Unauthorized' });"
);

// Pattern 2: deleteUniversityFacility (if it still exists in old form)
content = content.replace(
    /if \(req\.user\.role !== 'admin' && checkRes\.rows\[0\]\.owner_id !== req\.user\.userId\) return res\.status\(403\)\.json\(\{ error: 'Unauthorized' \}\);/g,
    "const isAuthorized = req.user.role === 'admin' || String(checkRes.rows[0].owner_id) === String(req.user.userId);\n        if (!isAuthorized) return res.status(403).json({ error: 'Unauthorized' });"
);

fs.writeFileSync(path, content);
console.log('Successfully updated permissions');
