// api/auth-callback.js - Handle GitHub OAuth callback and validate committee email

import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { code, state, error: oauthError } = req.query;

        // Check for OAuth errors
        if (oauthError) {
            return redirectWithError(res, `GitHub OAuth error: ${oauthError}`);
        }

        // Validate required parameters
        if (!code || !state) {
            return redirectWithError(res, 'Missing OAuth parameters');
        }

        // Validate state to prevent CSRF attacks
        if (!validateState(state)) {
            return redirectWithError(res, 'Invalid OAuth state - security check failed');
        }

        // Exchange code for access token
        const tokenData = await exchangeCodeForToken(code);
        
        // Get user information from GitHub
        const userData = await fetchUserData(tokenData.access_token);
        
        // **CRITICAL: Validate email against committee email**
        const isAuthorized = await validateCommitteeEmail(userData, tokenData.access_token);
        
        if (!isAuthorized) {
            return redirectWithError(res, 'Access denied: Only UMHC committee members can access admin features');
        }

        // Generate secure JWT for the authorized user
        const jwtToken = generateJWT(userData);
        
        // Redirect back to client with success
        redirectWithSuccess(res, jwtToken, userData);

    } catch (error) {
        console.error('OAuth callback error:', error);
        return redirectWithError(res, `Authentication failed: ${error.message}`);
    }
}

function validateState(encodedState) {
    try {
        const decoded = JSON.parse(Buffer.from(encodedState, 'base64').toString());
        const { timestamp } = decoded;
        
        // Check if state is not older than 10 minutes
        const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
        return timestamp > tenMinutesAgo;
        
    } catch (error) {
        console.error('State validation error:', error);
        return false;
    }
}

async function exchangeCodeForToken(code) {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    
    if (!clientSecret) {
        throw new Error('GitHub Client Secret not configured');
    }

    const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            code: code
        })
    });

    if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.status}`);
    }

    const tokenData = await response.json();
    
    if (tokenData.error) {
        throw new Error(`GitHub token error: ${tokenData.error_description || tokenData.error}`);
    }

    return tokenData;
}

async function fetchUserData(accessToken) {
    const response = await fetch('https://api.github.com/user', {
        headers: {
            'Authorization': `token ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'UMHC-Finance-System'
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch user data: ${response.status}`);
    }

    return await response.json();
}

async function validateCommitteeEmail(userData, accessToken) {
    const allowedEmail = process.env.ALLOWED_EMAIL; // hiking@manchesterstudentsunion.com
    
    if (!allowedEmail) {
        throw new Error('Committee email not configured');
    }

    // Get user's emails from GitHub
    const emailResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
            'Authorization': `token ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'UMHC-Finance-System'
        }
    });

    if (!emailResponse.ok) {
        throw new Error('Failed to fetch user emails');
    }

    const emails = await emailResponse.json();
    
    // Check if any of the user's emails match the committee email
    const hasCommitteeEmail = emails.some(email => 
        email.email.toLowerCase() === allowedEmail.toLowerCase() && email.verified
    );

    console.log(`Email validation for ${userData.login}:`, {
        userEmails: emails.map(e => ({ email: e.email, verified: e.verified })),
        allowedEmail: allowedEmail,
        hasAccess: hasCommitteeEmail
    });

    return hasCommitteeEmail;
}

function generateJWT(userData) {
    const jwtSecret = process.env.JWT_SECRET;
    
    if (!jwtSecret) {
        throw new Error('JWT Secret not configured');
    }

    const payload = {
        userId: userData.id,
        username: userData.login,
        name: userData.name,
        email: process.env.ALLOWED_EMAIL, // Always use the committee email
        role: 'committee',
        loginTime: new Date().toISOString()
    };

    // Generate JWT with 24 hour expiry
    return jwt.sign(payload, jwtSecret, { 
        expiresIn: '24h',
        issuer: 'umhc-auth-server',
        audience: 'umhc-finance-system'
    });
}

function redirectWithSuccess(res, jwtToken, userData) {
    const clientUrl = process.env.CLIENT_URL;
    const params = new URLSearchParams({
        token: jwtToken,
        user: userData.login,
        status: 'success'
    });

    const redirectUrl = `${clientUrl}/admin-dashboard.html?${params.toString()}`;
    
    res.writeHead(302, {
        'Location': redirectUrl
    });
    res.end();
}

function redirectWithError(res, errorMessage) {
    const clientUrl = process.env.CLIENT_URL;
    const params = new URLSearchParams({
        error: errorMessage,
        status: 'error'
    });

    const redirectUrl = `${clientUrl}/admin-login.html?${params.toString()}`;
    
    res.writeHead(302, { 'Location': redirectUrl });
    res.end();
}