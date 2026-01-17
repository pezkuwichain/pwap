import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { KurdistanColors } from '../theme/colors';
import { usePezkuwi } from '../contexts/PezkuwiContext';
import { KurdistanSun } from '../components/KurdistanSun';

// Standardized token logos
const hezLogo = require('../../../shared/images/hez_token_512.png');
const pezLogo = require('../../../shared/images/pez_token_512.png');
const usdtLogo = require('../../../shared/images/USDT(hez)logo.png');

interface TokenInfo {
  symbol: string;
  name: string;
  assetId: number;
  decimals: number;
  logo: any;
}

const TOKENS: TokenInfo[] = [
  { symbol: 'HEZ', name: 'Welati Coin', assetId: 0, decimals: 12, logo: hezLogo },
  { symbol: 'PEZ', name: 'Pezkuwichain Token', assetId: 1, decimals: 12, logo: pezLogo },
  { symbol: 'USDT', name: 'Tether USD', assetId: 1000, decimals: 6, logo: usdtLogo },
];

type TransactionStatus = 'idle' | 'signing' | 'submitting' | 'success' | 'error';

const SwapScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { api, isApiReady, selectedAccount, getKeyPair } = usePezkuwi();

  const [fromToken, setFromToken] = useState<TokenInfo>(TOKENS[0]);
  const [toToken, setToToken] = useState<TokenInfo>(TOKENS[1]);
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [slippage, setSlippage] = useState(0.5); // 0.5% default

  const [fromBalance, setFromBalance] = useState('0');
  const [toBalance, setToBalance] = useState('0');

  // Pool reserves for AMM calculation
  const [poolReserves, setPoolReserves] = useState<{
    reserve0: number;
    reserve1: number;
    asset0: number;
    asset1: number;
  } | null>(null);
  const [exchangeRate, setExchangeRate] = useState(0);
  const [isLoadingRate, setIsLoadingRate] = useState(false);
  const [isDexAvailable, setIsDexAvailable] = useState(false);

  const [txStatus, setTxStatus] = useState<TransactionStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const [showTokenSelector, setShowTokenSelector] = useState<'from' | 'to' | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Fetch balances
  useEffect(() => {
    const fetchBalances = async () => {
      if (!api || !isApiReady || !selectedAccount) return;

      // Fetch From Token Balance
      try {
        if (fromToken.symbol === 'HEZ') {
          const accountInfo = await api.query.system.account(selectedAccount.address) as any;
          setFromBalance(accountInfo.data.free.toString());
        } else {
          const balanceData = await api.query.assets.account(fromToken.assetId, selectedAccount.address) as any;
          setFromBalance(balanceData.isSome ? balanceData.unwrap().balance.toString() : '0');
        }
      } catch (error) {
        console.error('Failed to fetch from balance:', error);
        setFromBalance('0');
      }

      // Fetch To Token Balance
      try {
        if (toToken.symbol === 'HEZ') {
          const accountInfo = await api.query.system.account(selectedAccount.address) as any;
          setToBalance(accountInfo.data.free.toString());
        } else {
          const balanceData = await api.query.assets.account(toToken.assetId, selectedAccount.address) as any;
          setToBalance(balanceData.isSome ? balanceData.unwrap().balance.toString() : '0');
        }
      } catch (error) {
        console.error('Failed to fetch to balance:', error);
        setToBalance('0');
      }
    };

    fetchBalances();
  }, [api, isApiReady, selectedAccount, fromToken, toToken]);

  // Check if AssetConversion pallet is available
  useEffect(() => {
    if (api && isApiReady) {
      const hasAssetConversion = api.tx.assetConversion !== undefined;
      setIsDexAvailable(hasAssetConversion);
      if (__DEV__ && !hasAssetConversion) {
        console.warn('AssetConversion pallet not available in runtime');
      }
    }
  }, [api, isApiReady]);

  // Fetch exchange rate from AssetConversion pool
  useEffect(() => {
    const fetchExchangeRate = async () => {
      if (!api || !isApiReady || !isDexAvailable) {
        return;
      }

      setIsLoadingRate(true);
      try {
        // Map user-selected tokens to actual pool assets
        // HEZ → wHEZ (Asset 0) behind the scenes
        const getPoolAssetId = (token: TokenInfo) => {
          if (token.symbol === 'HEZ') return 0; // wHEZ
          return token.assetId;
        };

        const fromAssetId = getPoolAssetId(fromToken);
        const toAssetId = getPoolAssetId(toToken);

        // Pool ID must be sorted (smaller asset ID first)
        const [asset1, asset2] = fromAssetId < toAssetId
          ? [fromAssetId, toAssetId]
          : [toAssetId, fromAssetId];

        // Create pool asset tuple [asset1, asset2] - must be sorted!
        const poolAssets = [
          { NativeOrAsset: { Asset: asset1 } },
          { NativeOrAsset: { Asset: asset2 } }
        ];

        // Query pool from AssetConversion pallet
        const poolInfo = await api.query.assetConversion.pools(poolAssets);

        if (poolInfo && !poolInfo.isEmpty) {
          try {
            // Derive pool account using AccountIdConverter
            // blake2_256(&Encode::encode(&(PalletId, PoolId))[..])
            const { stringToU8a } = await import('@pezkuwi/util');
            const { blake2AsU8a } = await import('@pezkuwi/util-crypto');

            // PalletId for AssetConversion: "py/ascon" (8 bytes)
            const PALLET_ID = stringToU8a('py/ascon');

            // Create PoolId tuple (u32, u32)
            const poolId = api.createType('(u32, u32)', [asset1, asset2]);

            // Create (PalletId, PoolId) tuple: ([u8; 8], (u32, u32))
            const palletIdType = api.createType('[u8; 8]', PALLET_ID);
            const fullTuple = api.createType('([u8; 8], (u32, u32))', [palletIdType, poolId]);

            // Hash the SCALE-encoded tuple
            const accountHash = blake2AsU8a(fullTuple.toU8a(), 256);
            const poolAccountId = api.createType('AccountId32', accountHash);

            // Query pool account's asset balances
            const reserve0Query = await api.query.assets.account(asset1, poolAccountId);
            const reserve1Query = await api.query.assets.account(asset2, poolAccountId);

            const reserve0Data = reserve0Query.toJSON() as { balance?: string } | null;
            const reserve1Data = reserve1Query.toJSON() as { balance?: string } | null;

            if (reserve0Data?.balance && reserve1Data?.balance) {
              // Parse hex string balances to BigInt, then to number
              const balance0Hex = reserve0Data.balance.toString();
              const balance1Hex = reserve1Data.balance.toString();

              // Use correct decimals for each asset
              const decimals0 = asset1 === 1000 ? 6 : 12;
              const decimals1 = asset2 === 1000 ? 6 : 12;

              const reserve0 = Number(BigInt(balance0Hex)) / (10 ** decimals0);
              const reserve1 = Number(BigInt(balance1Hex)) / (10 ** decimals1);

              if (__DEV__) {
                console.log('Pool reserves found:', { reserve0, reserve1, asset1, asset2 });
              }

              // Store pool reserves for AMM calculation
              setPoolReserves({
                reserve0,
                reserve1,
                asset0: asset1,
                asset1: asset2
              });

              // Calculate simple exchange rate for display
              const rate = fromAssetId === asset1
                ? reserve1 / reserve0  // from asset1 to asset2
                : reserve0 / reserve1; // from asset2 to asset1

              setExchangeRate(rate);
            } else {
              if (__DEV__) console.warn('Pool has no reserves');
              setExchangeRate(0);
              setPoolReserves(null);
            }
          } catch (err) {
            if (__DEV__) console.error('Error deriving pool account:', err);
            setExchangeRate(0);
            setPoolReserves(null);
          }
        } else {
          if (__DEV__) console.warn('No liquidity pool found for this pair');
          setExchangeRate(0);
          setPoolReserves(null);
        }
      } catch (error) {
        if (__DEV__) console.error('Failed to fetch exchange rate:', error);
        setExchangeRate(0);
        setPoolReserves(null);
      } finally {
        setIsLoadingRate(false);
      }
    };

    fetchExchangeRate();
  }, [api, isApiReady, isDexAvailable, fromToken, toToken]);

  // Calculate output amount using Uniswap V2 AMM formula
  useEffect(() => {
    if (!fromAmount || parseFloat(fromAmount) <= 0) {
      setToAmount('');
      return;
    }

    // If no pool reserves available, cannot calculate
    if (!poolReserves) {
      setToAmount('');
      return;
    }

    const amountIn = parseFloat(fromAmount);
    const { reserve0, reserve1, asset0 } = poolReserves;

    // Determine which reserve is input and which is output
    const getPoolAssetId = (token: TokenInfo) => {
      if (token.symbol === 'HEZ') return 0; // wHEZ
      return token.assetId;
    };
    const fromAssetId = getPoolAssetId(fromToken);
    const isAsset0ToAsset1 = fromAssetId === asset0;

    const reserveIn = isAsset0ToAsset1 ? reserve0 : reserve1;
    const reserveOut = isAsset0ToAsset1 ? reserve1 : reserve0;

    // Uniswap V2 AMM formula (matches Substrate runtime exactly)
    // Runtime: amount_in_with_fee = amount_in * (1000 - LPFee) = amount_in * 970
    // LPFee = 30 (3% fee)
    // Formula: amountOut = (amountIn * 970 * reserveOut) / (reserveIn * 1000 + amountIn * 970)
    const LP_FEE = 30; // 3% fee
    const amountInWithFee = amountIn * (1000 - LP_FEE);
    const numerator = amountInWithFee * reserveOut;
    const denominator = reserveIn * 1000 + amountInWithFee;
    const amountOut = numerator / denominator;

    if (__DEV__) {
      console.log('AMM calculation:', {
        amountIn,
        reserveIn,
        reserveOut,
        amountOut,
        lpFee: `${LP_FEE / 10}%`
      });
    }

    setToAmount(amountOut.toFixed(6));
  }, [fromAmount, fromToken, toToken, poolReserves]);

  // Calculate formatted balances
  const fromBalanceFormatted = useMemo(() => {
    return (Number(fromBalance) / Math.pow(10, fromToken.decimals)).toFixed(4);
  }, [fromBalance, fromToken]);

  const toBalanceFormatted = useMemo(() => {
    return (Number(toBalance) / Math.pow(10, toToken.decimals)).toFixed(4);
  }, [toBalance, toToken]);

  const hasInsufficientBalance = useMemo(() => {
    const amountNum = parseFloat(fromAmount || '0');
    const balanceNum = parseFloat(fromBalanceFormatted);
    return amountNum > 0 && amountNum > balanceNum;
  }, [fromAmount, fromBalanceFormatted]);

  const handleSwapDirection = () => {
    const tempToken = fromToken;
    const tempBalance = fromBalance;
    const tempAmount = fromAmount;

    setFromToken(toToken);
    setToToken(tempToken);
    setFromBalance(toBalance);
    setToBalance(tempBalance);
    setFromAmount(toAmount);
    setToAmount(tempAmount);
  };

  const handleMaxClick = () => {
    setFromAmount(fromBalanceFormatted);
  };

  const handleTokenSelect = (token: TokenInfo) => {
    if (showTokenSelector === 'from') {
      if (token.symbol === toToken.symbol) {
        Alert.alert('Error', 'Cannot select the same token for both sides');
        return;
      }
      setFromToken(token);
    } else if (showTokenSelector === 'to') {
      if (token.symbol === fromToken.symbol) {
        Alert.alert('Error', 'Cannot select the same token for both sides');
        return;
      }
      setToToken(token);
    }
    setShowTokenSelector(null);
  };

  const handleConfirmSwap = async () => {
    if (!api || !selectedAccount) {
      Alert.alert('Error', 'Please connect your wallet');
      return;
    }

    if (!exchangeRate || exchangeRate === 0) {
      Alert.alert('Error', 'No liquidity pool available for this pair');
      return;
    }

    setTxStatus('signing');
    setShowConfirm(false);
    setErrorMessage('');

    try {
      const keypair = await getKeyPair(selectedAccount.address);
      if (!keypair) throw new Error('Failed to load keypair');

      const amountIn = BigInt(Math.floor(parseFloat(fromAmount) * Math.pow(10, fromToken.decimals)));
      const minAmountOut = BigInt(
        Math.floor(parseFloat(toAmount) * (1 - slippage / 100) * Math.pow(10, toToken.decimals))
      );

      let tx;

      if (fromToken.symbol === 'HEZ' && toToken.symbol === 'PEZ') {
        // HEZ → PEZ: wrap(HEZ→wHEZ) then swap(wHEZ→PEZ)
        const wrapTx = api.tx.tokenWrapper.wrap(amountIn.toString());
        const swapTx = api.tx.assetConversion.swapExactTokensForTokens(
          [0, 1], // wHEZ → PEZ
          amountIn.toString(),
          minAmountOut.toString(),
          selectedAccount.address,
          true
        );
        tx = api.tx.utility.batchAll([wrapTx, swapTx]);

      } else if (fromToken.symbol === 'PEZ' && toToken.symbol === 'HEZ') {
        // PEZ → HEZ: swap(PEZ→wHEZ) then unwrap(wHEZ→HEZ)
        const swapTx = api.tx.assetConversion.swapExactTokensForTokens(
          [1, 0], // PEZ → wHEZ
          amountIn.toString(),
          minAmountOut.toString(),
          selectedAccount.address,
          true
        );
        const unwrapTx = api.tx.tokenWrapper.unwrap(minAmountOut.toString());
        tx = api.tx.utility.batchAll([swapTx, unwrapTx]);

      } else if (fromToken.symbol === 'HEZ') {
        // HEZ → Any Asset: wrap(HEZ→wHEZ) then swap(wHEZ→Asset)
        const wrapTx = api.tx.tokenWrapper.wrap(amountIn.toString());
        const swapTx = api.tx.assetConversion.swapExactTokensForTokens(
          [0, toToken.assetId],
          amountIn.toString(),
          minAmountOut.toString(),
          selectedAccount.address,
          true
        );
        tx = api.tx.utility.batchAll([wrapTx, swapTx]);

      } else if (toToken.symbol === 'HEZ') {
        // Any Asset → HEZ: swap(Asset→wHEZ) then unwrap(wHEZ→HEZ)
        const swapTx = api.tx.assetConversion.swapExactTokensForTokens(
          [fromToken.assetId, 0],
          amountIn.toString(),
          minAmountOut.toString(),
          selectedAccount.address,
          true
        );
        const unwrapTx = api.tx.tokenWrapper.unwrap(minAmountOut.toString());
        tx = api.tx.utility.batchAll([swapTx, unwrapTx]);

      } else {
        // Direct swap between assets (PEZ ↔ USDT, etc.)
        tx = api.tx.assetConversion.swapExactTokensForTokens(
          [fromToken.assetId, toToken.assetId],
          amountIn.toString(),
          minAmountOut.toString(),
          selectedAccount.address,
          true
        );
      }

      setTxStatus('submitting');

      await tx.signAndSend(keypair, ({ status, dispatchError }) => {
        if (status.isInBlock) {
          if (dispatchError) {
            const errorMsg = dispatchError.toString();
            setErrorMessage(errorMsg);
            setTxStatus('error');
            Alert.alert('Transaction Failed', errorMsg);
          } else {
            setTxStatus('success');
            Alert.alert('Success!', `Swapped ${fromAmount} ${fromToken.symbol} for ~${toAmount} ${toToken.symbol}`);
            setTimeout(() => {
              setFromAmount('');
              setToAmount('');
              setTxStatus('idle');
            }, 2000);
          }
        }
      });
    } catch (error: any) {
      console.error('Swap failed:', error);
      setErrorMessage(error.message || 'Transaction failed');
      setTxStatus('error');
      Alert.alert('Error', error.message || 'Swap transaction failed');
    }
  };

  if (!selectedAccount) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.emptyIcon}>💱</Text>
          <Text style={styles.emptyText}>Connect your wallet to swap tokens</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Kurdistan Sun Loading Overlay */}
      {(txStatus === 'signing' || txStatus === 'submitting') && (
        <View style={styles.loadingOverlay}>
          <KurdistanSun size={250} />
          <Text style={styles.loadingText}>
            {txStatus === 'signing' ? 'Waiting for signature...' : 'Processing your swap...'}
          </Text>
        </View>
      )}

      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
        {/* Settings Button */}
        <View style={styles.header}>
          <View style={{width: 40}} />
          <Text style={styles.headerTitle}>Swap Tokens</Text>
          <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.settingsButton}>
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* From Token Card */}
        <View style={styles.tokenCard}>
          <View style={styles.tokenCardHeader}>
            <Text style={styles.tokenCardLabel}>From</Text>
            <Text style={styles.tokenCardBalance}>
              Balance: {fromBalanceFormatted} {fromToken.symbol}
            </Text>
          </View>

          <View style={styles.tokenInputRow}>
            <TextInput
              style={styles.amountInput}
              placeholder="0.0"
              placeholderTextColor="#999"
              keyboardType="decimal-pad"
              value={fromAmount}
              onChangeText={setFromAmount}
            />
            <TouchableOpacity
              style={styles.tokenSelector}
              onPress={() => setShowTokenSelector('from')}
            >
              <Image source={fromToken.logo} style={styles.tokenLogo} resizeMode="contain" />
              <Text style={styles.tokenSymbol}>{fromToken.symbol}</Text>
              <Text style={styles.tokenSelectorArrow}>▼</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.maxButton} onPress={handleMaxClick}>
            <Text style={styles.maxButtonText}>MAX</Text>
          </TouchableOpacity>
        </View>

        {/* Swap Direction Button */}
        <View style={styles.swapDirectionContainer}>
          <TouchableOpacity style={styles.swapDirectionButton} onPress={handleSwapDirection}>
            <Text style={styles.swapDirectionIcon}>⇅</Text>
          </TouchableOpacity>
        </View>

        {/* To Token Card */}
        <View style={styles.tokenCard}>
          <View style={styles.tokenCardHeader}>
            <Text style={styles.tokenCardLabel}>To</Text>
            <Text style={styles.tokenCardBalance}>
              Balance: {toBalanceFormatted} {toToken.symbol}
            </Text>
          </View>

          <View style={styles.tokenInputRow}>
            <TextInput
              style={styles.amountInput}
              placeholder="0.0"
              placeholderTextColor="#999"
              value={toAmount}
              editable={false}
            />
            <TouchableOpacity
              style={styles.tokenSelector}
              onPress={() => setShowTokenSelector('to')}
            >
              <Image source={toToken.logo} style={styles.tokenLogo} resizeMode="contain" />
              <Text style={styles.tokenSymbol}>{toToken.symbol}</Text>
              <Text style={styles.tokenSelectorArrow}>▼</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Swap Details */}
        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>ℹ️ Exchange Rate</Text>
            <Text style={styles.detailValue}>
              {isLoadingRate
                ? 'Loading...'
                : exchangeRate > 0
                ? `1 ${fromToken.symbol} ≈ ${exchangeRate.toFixed(4)} ${toToken.symbol}`
                : 'No pool available'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Slippage Tolerance</Text>
            <Text style={styles.detailValueHighlight}>{slippage}%</Text>
          </View>
        </View>

        {/* Warnings */}
        {hasInsufficientBalance && (
          <View style={[styles.warningCard, styles.errorCard]}>
            <Text style={styles.warningIcon}>⚠️</Text>
            <Text style={styles.warningText}>Insufficient {fromToken.symbol} balance</Text>
          </View>
        )}

        {/* Swap Button */}
        <TouchableOpacity
          style={[
            styles.swapButton,
            (!fromAmount || hasInsufficientBalance || txStatus !== 'idle' || exchangeRate === 0) && styles.swapButtonDisabled
          ]}
          onPress={() => setShowConfirm(true)}
          disabled={!fromAmount || hasInsufficientBalance || txStatus !== 'idle' || exchangeRate === 0}
        >
          <Text style={styles.swapButtonText}>
            {hasInsufficientBalance
              ? `Insufficient ${fromToken.symbol} Balance`
              : exchangeRate === 0
              ? 'No Pool Available'
              : 'Swap Tokens'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Token Selector Modal */}
      <Modal visible={showTokenSelector !== null} transparent animationType="slide" onRequestClose={() => setShowTokenSelector(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeader}>Select Token</Text>
            {TOKENS.map((token) => (
              <TouchableOpacity
                key={token.symbol}
                style={styles.tokenOption}
                onPress={() => handleTokenSelect(token)}
              >
                <Image source={token.logo} style={styles.tokenOptionLogo} resizeMode="contain" />
                <View style={styles.tokenOptionInfo}>
                  <Text style={styles.tokenOptionSymbol}>{token.symbol}</Text>
                  <Text style={styles.tokenOptionName}>{token.name}</Text>
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowTokenSelector(null)}>
              <Text style={styles.modalCloseButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={showSettings} transparent animationType="slide" onRequestClose={() => setShowSettings(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeader}>Swap Settings</Text>
            <Text style={styles.settingsLabel}>Slippage Tolerance</Text>
            <View style={styles.slippageButtons}>
              {[0.1, 0.5, 1.0, 2.0].map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[styles.slippageButton, slippage === val && styles.slippageButtonActive]}
                  onPress={() => setSlippage(val)}
                >
                  <Text style={[styles.slippageButtonText, slippage === val && styles.slippageButtonTextActive]}>
                    {val}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowSettings(false)}>
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Confirm Modal */}
      <Modal visible={showConfirm} transparent animationType="slide" onRequestClose={() => setShowConfirm(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalHeader}>Confirm Swap</Text>
            <View style={styles.confirmDetails}>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>You Pay</Text>
                <Text style={styles.confirmValue}>{fromAmount} {fromToken.symbol}</Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabel}>You Receive</Text>
                <Text style={styles.confirmValue}>{toAmount} {toToken.symbol}</Text>
              </View>
              <View style={[styles.confirmRow, styles.confirmRowBorder]}>
                <Text style={styles.confirmLabelSmall}>Exchange Rate</Text>
                <Text style={styles.confirmValueSmall}>1 {fromToken.symbol} = {exchangeRate.toFixed(4)} {toToken.symbol}</Text>
              </View>
              <View style={styles.confirmRow}>
                <Text style={styles.confirmLabelSmall}>Slippage</Text>
                <Text style={styles.confirmValueSmall}>{slippage}%</Text>
              </View>
            </View>
            <View style={styles.confirmButtons}>
              <TouchableOpacity style={styles.confirmCancelButton} onPress={() => setShowConfirm(false)}>
                <Text style={styles.confirmCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmSwapButton} onPress={handleConfirmSwap}>
                <Text style={styles.confirmSwapButtonText}>Confirm Swap</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsIcon: {
    fontSize: 20,
  },
  tokenCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)',
    elevation: 2,
  },
  tokenCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tokenCardLabel: {
    fontSize: 14,
    color: '#666',
  },
  tokenCardBalance: {
    fontSize: 12,
    color: '#999',
  },
  tokenInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    padding: 0,
  },
  tokenSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 8,
  },
  tokenLogo: {
    width: 24,
    height: 24,
  },
  tokenSymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  tokenSelectorArrow: {
    fontSize: 10,
    color: '#666',
  },
  maxButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(0, 143, 67, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 143, 67, 0.3)',
  },
  maxButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: KurdistanColors.kesk,
  },
  swapDirectionContainer: {
    alignItems: 'center',
    marginVertical: -12,
    zIndex: 10,
  },
  swapDirectionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E5E5',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  swapDirectionIcon: {
    fontSize: 24,
    color: '#333',
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  detailValueHighlight: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '600',
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  errorCard: {
    backgroundColor: '#FEE2E2',
  },
  warningIcon: {
    fontSize: 20,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#991B1B',
  },
  swapButton: {
    backgroundColor: KurdistanColors.kesk,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginBottom: 20,
  },
  swapButtonDisabled: {
    backgroundColor: '#CCC',
  },
  swapButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingText: {
    marginTop: 24,
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  tokenOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    marginBottom: 8,
    gap: 12,
  },
  tokenOptionLogo: {
    width: 40,
    height: 40,
  },
  tokenOptionInfo: {
    flex: 1,
  },
  tokenOptionSymbol: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  tokenOptionName: {
    fontSize: 12,
    color: '#666',
  },
  modalCloseButton: {
    backgroundColor: '#EEE',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  modalCloseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  settingsLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 12,
  },
  slippageButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  slippageButton: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  slippageButtonActive: {
    backgroundColor: KurdistanColors.kesk,
  },
  slippageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  slippageButtonTextActive: {
    color: '#FFFFFF',
  },
  confirmDetails: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  confirmRowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    marginTop: 8,
    paddingTop: 16,
  },
  confirmLabel: {
    fontSize: 14,
    color: '#666',
  },
  confirmValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  confirmLabelSmall: {
    fontSize: 12,
    color: '#999',
  },
  confirmValueSmall: {
    fontSize: 12,
    color: '#666',
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmCancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#EEE',
    alignItems: 'center',
  },
  confirmCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  confirmSwapButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: KurdistanColors.kesk,
    alignItems: 'center',
  },
  confirmSwapButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default SwapScreen;
