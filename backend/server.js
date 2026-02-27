require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors({
    origin: function (origin, callback) {
        callback(null, true); // Dynamically allow any origin (great for full Vercel compatibility)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));
app.use(express.json());

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Email transporter setup
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    tls: {
        rejectUnauthorized: false
    },
    // Force IPv4 to prevent Render throwing ENETUNREACH internally
    family: 4
});

// Helper for sending verification email
const sendVerificationEmail = async (email, token) => {
    const verifyLink = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

    const mailOptions = {
        from: `"NeuralShield Fraud Detection" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "Verify your email address",
        html: `
      <h2>Welcome to NeuralShield Fraud Detection System</h2>
      <p>Please click the link below to verify your email address:</p>
      <a href="${verifyLink}" style="padding: 10px 15px; background-color: #0b57d0; color: white; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px; margin-bottom: 20px;">Verify Email</a>
      <p>If the button doesn't work, copy and paste this link: <br/> ${verifyLink}</p>
    `
    };

    await transporter.sendMail(mailOptions);
};

// Auth Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: "Access denied" });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid token" });
        req.user = user;
        next();
    });
};

// --- ROUTES ---

// 1. User Registration
app.post('/api/auth/register', async (req, res) => {
    const client = await pool.connect();
    try {
        const { email, password, fullName } = req.body;

        // Check if user exists
        const userCheck = await client.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        await client.query('BEGIN');

        // Insert user
        const userResult = await client.query(
            'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
            [email, passwordHash]
        );
        const user = userResult.rows[0];

        // Insert profile
        if (fullName) {
            await client.query(
                'INSERT INTO user_profiles (user_id, full_name) VALUES ($1, $2)',
                [user.id, fullName]
            );
        }

        // Create verification token
        const verificationToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1d' });
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day from now

        await client.query(
            'INSERT INTO email_verifications (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [user.id, verificationToken, expiresAt]
        );

        await client.query('COMMIT');

        // Send email (wrapping in try-catch so it doesn't fail registration if mail fails)
        try {
            await sendVerificationEmail(email, verificationToken);
        } catch (mailErr) {
            console.error('Failed to send verification email:', mailErr);
        }

        res.status(201).json({ message: 'Registration successful. Please check your email to verify.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

// 2. Email Verification
app.post('/api/auth/verify-email', async (req, res) => {
    try {
        const { token } = req.body;

        // Token valid?
        const verificationCheck = await pool.query(
            'SELECT * FROM email_verifications WHERE token = $1 AND expires_at > NOW()',
            [token]
        );

        if (verificationCheck.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired verification token' });
        }

        const verificationRecord = verificationCheck.rows[0];

        await pool.query('BEGIN');

        // Update user
        await pool.query('UPDATE users SET is_verified = TRUE WHERE id = $1', [verificationRecord.user_id]);

        // Delete token
        await pool.query('DELETE FROM email_verifications WHERE user_id = $1', [verificationRecord.user_id]);

        await pool.query('COMMIT');

        res.json({ message: 'Email verified successfully. You can now log in.' });
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// 3. User Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) return res.status(400).json({ error: 'Invalid credentials' });

        const user = result.rows[0];

        // Check password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' });

        // Check verification
        if (!user.is_verified) return res.status(403).json({ error: 'Please verify your email before logging in' });

        // Generate JWT
        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Update last login
        await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

        res.json({
            token,
            user: { id: user.id, email: user.email }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// 4. Get Current User Profile
app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT u.id, u.email, u.is_verified, p.full_name, p.role
      FROM users u
      LEFT JOIN user_profiles p ON u.id = p.user_id
      WHERE u.id = $1
    `, [req.user.id]);

        if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// 5. Submit Transaction
app.post('/api/transactions', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const {
            transaction_id, amount, sender_name, sender_account,
            receiver_name, receiver_account, transaction_type,
            description, transaction_date
        } = req.body;

        await client.query('BEGIN');

        // Insert transaction
        const txResult = await client.query(`
      INSERT INTO transactions 
      (user_id, transaction_id, amount, sender_name, sender_account, receiver_name, receiver_account, transaction_type, description, transaction_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `, [
            req.user.id, transaction_id, amount, sender_name, sender_account,
            receiver_name, receiver_account, transaction_type, description, transaction_date
        ]);

        const tx_id = txResult.rows[0].id;

        // Very simple heuristic logic since complex ML happens on Python typically, 
        // or just pass through risk metrics sent by the frontend's pre-processor
        const {
            risk_score = 10,
            risk_level = 'low',
            flags = [],
            velocity_check = false,
            amount_anomaly = false,
            unusual_time = false,
            duplicate_detected = false,
            analysis_details = {}
        } = req.body.analysis || {};

        // Analyze transaction & store
        await client.query(`
      INSERT INTO fraud_analysis 
      (transaction_id, user_id, risk_score, risk_level, flags, velocity_check, amount_anomaly, unusual_time, duplicate_detected, analysis_details)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
            tx_id, req.user.id, risk_score, risk_level, JSON.stringify(flags),
            velocity_check, amount_anomaly, unusual_time, duplicate_detected, JSON.stringify(analysis_details)
        ]);

        await client.query('COMMIT');
        res.status(201).json({ message: 'Transaction recorded successfully', id: tx_id });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    } finally {
        client.release();
    }
});

// 6. Get Recent Transactions
app.get('/api/transactions', authenticateToken, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const result = await pool.query(`
      SELECT t.*, fa.risk_score, fa.risk_level, fa.flags, fa.velocity_check, fa.amount_anomaly, fa.unusual_time, fa.duplicate_detected
      FROM transactions t
      LEFT JOIN fraud_analysis fa ON t.id = fa.transaction_id
      WHERE t.user_id = $1
      ORDER BY t.created_at DESC
      LIMIT $2
    `, [req.user.id, limit]);

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
});
