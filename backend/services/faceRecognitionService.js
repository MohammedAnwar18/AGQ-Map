const path = require('path');
const sharp = require('sharp');
// Pure-JS/WASM build: no native tfjs-node / canvas addon required (safe for Vercel serverless).
const faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');

const MODELS_PATH = path.join(__dirname, '..', 'models');
const MAX_DIMENSION = 1280; // downscale huge uploads before running inference (speed, memory)
const DETECTOR_INPUT_SIZE = 512; // TinyFaceDetector input size (multiple of 32)
const DETECTOR_SCORE_THRESHOLD = 0.5;
const MIN_ACCEPTED_DETECTION_SCORE = 0.6;

// Distance thresholds for the 128-d recognition descriptor (euclidean distance).
// These mirror the calibration used by dlib's face_recognition_model (which
// face-api.js's recognition net is a direct port of) — 0.6 is the standard
// same-person cutoff; we split it into confidence tiers to avoid overstating certainty.
const THRESHOLDS = {
    VERY_HIGH: 0.4,
    HIGH: 0.5,
    POSSIBLE: 0.6
};

let modelsLoadedPromise = null;

function classifyDistance(distance) {
    if (distance <= THRESHOLDS.VERY_HIGH) {
        return { level: 'very_high', label: 'تطابق شبه مؤكد (نفس الشخص على الأرجح)', isMatch: true };
    }
    if (distance <= THRESHOLDS.HIGH) {
        return { level: 'high', label: 'تطابق بثقة عالية', isMatch: true };
    }
    if (distance <= THRESHOLDS.POSSIBLE) {
        return { level: 'possible', label: 'تشابه محتمل - يتطلب مراجعة يدوية', isMatch: true };
    }
    return { level: 'none', label: 'لا يوجد تطابق كافٍ', isMatch: false };
}

/**
 * Loads the three models needed (once per process): face detector, 68-point
 * landmarks (used internally to align the face before encoding) and the
 * recognition net that produces the 128-d descriptor.
 */
async function ensureModelsLoaded() {
    if (!modelsLoadedPromise) {
        modelsLoadedPromise = (async () => {
            await faceapi.tf.setBackend('wasm');
            await faceapi.tf.ready();
            await faceapi.nets.tinyFaceDetector.loadFromDisk(MODELS_PATH);
            await faceapi.nets.faceLandmark68Net.loadFromDisk(MODELS_PATH);
            await faceapi.nets.faceRecognitionNet.loadFromDisk(MODELS_PATH);
            console.log('✅ Face recognition models loaded (backend:', faceapi.tf.getBackend(), ')');
        })();
    }
    return modelsLoadedPromise;
}

/**
 * Decodes an arbitrary image buffer (jpeg/png/webp/...) into a tf.Tensor3D
 * of raw RGB pixels, auto-rotated per EXIF and capped to MAX_DIMENSION.
 */
async function imageBufferToTensor(buffer) {
    const { data, info } = await sharp(buffer)
        .rotate() // apply EXIF orientation
        .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
        .removeAlpha()
        .toColorspace('srgb')
        .raw()
        .toBuffer({ resolveWithObject: true });

    return faceapi.tf.tensor3d(new Uint8Array(data), [info.height, info.width, info.channels]);
}

function boxArea(box) {
    return box.width * box.height;
}

/**
 * Runs full detection (box + landmarks + 128-d descriptor) for every face
 * found in the image. Returns an array sorted by face size (largest first),
 * each entry: { descriptor: number[], box: {x,y,width,height}, detectionScore }
 */
async function extractAllFaces(buffer) {
    await ensureModelsLoaded();
    const tensor = await imageBufferToTensor(buffer);
    try {
        const options = new faceapi.TinyFaceDetectorOptions({
            inputSize: DETECTOR_INPUT_SIZE,
            scoreThreshold: DETECTOR_SCORE_THRESHOLD
        });

        const results = await faceapi
            .detectAllFaces(tensor, options)
            .withFaceLandmarks()
            .withFaceDescriptors();

        return results
            .filter(r => r.detection.score >= MIN_ACCEPTED_DETECTION_SCORE)
            .map(r => ({
                descriptor: Array.from(r.descriptor),
                box: {
                    x: Math.round(r.detection.box.x),
                    y: Math.round(r.detection.box.y),
                    width: Math.round(r.detection.box.width),
                    height: Math.round(r.detection.box.height)
                },
                detectionScore: Number(r.detection.score.toFixed(4)),
                imageWidth: r.detection.imageWidth,
                imageHeight: r.detection.imageHeight
            }))
            .sort((a, b) => boxArea(b.box) - boxArea(a.box));
    } finally {
        faceapi.tf.dispose(tensor);
    }
}

/**
 * Convenience wrapper for reference/enrollment photos: requires exactly one
 * clear face so a person's identity in the database never gets polluted by
 * an unrelated bystander face from a group photo.
 */
async function extractSingleFace(buffer) {
    const faces = await extractAllFaces(buffer);
    if (faces.length === 0) {
        const err = new Error('لم يتم العثور على أي وجه واضح في الصورة. الرجاء رفع صورة شخصية واضحة ومباشرة للوجه.');
        err.code = 'NO_FACE_DETECTED';
        throw err;
    }
    if (faces.length > 1) {
        const err = new Error('تم العثور على أكثر من وجه في الصورة. الرجاء رفع صورة تحتوي على وجه شخص واحد فقط لضمان دقة البيانات.');
        err.code = 'MULTIPLE_FACES_DETECTED';
        err.faces = faces;
        throw err;
    }
    return faces[0];
}

function euclideanDistance(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
        const diff = a[i] - b[i];
        sum += diff * diff;
    }
    return Math.sqrt(sum);
}

/**
 * Matches one query descriptor against a flat list of enrolled photo rows
 * ({ person_id, photo_id, descriptor, ... }), grouping by person and keeping
 * each person's single best (lowest-distance) photo. Returns candidates
 * sorted best-first, each annotated with a confidence tier — never a bare
 * "match/no match" boolean, so misleading borderline results stay visible
 * as "needs manual review" instead of being silently promoted.
 */
function matchDescriptorAgainstEnrollments(queryDescriptor, enrollments) {
    const bestByPerson = new Map();

    for (const row of enrollments) {
        const distance = euclideanDistance(queryDescriptor, row.descriptor);
        const current = bestByPerson.get(row.person_id);
        if (!current || distance < current.distance) {
            bestByPerson.set(row.person_id, { ...row, distance });
        }
    }

    return Array.from(bestByPerson.values())
        .map(candidate => {
            const classification = classifyDistance(candidate.distance);
            return {
                personId: candidate.person_id,
                name: candidate.name,
                info: candidate.info,
                matchedPhotoId: candidate.photo_id,
                matchedPhotoUrl: candidate.photo_url,
                distance: Number(candidate.distance.toFixed(4)),
                confidencePercent: Math.max(0, Math.round((1 - candidate.distance / THRESHOLDS.POSSIBLE) * 100)),
                ...classification
            };
        })
        .sort((a, b) => a.distance - b.distance);
}

module.exports = {
    ensureModelsLoaded,
    extractAllFaces,
    extractSingleFace,
    matchDescriptorAgainstEnrollments,
    euclideanDistance,
    THRESHOLDS
};
