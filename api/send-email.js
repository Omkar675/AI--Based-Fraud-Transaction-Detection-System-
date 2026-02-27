export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { to, subject, html, secret } = req.body;
    if (secret !== process.env.JWT_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Dynamic import of nodemailer to prevent it from failing client-side builds
    const nodemailer = await import('nodemailer');

    try {
        const transporter = nodemailer.default.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            }
        });

        const info = await transporter.sendMail({
            from: `"NeuralShield" <${process.env.SMTP_USER}>`,
            to,
            subject,
            html
        });

        res.status(200).json({ success: true, messageId: info.messageId });
    } catch (error) {
        console.error("Vercel SMTP Error:", error);
        res.status(500).json({ error: error.message });
    }
}
