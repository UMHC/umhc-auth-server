// api/auth-begin.js - FIXED VERSION for Vercel

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log('Auth-begin function called');
        
        // Get environment variables (stored securely in Vercel)
        const clientId = process.env.GITHUB_CLIENT_ID;
        const clientUrl = process.env.CLIENT_URL;
        
        console.log('Client ID configured:', !!clientId);
        console.log('Client URL:', clientUrl);
        
        if (!clientId) {
            return res.status(500).json({ error: 'GitHub Client ID not configured' });
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
            redirect_uri: `${req.headers.host ? `https://${req.headers.host}` : 'https://umhc-auth-server-a6jon0ptc-umhcs-projects.vercel.app'}/api/auth-callback`
        });

        const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;

        console.log('Generated OAuth URL successfully');

        // Return the OAuth URL for client-side redirect
        res.status(200).json({
            authUrl: authUrl,
            state: stateWithTimestamp,
            debug: {
                clientId: clientId ? 'configured' : 'missing',
                redirectUri: `${req.headers.host ? `https://${req.headers.host}` : 'https://umhc-auth-server-a6jon0ptc-umhcs-projects.vercel.app'}/api/auth-callback`
            }
        });

    } catch (error) {
        console.error('OAuth initiation error:', error);
        res.status(500).json({ 
            error: 'Authentication initiation failed',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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