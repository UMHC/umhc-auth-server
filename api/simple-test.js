export default function handler(req, res) {
    res.status(200).json({ 
        message: 'Simple test works!', 
        timestamp: new Date().toISOString() 
    });
}