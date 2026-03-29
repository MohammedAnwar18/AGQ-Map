const webpush = require('web-push');
require('dotenv').config();

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:example@yourdomain.com';

if (!vapidPublicKey || !vapidPrivateKey) {
    console.error('❌ VAPID keys are missing in .env');
} else {
    webpush.setVapidDetails(
        vapidSubject,
        vapidPublicKey,
        vapidPrivateKey
    );
    console.log('✅ Web Push VAPID details set');
}

/**
 * Send a push notification to a user
 * @param {object} subscription - The push subscription object
 * @param {object} payload - The notification payload
 */
const sendPushNotification = async (subscription, payload) => {
    try {
        const payloadString = JSON.stringify(payload);
        await webpush.sendNotification(subscription, payloadString);
        console.log('✅ Push notification sent successfully');
        return { success: true };
    } catch (error) {
        console.error('❌ Error sending push notification:', error);
        // If 410 (Gone) or 404 (Not Found), the subscription is no longer valid
        if (error.statusCode === 410 || error.statusCode === 404) {
            return { success: false, expired: true };
        }
        return { success: false, error: error.message };
    }
};

module.exports = {
    sendPushNotification
};
