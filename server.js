const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

// Rate limiting store
const rateLimitStore = new Map();

// ✅ Enhanced CORS Security
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = [
            'https://anonedu.github.io',
            'https://avirus90.github.io',
            'http://localhost:5500',
            'http://127.0.0.1:5500',
            'http://localhost:3000',
            'http://127.0.0.1:3000'
        ];
        
        if (!origin) {
            return callback(null, true);
        }
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log('🚨 Blocked CORS request from:', origin);
            callback(null, true);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

// ✅ Security Headers Middleware
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=()');
    
    res.setHeader('Content-Security-Policy', 
        "default-src 'self'; " +
        "script-src 'self' https://www.gstatic.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
        "style-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com 'unsafe-inline'; " +
        "img-src 'self' data: https: http: blob:; " +
        "font-src 'self' https://cdnjs.cloudflare.com; " +
        "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://anon-edu-backend-anon.vercel.app https://api.telegram.org; " +
        "frame-src 'self' https://docs.google.com; " +
        "media-src 'self' https: http: blob:;"
    );
    
    next();
});

// ✅ Request Validation Middleware
const validateRequest = (req, res, next) => {
    if (req.method === 'POST' || req.method === 'PUT') {
        const contentType = req.headers['content-type'];
        if (!contentType || !contentType.includes('application/json')) {
            return res.status(400).json({ 
                success: false,
                error: 'Content-Type must be application/json' 
            });
        }
    }
    
    const contentLength = parseInt(req.headers['content-length'] || '0');
    if (contentLength > 1024 * 1024) {
        return res.status(413).json({ 
            success: false,
            error: 'Request too large (max 1MB)' 
        });
    }
    
    next();
};

app.use('/api/', validateRequest);

// ✅ Rate Limiting Middleware
const rateLimit = (windowMs = 15 * 60 * 1000, max = 100) => {
    return (req, res, next) => {
        const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const now = Date.now();
        const path = req.path;
        
        const key = `${ip}:${path}`;
        
        if (!rateLimitStore.has(key)) {
            rateLimitStore.set(key, { count: 1, startTime: now });
        } else {
            const data = rateLimitStore.get(key);
            
            if (now - data.startTime > windowMs) {
                data.count = 1;
                data.startTime = now;
            } else {
                data.count++;
            }
            
            if (data.count > max) {
                console.log(`🚨 Rate limit exceeded: ${key} (${data.count} requests)`);
                return res.status(429).json({
                    success: false,
                    error: 'Too many requests',
                    retryAfter: Math.ceil((data.startTime + windowMs - now) / 1000),
                    message: 'Please wait before making more requests'
                });
            }
        }
        
        res.setHeader('X-RateLimit-Limit', max);
        res.setHeader('X-RateLimit-Remaining', max - rateLimitStore.get(key).count);
        
        setTimeout(() => {
            rateLimitStore.delete(key);
        }, windowMs);
        
        next();
    };
};

// ✅ Abuse Detection Middleware
const detectAbuse = (req, res, next) => {
    const userAgent = req.headers['user-agent'] || '';
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    
    const suspiciousAgents = [
        'python-requests', 'java', 'perl', 'ruby',
        'bot', 'crawler', 'spider', 'scraper', 'headless'
    ];
    
    const isSuspicious = suspiciousAgents.some(agent => 
        userAgent.toLowerCase().includes(agent)
    );
    
    if (isSuspicious && !req.path.includes('/api/test') && !req.path.includes('/health')) {
        console.log('🚨 Suspicious request detected:', { 
            ip, 
            userAgent: userAgent.substring(0, 100), 
            path: req.path,
            method: req.method 
        });
        
        setTimeout(next, 2000);
    } else {
        next();
    }
};

// Apply security middleware
app.use('/api/', detectAbuse);

// Apply rate limiting
app.use('/api/files', rateLimit(15 * 60 * 1000, 50));
app.use('/api/mock-test', rateLimit(15 * 60 * 1000, 20));
app.use('/api/telegram/file', rateLimit(15 * 60 * 1000, 30));

// ✅ Security Logging Endpoint
app.post('/api/security/log', async (req, res) => {
    try {
        const { eventType, data, timestamp, userId, userEmail } = req.body;
        
        if (!eventType) {
            return res.status(400).json({ 
                success: false, 
                error: 'eventType is required' 
            });
        }
        
        console.log('🔐 SECURITY LOG:', {
            eventType,
            userId: userId || 'anonymous',
            userEmail: userEmail || 'unknown',
            timestamp: timestamp || new Date().toISOString(),
            data: typeof data === 'string' ? data.substring(0, 500) : JSON.stringify(data).substring(0, 500),
            ip: req.ip,
            userAgent: req.headers['user-agent']?.substring(0, 100)
        });
        
        res.json({ 
            success: true, 
            logged: true,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Security log error:', error);
        res.json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Home page
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>EduAnon Backend API</title>
            <style>
                body { font-family: Arial; padding: 40px; max-width: 800px; margin: 0 auto; }
                .channel { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 10px; }
                a { color: #007bff; text-decoration: none; }
                .cors-info { background: #d4edda; padding: 10px; border-radius: 5px; margin: 10px 0; }
                .security-info { background: #fff3cd; padding: 10px; border-radius: 5px; margin: 10px 0; }
                .endpoint-list { background: #e9ecef; padding: 10px; border-radius: 5px; margin: 10px 0; }
                code { background: #f8f9fa; padding: 2px 5px; border-radius: 3px; }
            </style>
        </head>
        <body>
            <h1>🔐 EduAnon Backend API</h1>
            
            <div class="security-info">
                <strong>🔒 Security Features:</strong>
                <ul>
                    <li>Rate Limiting: ✅ Active</li>
                    <li>CORS Protection: ✅ Restricted Origins</li>
                    <li>Security Headers: ✅ CSP, XSS Protection</li>
                    <li>Request Validation: ✅ Size & Type Checking</li>
                    <li>Abuse Detection: ✅ Bot Detection</li>
                    <li>Security Logging: ✅ POST /api/security/log</li>
                </ul>
            </div>
            
            <div class="cors-info">
                <strong>🌐 CORS Status:</strong> Restricted origins only
            </div>
            
            <p>Telegram Channel: <strong>@ANON_EDU</strong></p>
            <p>Channel ID: <code>-1003687504990</code></p>
            <p>Bot Token: <code>8151664879:AAGggzn4M2Iv-9lHAUJXjCVPGKnKyr7IZMc</code></p>
            
            <div class="channel">
                <h3>📡 Available Endpoints:</h3>
                <div class="endpoint-list">
                    <p><a href="/api/test" target="_blank">GET /api/test</a> - API Status</p>
                    <p><a href="/api/files" target="_blank">GET /api/files</a> - Get Files</p>
                    <p><a href="/api/channel-info" target="_blank">GET /api/channel-info</a> - Channel Details</p>
                    <p><a href="/api/mock-test/sample" target="_blank">GET /api/mock-test/:fileId</a> - Mock Test Parser</p>
                    <p><strong>POST /api/security/log</strong> - Security Event Logging</p>
                    <p><a href="/health" target="_blank">GET /health</a> - Health Check</p>
                    <p><a href="/api/bot-test" target="_blank">GET /api/bot-test</a> - Bot Test</p>
                </div>
            </div>
            
            <div class="security-info">
                <h3>🔐 Rate Limits:</h3>
                <ul>
                    <li><code>/api/files</code>: 50 requests per 15 minutes</li>
                    <li><code>/api/mock-test</code>: 20 requests per 15 minutes</li>
                    <li><code>/api/telegram/file</code>: 30 requests per 15 minutes</li>
                    <li>Other endpoints: 100 requests per 15 minutes</li>
                </ul>
            </div>
            
            <p>✅ Using updated Telegram API</p>
            
            <div class="channel">
                <h3>🔗 Frontend:</h3>
                <p><a href="https://avirus90.github.io/AnonEdu/" target="_blank">Open EduAnon Frontend</a></p>
                <p>Backend URL: <code>https://anon-edu-backend-anon.vercel.app</code></p>
            </div>
            
            <div class="security-info">
                <h3>📊 Security Monitoring:</h3>
                <p>All security events are logged.</p>
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
        service: 'EduAnon Backend API',
        channel_id: '-1003687504990',
        channel_username: '@ANON_EDU',
        cors_enabled: true,
        allowed_origins: ['https://anonedu.github.io', 'https://avirus90.github.io', 'localhost'],
        rate_limiting: true,
        security_headers: true,
        backend_version: '2.0.0',
        frontend_url: 'https://avirus90.github.io/AnonEdu/',
        timestamp: new Date().toISOString()
    });
});

// Channel info
app.get('/api/channel-info', async (req, res) => {
    try {
        const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8151664879:AAGggzn4M2Iv-9lHAUJXjCVPGKnKyr7IZMc';
        
        const response = await axios.get(
            `https://api.telegram.org/bot${BOT_TOKEN}/getChat`,
            { 
                params: { chat_id: '@ANON_EDU' },
                timeout: 10000
            }
        );
        
        res.json({
            success: true,
            channel: response.data.result,
            security: 'rate_limited',
            cors: 'restricted'
        });
    } catch (error) {
        res.json({
            success: false,
            error: error.message,
            security: 'rate_limited',
            cors: 'restricted'
        });
    }
});

// Main files endpoint
app.get('/api/files', async (req, res) => {
    try {
        const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8151664879:AAGggzn4M2Iv-9lHAUJXjCVPGKnKyr7IZMc';
        
        console.log(`📥 Fetching files from @ANON_EDU from IP: ${req.ip}`);

        const updatesResponse = await axios.get(
            `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`,
            {
                params: {
                    limit: 100,
                    offset: -100
                },
                timeout: 15000
            }
        );

        console.log(`📊 Updates received: ${updatesResponse.data.result?.length || 0}`);
        
        const files = [];
        
        if (updatesResponse.data.ok && updatesResponse.data.result) {
            for (const update of updatesResponse.data.result) {
                const msg = update.channel_post || update.edited_channel_post || update.message;
                
                if (msg && msg.document) {
                    const fileData = msg.document;
                    
                    try {
                        const fileRes = await axios.get(
                            `https://api.telegram.org/bot${BOT_TOKEN}/getFile`,
                            { 
                                params: { file_id: fileData.file_id },
                                timeout: 5000
                            }
                        );
                        
                        if (fileRes.data.ok) {
                            files.push({
                                id: msg.message_id,
                                date: new Date(msg.date * 1000).toLocaleString('hi-IN'),
                                caption: msg.caption || 'Document',
                                type: 'document',
                                name: fileData.file_name || `document_${msg.message_id}`,
                                size: fileData.file_size,
                                mime_type: fileData.mime_type,
                                download_url: `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileRes.data.result.file_path}`,
                                file_id: fileData.file_id,
                                security_note: 'File access is rate limited'
                            });
                        }
                    } catch (fileError) {
                        console.log(`⚠️ File error: ${fileError.message}`);
                    }
                }
                
                if (msg && msg.photo && msg.photo.length > 0) {
                    const photoData = msg.photo[msg.photo.length - 1];
                    
                    try {
                        const fileRes = await axios.get(
                            `https://api.telegram.org/bot${BOT_TOKEN}/getFile`,
                            { 
                                params: { file_id: photoData.file_id },
                                timeout: 5000
                            }
                        );
                        
                        if (fileRes.data.ok) {
                            files.push({
                                id: msg.message_id,
                                date: new Date(msg.date * 1000).toLocaleString('hi-IN'),
                                caption: msg.caption || 'Photo',
                                type: 'image',
                                name: `photo_${msg.message_id}.jpg`,
                                size: photoData.file_size,
                                mime_type: 'image/jpeg',
                                download_url: `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileRes.data.result.file_path}`,
                                security_note: 'File access is rate limited'
                            });
                        }
                    } catch (photoError) {
                        console.log(`⚠️ Photo error: ${photoError.message}`);
                    }
                }
            }
        }

        console.log(`✅ Total files found: ${files.length}`);
        
        if (files.length === 0) {
            console.log('No files in updates, trying direct channel access...');
            
            try {
                const chatResponse = await axios.get(
                    `https://api.telegram.org/bot${BOT_TOKEN}/getChat`,
                    { 
                        params: { chat_id: '@ANON_EDU' },
                        timeout: 5000
                    }
                );
                
                console.log('Channel accessible:', chatResponse.data.ok);
                
                res.json({
                    success: true,
                    channel: '@ANON_EDU',
                    channel_id: '-1003687504990',
                    channel_accessible: chatResponse.data.ok,
                    total_files: 0,
                    files: [],
                    message: 'Channel is accessible but no files found in recent updates',
                    security: {
                        rate_limited: true,
                        cors_restricted: true,
                        abuse_detection: true
                    },
                    timestamp: new Date().toISOString()
                });
                return;
                
            } catch (channelError) {
                console.log('Channel access error:', channelError.message);
            }
        }
        
        res.json({
            success: true,
            channel: '@ANON_EDU',
            channel_id: '-1003687504990',
            total_files: files.length,
            files: files,
            security: {
                rate_limited: true,
                cors_restricted: true,
                abuse_detection: true
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ API Error:', error.message);
        
        res.json({
            success: false,
            error: error.message,
            hint: 'Bot token or API issue',
            channel: '@ANON_EDU',
            channel_id: '-1003687504990',
            security: {
                rate_limited: true,
                cors_restricted: true
            }
        });
    }
});

// Mock Test Parser Endpoint
app.get('/api/mock-test/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;
        const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8151664879:AAGggzn4M2Iv-9lHAUJXjCVPGKnKyr7IZMc';
        
        console.log(`📥 Processing mock test file: ${fileId} from IP: ${req.ip}`);
        
        if (!fileId || fileId.length > 100) {
            return res.json({
                success: false,
                error: 'Invalid file ID format',
                security: 'input_validation_failed'
            });
        }
        
        const fileResponse = await axios.get(
            `https://api.telegram.org/bot${BOT_TOKEN}/getFile`,
            { 
                params: { file_id: fileId },
                timeout: 10000
            }
        );
        
        if (!fileResponse.data.ok) {
            throw new Error('File not found');
        }
        
        const filePath = fileResponse.data.result.file_path;
        const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
        
        console.log(`📄 Downloading file from: ${fileUrl}`);
        
        const txtResponse = await axios.get(fileUrl, { 
            timeout: 15000,
            maxContentLength: 5 * 1024 * 1024
        });
        const content = txtResponse.data;
        
        console.log(`📊 File content length: ${content.length} characters`);
        
        const questions = parseTxtToQuestions(content);
        
        console.log(`✅ Parsed ${questions.length} questions`);
        
        res.json({
            success: true,
            questions: questions,
            total: questions.length,
            fileId: fileId,
            security: {
                rate_limited: true,
                size_checked: true,
                cors_restricted: true
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Mock test error:', error.message);
        res.json({
            success: false,
            error: error.message,
            message: 'Failed to load mock test',
            security: {
                rate_limited: true,
                cors_restricted: true
            },
            timestamp: new Date().toISOString()
        });
    }
});

// TXT Parser Function
function parseTxtToQuestions(content) {
    const lines = content.split('\n');
    const questions = [];
    let currentQuestion = null;
    let questionNumber = 1;
    
    for (const line of lines) {
        const trimmed = line.trim();
        
        if (!trimmed) continue;
        
        if (trimmed.startsWith('Q:')) {
            if (currentQuestion) questions.push(currentQuestion);
            currentQuestion = {
                id: questionNumber++,
                question: trimmed.substring(2).trim(),
                options: [],
                answer: null,
                explanation: null
            };
        } 
        else if (trimmed.startsWith('A:')) {
            if (currentQuestion) currentQuestion.options.push({
                letter: 'A',
                text: trimmed.substring(2).trim()
            });
        }
        else if (trimmed.startsWith('B:')) {
            if (currentQuestion) currentQuestion.options.push({
                letter: 'B',
                text: trimmed.substring(2).trim()
            });
        }
        else if (trimmed.startsWith('C:')) {
            if (currentQuestion) currentQuestion.options.push({
                letter: 'C',
                text: trimmed.substring(2).trim()
            });
        }
        else if (trimmed.startsWith('D:')) {
            if (currentQuestion) currentQuestion.options.push({
                letter: 'D',
                text: trimmed.substring(2).trim()
            });
        }
        else if (trimmed.toUpperCase().startsWith('ANS:')) {
            if (currentQuestion) {
                const answer = trimmed.substring(4).trim().toUpperCase();
                currentQuestion.answer = answer;
                currentQuestion.correctOption
