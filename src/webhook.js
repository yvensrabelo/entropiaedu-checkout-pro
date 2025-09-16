const crypto = require('crypto');

/**
 * Valida a assinatura do webhook do Mercado Pago
 */
function validateWebhookSignature(req, secret) {
    if (!secret) {
        console.warn('WEBHOOK_SECRET não configurado - validação de assinatura desabilitada');
        return true;
    }

    const signature = req.headers['x-signature'];
    const requestId = req.headers['x-request-id'];

    if (!signature || !requestId) {
        console.error('Headers de assinatura ausentes');
        return false;
    }

    // Extrair timestamp e hash da assinatura
    const parts = signature.split(',');
    let ts, hash;

    for (const part of parts) {
        const [key, value] = part.split('=');
        if (key && value) {
            const cleanKey = key.trim();
            const cleanValue = value.trim();
            if (cleanKey === 'ts') {
                ts = cleanValue;
            } else if (cleanKey === 'v1') {
                hash = cleanValue;
            }
        }
    }

    if (!ts || !hash) {
        console.error('Formato de assinatura inválido');
        return false;
    }

    // Verificar se o timestamp não é muito antigo (5 minutos)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(ts)) > 300) {
        console.error('Timestamp da assinatura muito antigo');
        return false;
    }

    // Criar string para validação
    const dataId = req.body.data?.id || '';
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;

    // Calcular HMAC
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(manifest);
    const expectedHash = hmac.digest('hex');

    if (expectedHash !== hash) {
        console.error('Hash de assinatura inválido');
        return false;
    }

    return true;
}

/**
 * Processa notificações de pagamento
 */
async function processPaymentNotification(paymentData) {
    console.log('Processando notificação de pagamento:', {
        id: paymentData.id,
        status: paymentData.status,
        external_reference: paymentData.external_reference
    });

    // Aqui você implementaria a lógica específica do seu negócio
    switch (paymentData.status) {
        case 'approved':
            console.log('Pagamento aprovado - liberando acesso');
            // Implementar lógica para liberar produto/serviço
            break;

        case 'pending':
            console.log('Pagamento pendente - aguardando confirmação');
            // Implementar lógica para pagamento pendente
            break;

        case 'rejected':
            console.log('Pagamento rejeitado');
            // Implementar lógica para pagamento rejeitado
            break;

        case 'cancelled':
            console.log('Pagamento cancelado');
            // Implementar lógica para pagamento cancelado
            break;

        default:
            console.log('Status de pagamento desconhecido:', paymentData.status);
    }
}

/**
 * Processa notificações de merchant order
 */
async function processMerchantOrderNotification(orderData) {
    console.log('Processando notificação de pedido:', {
        id: orderData.id,
        status: orderData.status
    });

    // Implementar lógica específica para pedidos
}

module.exports = {
    validateWebhookSignature,
    processPaymentNotification,
    processMerchantOrderNotification
};