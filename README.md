# Paperclip AI Telegram Bot

A Telegram bot that bridges messages to a [Paperclip AI](https://github.com/paperclipai) backend. Users send messages via Telegram, which become issues on the Paperclip platform assigned to a CEO agent. The agent's response is polled and relayed back to Telegram.

## How It Works

1. User sends a message on Telegram
2. Bot creates an issue on the Paperclip API with the message content
3. The assigned CEO agent is woken up to process the issue
4. Bot polls for the agent's comment response (3s interval, up to 3min timeout)
5. Response is sent back to the user on Telegram

Each message creates a new issue — there is no conversation threading.

## Prerequisites

- [Bun](https://bun.sh) runtime
- [Paperclip AI](https://github.com/paperclipai) server running locally (default `http://127.0.0.1:3100`)
- Telegram bot token from [@BotFather](https://t.me/BotFather)
- Your Telegram user ID (get it from [@userinfobot](https://t.me/userinfobot))
- At least one company with an agent configured in Paperclip

## Setup

```bash
cd telegram-bot
bun install
cp .env.example .env
```

Edit `.env`:

```env
TELEGRAM_BOT_TOKEN=123456789:AAHfiqksKZ8...
ADMIN_USER_IDS=your_telegram_user_id
PAPERCLIP_URL=http://127.0.0.1:3100
```

`PAPERCLIP_COMPANIES` is optional — the bot auto-syncs companies and agents from the Paperclip API on startup and every 60 seconds. If the API is unreachable, you can set it manually:

```env
PAPERCLIP_COMPANIES=[{"name":"My Company","companyId":"xxx","ceoAgentId":"yyy","goalId":"zzz"}]
```

## Run

Start the Paperclip server first, then the bot:

```bash
bun run dev
```

DM your bot on Telegram. Only users in `ADMIN_USER_IDS` (and anyone added via `/allow`) can interact with it. Unauthorized messages are silently ignored.

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Connect and show active company |
| `/company` | Switch between companies |
| `/clear` | Reset conversation (no-op in current mode) |
| `/agent` | Show active agent info |
| `/help` | List commands |

### Admin only

| Command | Description |
|---------|-------------|
| `/allow <user_id>` | Add user to allowlist |
| `/revoke <user_id>` | Remove user from allowlist |
| `/users` | List allowed users |

## Features

- **Multi-company support** — switch between Paperclip companies via inline keyboard
- **Auto-sync** — discovers companies and agents from the Paperclip API automatically
- **Approval management** — polls for pending approvals (hire requests, etc.) and sends Approve/Reject buttons to admins
- **Comment forwarding** — new comments on non-Telegram issues are forwarded to admins
- **Typing indicator** while waiting for agent responses
- **Auto-chunking** for long responses (4096 char Telegram limit)
- **Access control** — allowlist persisted to `access.json` with atomic writes

## Architecture

```
telegram-bot/src/
  index.ts          — Entrypoint (polling or webhook mode)
  bot.ts            — grammY bot setup, middleware, handlers, pollers
  config.ts         — Environment parsing and company config
  state.ts          — Per-user active company selection (in-memory)
  sync.ts           — Auto-sync companies/agents from Paperclip API
  ai/claude.ts      — Paperclip REST bridge (creates issues, wakes agents, polls comments)
  handlers/
    commands.ts     — Bot command handlers
    message.ts      — Text/photo message handlers
  security/
    access.ts       — Allowlist-based access control
  approvals.ts      — Polls and surfaces pending approvals to admins
  comments.ts       — Polls and forwards new comments to admins
```

## Production (webhook mode)

Set in `.env`:

```env
BOT_MODE=webhook
WEBHOOK_URL=https://your-domain.com
```

The bot listens on `PORT` (default 3000) and registers the webhook with Telegram automatically.
