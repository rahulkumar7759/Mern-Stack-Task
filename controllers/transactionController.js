const axios = require('axios');
const Transaction = require('../models/Transaction');

// Fetch and initialize the database
exports.initializeDatabase = async (req, res) => {
    try {
        const response = await axios.get('https://s3.amazonaws.com/roxiler.com/product_transaction.json');
        await Transaction.deleteMany(); // Clear existing data
        await Transaction.insertMany(response.data); // Seed new data
        res.status(200).json({ message: 'Database initialized successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to initialize database' });
    }
};

// Get transactions with search and pagination
exports.getTransactions = async (req, res) => {
    const { month, search = '', page = 1, perPage = 10 } = req.query;
    const query = {
        dateOfSale: { $regex: `-${month.padStart(2, '0')}-`, $options: 'i' },
        $or: [
            { title: new RegExp(search, 'i') },
            { description: new RegExp(search, 'i') },
            { price: new RegExp(search, 'i') }
        ]
    };

    try {
        const transactions = await Transaction.find(query)
            .skip((page - 1) * perPage)
            .limit(parseInt(perPage));
        res.json(transactions);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
};

// Get statistics for the selected month
exports.getStatistics = async (req, res) => {
    const { month } = req.query;
    const regex = new RegExp(`-${month.padStart(2, '0')}-`, 'i');

    try {
        const totalSaleAmount = await Transaction.aggregate([
            { $match: { dateOfSale: regex, isSold: true } },
            { $group: { _id: null, total: { $sum: '$price' } } }
        ]);

        const soldItemsCount = await Transaction.countDocuments({ dateOfSale: regex, isSold: true });
        const notSoldItemsCount = await Transaction.countDocuments({ dateOfSale: regex, isSold: false });

        res.json({
            totalSaleAmount: totalSaleAmount[0]?.total || 0,
            soldItemsCount,
            notSoldItemsCount
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
};

// Get data for bar chart
exports.getBarChartData = async (req, res) => {
    const { month } = req.query;
    const regex = new RegExp(`-${month.padStart(2, '0')}-`, 'i');

    const ranges = [
        { label: '0-100', min: 0, max: 100 },
        { label: '101-200', min: 101, max: 200 },
        { label: '201-300', min: 201, max: 300 },
        { label: '301-400', min: 301, max: 400 },
        { label: '401-500', min: 401, max: 500 },
        { label: '501-600', min: 501, max: 600 },
        { label: '601-700', min: 601, max: 700 },
        { label: '701-800', min: 701, max: 800 },
        { label: '801-900', min: 801, max: 900 },
        { label: '901-above', min: 901, max: Infinity }
    ];

    try {
        const data = await Promise.all(ranges.map(async (range) => {
            const count = await Transaction.countDocuments({
                dateOfSale: regex,
                price: { $gte: range.min, $lte: range.max }
            });
            return { range: range.label, count };
        }));

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch bar chart data' });
    }
};

// Get data for pie chart
exports.getPieChartData = async (req, res) => {
    const { month } = req.query;
    const regex = new RegExp(`-${month.padStart(2, '0')}-`, 'i');

    try {
        const data = await Transaction.aggregate([
            { $match: { dateOfSale: regex } },
            { $group: { _id: '$category', count: { $sum: 1 } } }
        ]);

        res.json(data.map(item => ({ category: item._id, count: item.count })));
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch pie chart data' });
    }
};

// Get combined data
exports.getCombinedData = async (req, res) => {
    try {
        const [transactions, statistics, barChartData, pieChartData] = await Promise.all([
            exports.getTransactions(req, res),
            exports.getStatistics(req, res),
            exports.getBarChartData(req, res),
            exports.getPieChartData(req, res)
        ]);

        res.json({
            transactions,
            statistics,
            barChartData,
            pieChartData
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch combined data' });
    }
};
