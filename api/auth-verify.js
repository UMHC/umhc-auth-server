module.exports = async function handler(req, res) {
    // FIXED: Enable CORS headers (was missing!)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({ 
                valid: false, 
                error: 'No token provided' 
            });
        }

        const jwt = require('jsonwebtoken');
        const jwtSecret = process.env.JWT_SECRET;
        
        if (!jwtSecret) {
            console.error('❌ JWT Secret not configured in Vercel environment variables');
            throw new Error('JWT Secret not configured');
        }

        // Verify and decode the JWT token
        const decoded = jwt.verify(token, jwtSecret, {
            issuer: 'umhc-auth-server',
            audience: 'umhc-finance-system'
        });

        console.log('✅ Token verified successfully for user:', decoded.username);

        // Return user info
        res.status(200).json({
            valid: true,
            user: {
                userId: decoded.userId,
                username: decoded.username,
                name: decoded.name,
                email: decoded.email,
                role: decoded.role,
                loginTime: decoded.loginTime
            },
            expiresAt: decoded.exp
        });

    } catch (error) {
        console.error('❌ Token verification failed:', error.message);
        
        let errorMessage = 'Token verification failed';
        let statusCode = 401;
        
        if (error.name === 'TokenExpiredError') {
            errorMessage = 'Token has expired';
            statusCode = 401;
        } else if (error.name === 'JsonWebTokenError') {
            errorMessage = 'Invalid token';
            statusCode = 401;
        } else if (error.message.includes('JWT Secret')) {
            errorMessage = 'Server configuration error';
            statusCode = 500;
        }

        res.status(statusCode).json({ 
            valid: false, 
            error: errorMessage 
        });
    }
}