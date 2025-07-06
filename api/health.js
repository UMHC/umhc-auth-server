module.exports = function handler(req, res) {
    res.status(200).json({ 
        status: 'OK',
        message: 'UMHC Auth server is working!',
        timestamp: new Date().toISOString(),
        environment: {
            hasGitHubClientId: !!process.env.GITHUB_CLIENT_ID,
            hasGitHubSecret: !!process.env.GITHUB_CLIENT_SECRET,
            hasJwtSecret: !!process.env.JWT_SECRET,
            hasAllowedEmail: !!process.env.ALLOWED_EMAIL,
            hasClientUrl: !!process.env.CLIENT_URL
        }
    });
}