const mongoose = require('mongoose');

const LOCAL_URI = 'mongodb://127.0.0.1:27017/expense_tracker';
let activeMongoUri = process.env.MONGODB_URI || LOCAL_URI;
let connectionPromise;

const userSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password_hash: { type: String, default: '' },
  auth_provider: { type: String, enum: ['local', 'google'], default: 'local' },
  google_id: { type: String, default: null, sparse: true },
  avatar: { type: String, default: '' },
  currency: { type: String, default: 'INR' },
  phone: { type: String, default: '' },
  bio: { type: String, default: '' },
  otp: {
    code: { type: String, default: null },
    expires_at: { type: Date, default: null }
  },
  created_at: { type: Date, default: Date.now }
});

const budgetSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category: { type: String, required: true, trim: true },
  limit_amount: { type: Number, required: true, min: 0 },
  created_at: { type: Date, default: Date.now }
});

budgetSchema.index({ user_id: 1, category: 1 }, { unique: true });

const transactionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true, enum: ['income', 'expense'] },
  category: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0.01 },
  description: { type: String, default: '' },
  date: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

transactionSchema.index({ user_id: 1, date: -1 });

const User = mongoose.model('User', userSchema);
const Budget = mongoose.model('Budget', budgetSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);

function toApiDoc(doc) {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  obj.id = obj._id.toString();
  if (obj.user_id && obj.user_id.toString) {
    obj.user_id = obj.user_id.toString();
  }
  delete obj._id;
  delete obj.__v;
  delete obj.password_hash;
  delete obj.otp;
  return obj;
}

function toApiDocs(docs) {
  return docs.map(toApiDoc);
}

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

async function initDatabase() {
  console.log('Connecting to MongoDB...');
  try {
    await connectDatabase();
    console.log('Successfully connected to MongoDB.');
    await User.init();
    await Budget.init();
    await Transaction.init();
    console.log('Database indexes verified.');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
}

async function connectDatabase() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!connectionPromise) {
    connectionPromise = (async () => {
      try {
        const masked = activeMongoUri.includes('@') ? activeMongoUri.split('@')[1] : activeMongoUri;
        console.log(`Connecting to MongoDB (${masked})...`);
        await mongoose.connect(activeMongoUri, { serverSelectionTimeoutMS: 3000 });
        return mongoose.connection;
      } catch (err) {
        if (activeMongoUri !== LOCAL_URI) {
          console.warn(`Primary MongoDB failed (${err.message}). Falling back to local MongoDB at ${LOCAL_URI}...`);
          activeMongoUri = LOCAL_URI;
          await mongoose.connect(LOCAL_URI, { serverSelectionTimeoutMS: 3000 });
          return mongoose.connection;
        }
        throw err;
      }
    })().catch((error) => {
      connectionPromise = undefined;
      throw error;
    });
  }

  await connectionPromise;
  return mongoose.connection;
}

async function closeDatabase() {
  await mongoose.connection.close();
}

module.exports = {
  User,
  Budget,
  Transaction,
  toApiDoc,
  toApiDocs,
  isValidObjectId,
  connectDatabase,
  initDatabase,
  closeDatabase
};
