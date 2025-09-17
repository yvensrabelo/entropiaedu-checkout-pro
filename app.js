require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MercadoPagoConfig, Preference, Payment, MerchantOrder } = require('mercadopago');
const path = require('path');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3000;

// Configuração do Mercado Pago
const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN,
    options: {
        timeout: 5000
        // idempotencyKey será gerada por requisição
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

        // Gerar idempotencyKey única para esta requisição
        const idempotencyKey = crypto.randomUUID();
        console.log('IdempotencyKey gerada:', idempotencyKey);

        const preference = new Preference(client);

        // Extrair dados do formulário
        const {
            title,
            description,
            price,
            quantity,
            payer_name,
            payer_surname,
            payer_email
        } = req.body;

        // Validar dados obrigatórios
        if (!title || !price || !quantity || !payer_email) {
            return res.status(400).json({
                error: 'Dados obrigatórios faltando: title, price, quantity, payer_email'
            });
        }

        // Validar e construir URL base
        let baseUrl = process.env.PRODUCTION_URL;

        if (!baseUrl) {
            // Em desenvolvimento, usar URL da requisição
            baseUrl = `${req.protocol}://${req.get('host')}`;
            console.warn('PRODUCTION_URL não configurada, usando URL da requisição:', baseUrl);
        } else if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
            return res.status(500).json({
                error: 'PRODUCTION_URL mal configurada. Deve começar com http:// ou https://'
            });
        }

        // Configurar preferência com dados do formulário
        const body = {
            items: [
                {
                    title: title,
                    description: description || '',
                    quantity: parseInt(quantity),
                    unit_price: parseFloat(price)
                }
            ],
            payer: {
                name: payer_name || '',
                surname: payer_surname || '',
                email: payer_email
            },
            notification_url: `${baseUrl}/webhook`,
            back_urls: {
                success: `${baseUrl}/success`,
                failure: `${baseUrl}/failure`,
                pending: `${baseUrl}/pending`
            },
            auto_return: 'approved'
        };

        console.log('Notification URL configurada:', body.notification_url);

        const result = await preference.create({
            body,
            requestOptions: {
                idempotencyKey: idempotencyKey
            }
        });
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
                    try {
                        // Buscar dados completos do pagamento
                        const payment = new Payment(client);
                        const paymentData = await payment.get({
                            id: notification.data.id
                        });

                        console.log('Dados do pagamento obtidos:', {
                            id: paymentData.id,
                            status: paymentData.status,
                            status_detail: paymentData.status_detail,
                            amount: paymentData.transaction_amount
                        });

                        // Processar notificação com dados reais
                        await webhook.processPaymentNotification(paymentData);
                    } catch (error) {
                        console.error('Erro ao buscar dados do pagamento:', error);
                    }
                }
                break;

            case 'merchant_order':
                if (notification.data && notification.data.id) {
                    try {
                        // Buscar dados completos do pedido
                        const merchantOrder = new MerchantOrder(client);
                        const orderData = await merchantOrder.get({
                            id: notification.data.id
                        });

                        console.log('Dados do pedido obtidos:', {
                            id: orderData.id,
                            status: orderData.status,
                            items: orderData.items?.length || 0
                        });

                        // Processar notificação com dados reais
                        await webhook.processMerchantOrderNotification(orderData);
                    } catch (error) {
                        console.error('Erro ao buscar dados do pedido:', error);
                    }
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