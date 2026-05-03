# Pezkuwi Web App Projects (PWAP)

Monorepo for Pezkuwi blockchain frontend applications.

## Project Structure

```
pwap/
├── web/                    # Main web application
├── mobile/                 # Mobile application (React Native + Expo)
├── backend/                # Backend API services
├── shared/                 # Shared code and utilities
└── package.json            # Root package with build scripts
```

## Related Repositories

| Repository | Description | URL |
|------------|-------------|-----|
| pezkuwi-sdk-ui | Blockchain Explorer & Developer Tools | https://github.com/pezkuwichain/pezkuwi-sdk-ui |
| pezkuwi-extension | Browser Wallet Extension | https://github.com/pezkuwichain/pezkuwi-extension |

## Projects

### 1. `web/` - Main Web Application

**Status:** ✅ Production Ready

The primary web interface for Pezkuwi blockchain at [app.pezkuwichain.io](https://app.pezkuwichain.io)

**Tech Stack:**
- React 18 + TypeScript
- Vite
- @pezkuwi/api
- Supabase (Auth & Database)
- Tailwind CSS + shadcn/ui
- i18next

**Features:**
- Wallet integration (Pezkuwi Extension)
- Live blockchain data
- Staking dashboard
- DEX/Swap interface
- P2P Fiat Trading with atomic escrow
- Transaction history
- Multi-language support (EN, TR, KMR, CKB, AR, FA)
- Governance with live blockchain integration

```bash
cd web
npm install
npm run dev
```

### 2. `mobile/` - Mobile Application

**Status:** 🚧 In Development

React Native Expo app for iOS and Android.

**Features:**
- Welcome screen with language selection
- Multi-language support (6 languages with RTL)
- Authentication (Sign In/Up)
- Main dashboard navigation (5-tab bottom nav)
- Wallet integration with @pezkuwi/api
- Live blockchain data (HEZ, PEZ, USDT)
- Send/receive transactions
- Biometric authentication

```bash
cd mobile
npm install
npm start
```

### 3. `backend/` - Backend Services

API services for the applications.

```bash
cd backend
npm install
npm run dev
```

### 4. `shared/` - Shared Code

Common code, types, and utilities used across all platforms.

```
shared/
├── types/          # TypeScript type definitions
├── utils/          # Helper functions
├── blockchain/     # Blockchain utilities
├── constants/      # App constants
├── images/         # Shared images and logos
└── i18n/           # Internationalization
```

## Quick Start

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
# Clone repository
git clone https://github.com/pezkuwichain/pwap.git
cd pwap

# Install all dependencies
npm install

# Or install individually
npm run install:web
npm run install:mobile
npm run install:backend
```

### Build All Projects

```bash
npm run build
```

This builds:
1. `web` - Vite production build
2. `pezkuwi-sdk-ui` - Full SDK UI build (separate repo)
3. `mobile` - Expo web export

### Development

```bash
# Run web and mobile in parallel
npm run dev

# Or run individually
npm run dev:web
npm run dev:mobile
```

## Multi-Language Support

All applications support:
- 🇬🇧 English (EN)
- 🇹🇷 Türkçe (TR)
- ☀️ Kurmancî (KMR)
- ☀️ سۆرانی (CKB)
- 🇸🇦 العربية (AR)
- 🇮🇷 فارسی (FA)

RTL support for CKB, AR, FA.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Build all projects |
| `npm run dev` | Start development servers |
| `npm run lint` | Run linters |
| `npm run test` | Run tests |
| `npm run install:all` | Install all dependencies |

## Links

- **Website:** https://app.pezkuwichain.io
- **Website (alt):** https://pex.mom
- **Exchange:** https://pex.network
- **Documentation:** https://docs.pezkuwichain.io

## License

Apache-2.0
