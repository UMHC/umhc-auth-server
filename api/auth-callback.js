const jwt = require('jsonwebtoken');

module.exports = async function handler(req, res) {
    console.log('Auth callback called with method:', req.method);
    console.log('Query params:', req.query);
    
    if (req.method !== 'GET') {
        console.log('Wrong method, rejecting');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { code, state, error: oauthError } = req.query;
        console.log('Received code:', !!code, 'state:', !!state, 'error:', oauthError);

        if (oauthError) {
            console.log('OAuth error:', oauthError);
            return redirectWithError(res, `GitHub OAuth error: ${oauthError}`);
        }

        if (!code || !state) {
            console.log('Missing OAuth parameters');
            return redirectWithError(res, 'Missing OAuth parameters');
        }

        if (!validateState(state)) {
            console.log('Invalid OAuth state');
            return redirectWithError(res, 'Invalid OAuth state');
        }

        console.log('Exchanging code for token...');
        const tokenData = await exchangeCodeForToken(code);
        console.log('Got token, fetching user data...');
        
        const userData = await fetchUserData(tokenData.access_token);
        console.log('User data:', userData.login);
        
        console.log('Validating committee email...');
        const isAuthorized = await validateCommitteeEmail(userData, tokenData.access_token);
        console.log('Is authorized:', isAuthorized);
        
        if (!isAuthorized) {
            console.log('Access denied - no committee email');
            return redirectWithError(res, 'Access denied: Only UMHC committee members can access admin features');
        }

        console.log('Generating JWT token...');
        const jwtToken = generateJWT(userData);
        console.log('Redirecting to success...');
        redirectWithSuccess(res, jwtToken, userData);

    } catch (error) {
        console.error('OAuth callback error:', error);
        return redirectWithError(res, `Authentication failed: ${error.message}`);
    }
}

function validateState(encodedState) {
    try {
        const decoded = JSON.parse(Buffer.from(encodedState, 'base64').toString());
        const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
        return decoded.timestamp > tenMinutesAgo;
    } catch (error) {
        console.log('State validation error:', error.message);
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
    const allowedEmail = process.env.ALLOWED_EMAIL;
    
    if (!allowedEmail) {
        throw new Error('Committee email not configured');
    }

    console.log('Checking for email:', allowedEmail);

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
    console.log('User emails:', emails.map(e => `${e.email} (verified: ${e.verified})`));
    
    const hasCommitteeEmail = emails.some(email => 
        email.email.toLowerCase() === allowedEmail.toLowerCase() && email.verified
    );

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
        email: process.env.ALLOWED_EMAIL,
        role: 'committee',
        loginTime: new Date().toISOString()
    };

    return jwt.sign(payload, jwtSecret, { 
        expiresIn: '24h',
        issuer: 'umhc-auth-server',
        audience: 'umhc-finance-system'
    });
}

function redirectWithSuccess(res, jwtToken, userData) {
    const clientUrl = process.env.CLIENT_URL || 'https://UMHC.github.io/umhc-finance';
    const params = new URLSearchParams({
        token: jwtToken,
        user: userData.login,
        status: 'success'
    });

    const redirectUrl = `${clientUrl}/admin-dashboard.html?${params.toString()}`;
    console.log('Redirecting to success:', redirectUrl);
    res.writeHead(302, { 'Location': redirectUrl });
    res.end();
}

function redirectWithError(res, errorMessage) {
    const clientUrl = process.env.CLIENT_URL || 'https://UMHC.github.io/umhc-finance';
    const params = new URLSearchParams({
        error: errorMessage,
        status: 'error'
    });

    const redirectUrl = `${clientUrl}/admin-login.html?${params.toString()}`;
    console.log('Redirecting to error:', redirectUrl);
    res.writeHead(302, { 'Location': redirectUrl });
    res.end();
}