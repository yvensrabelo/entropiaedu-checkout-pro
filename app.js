require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MercadoPagoConfig, Preference } = require('mercadopago');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Configuração do Mercado Pago
const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN,
    options: {
        timeout: 5000,
        idempotencyKey: 'abc'
    }
});

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

// Debug middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
});

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota de teste para verificar variáveis de ambiente
app.get('/test', (req, res) => {
    res.json({
        hasAccessToken: !!process.env.MP_ACCESS_TOKEN,
        hasPublicKey: !!process.env.MP_PUBLIC_KEY,
        hasProductionUrl: !!process.env.PRODUCTION_URL,
        nodeEnv: process.env.NODE_ENV,
        accessTokenLength: process.env.MP_ACCESS_TOKEN ? process.env.MP_ACCESS_TOKEN.length : 0
    });
});

// Criar preferência de pagamento
app.post('/create_preference', async (req, res) => {
    try {
        console.log('Criando preferência de pagamento...');
        console.log('Access Token presente:', !!process.env.MP_ACCESS_TOKEN);
        console.log('Request body:', req.body);

        const preference = new Preference(client);

        // Preferência mínima para teste
        const body = {
            items: [
                {
                    title: req.body.title || 'Produto Exemplo',
                    quantity: 1,
                    unit_price: 100.00
                }
            ]
        };

        const result = await preference.create({ body });
        res.json({
            id: result.id,
            init_point: result.init_point,
            sandbox_init_point: result.sandbox_init_point
        });

    } catch (error) {
        console.error('Erro ao criar preferência:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({
            error: 'Erro interno do servidor',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// URLs de retorno
app.get('/success', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'success.html'));
});

app.get('/failure', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'failure.html'));
});

app.get('/pending', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pending.html'));
});

// Webhook para notificações
app.post('/webhook', async (req, res) => {
    const webhook = require('./src/webhook');

    try {
        // Log da requisição para debug
        console.log('Headers recebidos:', req.headers);
        console.log('Body recebido:', req.body);

        // Validar assinatura do webhook em produção
        if (process.env.NODE_ENV === 'production' && process.env.WEBHOOK_SECRET) {
            if (!webhook.validateWebhookSignature(req, process.env.WEBHOOK_SECRET)) {
                console.error('Assinatura de webhook inválida');
                return res.status(401).json({ error: 'Unauthorized' });
            }
            console.log('Webhook validado com sucesso');
        } else {
            console.log('Validação de webhook desabilitada (ambiente de desenvolvimento ou WEBHOOK_SECRET não configurado)');
        }

        const notification = req.body;
        console.log('Webhook recebido:', {
            id: notification.id,
            topic: notification.topic,
            type: notification.type,
            action: notification.action,
            data: notification.data
        });

        // Processar diferentes tipos de notificação
        switch (notification.topic || notification.type) {
            case 'payment':
                if (notification.data && notification.data.id) {
                    // Em produção, você faria uma chamada à API para obter os dados completos
                    // const payment = await mercadopago.payment.findById(notification.data.id);
                    // await webhook.processPaymentNotification(payment);
                    console.log('Notificação de pagamento recebida:', notification.data.id);
                }
                break;

            case 'merchant_order':
                if (notification.data && notification.data.id) {
                    // Em produção, você faria uma chamada à API para obter os dados completos
                    // const order = await mercadopago.merchant_orders.findById(notification.data.id);
                    // await webhook.processMerchantOrderNotification(order);
                    console.log('Notificação de pedido recebida:', notification.data.id);
                }
                break;

            default:
                console.log('Tipo de notificação não reconhecido:', notification.topic || notification.type);
        }

        res.status(200).send('OK');

    } catch (error) {
        console.error('Erro ao processar webhook:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Iniciar servidor
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
    console.log(`Ambiente: ${process.env.NODE_ENV}`);
});