require('dotenv').config();

const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo').MongoStore;
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const path = require('path');
const mongoose = require('mongoose');
const {
  User,
  Budget,
  Transaction,
  toApiDoc,
  toApiDocs,
  isValidObjectId,
  connectDatabase,
  initDatabase
} = require('./database');

async function sendEmail({ to, subject, html, text }) {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || `"Aura Finance" <${process.env.SMTP_USER}>`,
        to,
        subject,
        text,
        html
      });
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error('SMTP email error, falling back to console log:', err.message);
    }
  }

  // Graceful development/test fallback
  console.log(`\n======================================================`);
  console.log(`[AURA SECURE NOTIFICATION to: ${to}]`);
  console.log(`SUBJECT: ${subject}`);
  console.log(`BODY:\n${text}`);
  console.log(`======================================================\n`);
  return { success: true, devMode: true };
}

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'personal-expense-tracker-super-secret-key-12345',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    clientPromise: connectDatabase().then(() => mongoose.connection.getClient())
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
}));

app.use(express.static(path.join(__dirname, 'public')));

const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }
  next();
};

function getUserObjectId(sessionUserId) {
  return new mongoose.Types.ObjectId(sessionUserId);
}

// ==========================================
// 1. AUTHENTICATION API ROUTES
// ==========================================

app.post('/api/auth/register', async (req, res) => {
  const { name, username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields (username, email, password) are required.' });
  }

  try {
    const trimmedUsername = username.trim();
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      $or: [{ username: trimmedUsername }, { email: normalizedEmail }]
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username or Email is already registered.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      name: name ? name.trim() : trimmedUsername,
      username: trimmedUsername,
      email: normalizedEmail,
      password_hash: passwordHash,
      currency: 'INR'
    });

    req.session.userId = user._id.toString();
    req.session.username = trimmedUsername;

    return res.status(201).json({
      message: 'Registration successful!',
      user: toApiDoc(user)
    });
  } catch (err) {
    console.error('Registration failed:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { credential, password } = req.body;

  if (!credential || !password) {
    return res.status(400).json({ error: 'Username/Email and password are required.' });
  }

  try {
    const trimmedCredential = credential.trim();
    const user = await User.findOne({
      $or: [{ username: trimmedCredential }, { email: trimmedCredential.toLowerCase() }]
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials. User not found.' });
    }

    if (!user.password_hash) {
      return res.status(400).json({ error: 'This account was created via Google Sign-In. Please sign in with Google.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials. Incorrect password.' });
    }

    req.session.userId = user._id.toString();
    req.session.username = user.username;

    return res.json({
      message: 'Login successful!',
      user: toApiDoc(user)
    });
  } catch (err) {
    console.error('Login failed:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Google / Gmail Sign In & Sign Up
app.post('/api/auth/google', async (req, res) => {
  const { email, name, google_id, avatar } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'A valid email address is required for Google Sign-In.' });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    let user = await User.findOne({
      $or: [
        { email: normalizedEmail },
        ...(google_id ? [{ google_id }] : [])
      ]
    });

    if (user) {
      let updated = false;
      if (google_id && !user.google_id) {
        user.google_id = google_id;
        updated = true;
      }
      if (avatar && !user.avatar) {
        user.avatar = avatar;
        updated = true;
      }
      if (name && !user.name) {
        user.name = name;
        updated = true;
      }
      if (updated) {
        await user.save();
      }
    } else {
      let baseUsername = (name ? name.toLowerCase().replace(/[^a-z0-9]/g, '') : normalizedEmail.split('@')[0].replace(/[^a-z0-9]/g, '')) || 'aura_user';
      let username = baseUsername;
      let counter = 1;
      while (await User.findOne({ username })) {
        username = `${baseUsername}${counter++}`;
      }

      user = await User.create({
        name: name || baseUsername,
        username,
        email: normalizedEmail,
        google_id: google_id || `google_${Date.now()}`,
        avatar: avatar || '',
        auth_provider: 'google',
        password_hash: '',
        currency: 'INR'
      });
    }

    req.session.userId = user._id.toString();
    req.session.username = user.username;

    return res.json({
      message: 'Signed in with Google successfully!',
      user: toApiDoc(user)
    });
  } catch (err) {
    console.error('Google auth error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Forgot Password - Dispatch 6-digit OTP
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Registered email address is required.' });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({ error: 'No account registered with this email address.' });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.otp = {
      code: otpCode,
      expires_at: expiresAt
    };
    await user.save();

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #2563eb; font-size: 26px; font-weight: 700; margin: 0;">Aura Finance</h1>
          <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Personal Expense & Wealth Intelligence</p>
        </div>
        <p style="font-size: 16px; line-height: 1.5; color: #334155;">Hello <strong>${user.name || user.username}</strong>,</p>
        <p style="font-size: 15px; line-height: 1.6; color: #475569;">
          We received a request to reset your Aura Finance password. Please use the 6-digit one-time verification code below to authorize your password reset:
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <div style="display: inline-block; background: #eff6ff; border: 2px dashed #3b82f6; border-radius: 12px; padding: 14px 32px;">
            <span style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #1d4ed8; font-family: monospace;">${otpCode}</span>
          </div>
          <p style="font-size: 13px; color: #94a3b8; margin-top: 10px;">Expires in 10 minutes</p>
        </div>
        <p style="font-size: 13px; line-height: 1.5; color: #64748b;">
          If you did not request this code, you can safely ignore this message. Your credentials remain safe and protected.
        </p>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">
          © ${new Date().getFullYear()} Aura Finance. All rights reserved.
        </p>
      </div>
    `;

    await sendEmail({
      to: user.email,
      subject: `[Aura Finance] ${otpCode} is your Password Reset Code`,
      text: `Your Aura Finance OTP code is: ${otpCode}. This code is valid for 10 minutes.`,
      html: htmlContent
    });

    const isSmtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER);

    return res.json({
      message: 'A 6-digit OTP code has been dispatched to your email.',
      email: user.email,
      devOtp: isSmtpConfigured ? undefined : otpCode
    });
  } catch (err) {
    console.error('Forgot password dispatch error:', err);
    return res.status(500).json({ error: 'Failed to dispatch OTP. Please try again.' });
  }
});

// Verify OTP Code
app.post('/api/auth/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP code are required.' });
  }

  try {
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user || !user.otp || !user.otp.code) {
      return res.status(400).json({ error: 'No OTP requested or code expired. Please request a new one.' });
    }

    if (new Date() > new Date(user.otp.expires_at)) {
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    if (user.otp.code.trim() !== otp.trim()) {
      return res.status(400).json({ error: 'Incorrect OTP code. Please check and try again.' });
    }

    return res.json({ message: 'OTP verified successfully.', verified: true });
  } catch (err) {
    console.error('Verify OTP error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Reset Password with Verified OTP
app.post('/api/auth/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    return res.status(400).json({ error: 'Email, OTP, and new password are required.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }

  try {
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user || !user.otp || !user.otp.code) {
      return res.status(400).json({ error: 'No valid OTP found or code expired.' });
    }

    if (new Date() > new Date(user.otp.expires_at)) {
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    if (user.otp.code.trim() !== otp.trim()) {
      return res.status(400).json({ error: 'Incorrect OTP code.' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password_hash = await bcrypt.hash(newPassword, salt);
    user.otp = { code: null, expires_at: null };
    await user.save();

    return res.json({ message: 'Password reset successfully! You can now log in with your new password.' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/auth/me', async (req, res) => {
  if (!req.session.userId) {
    return res.json({ loggedIn: false });
  }

  try {
    if (!isValidObjectId(req.session.userId)) {
      req.session.destroy();
      return res.json({ loggedIn: false });
    }

    const user = await User.findById(req.session.userId)
      .select('name username email currency phone bio avatar auth_provider created_at');
    if (!user) {
      req.session.destroy();
      return res.json({ loggedIn: false });
    }

    return res.json({ loggedIn: true, user: toApiDoc(user) });
  } catch (err) {
    console.error('Fetch profile failed:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/auth/profile', requireAuth, async (req, res) => {
  const { name, username, email, password, currency, phone, bio, avatar } = req.body;
  const userId = req.session.userId;

  try {
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const trimmedUsername = username ? username.trim() : currentUser.username;
    const normalizedEmail = email ? email.trim().toLowerCase() : currentUser.email;

    const existingUser = await User.findOne({
      _id: { $ne: userId },
      $or: [{ username: trimmedUsername }, { email: normalizedEmail }]
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username or Email is already in use by another account.' });
    }

    const updates = {
      username: trimmedUsername,
      email: normalizedEmail
    };

    if (name !== undefined) updates.name = name.trim();
    if (currency !== undefined) updates.currency = currency.trim();
    if (phone !== undefined) updates.phone = phone.trim();
    if (bio !== undefined) updates.bio = bio.trim();
    if (avatar !== undefined) updates.avatar = avatar.trim();

    if (password && password.length >= 6) {
      const salt = await bcrypt.genSalt(10);
      updates.password_hash = await bcrypt.hash(password, salt);
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updates, { new: true })
      .select('name username email currency phone bio avatar auth_provider created_at');
    
    req.session.username = updatedUser.username;

    return res.json({
      message: 'Profile updated successfully!',
      user: toApiDoc(updatedUser)
    });
  } catch (err) {
    console.error('Profile update failed:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Account Data Export
app.get('/api/user/data/export', requireAuth, async (req, res) => {
  try {
    const userId = getUserObjectId(req.session.userId);
    const [user, transactions, budgets] = await Promise.all([
      User.findById(userId).select('name username email currency phone bio avatar auth_provider created_at'),
      Transaction.find({ user_id: userId }).sort({ date: -1 }),
      Budget.find({ user_id: userId })
    ]);

    res.json({
      exportDate: new Date().toISOString(),
      user: toApiDoc(user),
      transactions: toApiDocs(transactions),
      budgets: toApiDocs(budgets)
    });
  } catch (err) {
    console.error('Data export failed:', err);
    res.status(500).json({ error: 'Failed to export account data' });
  }
});

// Account Data Import
app.post('/api/user/data/import', requireAuth, async (req, res) => {
  try {
    const userId = getUserObjectId(req.session.userId);
    const { transactions, budgets } = req.body;

    let importedTxCount = 0;
    if (Array.isArray(transactions) && transactions.length > 0) {
      const txDocs = transactions.map((t) => ({
        user_id: userId,
        type: t.type === 'income' ? 'income' : 'expense',
        category: (t.category || 'Miscellaneous').trim(),
        amount: Math.abs(parseFloat(t.amount) || 0),
        description: (t.description || '').trim(),
        date: t.date || new Date().toISOString().split('T')[0]
      })).filter((t) => t.amount > 0);

      if (txDocs.length > 0) {
        await Transaction.insertMany(txDocs);
        importedTxCount = txDocs.length;
      }
    }

    let importedBudgetCount = 0;
    if (Array.isArray(budgets) && budgets.length > 0) {
      for (const b of budgets) {
        if (b.category && b.limit_amount > 0) {
          await Budget.findOneAndUpdate(
            { user_id: userId, category: b.category.trim() },
            { limit_amount: parseFloat(b.limit_amount) },
            { upsert: true }
          );
          importedBudgetCount++;
        }
      }
    }

    res.json({
      message: `Successfully imported ${importedTxCount} transactions and ${importedBudgetCount} budgets.`,
      importedTxCount,
      importedBudgetCount
    });
  } catch (err) {
    console.error('Data import failed:', err);
    res.status(500).json({ error: 'Failed to import data: ' + err.message });
  }
});

// Clear All Transactions
app.delete('/api/user/data/clear', requireAuth, async (req, res) => {
  try {
    const userId = getUserObjectId(req.session.userId);
    await Transaction.deleteMany({ user_id: userId });
    res.json({ message: 'All personal transactions cleared successfully.' });
  } catch (err) {
    console.error('Clear data failed:', err);
    res.status(500).json({ error: 'Failed to clear transactions.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout session destroy failed:', err);
      return res.status(500).json({ error: 'Could not log out. Please try again.' });
    }
    res.clearCookie('connect.sid');
    return res.json({ message: 'Logout successful' });
  });
});

// ==========================================
// 2. TRANSACTIONS API ROUTES (CRUD)
// ==========================================

app.get('/api/transactions', requireAuth, async (req, res) => {
  try {
    const userId = getUserObjectId(req.session.userId);
    const transactions = await Transaction.find({ user_id: userId })
      .sort({ date: -1, created_at: -1 });
    res.json(toApiDocs(transactions));
  } catch (err) {
    console.error('Fetch transactions failed:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/transactions', requireAuth, async (req, res) => {
  const { type, category, amount, description, date } = req.body;

  if (!type || !category || !amount || !date) {
    return res.status(400).json({ error: 'Missing required transaction details.' });
  }

  if (type !== 'income' && type !== 'expense') {
    return res.status(400).json({ error: 'Invalid transaction type.' });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number.' });
  }

  try {
    const userId = getUserObjectId(req.session.userId);
    const transaction = await Transaction.create({
      user_id: userId,
      type,
      category: category.trim(),
      amount: parsedAmount,
      description: description ? description.trim() : '',
      date
    });

    res.status(201).json(toApiDoc(transaction));
  } catch (err) {
    console.error('Add transaction failed:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/transactions/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { type, category, amount, description, date } = req.body;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid transaction ID.' });
  }

  if (!type || !category || !amount || !date) {
    return res.status(400).json({ error: 'Missing required transaction details.' });
  }

  if (type !== 'income' && type !== 'expense') {
    return res.status(400).json({ error: 'Invalid transaction type.' });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number.' });
  }

  try {
    const userId = getUserObjectId(req.session.userId);
    const transaction = await Transaction.findOneAndUpdate(
      { _id: id, user_id: userId },
      {
        type,
        category: category.trim(),
        amount: parsedAmount,
        description: description ? description.trim() : '',
        date
      },
      { new: true }
    );

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found or unauthorized.' });
    }

    res.json({
      message: 'Transaction updated successfully.',
      transaction: toApiDoc(transaction)
    });
  } catch (err) {
    console.error('Update transaction failed:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/api/transactions/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid transaction ID.' });
  }

  try {
    const userId = getUserObjectId(req.session.userId);
    const result = await Transaction.deleteOne({ _id: id, user_id: userId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Transaction not found or unauthorized.' });
    }

    res.json({ message: 'Transaction deleted successfully.' });
  } catch (err) {
    console.error('Delete transaction failed:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ==========================================
// 3. BUDGETS API ROUTES
// ==========================================

app.get('/api/budgets', requireAuth, async (req, res) => {
  try {
    const userId = getUserObjectId(req.session.userId);
    const budgets = await Budget.find({ user_id: userId }).sort({ category: 1 });
    res.json(toApiDocs(budgets));
  } catch (err) {
    console.error('Fetch budgets failed:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/budgets', requireAuth, async (req, res) => {
  const { category, limit_amount } = req.body;

  if (!category || !limit_amount) {
    return res.status(400).json({ error: 'Category and budget limit amount are required.' });
  }

  const parsedLimit = parseFloat(limit_amount);
  if (isNaN(parsedLimit) || parsedLimit <= 0) {
    return res.status(400).json({ error: 'Budget limit must be a positive number.' });
  }

  try {
    const userId = getUserObjectId(req.session.userId);
    const trimmedCategory = category.trim();

    const budget = await Budget.findOneAndUpdate(
      { user_id: userId, category: trimmedCategory },
      { limit_amount: parsedLimit },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({ message: 'Budget set successfully.', budget: toApiDoc(budget) });
  } catch (err) {
    console.error('Set budget failed:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/api/budgets/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ error: 'Invalid budget ID.' });
  }

  try {
    const userId = getUserObjectId(req.session.userId);
    const result = await Budget.deleteOne({ _id: id, user_id: userId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Budget not found or unauthorized.' });
    }

    res.json({ message: 'Budget deleted successfully.' });
  } catch (err) {
    console.error('Delete budget failed:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ==========================================
// 4. STATS & ANALYTICS REPORTS API
// ==========================================

app.get('/api/stats/summary', requireAuth, async (req, res) => {
  const userId = getUserObjectId(req.session.userId);
  const { month } = req.query;

  try {
    const baseMatch = { user_id: userId };
    const monthMatch = month ? { date: { $regex: `^${month}` } } : {};

    const incomeMatch = { ...baseMatch, type: 'income', ...monthMatch };
    const expenseMatch = { ...baseMatch, type: 'expense', ...monthMatch };

    const [incomeResult, expenseResult, budgets, expenseTransactions] = await Promise.all([
      Transaction.aggregate([
        { $match: incomeMatch },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Transaction.aggregate([
        { $match: expenseMatch },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Budget.find({ user_id: userId }),
      Transaction.find({ user_id: userId, type: 'expense', ...(month ? { date: { $regex: `^${month}` } } : {}) })
    ]);

    const totalIncome = incomeResult[0]?.total || 0;
    const totalExpense = expenseResult[0]?.total || 0;

    const spentByCategory = {};
    expenseTransactions.forEach((tx) => {
      spentByCategory[tx.category] = (spentByCategory[tx.category] || 0) + tx.amount;
    });

    const budgetsStatus = budgets.map((b) => ({
      id: b._id.toString(),
      category: b.category,
      limit_amount: b.limit_amount,
      spent: spentByCategory[b.category] || 0
    }));

    res.json({
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense,
      budgetsStatus
    });
  } catch (err) {
    console.error('Fetch dashboard stats failed:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/stats/category-breakdown', requireAuth, async (req, res) => {
  try {
    const userId = getUserObjectId(req.session.userId);
    const categories = await Transaction.aggregate([
      { $match: { user_id: userId, type: 'expense' } },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
      { $project: { _id: 0, category: '$_id', total: 1 } }
    ]);
    res.json(categories);
  } catch (err) {
    console.error('Fetch category breakdown failed:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/stats/monthly-trends', requireAuth, async (req, res) => {
  try {
    const userId = getUserObjectId(req.session.userId);
    const trends = await Transaction.aggregate([
      { $match: { user_id: userId } },
      {
        $addFields: {
          month: { $substr: ['$date', 0, 7] }
        }
      },
      {
        $group: {
          _id: '$month',
          income: {
            $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] }
          },
          expense: {
            $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] }
          }
        }
      },
      { $sort: { _id: -1 } },
      { $limit: 6 },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          month: '$_id',
          income: 1,
          expense: 1
        }
      }
    ]);
    res.json(trends);
  } catch (err) {
    console.error('Fetch monthly trends failed:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function startServer(port) {
  app.listen(port, async () => {
    console.log(`Server is running at: http://localhost:${port}`);
    await initDatabase();
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is already in use. Trying alternative port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server execution error:', err);
    }
  });
}

if (require.main === module) {
  startServer(PORT);
}

module.exports = app;
