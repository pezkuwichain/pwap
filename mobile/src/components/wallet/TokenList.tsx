import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native';
import { KurdistanColors } from '../../theme/colors';
import { TokenInfo } from '../../services/TokenService';

interface TokenListProps {
  tokens: TokenInfo[];
  hiddenTokens: string[];
  isLoading: boolean;
  onTokenPress: (token: TokenInfo) => void;
  onToggleVisibility: (symbol: string) => void;
  onSearchPress?: () => void;
  onAddPress?: () => void;
  onSettingsPress?: () => void;
}

export const TokenList: React.FC<TokenListProps> = ({
  tokens,
  hiddenTokens,
  isLoading,
  onTokenPress,
  onSearchPress,
  onAddPress,
  onSettingsPress,
}) => {
  const visibleTokens = tokens.filter(t => !hiddenTokens.includes(t.symbol));

  return (
    <View style={styles.tokensSection}>
      <View style={styles.tokensSectionHeader}>
        <Text style={styles.tokensTitle}>Tokens</Text>
        <View style={styles.tokenHeaderIcons}>
          <TouchableOpacity style={styles.tokenHeaderIcon} onPress={onSearchPress}>
            <Text>🔍</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tokenHeaderIcon} onPress={onAddPress}>
            <Text>➕</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.tokenHeaderIcon} onPress={onSettingsPress}>
            <Text>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Loading indicator */}
      {isLoading && tokens.length === 0 && (
        <View style={styles.loadingTokens}>
          <ActivityIndicator size="small" color={KurdistanColors.kesk} />
          <Text style={styles.loadingTokensText}>Loading tokens...</Text>
        </View>
      )}

      {/* Dynamic Token List */}
      {visibleTokens.map((token) => {
        const changeColor = token.change24h >= 0 ? '#22C55E' : '#EF4444';
        const changePrefix = token.change24h >= 0 ? '+' : '';

        return (
          <TouchableOpacity
            key={token.assetId ?? token.symbol}
            style={styles.tokenListItem}
            onPress={() => onTokenPress(token)}
          >
            {/* Token Logo */}
            {token.logo ? (
              <Image source={token.logo} style={styles.tokenListLogo} resizeMode="contain" />
            ) : (
              <View style={[styles.tokenListLogo, styles.tokenPlaceholderLogo]}>
                <Text style={styles.tokenPlaceholderText}>{token.symbol.slice(0, 2)}</Text>
              </View>
            )}

            {/* Token Info */}
            <View style={styles.tokenListInfo}>
              <Text style={styles.tokenListSymbol}>{token.symbol}</Text>
              <Text style={styles.tokenListNetwork}>{token.name}</Text>
            </View>

            {/* Balance & Price */}
            <View style={styles.tokenListBalance}>
              <Text style={styles.tokenListAmount}>{token.balance}</Text>
              <View style={styles.tokenPriceRow}>
                <Text style={styles.tokenListUsdValue}>{token.usdValue}</Text>
                {token.change24h !== 0 && (
                  <Text style={[styles.tokenChange, { color: changeColor }]}>
                    {changePrefix}{token.change24h.toFixed(1)}%
                  </Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
        );
      })}

      {/* Empty State */}
      {!isLoading && tokens.length === 0 && (
        <View style={styles.emptyTokens}>
          <Text style={styles.emptyTokensIcon}>🪙</Text>
          <Text style={styles.emptyTokensText}>No additional tokens found</Text>
          <TouchableOpacity
            style={styles.addTokenButton}
            onPress={onAddPress}
          >
            <Text style={styles.addTokenButtonText}>+ Add Token</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  tokensSection: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  tokensSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  tokensTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  tokenHeaderIcons: {
    flexDirection: 'row',
    gap: 12,
  },
  tokenHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tokenListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    boxShadow: '0px 1px 4px rgba(0, 0, 0, 0.05)',
    elevation: 2,
  },
  tokenListLogo: {
    width: 44,
    height: 44,
    marginRight: 12,
  },
  tokenListInfo: {
    flex: 1,
  },
  tokenListSymbol: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  tokenListNetwork: {
    fontSize: 12,
    color: '#888',
  },
  tokenListBalance: {
    alignItems: 'flex-end',
  },
  tokenListAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  tokenListUsdValue: {
    fontSize: 12,
    color: '#888',
  },
  tokenPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tokenChange: {
    fontSize: 11,
    fontWeight: '600',
  },
  tokenPlaceholderLogo: {
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
  },
  tokenPlaceholderText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6B7280',
  },
  loadingTokens: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 10,
  },
  loadingTokensText: {
    fontSize: 14,
    color: '#666',
  },
  emptyTokens: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyTokensIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTokensText: {
    fontSize: 14,
    color: '#999',
    marginBottom: 16,
  },
  addTokenButton: {
    backgroundColor: KurdistanColors.kesk,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  addTokenButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default TokenList;
