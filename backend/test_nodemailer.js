require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

async function testEmail() {
    console.log("Testing Nodemailer with:", process.env.SMTP_USER);
    try {
        const info = await transporter.sendMail({
            from: `"NeuralShield Test" <${process.env.SMTP_USER}>`,
            to: process.env.SMTP_USER, // sending it to yourself!
            subject: "Testing Nodemailer Configuration",
            html: "<b>If you see this, nodemailer is working perfectly with your App Password!</b>",
        });
        console.log("SUCCESS! Message sent:", info.messageId);
    } catch (error) {
        console.error("FAILED TO SEND:", error);
    }
}

testEmail();
