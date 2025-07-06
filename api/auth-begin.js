export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const clientId = process.env.GITHUB_CLIENT_ID;
        
        if (!clientId) {
            return res.status(500).json({ 
                error: 'GitHub Client ID not configured',
                hint: 'Add GITHUB_CLIENT_ID environment variable in Vercel dashboard'
            });
        }

        // Generate secure state
        const state = generateSecureState();
        const stateWithTimestamp = Buffer.from(JSON.stringify({
            state: state,
            timestamp: Date.now()
        })).toString('base64');

        // Build OAuth URL
        const params = new URLSearchParams({
            client_id: clientId,
            scope: 'user:email',
            state: stateWithTimestamp,
            redirect_uri: `https://${req.headers.host}/api/auth-callback`
        });

        const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;

        res.status(200).json({
            authUrl: authUrl,
            state: stateWithTimestamp
        });

    } catch (error) {
        res.status(500).json({ 
            error: 'Authentication initiation failed',
            message: error.message
        });
    }
}

function generateSecureState() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}