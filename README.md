# Pezkuwi Web App Projects

Unified repository for all Pezkuwi blockchain frontend applications and shared resources.

## 🏗️ Project Structure

```
pezkuwi-web-app-projects/
├── web/                    # Main web application
├── pezkuwi-sdk-ui/        # Polkadot SDK UI (branded clone)
├── mobile/                 # Mobile application
├── shared/                 # Shared code and utilities
└── README.md              # This file
```

## 📁 Directories

### 1. `web/` - Main Web Application

**Status:** ✅ ~90% Complete - Production Ready

The primary web interface for Pezkuwi blockchain at [pezkuwichain.app](https://pezkuwichain.app)

**Tech Stack:**
- React 18 + TypeScript
- Vite build tool
- Polkadot.js API
- Supabase (Auth & Database)
- Tailwind CSS + shadcn/ui
- i18next (Multi-language support)

**Features:**
- ✅ Wallet integration (Polkadot.js extension)
- ✅ Live blockchain data
- ✅ Staking dashboard
- ✅ DEX/Swap interface
- ✅ P2P Fiat Trading with atomic escrow
- ✅ Transaction history
- ✅ Multi-language support (EN, TR, KMR, CKB, AR, FA)
- ✅ Governance dropdown with live blockchain integration

**Get Started:**
```bash
cd web
npm install
npm run dev
```

### 2. `pezkuwi-sdk-ui/` - Polkadot SDK UI Clone

**Status:** 🚧 Planned - Not Yet Implemented

Branded version of Polkadot.js Apps for Pezkuwi blockchain.

**Purpose:**
- Provide comprehensive blockchain explorer
- Offer advanced developer tools
- Enable direct chain interaction
- Serve as official SDK interface

**Planned Implementation:**
1. Clone Polkadot.js Apps repository
2. Apply Pezkuwi branding
3. Configure chain endpoints
4. Deploy to pezkuwichain.app/sdk

**Resources:**
- See `pezkuwi-sdk-ui/README.md` for details

### 3. `mobile/` - Mobile Application

**Status:** 🚧 In Development (~50% Complete)

React Native Expo app for iOS and Android with full blockchain integration.

**Current Progress:**
- ✅ Welcome screen with language selection
- ✅ Multi-language support (6 languages with RTL)
- ✅ Authentication (Sign In/Up)
- ✅ Main dashboard navigation (5-tab bottom nav)
- ✅ Wallet integration with Polkadot.js
- ✅ Live blockchain data (HEZ, PEZ, USDT)
- ✅ Send/receive transactions
- ✅ Be Citizen screen
- ✅ Referral system integration
- ⏳ Full feature parity with web

**Technology:** React Native + Expo + TypeScript

**Get Started:**
```bash
cd mobile
npm install
npm start
```

### 4. `shared/` - Shared Code

**Status:** ✅ Fully Organized

Common code, types, and utilities used across all platforms (web, mobile, SDK UI).

**Structure:**
```
shared/
├── types/          # TypeScript type definitions
│   ├── blockchain.ts  # Blockchain types (WalletAccount, Transaction, etc.)
│   └── tokens.ts      # Token & DEX types (TokenInfo, PoolInfo, etc.)
├── utils/          # Helper functions (formatting, validation)
├── blockchain/     # Blockchain utilities (Polkadot API wrappers, endpoints)
├── constants/      # App constants (tokens, colors, languages)
└── i18n/           # Internationalization (translations for 6 languages)
    └── locales/    # Translation JSON files
```

**Usage:**
```typescript
// Token types and constants
import { TokenInfo, KNOWN_TOKENS } from '../../../shared/types/tokens';
import { KURDISTAN_COLORS, TOKEN_DISPLAY_SYMBOLS } from '../../../shared/constants';

// Blockchain utilities
import { DEFAULT_ENDPOINT, BLOCKCHAIN_ENDPOINTS } from '../../../shared/blockchain/polkadot';

// i18n
import { translations, LANGUAGES, isRTL } from '../../../shared/i18n';

// Formatting utilities
import { formatAddress, formatTokenAmount } from '../../../shared/utils/formatting';
```

## 🎯 Development Roadmap

### Phase 1: Project Organization ✅
- [x] Reorganize repository structure
- [x] Create shared utilities foundation
- [x] Set up placeholder directories
- [x] Centralize common code (i18n, types, constants)

### Phase 2: Web App Completion ✅
- [x] Implement governance dropdown with live data
- [x] Complete blockchain data integration
- [x] Delegation and proposals pages
- [x] Forum with moderation

### Phase 3: P2P Fiat Trading ✅
- [x] P2P marketplace UI (Buy/Sell/My Ads tabs)
- [x] Merchant dashboard with offer management
- [x] Atomic escrow system with race condition protection
- [x] Platform wallet escrow (5DFwqK698v...)
- [x] PostgreSQL FOR UPDATE lock for concurrent trades
- [x] Trade lifecycle (pending → payment_sent → completed)
- [x] Edit/Pause/Resume offer functionality

### Phase 4: Mobile Development 🚧
- [x] Choose technology stack (React Native + Expo)
- [x] Implement wallet integration with Polkadot.js
- [x] Live blockchain integration (HEZ, PEZ, USDT)
- [x] Bottom navigation with 5 tabs
- [ ] Connect Be Citizen to citizenship-crypto
- [ ] Integrate referral with pallet_referral
- [ ] Achieve feature parity with web

### Phase 5: Polkadot SDK UI (Future)
- [ ] Clone and configure Polkadot.js Apps
- [ ] Apply Pezkuwi branding
- [ ] Set up deployment pipeline
- [ ] Integrate with main web app

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Git

### Clone Repository
```bash
git clone https://github.com/pezkuwichain/pezkuwi-web-app-projects.git
cd pezkuwi-web-app-projects
```

### Run Web App
```bash
cd web
npm install
npm run dev
```

### Run Mobile App
```bash
cd mobile
npm install
npm start
```

### Build for Production
```bash
cd web
npm run build
```

## 🌐 Multi-Language Support

All applications support:
- 🇬🇧 English (EN)
- 🇹🇷 Türkçe (TR)
- ☀️ Kurmancî (KMR) - Kurdish Kurmanji
- ☀️ سۆرانی (CKB) - Kurdish Sorani
- 🇸🇦 العربية (AR)
- 🇮🇷 فارسی (FA)

RTL (Right-to-Left) support for CKB, AR, FA.

## 📝 Documentation

- **Web App:** See `web/README.md` and inline documentation
- **SDK UI:** See `pezkuwi-sdk-ui/README.md`
- **Mobile:** See `mobile/README.md`
- **Shared Code:** See `shared/README.md`
- **Architecture:** See `web/mimari.txt` for detailed system architecture

## 🔐 Security

Security is our top priority. See `web/SECURITY.md` for:
- Security policies
- Vulnerability reporting
- Multi-signature wallet setup
- Best practices

## 📄 License

See [LICENSE](./LICENSE) file for details.

## 🤝 Contributing

We welcome contributions! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📞 Support

- **Website:** [pezkuwichain.app](https://pezkuwichain.app)
- **Issues:** GitHub Issues
- **Documentation:** Project README files

---

**Note:** This is a monorepo structure designed for production-level deployment of Pezkuwi blockchain applications across multiple platforms.
