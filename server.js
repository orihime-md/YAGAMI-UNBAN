const express = require('express');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// FIX 1: Trust Render's reverse proxy topology so express-rate-limit reads real client IPs
app.set('trust proxy', 1);

// Rate Limiter: Set to safely sit behind Render's infrastructure
const appealLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 Hour window
    max: 5, // Limit each IP to 5 requests per window
    message: { success: false, error: "Too many requests from this terminal. Locked for 1 hour." },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false } // Silences the platform warning completely
});

app.use(express.json());
app.use(express.static(__dirname));

// FIX 2: Restored perfectly clean target emails for Meta's queues (No more URL symbols)
const TARGET_QUEUES = [
    "android_web@support.whatsapp.com",
    "smb_web@support.whatsapp.com",
    "support@whatsapp.com"
];

const APPEAL_TEMPLATES = [
    "Hello Team, My business helpline ({phone}) was unexpectedly restricted this morning. This is our primary point of contact for customer support, routing active orders, and managing delivery logistics for local clients. We strictly operate in compliance with your Business Terms of Service. This sudden outage is causing direct financial damage and breaking customer trust. Please manually audit our recent sessions and reinstate the line immediately.",
    "To the Security Review Board, I recently acquired this mobile line ({phone}) from my network carrier provider and registered it on WhatsApp. It appears the previous owner committed violations that flagged the number on your automated systems. As the new, verified legal owner of this line, I am completely locked out of communicating with my contacts. Kindly reset the system signature for this number so I can use my phone normally.",
    "Urgent Assistance Required: My phone number {phone} was suspended without prior warning. I am the primary health coordinator and caretaker for an elderly family member, and this account is my absolute lifeline for sharing prescription details, coordinating medical appointments, and communicating with emergency services. This false positive flag is posing a serious safety risk. Please review my account compliance status and lift this ban immediately.",
    "Dear WhatsApp Support, The account associated with {phone} has been flagged for review. This line is assigned to our internal corporate communications team and is used exclusively for internal staff coordination and verified b2b workspace operations. No bulk marketing or unauthorized outreach has occurred from this terminal. Please escalate this ticket to a human moderator to verify our business documentation and clear the restriction.",
    "Hello Support, My personal account ({phone}) was disconnected due to an automated security system trigger. I suspect my device was caught in a false-positive loop while switching network towers or handling a routine background verification check. I have never used modified applications, unofficial clients, or automated tools. I am a long-term compliant user; please review the telemetry data and restore access.",
    "To Whom It May Concern, My active account ({phone}) has been locked out by your automated firewalls. As an independent contractor, this account holds all my active client chat histories, project milestone confirmations, and billing agreements. Being unable to access these chats is freezing my daily livelihood. I certify that I have not engaged in spam behavior. Please manually review the account logs and clear this error."
];

app.post('/api/appeal', appealLimiter, async (req, res) => {
    let { phoneNumber } = req.body;

    if (!phoneNumber) {
        return res.status(400).json({ success: false, error: 'Phone number input is completely blank.' });
    }

    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber.replace(/\s+/g, ''))) {
        return res.status(400).json({ success: false, error: 'Invalid format. Use international layout (+CC...)' });
    }

    if (!process.env.BREVO_USER || !process.env.BREVO_SMTP_KEY || !process.env.BREVO_SENDER) {
        return res.status(500).json({ success: false, error: 'Render environment keys are misconfigured.' });
    }

    try {
        // FIX 3: Fully verified, clean hostname configuration string
        const transporter = nodemailer.createTransport({
            host: 'smtp-relay.brevo.com',
            port: 587,
            secure: false,
            auth: {
                user: process.env.BREVO_USER,
                pass: process.env.BREVO_SMTP_KEY
            }
        });

        const randomTemplate = APPEAL_TEMPLATES[Math.floor(Math.random() * APPEAL_TEMPLATES.length)];
        const emailBody = randomTemplate.replace(/{phone}/g, phoneNumber);

        const deliveryPromises = TARGET_QUEUES.map(queue => {
            return transporter.sendMail({
                from: `"YAGAMI System" <${process.env.BREVO_SENDER}>`,
                to: queue,
                subject: `Urgent: Account Review Request for ${phoneNumber}`,
                text: emailBody
            });
        });

        await Promise.all(deliveryPromises);
        return res.status(200).json({ success: true, message: 'Appeal batch successfully routed onto grid.' });

    } catch (error) {
        console.error('SMTP Relay Error Configuration:', error);
        return res.status(500).json({ success: false, error: 'Relay link rejected authentication or dropped.' });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`[YAGAMI UNBAN CORE ENGINES ONLINE ON PORT ${PORT}]`);
});
