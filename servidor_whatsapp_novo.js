const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(express.json());

// 🔥 IMPORTANTE: Adicionar CORS para permitir requisições
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

let client = null;
let status = 'Desconectado';

// Configurar cliente WhatsApp
client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: false,  // Vamos ver o navegador para debug
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Gerar QR Code
client.on('qr', (qr) => {
    console.log('📱 ESCANEIE O QR CODE ABAIXO:');
    qrcode.generate(qr, { small: true });
    status = 'Aguardando QR Code...';
});

// Quando conectar
client.on('ready', () => {
    console.log('✅ WhatsApp conectado com sucesso!');
    status = 'Conectado';
});

// Quando desconectar
client.on('disconnected', (reason) => {
    console.log('❌ WhatsApp desconectado:', reason);
    status = 'Desconectado';
});

// Inicializar WhatsApp
console.log('🔄 Iniciando WhatsApp...');
client.initialize();

// Rota para status
app.get('/status', (req, res) => {
    res.json({ 
        status: status,
        connected: status === 'Conectado'
    });
});

// Rota para enviar mensagem
app.post('/send-message', async (req, res) => {
    const { phone, message } = req.body;
    
    if (status !== 'Conectado') {
        return res.status(500).json({ 
            success: false, 
            error: 'WhatsApp não está conectado. Status: ' + status
        });
    }
    
    try {
        // Formatar telefone (55DDDNUMERO)
        const phoneFormatted = '55' + phone.replace(/\D/g, '') + '@c.us';
        
        console.log(`📤 Enviando mensagem para: ${phone}`);
        console.log(`💬 Mensagem: ${message}`);
        
        const result = await client.sendMessage(phoneFormatted, message);
        
        console.log('✅ Mensagem enviada com sucesso!');
        res.json({ 
            success: true, 
            message: 'Mensagem enviada',
            messageId: result.id._serialized 
        });
        
    } catch (error) {
        console.log('❌ Erro ao enviar mensagem:', error);
        res.status(500).json({ 
            success: false, 
            error: error.toString() 
        });
    }
});

// Rota para reconectar
app.post('/reconnect', async (req, res) => {
    try {
        await client.destroy();
        await client.initialize();
        res.json({ success: true, status: status });
    } catch (error) {
        res.status(500).json({ success: false, error: error.toString() });
    }
});

// Servidor web simples para ver status
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>WhatsApp Web.js - Sistema de Notificações</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; }
                .status { padding: 20px; border-radius: 10px; margin: 10px 0; font-size: 18px; }
                .connected { background: #d4edda; color: #155724; }
                .disconnected { background: #f8d7da; color: #721c24; }
                .waiting { background: #fff3cd; color: #856404; }
                button { padding: 10px 20px; font-size: 16px; margin: 5px; }
            </style>
        </head>
        <body>
            <h1>🤖 WhatsApp Web.js - Notificações</h1>
            <div id="status" class="status">Carregando...</div>
            
            <div>
                <button onclick="checkStatus()">🔄 Verificar Status</button>
                <button onclick="testarEnvio()">🧪 Testar Envio</button>
            </div>

            <script>
                async function checkStatus() {
                    try {
                        const response = await fetch('/status');
                        const data = await response.json();
                        
                        const statusDiv = document.getElementById('status');
                        statusDiv.textContent = 'Status: ' + data.status;
                        statusDiv.className = 'status ' + (
                            data.connected ? 'connected' : 
                            data.status.includes('Aguardando') ? 'waiting' : 'disconnected'
                        );
                    } catch (error) {
                        document.getElementById('status').textContent = 'Erro: ' + error.message;
                    }
                }

                async function testarEnvio() {
                    try {
                        const response = await fetch('/send-message', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                phone: '62985114018',
                                message: '🚀 Teste do novo sistema WhatsApp Web.js! Funcionando perfeitamente!'
                            })
                        });
                        
                        const data = await response.json();
                        if (data.success) {
                            alert('✅ Mensagem enviada com sucesso!');
                        } else {
                            alert('❌ Erro: ' + data.error);
                        }
                    } catch (error) {
                        alert('❌ Falha na conexão: ' + error.message);
                    }
                }

                // Verificar status a cada 5 segundos
                checkStatus();
                setInterval(checkStatus, 5000);
            </script>
        </body>
        </html>
    `);
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('🚀 Servidor rodando na porta: ' + PORT);
});