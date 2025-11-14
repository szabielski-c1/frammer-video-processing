# Webhook Forwarder

This is a simple Express app that receives webhooks from Frammer and forwards them to the main frammer-video-processing app.

## Purpose

- **Receives webhooks at:** `https://webhook-test-production-17ab.up.railway.app/webhook`
- **Forwards to:** `https://web-production-e4a7d.up.railway.app/api/webhook`

## Deployment to Railway

This should be deployed to the existing Railway project at `webhook-test-production-17ab.up.railway.app`.

### Steps:

1. **Update the existing webhook-test Railway project:**
   - Replace the code with this webhook-forwarder code
   - Or create a new Railway project and update DNS

2. **No environment variables needed** - The forward URL is hardcoded

3. **Deploy:**
   ```bash
   cd webhook-forwarder
   railway up
   ```

## How It Works

1. Frammer sends webhook → `https://webhook-test-production-17ab.up.railway.app/webhook`
2. This app receives it and logs the payload
3. Forwards the exact same payload → `https://web-production-e4a7d.up.railway.app/api/webhook`
4. Main frammer app processes it and stores results
5. Returns 200 OK to Frammer (whether forward succeeds or fails)

## Testing

Visit: `https://webhook-test-production-17ab.up.railway.app/`

Should return:
```json
{
  "status": "ok",
  "service": "Webhook Forwarder",
  "forwarding_to": "https://web-production-e4a7d.up.railway.app/api/webhook"
}
```

## Logs

Check Railway logs to see:
- Webhooks being received
- Forwarding attempts
- Success/failure status
