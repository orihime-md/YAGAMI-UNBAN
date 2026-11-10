const express = require('express');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust Render's reverse proxy hops natively for accurate visitor IP tracing
app.set('trust proxy', 1);

// Rate Limiter: Safe setup to sit behind load balancers cleanly
const appealLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour window
    max: 5, // Limit each client IP to 5 requests per hour
    message: { success: false, error: "Too many requests from this terminal. Locked for 1 hour." },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(express.json());
app.use(express.static(__dirname));

// Cleaned destination addresses for Meta's support desks (No URL characters)
const TARGET_QUEUES = [
    "android_web@://whatsapp.com",
    "smb_web@://whatsapp.com",
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
        return res.status(400).json({ success: false, error: 'Phone number input is blank.' });
    }

    // Normalization: Strips out spaces, dashes, dots, and brackets before evaluation
    const normalizedPhone = phoneNumber.replace(/[\s\-\(\)\.]/g, '');

    // Strict E.164 verification layout check
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(normalizedPhone)) {
        return res.status(400).json({ success: false, error: 'Invalid international format. Must begin with + followed by country code (e.g., +CC...)' });
    }

    // Match configurations setup identically to the Skill Mate environment template
    const BREVO_API_KEY = String(process.env.BREVO_API_KEY || "").trim();
    const BREVO_FROM = String(process.env.BREVO_FROM || "").trim();

    if (!BREVO_API_KEY || !BREVO_FROM) {
        return res.status(500).json({ success: false, error: 'Render dashboard environment variables are missing.' });
    }

    try {
        const randomTemplate = APPEAL_TEMPLATES[Math.floor(Math.random() * APPEAL_TEMPLATES.length)];
        const emailBody = randomTemplate.replace(/{phone}/g, normalizedPhone);

        // Map secondary targets as blind carbon copies (BCC) just like structural email setups
        const bccArray = TARGET_QUEUES.slice(1).map(email => ({ email: email }));
        
        const payload = {
            sender: { name: "YAGAMI Terminal Node", email: BREVO_FROM },
            to: [{ email: TARGET_QUEUES[0] }], // Primary channel target recipient
            bcc: bccArray,                     // Concurrent delivery lines
            subject: `Urgent: Account Review Request for ${normalizedPhone}`,
            textContent: emailBody
        };

        // FIXED: Legitimate, clean, non-mangled Brevo HTTPS REST API Route
        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: 'POST',
            headers: {
                'api-key': BREVO_API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        // Check if Brevo engine generated a messageId or gave a successful creation status code
        if (response.ok && (data.messageId || response.status === 201 || response.status === 200)) {
            return res.status(200).json({ success: true, message: 'Appeal safely dispatched through secure API grid tunnels.' });
        } else {
            console.error('Brevo API Error Log:', data);
            return res.status(500).json({ success: false, error: data.message || 'Brevo API node rejected delivery parameters.' });
        }

    } catch (error) {
        console.error('API Transmission Hook Error:', error);
        return res.status(500).json({ success: false, error: 'The core network API channel failed to resolve.' });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`[YAGAMI UNBAN SECURE HTTPS CORE RUNNING ON PORT ${PORT}]`);
});
