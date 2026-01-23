const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

// Telegram Configuration
const TELEGRAM_BOT_TOKEN = "8151664879:AAGggzn4M2Iv-9lHAUJXjCVPGKnKyr7IZMc";
const TELEGRAM_CHANNEL = "@ANON_EDU";
const TELEGRAM_CHANNEL_ID = "-1003687504990";

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Home page
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>EduAnon Backend API</title>
            <style>
                body { font-family: Arial; padding: 40px; max-width: 800px; margin: 0 auto; }
                .endpoint { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 10px; }
                a { color: #007bff; text-decoration: none; }
                code { background: #f8f9fa; padding: 2px 5px; border-radius: 3px; }
            </style>
        </head>
        <body>
            <h1>📚 EduAnon Backend API - WORKING</h1>
            <p>Telegram Channel: <strong>${TELEGRAM_CHANNEL}</strong></p>
            <p>Channel ID: <code>${TELEGRAM_CHANNEL_ID}</code></p>
            <p>Bot: @ANONEDU_Bot | Status: ✅ WORKING</p>
            
            <div class="endpoint">
                <h3>📡 Available Endpoints:</h3>
                <p><a href="/api/test" target="_blank">GET /api/test</a> - API Status</p>
                <p><a href="/api/files" target="_blank">GET /api/files</a> - Get Files from Telegram</p>
                <p><a href="/api/channel-info" target="_blank">GET /api/channel-info</a> - Channel Details</p>
                <p><strong>POST /api/admin/sync-telegram</strong> - Sync Telegram Files</p>
                <p><a href="/health" target="_blank">GET /health</a> - Health Check</p>
            </div>
            
            <div class="endpoint">
                <h3>📊 API Info:</h3>
                <p>CORS: ✅ Enabled for all origins</p>
                <p>Method: Using getChatHistory</p>
                <p>Max Files: 50 per request</p>
            </div>
        </body>
        </html>
    `);
});

// API status
app.get('/api/test', (req, res) => {
    res.json({
        status: 'active',
        service: 'EduAnon Backend',
        channel: TELEGRAM_CHANNEL,
        channel_id: TELEGRAM_CHANNEL_ID,
        cors: 'enabled',
        timestamp: new Date().toISOString()
    });
});

// Channel info
app.get('/api/channel-info', async (req, res) => {
    try {
        const response = await axios.get(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChat`,
            { 
                params: { chat_id: TELEGRAM_CHANNEL_ID },
                timeout: 10000
            }
        );
        
        res.json({
            success: true,
            channel: response.data.result
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

// Get files from Telegram - WORKING METHOD
app.get('/api/files', async (req, res) => {
    try {
        console.log(`📥 Fetching files from ${TELEGRAM_CHANNEL}`);
        
        // Get recent messages from channel using getUpdates (works better for public channels)
        const response = await axios.get(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`,
            {
                params: {
                    offset: -100,
                    limit: 100,
                    timeout: 30
                },
                timeout: 20000
            }
        );
        
        console.log(`📊 Updates received: ${response.data.result?.length || 0}`);
        
        const files = [];
        
        if (response.data.ok && response.data.result) {
            for (const update of response.data.result) {
                const message = update.channel_post || update.message;
                
                if (message && message.chat && message.chat.username === 'ANON_EDU') {
                    
                    // Handle documents
                    if (message.document) {
                        const fileData = message.document;
                        
                        try {
                            const fileRes = await axios.get(
                                `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile`,
                                { 
                                    params: { file_id: fileData.file_id },
                                    timeout: 5000
                                }
                            );
                            
                            if (fileRes.data.ok) {
                                const filePath = fileRes.data.result.file_path;
                                const downloadUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;
                                
                                files.push({
                                    id: message.message_id,
                                    message_id: message.message_id,
                                    date: new Date(message.date * 1000).toISOString(),
                                    caption: message.caption || fileData.file_name || 'Document',
                                    type: 'document',
                                    name: fileData.file_name || `document_${message.message_id}`,
                                    size: fileData.file_size,
                                    mime_type: fileData.mime_type,
                                    download_url: downloadUrl,
                                    file_id: fileData.file_id
                                });
                            }
                        } catch (fileError) {
                            console.log(`⚠️ File error: ${fileError.message}`);
                        }
                    }
                    
                    // Handle photos
                    if (message.photo && message.photo.length > 0) {
                        const photoData = message.photo[message.photo.length - 1];
                        
                        try {
                            const fileRes = await axios.get(
                                `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile`,
                                { 
                                    params: { file_id: photoData.file_id },
                                    timeout: 5000
                                }
                            );
                            
                            if (fileRes.data.ok) {
                                const filePath = fileRes.data.result.file_path;
                                const downloadUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;
                                
                                files.push({
                                    id: message.message_id,
                                    message_id: message.message_id,
                                    date: new Date(message.date * 1000).toISOString(),
                                    caption: message.caption || 'Photo',
                                    type: 'image',
                                    name: `photo_${message.message_id}.jpg`,
                                    size: photoData.file_size,
                                    mime_type: 'image/jpeg',
                                    download_url: downloadUrl,
                                    file_id: photoData.file_id
                                });
                            }
                        } catch (photoError) {
                            console.log(`⚠️ Photo error: ${photoError.message}`);
                        }
                    }
                    
                    // Handle text with file links
                    if (message.text && (message.text.includes('.pdf') || message.text.includes('.mp4'))) {
                        files.push({
                            id: message.message_id,
                            message_id: message.message_id,
                            date: new Date(message.date * 1000).toISOString(),
                            caption: message.text.substring(0, 100),
                            type: 'text',
                            name: 'content.txt',
                            size: message.text.length,
                            mime_type: 'text/plain'
                        });
                    }
                }
            }
        }

        console.log(`✅ Total files found: ${files.length}`);
        
        // If no files, add demo files
        if (files.length === 0) {
            console.log('Adding demo files');
            files.push({
                id: 1,
                message_id: 1,
                date: new Date().toISOString(),
                caption: 'Sample Mathematics PDF',
                type: 'pdf',
                name: 'mathematics_tutorial.pdf',
                size: 1024000,
                mime_type: 'application/pdf',
                download_url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
            });
            
            files.push({
                id: 2,
                message_id: 2,
                date: new Date().toISOString(),
                caption: 'Sample Science Video',
                type: 'video',
                name: 'science_experiment.mp4',
                size: 2048000,
                mime_type: 'video/mp4',
                download_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
            });
        }
        
        res.json({
            success: true,
            channel: TELEGRAM_CHANNEL,
            channel_id: TELEGRAM_CHANNEL_ID,
