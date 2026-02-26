require('dotenv').config();
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function testSend() {
    console.log("Testing Resend...", process.env.RESEND_API_KEY.substring(0, 10) + "...");
    const { data, error } = await resend.emails.send({
        from: 'Fraud Detection System <onboarding@resend.dev>',
        to: 'omkar8434996@gmail.com', // Replace with the actual email you signed up with
        subject: 'Test Email',
        html: '<p>Test.</p>',
    });

    if (error) {
        console.error("RESEND ERROR:", JSON.stringify(error, null, 2));
    } else {
        console.log("RESEND SUCCESS:", data);
    }
}

testSend();
