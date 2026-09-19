const app = require('../server');
const { connectDatabase } = require('../database');

module.exports = async (req, res) => {
	try {
		await connectDatabase();
		return app(req, res);
	} catch (error) {
		console.error('MongoDB connection failed:', error.message);
		return res.status(503).json({ error: 'Database unavailable. Please try again later.' });
	}
};