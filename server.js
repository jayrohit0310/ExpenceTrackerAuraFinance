require('dotenv').config();

const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo').MongoStore;
const bcrypt = require('bcryptjs');
const path = require('path');
const mongoose = require('mongoose');
const {
  User,
  Budget,
  Transaction,
  toApiDoc,
  toApiDocs,
  isValidObjectId,
  initDatabase
} = require('./database');

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
    mongoUrl: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/expense_tracker'
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
  const { username, email, password } = req.body;

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
      username: trimmedUsername,
      email: normalizedEmail,
      password_hash: passwordHash
    });

    req.session.userId = user._id.toString();
    req.session.username = trimmedUsername;

    return res.status(201).json({
      message: 'Registration successful!',
      user: { id: user._id.toString(), username: trimmedUsername, email: normalizedEmail }
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

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials. Incorrect password.' });
    }

    req.session.userId = user._id.toString();
    req.session.username = user.username;

    return res.json({
      message: 'Login successful!',
      user: { id: user._id.toString(), username: user.username, email: user.email }
    });
  } catch (err) {
    console.error('Login failed:', err);
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

    const user = await User.findById(req.session.userId).select('username email created_at');
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
  const { username, email, password } = req.body;
  const userId = req.session.userId;

  if (!username || !email) {
    return res.status(400).json({ error: 'Username and email are required.' });
  }

  try {
    const trimmedUsername = username.trim();
    const normalizedEmail = email.trim().toLowerCase();

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

    if (password && password.length >= 6) {
      const salt = await bcrypt.genSalt(10);
      updates.password_hash = await bcrypt.hash(password, salt);
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updates, { new: true });
    
    req.session.username = updatedUser.username;

    return res.json({
      message: 'Profile updated successfully!',
      user: { id: updatedUser._id.toString(), username: updatedUser.username, email: updatedUser.email }
    });
  } catch (err) {
    console.error('Profile update failed:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
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
