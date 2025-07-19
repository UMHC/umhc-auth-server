// api/claude-extract.js - Fixed with CommonJS syntax
const jwt = require('jsonwebtoken');

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

module.exports = async function handler(req, res) {
    // Simple CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // For testing, just echo back what we receive
    return res.status(200).json({
        message: 'Endpoint reached successfully',
        method: req.method,
        hasAuthHeader: !!req.headers.authorization,
        hasBody: !!req.body,
        bodyKeys: req.body ? Object.keys(req.body) : [],
        timestamp: new Date().toISOString()
    });
}