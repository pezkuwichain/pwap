# E2E Tests (Maestro)

## Setup
```bash
# Install Maestro CLI
curl -Ls "https://get.maestro.mobile.dev" | bash

# Or via npm
npm install -g maestro
```

## Running Tests
```bash
# Single test
maestro test .maestro/01-onboarding.yaml

# All tests
maestro test .maestro/

# With connected device
adb devices  # ensure device is connected
maestro test .maestro/
```

## Test Flows
1. **01-onboarding** — Welcome → Create Wallet → Mnemonic → Dashboard
2. **02-send-flow** — Wallet → Send → Enter address/amount → Verify fee
3. **03-receive-flow** — Wallet → Receive → QR code visible → Copy/Share
4. **04-dapp-browser** — Apps → DApp Browser → Bookmarks visible
5. **05-settings-network** — Wallet → Network selector → Networks listed

## Prerequisites
- App must be installed on device/emulator
- For tests requiring wallet: run 01-onboarding first
