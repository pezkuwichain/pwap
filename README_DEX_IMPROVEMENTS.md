# DEX System Improvements - User Guide

## Overview

This document provides a comprehensive guide to the newly implemented DEX improvements for PezkuwiChain beta testnet.

---

## 🆕 What's New

### 1. Pool Monitoring Dashboard ✨
- Real-time pool metrics
- LP position tracking
- Impermanent loss calculator
- APR estimations

### 2. Arbitrage Bot 🤖
- Automated price monitoring
- Smart arbitrage execution
- Pool balance maintenance

### 3. Enhanced Swap Interface 📈
- Price impact visualization
- Slippage tolerance controls
- Minimum received calculations

---

## 📊 Pool Dashboard

### Access
Navigate to: **http://localhost:5173/pool** (after login)

### Features

#### Canlı Metrikler (Live Metrics)
```
┌─────────────────────────────────────────┐
│ Total Liquidity    │ Current Price      │
│ $200,000          │ 1 HEZ = 5.0000 PEZ │
├─────────────────────────────────────────┤
│ Estimated APR     │ Constant (k)       │
│ 109.50%           │ 50.0B              │
└─────────────────────────────────────────┘
```

#### Pool Reserves Tab
- View wHEZ reserve
- View PEZ reserve
- See AMM formula: x × y = k

#### Your Position Tab (LP'ler için)
- LP token balance
- Pool share percentage
- Token values
- Estimated earnings (daily/monthly/yearly)

#### Impermanent Loss Calculator
Calculate potential IL at different price changes:
- +10%: -0.05% loss
- +25%: -0.62% loss
- +50%: -2.02% loss
- +100%: -5.72% loss
- +200%: -13.40% loss

---

## 🔄 Token Swap Improvements

### Price Impact Display

Swap interface now shows:
- **Green** (<1%): Excellent swap
- **Yellow** (1-5%): Good swap
- **Red** (>5%): High impact warning

### Slippage Tolerance

Default: **0.5%**

Customize: 0.1% | 0.5% | 1% | Custom

**Recommendation:**
- Normal: 0.5-1%
- Volatile markets: 2-5%
- Large swaps: 5-10%

### Minimum Received

System automatically calculates minimum tokens you'll receive after slippage:

```
Input: 1000 HEZ
Expected: 4850.62 PEZ
Min Received (0.5% slip): 4826.37 PEZ
```

---

## 🤖 Arbitrage Bot Usage

### Purpose
Maintains pool price balance by executing arbitrage trades when price deviates from reference.

### Installation

```bash
cd /home/mamostehp/Pezkuwi-SDK

# Ensure substrate-interface is installed
pip3 install substrate-interface --break-system-packages
```

### Configuration

Edit `/home/mamostehp/Pezkuwi-SDK/scripts/arbitrage_bot.py`:

```python
CONFIG = {
    'ws_url': 'ws://127.0.0.1:9944',      # Testnet endpoint
    'reference_price': 5.0,                # Target: 1 HEZ = 5 PEZ
    'min_profit_percent': 2.0,             # Min 2% deviation to trade
    'max_swap_amount_hez': 5000,           # Max 5K HEZ per trade
    'check_interval': 30,                  # Check every 30 seconds
    'slippage_tolerance': 0.05,            # 5% slippage
}
```

### Running the Bot

**Foreground (for testing):**
```bash
python3 ./scripts/arbitrage_bot.py
```

**Background (production):**
```bash
nohup python3 ./scripts/arbitrage_bot.py > /tmp/arb-bot.log 2>&1 &

# Monitor logs
tail -f /tmp/arb-bot.log
```

### Bot Output Example

```
======================================================================
   🤖 Arbitrage Bot Started
======================================================================

⚙️  Configuration:
   Reference Price: 1 HEZ = 5.0 PEZ
   Min Profit: 2.0%
   Max Swap: 5000 HEZ
   Check Interval: 30s

──────────────────────────────────────────────────────────────────────
🔍 Check #1 - 2025-11-02 20:30:15
──────────────────────────────────────────────────────────────────────
📊 Pool Price: 1 HEZ = 5.1234 PEZ
📊 Reference: 1 HEZ = 5.0000 PEZ
📊 Deviation: +2.47%

💰 HEZ overpriced by 2.47% → Sell HEZ for PEZ

💡 Arbitrage opportunity detected!
   Expected profit: 2.47%

🔄 Executing arbitrage: HEZ_TO_PEZ
   Amount: 5000.00 tokens
   Step 1: Wrapping HEZ to wHEZ...
   Step 2: Swapping wHEZ to PEZ...
✅ Swap successful! Block: 0x1234...

✨ Arbitrage executed successfully!
   Total trades: 1

💤 Sleeping for 30 seconds...
```

### Bot Commands

**Check if running:**
```bash
ps aux | grep arbitrage_bot
```

**Stop bot:**
```bash
pkill -f arbitrage_bot.py
```

**View recent activity:**
```bash
tail -50 /tmp/arb-bot.log
```

---

## 📈 Liquidity Mining (Future)

### Timeline
6 weeks implementation (as per LIQUIDITY_MINING_PLAN.md)

### Expected Features
- Stake LP tokens to earn HEZ rewards
- 10 HEZ/block emission (~5M HEZ/year)
- Target APR: 50-150%
- Auto-compound options
- Governance participation

### How to Prepare
1. Add liquidity to wHEZ/PEZ pool
2. Hold LP tokens in wallet
3. Wait for liquidity mining launch announcement

---

## 🔐 Security Best Practices

### For Users
1. **Always check price impact** before large swaps
2. **Set appropriate slippage** (don't use 50% unless necessary)
3. **Verify transaction details** in confirmation dialog
4. **Start with small amounts** when testing

### For LP Providers
1. **Understand impermanent loss** before adding liquidity
2. **Monitor pool metrics** via dashboard
3. **Calculate expected APR** vs IL risk
4. **Diversify positions** across pools (when available)

### For Bot Operators
1. **Use dedicated wallet** for bot (not main funds)
2. **Monitor bot logs** regularly
3. **Set reasonable limits** (max_swap_amount)
4. **Test on testnet** before mainnet

---

## 🎯 Recommended Safe Swap Limits

Based on current pool liquidity (100K wHEZ + 500K PEZ):

| Swap Amount | Price Impact | Risk Level | Recommendation |
|-------------|--------------|------------|----------------|
| 0 - 1,000 HEZ | <1% | ✅ Low | Safe for all users |
| 1,000 - 5,000 HEZ | 1-5% | ⚠️ Medium | Experienced users |
| 5,000 - 11,500 HEZ | 5-10% | ⚠️ High | Split into smaller swaps |
| 11,500+ HEZ | >10% | ❌ Very High | Not recommended |

**Pro Tip:** For swaps >10K HEZ, split into multiple 5K swaps over time.

---

## 📱 Quick Reference

### URLs

| Feature | URL | Requires Login |
|---------|-----|----------------|
| Home | http://localhost:5173 | No |
| Swap | http://localhost:5173/wallet (Swap tab) | Yes |
| Pool Dashboard | http://localhost:5173/pool | Yes |
| Wallet | http://localhost:5173/wallet | Yes |

### Default Network Settings

```
Network: PezkuwiChain Beta Testnet
Endpoint: ws://127.0.0.1:9944
Chain ID: pezkuwichain-beta
Block Time: ~6 seconds
```

### Token Info

| Token | Type | Asset ID | Symbol |
|-------|------|----------|--------|
| HEZ | Native | - | HEZ |
| wHEZ | Wrapped | 0 | wHEZ |
| PEZ | Utility | 1 | PEZ |

### Pool Info

| Pool | Assets | Liquidity | LP Fee |
|------|--------|-----------|--------|
| wHEZ/PEZ | 0 & 1 | 100K wHEZ + 500K PEZ | 3% |

---

## 🛠️ Troubleshooting

### Issue: Pool dashboard shows "No pool data"

**Solution:**
1. Check beta testnet is running:
   ```bash
   ps aux | grep pezkuwi
   ```
2. Check pool was initialized:
   ```bash
   python3 /tmp/init_beta_pools.py
   ```
3. Ensure wallet is connected

### Issue: Swap fails with "1010 invalid transaction"

**Solution:**
- This should be fixed now! Swap paths updated to simple arrays.
- If still happens, check slippage tolerance (increase to 1-2%)
- Verify account has sufficient balance + gas

### Issue: Arbitrage bot not trading

**Possible Causes:**
1. Price deviation <2% (working as expected)
2. Bot account has insufficient funds
3. Pool liquidity exhausted
4. Network connection issues

**Check:**
```bash
tail -f /tmp/arb-bot.log  # See bot activity
```

### Issue: High impermanent loss

**Understand:**
- IL is inherent to AMMs
- It's "impermanent" - can recover if price returns
- LP fees offset IL over time
- Calculator shows worst-case scenarios

**Mitigation:**
- Add liquidity when volatility is low
- Hold position long-term for fee accumulation
- Monitor APR vs IL regularly

---

## 💡 Tips & Tricks

### For Traders
1. **Use limit orders** (when implemented) for better prices
2. **Split large swaps** to reduce price impact
3. **Trade during high liquidity** periods
4. **Monitor arbitrage bot** - trade after it corrects price

### For LPs
1. **Add liquidity in balanced ratios** (current pool ratio)
2. **Compound rewards** (when liquidity mining live)
3. **Track impermanent loss** via dashboard
4. **Calculate APR including fees**

### For Developers
1. **Review pool analysis** in `/tmp/pool-analysis.md`
2. **Check liquidity mining plan** in SDK docs
3. **Use pool monitoring** for integration testing
4. **Monitor bot behavior** before mainnet

---

## 📞 Support & Resources

### Documentation
- **Main README**: `/home/mamostehp/DKSweb/README.md`
- **Pool Analysis**: `/tmp/pool-analysis.md`
- **LM Plan**: `/home/mamostehp/Pezkuwi-SDK/docs/LIQUIDITY_MINING_PLAN.md`

### Scripts
- **Pool Init**: `/tmp/init_beta_pools.py`
- **Arb Bot**: `/home/mamostehp/Pezkuwi-SDK/scripts/arbitrage_bot.py`
- **Pool Check**: `/tmp/check-pool.mjs`

### Components
- **PoolDashboard**: `/home/mamostehp/DKSweb/src/components/PoolDashboard.tsx`
- **TokenSwap**: `/home/mamostehp/DKSweb/src/components/TokenSwap.tsx`

### Getting Help
1. Check this document first
2. Review error messages in console
3. Check bot logs: `tail -f /tmp/arb-bot.log`
4. Review transaction in Polkadot.js Apps

---

## 🚀 What's Next?

### Short Term (Done ✅)
- [x] Pool monitoring dashboard
- [x] Arbitrage bot
- [x] Frontend improvements
- [x] Documentation

### Medium Term (1-2 months)
- [ ] Liquidity mining implementation
- [ ] Multiple pool support
- [ ] Advanced charting
- [ ] Transaction history

### Long Term (3-6 months)
- [ ] Governance integration
- [ ] Cross-chain swaps
- [ ] Limit orders
- [ ] Mobile app

---

## ⚖️ Disclaimer

**Beta Testnet Warning:**
- This is a **test environment**
- Tokens have **NO real value**
- Use for **testing purposes only**
- Expect **occasional resets**
- **Do not** use on mainnet without thorough testing

**Financial Advice:**
- This is **NOT financial advice**
- **DYOR** before any transactions
- **Understand risks** of AMM trading
- **Impermanent loss** is real
- **Never invest** more than you can afford to lose

---

## 📄 License

MIT License - See project root for details

---

**Last Updated:** 2025-11-02
**Version:** 1.0.0-beta
**Network:** PezkuwiChain Beta Testnet
