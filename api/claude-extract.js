// api/claude-extract.js
const jwt = require('jsonwebtoken');

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

module.exports = async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log('Claude API proxy request received');

        // Verify JWT token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No valid auth token provided' });
        }

        const token = authHeader.split(' ')[1];

        // Verify JWT token using your existing logic
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET, {
                issuer: 'umhc-auth-server',
                audience: 'umhc-finance-system'
            });
            console.log('Token verified for user:', decoded.username);
        } catch (error) {
            console.log('Token verification failed:', error.message);
            return res.status(401).json({ error: 'Invalid auth token' });
        }

        // Check if user has the committee email
        if (decoded.email !== process.env.ALLOWED_EMAIL) {
            console.log('User does not have committee email access');
            return res.status(403).json({ error: 'Committee access required' });
        }

        // Get the request data
        const { 
            prompt, 
            messageContent, // NEW: Support for full message content array
            model = 'claude-3-5-sonnet-20241022', 
            maxTokens = 8000, 
            apiKey,
            temperature = 0.1
        } = req.body;

        // Handle both old format (prompt) and new format (messageContent)
        let messages;
        if (messageContent && Array.isArray(messageContent)) {
            // New format with images/documents
            messages = [{
                role: 'user',
                content: messageContent
            }];
            console.log('Using message content with', messageContent.length, 'parts');
            
            // Log content types for debugging
            messageContent.forEach((part, index) => {
                if (part.type === 'document') {
                    console.log(`Part ${index}: PDF document`);
                } else if (part.type === 'image') {
                    console.log(`Part ${index}: Image (${part.source.media_type})`);
                } else if (part.type === 'text') {
                    console.log(`Part ${index}: Text prompt (${part.text.length} chars)`);
                }
            });
        } else if (prompt) {
            // Old format with just text
            messages = [{
                role: 'user',
                content: prompt
            }];
            console.log('Using text-only prompt');
        } else {
            return res.status(400).json({ error: 'Either prompt or messageContent is required' });
        }

        // API key can come from request body or environment variable
        const claudeApiKey = apiKey || process.env.CLAUDE_API_KEY;

        if (!claudeApiKey) {
            return res.status(400).json({
                error: 'Claude API key required. Please provide apiKey in request body.',
                needsApiKey: true
            });
        }

        console.log('Making request to Claude API with model:', model);

        // Make request to Claude API
        const claudeResponse = await fetch(CLAUDE_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': claudeApiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: model,
                max_tokens: maxTokens,
                temperature: temperature,
                messages: messages
            })
        });

        if (!claudeResponse.ok) {
            const errorText = await claudeResponse.text();
            console.error('Claude API error:', claudeResponse.status, errorText);

            // Parse error to provide better feedback
            try {
                const errorData = JSON.parse(errorText);
                if (errorData.error && errorData.error.message) {
                    if (errorData.error.message.includes('model')) {
                        return res.status(400).json({
                            error: `Invalid model: ${model}. Use claude-3-5-sonnet-20241022, claude-3-opus-20240229, or claude-3-haiku-20240307`
                        });
                    }
                    // Return the actual error message from Claude
                    return res.status(400).json({
                        error: errorData.error.message,
                        type: errorData.error.type || 'unknown_error'
                    });
                }
            } catch (e) {
                // If error parsing fails, return original error
            }

            return res.status(claudeResponse.status).json({
                error: errorText
            });
        }

        const claudeResult = await claudeResponse.json();
        console.log('Claude API request successful');
        
        // Log token usage for monitoring
        if (claudeResult.usage) {
            console.log('Token usage:', {
                input: claudeResult.usage.input_tokens,
                output: claudeResult.usage.output_tokens,
                total: claudeResult.usage.input_tokens + claudeResult.usage.output_tokens
            });
        }

        // Return the Claude response
        res.status(200).json({
            success: true,
            content: claudeResult.content[0].text,
            usage: claudeResult.usage,
            model: model,
            processedBy: 'Claude API via Vercel proxy',
            processedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('Claude proxy error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}