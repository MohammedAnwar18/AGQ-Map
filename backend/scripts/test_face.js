const path = require('path');
const fs = require('fs');
const { extractAllFaces, extractSingleFace, matchDescriptorAgainstEnrollments } = require('../services/faceRecognitionService');

async function main() {
    const samplePath = path.join(__dirname, '..', 'node_modules', '@vladmandic', 'face-api', 'demo', 'sample1.jpg');
    const buffer = fs.readFileSync(samplePath);

    console.time('extractAllFaces');
    const faces = await extractAllFaces(buffer);
    console.timeEnd('extractAllFaces');

    console.log(`Detected ${faces.length} face(s):`);
    faces.forEach((f, i) => {
        console.log(`  face ${i}: score=${f.detectionScore} box=`, f.box, `descriptorLen=${f.descriptor.length}`);
    });

    // extractSingleFace should reject a multi-face image
    try {
        await extractSingleFace(buffer);
        console.log('UNEXPECTED: extractSingleFace did not throw on multi-face image');
    } catch (err) {
        console.log('OK: extractSingleFace correctly rejected multi-face image ->', err.code, '-', err.message);
    }

    // sanity-check the matcher: face vs itself should be a near-perfect (very_high) match,
    // and face vs a different detected face in the same photo should NOT match.
    if (faces.length >= 2) {
        const enrollments = [
            { person_id: 1, photo_id: 1, photo_url: '/a.jpg', name: 'نفس الشخص (تجريبي)', info: null, descriptor: faces[0].descriptor }
        ];
        const selfMatch = matchDescriptorAgainstEnrollments(faces[0].descriptor, enrollments);
        const otherMatch = matchDescriptorAgainstEnrollments(faces[1].descriptor, enrollments);
        console.log('Self-match distance (expect ~0, very_high):', selfMatch[0].distance, selfMatch[0].level);
        console.log('Different-person distance (expect > 0.6, none):', otherMatch[0].distance, otherMatch[0].level);
    }

    console.log('SUCCESS');
}

main().catch(err => {
    console.error('FAILED:', err);
    process.exit(1);
});
