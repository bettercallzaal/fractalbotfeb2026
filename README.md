# ZAO Fractal Bot

Discord bot for running ZAO Fractal voting — a fractal democracy system where small groups reach consensus on contribution rankings and earn onchain Respect tokens.

Based on the [Respect Game](https://edenfractal.com/fractal-decision-making-processes) pioneered by Eden Fractal and Optimism Fractal.

## How It Works

1. **Group up** — 2-6 people join a voice channel
2. **Start fractal** — Facilitator runs `/zaofractal`, confirms members, then enters the fractal number and group number via a popup modal
3. **Vote** — Members vote on who contributed most using colored button UI (Levels 6 → 1). Each round, the bot joins voice to play an audio ping and posts a voting link in the voice channel text chat.
4. **Results** — Bot posts a rich embed to the general channel with final rankings, Respect points earned, and a one-click link to submit results onchain
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
| `/register <wallet or ENS>` | Link your Ethereum wallet or ENS name (e.g. `vitalik.eth`) |
| `/wallet` | Show your linked wallet |
| `/guide` | Learn how ZAO Fractal works (with link to full web guide) |
| `/intro <@user>` | Look up a member's introduction from #intros |
| `/propose <title> <description> [type] [amount]` | Create a proposal for community voting |
| `/proposals` | List all active proposals |
| `/proposal <id>` | View details and vote breakdown for a proposal |
| `/leaderboard` | View the ZAO Respect leaderboard |
| `/timer [minutes] [shuffle]` | Start a presentation timer for voice channel members |
| `/timer_add [minutes]` | Add extra time to the current speaker |
| `/history [query]` | Search completed fractals by member, group, or fractal number |
| `/mystats [@user]` | View cumulative fractal stats and Respect earned |
| `/rankings` | View cumulative Respect rankings from fractal history |

### Supreme Admin Only

| Command | Description |
|---------|-------------|
| `/admin_register <user> <wallet or ENS>` | Register wallet or ENS for another user |
| `/admin_wallets` | List all wallet registrations + stats |
| `/admin_lookup <user>` | Look up a user's wallet |
| `/admin_match_all` | Auto-match server members to wallets by display name |
| `/admin_refresh_intros` | Rebuild intro cache from #intros channel history |
| `/admin_close_proposal <id>` | Close voting on a proposal and post results |
| `/admin_delete_proposal <id>` | Delete a proposal entirely |
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

## Introduction Lookup

The `/intro` command lets anyone look up a member's introduction from the #intros channel:

- **Cached** — Intros are fetched once from channel history and cached in `data/intros.json`
- **Rich embed** — Shows intro text, link to their [thezao.com](https://thezao.com) community page, and wallet address if registered
- **Admin refresh** — `/admin_refresh_intros` rebuilds the entire cache from channel history

## Proposal System

Community proposals with threaded discussion and voting:

- **`/propose`** — Create a proposal (Text, Governance, or Funding type)
  - **Text/Funding** — Yes / No / Abstain voting buttons
  - **Governance** — Custom options entered via modal (up to 5 choices)
  - Each proposal gets its own discussion thread
- **Persistent votes** — Voting buttons survive bot restarts
- **Respect-weighted** — Vote power = your total onchain Respect (OG + ZOR). Must hold Respect tokens and have a registered wallet to vote.
- **Admin controls** — Close voting to post final results, or delete proposals entirely

## Respect Leaderboard

Live onchain leaderboard at [zao-fractal.vercel.app/leaderboard](https://zao-fractal.vercel.app/leaderboard):

- Queries OG Respect (ERC-20) and ZOR Respect (ERC-1155) balances from Optimism
- Uses Multicall3 for efficient batch queries across 130+ member wallets
- Searchable, sortable table with top-3 medal highlights
- 5-minute server-side cache for fast responses
- `/leaderboard` command in Discord links directly to the web page

## Fractal History & Stats

Every completed fractal is automatically logged to `data/history.json`:

- **`/history [query]`** — Search past fractals by member name, group name, or fractal number
- **`/mystats [@user]`** — View cumulative Respect earned, participation count, podium finishes, and recent fractals
- **`/rankings`** — Cumulative Respect leaderboard from all recorded fractal history
- Auto-records rankings, Respect points, facilitator, fractal/group number, and timestamp

## Presentation Timer

Run `/timer` before voting to give each member structured speaking time:

- **Auto-detects speakers** from your voice channel (2-6 members)
- **Live countdown** using Discord's built-in relative timestamps (updates client-side)
- **Facilitator controls** — Skip, Pause, Resume, and Stop buttons
- **`/timer_add`** — Add extra minutes to the current speaker if needed
- **Shuffle option** — Randomize speaker order with `shuffle: True`
- When all speakers finish, the bot announces "Ready to begin voting!"

## Wallet System

The bot maps Discord users to Ethereum wallet addresses for onchain submission:

- **`/register`** — Users self-register their wallet address or ENS name (e.g. `vitalik.eth` → auto-resolves to `0x...`)
- **Name matching** — 130+ pre-loaded name→wallet mappings in `data/names_to_wallets.json` auto-match by Discord display name
- **Admin override** — Admins can register wallets or ENS names for any user with `/admin_register`
- **`/admin_match_all`** — Shows which server members already have wallets matched

When a fractal completes, the bot generates a pre-filled `zao.frapps.xyz/submitBreakout` link with all ranked wallet addresses and @mentions everyone to go vote.

## Voice Channel Notifications

Each voting round, the bot:
- **Sends a link** to the voting thread in the voice channel's text chat so members can click through
- **Plays an audio ping** by joining the voice channel, playing a short ding sound, then disconnecting

## Project Structure

```
fractalbotfeb2026/
├── main.py                    # Bot entry point
├── requirements.txt           # Python dependencies
├── config/
│   ├── config.py              # Settings (roles, levels, respect points, channels)
│   └── .env.template          # Environment variable template
├── assets/
│   └── ping.mp3               # Audio notification for voting rounds
├── cogs/
│   ├── base.py                # Shared utilities (voice check, role check)
│   ├── guide.py               # /guide + /leaderboard commands
│   ├── intro.py               # /intro command with cached #intros lookup
│   ├── proposals.py           # Proposal voting system
│   ├── history.py             # Fractal history tracking + search
│   ├── timer.py               # Presentation timer with speaker queue
│   ├── wallet.py              # Wallet + ENS registration commands
│   └── fractal/
│       ├── __init__.py
│       ├── cog.py             # Slash commands (26 total)
│       ├── group.py           # Core voting logic + voice notifications
│       └── views.py           # Discord button UIs + naming modal
├── utils/
│   ├── logging.py             # Color-coded logging
│   └── web_integration.py     # Webhook notifications to web dashboard
├── data/
│   ├── wallets.json           # Discord ID → wallet mappings
│   ├── names_to_wallets.json  # Name → wallet mappings (pre-loaded)
│   ├── intros.json            # Cached #intros channel messages
│   ├── proposals.json         # Proposal data + votes
│   └── history.json           # Completed fractal results log
└── web/                       # Next.js web app (Vercel)
    ├── pages/
    │   ├── index.tsx          # Dashboard UI
    │   ├── guide.tsx          # Full guide / slide deck (public)
    │   ├── leaderboard.tsx    # Respect leaderboard (public)
    │   └── api/
    │       ├── leaderboard.ts # Onchain balance API (Multicall3 + ethers)
    │       └── ...            # Auth + webhook routes
    ├── components/ui/         # Radix UI components
    └── utils/                 # Database schema (Drizzle + Neon)
```

## Setup

### Requirements
- Python 3.10+
- Discord bot token with Message Content, Members, and Guilds intents
- ffmpeg (for voice channel audio pings) — `brew install ffmpeg` on macOS

### Install & Run (Local)

```bash
pip install -r requirements.txt
cp config/.env.template .env
# Edit .env with your DISCORD_TOKEN
python3 main.py
```

### Web App (Local)

```bash
cd web
npm install
cp .env.example .env.local
# Edit .env.local with ALCHEMY_OPTIMISM_RPC key
npm run dev
```

### Deploy to Bot-Hosting.net

1. Create a Discord bot server at [bot-hosting.net](https://bot-hosting.net)
2. In the **Files** tab, upload all project files directly into `/home/container/` (no subfolders — `main.py` must be at the root)
3. Upload your `.env` file separately with your bot token
4. In the **Startup** tab, set **App py file** to `main.py`
5. Hit **Start** — dependencies install automatically from `requirements.txt`

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_TOKEN` | Yes | Discord bot token |
| `DEBUG` | No | Set to `TRUE` for verbose logging |
| `WEB_WEBHOOK_URL` | No | Webhook URL for web dashboard |
| `WEBHOOK_SECRET` | No | Secret for webhook auth |
| `ALCHEMY_OPTIMISM_RPC` | For leaderboard | Alchemy RPC URL for Optimism |

## Onchain Integration

- **Respect Contract**: Soulbound ERC-1155 on Optimism via [ORDAO](https://optimismfractal.com/council)
- **OG Respect (ERC-20)**: `0x34cE89baA7E4a4B00E17F7E4C0cb97105C216957`
- **ZOR Respect (ERC-1155)**: `0x9885CCeEf7E8371Bf8d6f2413723D25917E7445c`
- **Submit UI**: [zao.frapps.xyz/submitBreakout](https://zao.frapps.xyz/submitBreakout)
- **Toolkit**: [Optimystics/frapps](https://github.com/Optimystics/frapps)

## Recently Shipped

- [x] **Fractal history tracking** — `/history`, `/mystats`, `/rankings` with searchable log of all completed fractals
- [x] **Presentation timer** — `/timer` manages a speaking queue with live countdown, skip/pause/resume controls
- [x] **Introduction lookup** — `/intro @user` fetches and caches introductions from #intros channel
- [x] **Proposal voting system** — `/propose` creates threaded proposals with Respect-weighted voting (OG + ZOR token-gated)
- [x] **Respect leaderboard** — Web page + `/leaderboard` command with live onchain OG + ZOR Respect balances
- [x] **ENS name registration** — `/register vitalik.eth` resolves and stores the address automatically
- [x] **Voice channel audio ping** — Bot joins voice and plays a ding each voting round
- [x] **Voice channel thread link** — Auto-posts voting thread link in voice channel text chat
- [x] **Fractal naming modal** — Popup asks for fractal number + group number before starting
- [x] **Rich embed results** — Results posted as embed with Respect points + one-click submit link
- [x] **`/guide` command + web slide deck** — Quick explainer in Discord + full guide at `/guide` on web
- [x] **No grey buttons** — Voting buttons cycle blue/green/red only
- [x] **Bot-Hosting.net deployment** — Documented deployment to Pterodactyl-based hosting

## Roadmap / Ideas

### High Impact / Quick Wins
- [ ] **Vote timeout** — Auto-advance or warn if a round goes too long without reaching threshold

### UX Improvements
- [ ] **Auto-split into groups** — For larger meetings (7+ people in voice), automatically split into balanced groups of 3-6
- [ ] **Mid-fractal member handling** — Gracefully handle someone leaving voice/Discord mid-fractal (remove from candidates, adjust threshold)
- [ ] **Facilitator rotation** — Track who's facilitated before and suggest/auto-assign facilitators fairly

### Onchain / Web
- [ ] **Transaction verification** — Listen for onchain tx after submitBreakout and confirm back in Discord
- [ ] **Web dashboard** — Wire up the `web/` folder for live voting status, historical rankings

### Operational
- [ ] **Scheduled fractals** — `/schedule` command for recurring weekly fractals with reminders
- [ ] **Multi-group coordination** — "Fractal master" view showing status of all groups running in parallel during a meeting

## Links

- **THE ZAO Discord**: [discord.gg/thezao](https://discord.gg/thezao)
- **Onchain Dashboard**: [zao.frapps.xyz](https://zao.frapps.xyz)
- **Respect Leaderboard**: [zao-fractal.vercel.app/leaderboard](https://zao-fractal.vercel.app/leaderboard)
- **Optimism Fractal**: [optimismfractal.com](https://optimismfractal.com)
- **Eden Fractal**: [edenfractal.com](https://edenfractal.com)
