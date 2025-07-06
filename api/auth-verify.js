module.exports = async function handler(req, res) {
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
            throw new Error('JWT Secret not configured');
        }

        const decoded = jwt.verify(token, jwtSecret, {
            issuer: 'umhc-auth-server',
            audience: 'umhc-finance-system'
        });

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
        let errorMessage = 'Token verification failed';
        
        if (error.name === 'TokenExpiredError') {
            errorMessage = 'Token has expired';
        } else if (error.name === 'JsonWebTokenError') {
            errorMessage = 'Invalid token';
        }

        res.status(401).json({ 
            valid: false, 
            error: errorMessage 
        });
    }
}