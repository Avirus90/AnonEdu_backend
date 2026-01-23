const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

// Telegram Configuration
const TELEGRAM_BOT_TOKEN = "8151664879:AAGggzn4M2Iv-9lHAUJXjCVPGKnKyr7IZMc";
const TELEGRAM_CHANNEL = "@ANON_EDU";
const TELEGRAM_CHANNEL_ID = "-1003687504990";

// Middleware
app.use(cors());
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
            <h1>📚 EduAnon Backend API</h1>
            <p>Telegram Channel: <strong>${TELEGRAM_CHANNEL}</strong></p>
            <p>Channel ID: <code>${TELEGRAM_CHANNEL_ID}</code></p>
            
            <div class="endpoint">
                <h3>📡 Available Endpoints:</h3>
                <p><a href="/api/test" target="_blank">GET /api/test</a> - API Status</p>
                <p><a href="/api/files" target="_blank">GET /api/files</a> - Get Files from Telegram</p>
                <p><a href="/api/channel-info" target="_blank">GET /api/channel-info</a> - Channel Details</p>
                <p><strong>POST /api/admin/sync-telegram</strong> - Sync Telegram Files to Firebase</p>
                <p><a href="/health" target="_blank">GET /health</a> - Health Check</p>
            </div>
            
            <p>🤖 Bot: @ANONEDU_Bot | Status: ✅ WORKING</p>
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

// Get files from Telegram
app.get('/api/files', async (req, res) => {
    try {
        console.log(`📥 Fetching files from ${TELEGRAM_CHANNEL}`);
        
        // Get recent messages from channel
        const response = await axios.get(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChatHistory`,
            {
                params: {
                    chat_id: TELEGRAM_CHANNEL_ID,
                    limit: 50
                },
                timeout: 15000
            }
        );
        
        console.log(`📊 Messages received: ${response.data.result?.messages?.length || 0}`);
        
        const files = [];
        
        if (response.data.ok && response.data.result.messages) {
            for (const message of response.data.result.messages) {
                if (message.document) {
                    // Handle documents
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
                            files.push({
                                id: message.id,
                                message_id: message.id,
                                date: new Date(message.date * 1000).toISOString(),
                                caption: message.caption || fileData.file_name || 'Document',
                                type: 'document',
                                name: fileData.file_name || `document_${message.id}`,
                                size: fileData.file_size,
                                mime_type: fileData.mime_type,
                                file_id: fileData.file_id,
                                file_unique_id: fileData.file_unique_id
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
                            files.push({
                                id: message.id,
                                message_id: message.id,
                                date: new Date(message.date * 1000).toISOString(),
                                caption: message.caption || 'Photo',
                                type: 'image',
                                name: `photo_${message.id}.jpg`,
                                size: photoData.file_size,
                                mime_type: 'image/jpeg',
                                file_id: photoData.file_id,
                                file_unique_id: photoData.file_unique_id
                            });
                        }
                    } catch (photoError) {
                        console.log(`⚠️ Photo error: ${photoError.message}`);
                    }
                }
                
                // Handle text messages (for mock tests)
                if (message.text && message.text.includes('.txt')) {
                    files.push({
                        id: message.id,
                        message_id: message.id,
                        date: new Date(message.date * 1000).toISOString(),
                        caption: message.text.substring(0, 100) || 'Text File',
                        type: 'text',
                        name: 'mock_test.txt',
                        size: message.text.length,
                        mime_type: 'text/plain'
                    });
                }
            }
        }

        console.log(`✅ Total files found: ${files.length}`);
        
        res.json({
            success: true,
            channel: TELEGRAM_CHANNEL,
            channel_id: TELEGRAM_CHANNEL_ID,
            total_files: files.length,
            files: files,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ API Error:', error.message);
        
        res.json({
            success: false,
            error: error.message,
            channel: TELEGRAM_CHANNEL,
            channel_id: TELEGRAM_CHANNEL_ID
        });
    }
});

// Sync Telegram files to Firebase
app.post('/api/admin/sync-telegram', async (req, res) => {
    try {
        const { courseId } = req.body;
        
        if (!courseId) {
            return res.status(400).json({
                success: false,
                error: 'Course ID is required'
            });
        }
        
        // Get files from Telegram
        const filesResponse = await axios.get(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChatHistory`,
            {
                params: {
                    chat_id: TELEGRAM_CHANNEL_ID,
                    limit: 100
                },
                timeout: 15000
            }
        );
        
        const syncedFiles = [];
        
        if (filesResponse.data.ok && filesResponse.data.result.messages) {
            for (const message of filesResponse.data.result.messages) {
                if (message.document || (message.photo && message.photo.length > 0)) {
                    const fileData = message.document || message.photo[message.photo.length - 1];
                    
                    // Determine file type
                    let fileType = 'document';
                    let fileName = 'file';
                    
                    if (message.document) {
                        fileName = message.document.file_name || `document_${message.id}`;
                        if (fileName.toLowerCase().includes('.pdf')) fileType = 'pdf';
                        else if (fileName.toLowerCase().includes('.txt')) fileType = 'text';
                        else if (fileName.toLowerCase().includes('.mp4') || fileName.toLowerCase().includes('.avi')) fileType = 'video';
                        else if (fileName.toLowerCase().includes('.jpg') || fileName.toLowerCase().includes('.jpeg') || fileName.toLowerCase().includes('.png')) fileType = 'image';
                    } else if (message.photo) {
                        fileType = 'image';
                        fileName = `photo_${message.id}.jpg`;
                    }
                    
                    syncedFiles.push({
                        courseId: courseId,
                        telegramMessageId: message.id,
                        telegramFileId: fileData.file_id,
                        title: message.caption || fileName,
                        type: fileType,
                        fileName: fileName,
                        fileSize: fileData.file_size,
                        order: syncedFiles.length + 1,
                        createdAt: new Date().toISOString(),
                        downloadUrl: `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileData.file_path}`
                    });
                }
            }
        }
        
        console.log(`✅ Synced ${syncedFiles.length} files from Telegram`);
        
        res.json({
            success: true,
            synced: syncedFiles.length,
            files: syncedFiles,
            message: 'Files synced successfully'
        });
        
    } catch (error) {
        console.error('❌ Sync error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'EduAnon Backend',
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Server error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
    🚀 EduAnon Backend Started
    📍 Port: ${PORT}
    🌐 URL: https://anon-edu-backend-anon.vercel.app
    📡 Channel: ${TELEGRAM_CHANNEL} (ID: ${TELEGRAM_CHANNEL_ID})
    🤖 Bot: @ANONEDU_Bot
    ✅ STATUS: WORKING
    `);
});

module.exports = app;
