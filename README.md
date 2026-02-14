# ZAO Fractal Bot

Discord bot for running ZAO Fractal voting — a fractal democracy system where small groups reach consensus on contribution rankings and earn onchain Respect tokens.

Based on the [Respect Game](https://edenfractal.com/fractal-decision-making-processes) pioneered by Eden Fractal and Optimism Fractal.

## How It Works

1. **Group up** — 2-6 people join a voice channel
2. **Start fractal** — Facilitator runs `/zaofractal` (optionally with a custom name)
3. **Vote** — Members vote on who contributed most using button UI (Levels 6 → 1)
4. **Results** — Bot posts final rankings with a clickable link to submit results onchain
5. **Earn Respect** — Rankings are submitted to the ZAO Respect contract on Optimism via [zao.frapps.xyz](https://zao.frapps.xyz)

### Respect Points (Year 2 — 2x Fibonacci)

| Rank | Level | Respect |
|------|-------|---------|
| 1st  | 6     | 110     |
| 2nd  | 5     | 68      |
| 3rd  | 4     | 42      |
| 4th  | 3     | 26      |
| 5th  | 2     | 16      |
| 6th  | 1     | 10      |

## Commands

### Everyone

| Command | Description |
|---------|-------------|
| `/zaofractal [name]` | Start a fractal from your voice channel. Optional custom name. |
| `/endgroup` | End your fractal (facilitator only) |
| `/status` | Check fractal status (use in fractal thread) |
| `/groupwallets` | Show wallet addresses for all group members |
| `/register <wallet>` | Link your Ethereum wallet for onchain Respect |
| `/wallet` | Show your linked wallet |

### Supreme Admin Only

| Command | Description |
|---------|-------------|
| `/admin_register <user> <wallet>` | Register wallet for another user |
| `/admin_wallets` | List all wallet registrations + stats |
| `/admin_lookup <user>` | Look up a user's wallet |
| `/admin_match_all` | Auto-match server members to wallets by display name |
| `/admin_end_fractal [thread_id]` | Force end any fractal |
| `/admin_list_fractals` | List all active fractals |
| `/admin_cleanup` | Clean up stuck/old fractals |
| `/admin_force_round <thread_id>` | Skip voting, advance to next round |
| `/admin_reset_votes <thread_id>` | Clear all votes in current round |
| `/admin_declare_winner <thread_id> <user>` | Manually declare a round winner |
| `/admin_add_member <thread_id> <user>` | Add someone to an active fractal |
| `/admin_remove_member <thread_id> <user>` | Remove someone from an active fractal |
| `/admin_change_facilitator <thread_id> <user>` | Transfer facilitator role |
| `/admin_pause_fractal <thread_id>` | Pause voting |
| `/admin_resume_fractal <thread_id>` | Resume voting |
| `/admin_restart_fractal <thread_id>` | Restart from Level 6 with same members |
| `/admin_fractal_stats <thread_id>` | Detailed stats for a fractal |
| `/admin_server_stats` | Server-wide fractal statistics |
| `/admin_export_data [thread_id]` | Export fractal data as JSON file |

## Wallet System

The bot maps Discord users to Ethereum wallet addresses for onchain submission:

- **`/register`** — Users self-register their wallet
- **Name matching** — 130+ pre-loaded name→wallet mappings in `data/names_to_wallets.json` auto-match by Discord display name
- **Admin override** — Admins can register wallets for any user with `/admin_register`
- **`/admin_match_all`** — Shows which server members already have wallets matched

When a fractal completes, the bot generates a pre-filled `zao.frapps.xyz/submitBreakout` link with all ranked wallet addresses and @mentions everyone to go vote.

## Project Structure

```
fractalbotfeb2026/
├── main.py                    # Bot entry point
├── requirements.txt           # Python dependencies
├── config/
│   ├── config.py              # Settings (roles, levels, respect points)
│   └── .env.template          # Environment variable template
├── cogs/
│   ├── base.py                # Shared utilities (voice check, role check)
│   ├── wallet.py              # Wallet registration commands
│   └── fractal/
│       ├── __init__.py
│       ├── cog.py             # Slash commands (25 total)
│       ├── group.py           # Core voting logic + submitBreakout URL
│       └── views.py           # Discord button UIs
├── utils/
│   ├── logging.py             # Color-coded logging
│   └── web_integration.py     # Webhook notifications to web dashboard
├── data/
│   ├── wallets.json           # Discord ID → wallet mappings
│   └── names_to_wallets.json  # Name → wallet mappings (pre-loaded)
└── web/                       # Next.js dashboard (optional)
    ├── pages/                 # Dashboard UI + API routes
    ├── components/ui/         # Radix UI components
    └── utils/                 # Database schema (Drizzle + Neon)
```

## Setup

### Requirements
- Python 3.10+
- Discord bot token with Message Content, Members, and Guilds intents

### Install & Run

```bash
pip install -r requirements.txt
cp config/.env.template .env
# Edit .env with your DISCORD_TOKEN
python3 main.py
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_TOKEN` | Yes | Discord bot token |
| `DEBUG` | No | Set to `TRUE` for verbose logging |
| `WEB_WEBHOOK_URL` | No | Webhook URL for web dashboard |
| `WEBHOOK_SECRET` | No | Secret for webhook auth |

## Onchain Integration

- **Respect Contract**: Soulbound ERC-1155 on Optimism via [ORDAO](https://optimismfractal.com/council)
- **Submit UI**: [zao.frapps.xyz/submitBreakout](https://zao.frapps.xyz/submitBreakout)
- **Toolkit**: [Optimystics/frapps](https://github.com/Optimystics/frapps)

## Links

- **THE ZAO Discord**: [discord.gg/thezao](https://discord.gg/thezao)
- **Onchain Dashboard**: [zao.frapps.xyz](https://zao.frapps.xyz)
- **Optimism Fractal**: [optimismfractal.com](https://optimismfractal.com)
- **Eden Fractal**: [edenfractal.com](https://edenfractal.com)
