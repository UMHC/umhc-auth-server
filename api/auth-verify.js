// api/auth-verify.js - Verify JWT tokens for ongoing authentication

import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
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

        const jwtSecret = process.env.JWT_SECRET;
        
        if (!jwtSecret) {
            throw new Error('JWT Secret not configured');
        }

        // Verify the JWT token
        const decoded = jwt.verify(token, jwtSecret, {
            issuer: 'umhc-auth-server',
            audience: 'umhc-finance-system'
        });

        // Check if token is expired (additional check)
        const now = Math.floor(Date.now() / 1000);
        if (decoded.exp && decoded.exp < now) {
            return res.status(401).json({ 
                valid: false, 
                error: 'Token expired' 
            });
        }

        // Token is valid, return user information
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
        console.error('Token verification error:', error);
        
        let errorMessage = 'Token verification failed';
        
        if (error.name === 'TokenExpiredError') {
            errorMessage = 'Token has expired';
        } else if (error.name === 'JsonWebTokenError') {
            errorMessage = 'Invalid token';
        } else if (error.name === 'NotBeforeError') {
            errorMessage = 'Token not active yet';
        }

        res.status(401).json({ 
            valid: false, 
            error: errorMessage 
        });
    }
}