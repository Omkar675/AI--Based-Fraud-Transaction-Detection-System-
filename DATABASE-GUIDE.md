# PostgreSQL Database Setup Guide

This guide will help you set up the new PostgreSQL database for your Fraud Detection System from scratch. 

## 1. Install PostgreSQL

**Windows:**
1. Download the installer from the [Official PostgreSQL site](https://www.postgresql.org/download/windows/) (version 15 or 16 recommended).
2. Run the installer. Leave ports and settings as default.
3. **IMPORTANT**: When prompted for a password, remember it! It will be your `postgres` user password.

**Mac / Linux:**
```bash
# Mac (via Homebrew)
brew install postgresql@15
brew services start postgresql@15

# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql.service
```

## 2. Create the Database

Open your terminal or command prompt. Connect to the PostgreSQL shell using your `postgres` user.

```bash
# On Windows / Mac
psql -U postgres
# (It will prompt for the password you set during installation)

# On Linux (Ubuntu)
sudo -u postgres psql
```

Once inside the `postgres=#` prompt, run:

```sql
CREATE DATABASE fraud_detection_db;
\q
```
*(The `\q` command exits the shell)*

## 3. Import the Schema

Now that the database exists, we need to create the tables. Open a terminal in the root of your project folder where `backend/database/schema.sql` resides:

```bash
psql -U postgres -d fraud_detection_db -f backend/database/schema.sql
```

*(This reads the schema file and creates all tables, such as `users`, `transactions`, `fraud_analysis`, etc.)*

## 4. Environment Variables

Navigate to the `backend` folder and copy the example environment file:
```bash
cd backend
cp .env.example .env
```

Open `.env` in your editor and update the `DATABASE_URL` with the password you set in Step 1.
For example, if your password is `mypassword`, it should look like:
`DATABASE_URL=postgres://postgres:mypassword@localhost:5432/fraud_detection_db`

*(You also need to update the `SMTP_*` values in `.env` if you want to test the email verification. A Gmail "App Password" works great for this.)*

## 5. Install Dependencies & Start Server

Now you're ready to start the backend!

```bash
# Assuming you are still in the backend/ folder
ase) PS E:\AI--Based-Fraud-Transaction-Detection-System-\backend> npm run dev

> fraud-detection-backend@1.0.0 dev
> nodemon server.js

[nodemon] 3.1.14
[nodemon] to restart at any time, enter `rs`
[nodemon] watching path(s): *.*
[nodemon] watching extensions: js,mjs,cjs,json
[nodemon] starting `node server.js`
Backend server running on port 5000
```

You should see: `Backend server running on port 5000`

## 6. Frontend Integration

In your React frontend (`src/`), you now need to update your API calls to point to this new backend (e.g. `http://localhost:5000`) instead of Supabase. The Express server provides the following endpoints out of the box:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/verify-email`
- `POST /api/transactions`
- `GET /api/transactions`
