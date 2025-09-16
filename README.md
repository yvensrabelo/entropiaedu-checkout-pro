# EntropiaEdu - Checkout Pro Mercado Pago

Implementação do Checkout Pro do Mercado Pago para a plataforma EntropiaEdu.

## Características

- ✅ Checkout Pro integrado
- ✅ URLs de retorno configuradas
- ✅ Webhook para notificações
- ✅ Interface responsiva
- ✅ Suporte a todos os meios de pagamento do MP

## Configuração

### Variáveis de Ambiente

Crie um arquivo `.env` com as seguintes variáveis:

```env
MP_PUBLIC_KEY=sua_public_key
MP_ACCESS_TOKEN=seu_access_token
MP_CLIENT_ID=seu_client_id
MP_CLIENT_SECRET=seu_client_secret
PRODUCTION_URL=https://entropiaedu.com
WEBHOOK_SECRET=sua_secret_key
NODE_ENV=production
PORT=3000
```

### Instalação

```bash
npm install
```

### Executar

```bash
npm start
```

## URLs Importantes

- **Homepage**: `/`
- **Criar Preferência**: `POST /create_preference`
- **Sucesso**: `/success`
- **Falha**: `/failure`
- **Pendente**: `/pending`
- **Webhook**: `POST /webhook`

## Webhook

O webhook está configurado para receber notificações em:
`https://entropiaedu.com/webhook`

### Eventos Suportados

- `payment` - Notificações de pagamento
- `merchant_order` - Notificações de pedidos

## Deploy

O projeto está configurado para deploy automático no Vercel.

## Suporte

Para dúvidas técnicas, consulte a [documentação do Mercado Pago](https://www.mercadopago.com.br/developers).