// api/auth-begin.js - Initiate GitHub OAuth flow securely

export default async function handler(req, res) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Get environment variables (stored securely in Vercel)
        const clientId = process.env.GITHUB_CLIENT_ID;
        const clientUrl = process.env.CLIENT_URL;
        
        if (!clientId) {
            throw new Error('GitHub Client ID not configured');
        }

        // Generate secure random state for CSRF protection
        const state = generateSecureState();
        
        // Store state with timestamp for validation
        const stateWithTimestamp = Buffer.from(JSON.stringify({
            state: state,
            timestamp: Date.now(),
            origin: req.headers.origin || clientUrl
        })).toString('base64');

        // Build GitHub OAuth URL
        const params = new URLSearchParams({
            client_id: clientId,
            scope: 'user:email',
            state: stateWithTimestamp,
            redirect_uri: `${req.headers.origin || req.url.split('/api')[0]}/api/auth-callback`
        });

        const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;

        // Return the OAuth URL for client-side redirect
        res.status(200).json({
            authUrl: authUrl,
            state: stateWithTimestamp
        });

    } catch (error) {
        console.error('OAuth initiation error:', error);
        res.status(500).json({ 
            error: 'Authentication initiation failed',
            message: error.message 
        });
    }
}

function generateSecureState() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    // Generate 32 character random string
    for (let i = 0; i < 32; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    
    return result;
}