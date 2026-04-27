import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useDashboard } from '@/contexts/DashboardContext';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { identityToUUID } from '@shared/lib/identity';
import { supabase } from '@/lib/supabase';

interface P2PIdentity {
  /** UUID v5 derived from identityId, used as user_id in DB */
  userId: string | null;
  /** Full citizen number (#42-0-832967) or visa number (V-123456) */
  identityId: string | null;
  /** Wallet address (SS58) */
  walletAddress: string | null;
  /** Whether user is a citizen with on-chain NFT */
  isCitizen: boolean;
  /** Whether user has an off-chain visa */
  isVisa: boolean;
  /** Whether user has any P2P identity (citizen or visa) */
  hasIdentity: boolean;
  /** Loading state during identity resolution */
  loading: boolean;
  /** Apply for a visa (for non-citizens) */
  applyForVisa: () => Promise<string | null>;
}

const P2PIdentityContext = createContext<P2PIdentity | undefined>(undefined);

export function P2PIdentityProvider({ children }: { children: ReactNode }) {
  const { citizenNumber, nftDetails, loading: dashboardLoading } = useDashboard();
  const { selectedAccount } = usePezkuwi();

  const [userId, setUserId] = useState<string | null>(null);
  const [identityId, setIdentityId] = useState<string | null>(null);
  const [visaNumber, setVisaNumber] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const walletAddress = selectedAccount?.address || null;
  const isCitizen = !!(nftDetails.citizenNFT && citizenNumber !== 'N/A');
  const isVisa = !!visaNumber;
  const hasIdentity = isCitizen || isVisa;

  // Resolve identity when wallet/dashboard data changes
  useEffect(() => {
    if (dashboardLoading) return;

    const resolve = async () => {
      setLoading(true);

      try {
        if (isCitizen) {
          // Citizen: use full citizen number as identity
          const fullCitizenNumber = `#${nftDetails.citizenNFT!.collectionId}-${nftDetails.citizenNFT!.itemId}-${citizenNumber}`;
          setIdentityId(fullCitizenNumber);
          const uuid = await identityToUUID(fullCitizenNumber);
          setUserId(uuid);
          setVisaNumber(null);

          // If this wallet is linked to a Telegram account and p2p_user_id not set yet,
          // backfill it so mini app users see the same P2P identity
          if (walletAddress) {
            supabase
              .from('tg_users')
              .select('id, p2p_user_id')
              .eq('wallet_address', walletAddress)
              .maybeSingle()
              .then(({ data: tgUser }) => {
                if (tgUser && !tgUser.p2p_user_id) {
                  supabase.from('tg_users').update({ p2p_user_id: uuid }).eq('id', tgUser.id);
                }
              });
          }
        } else if (walletAddress) {
          // Non-citizen: check for existing visa
          const { data: visa } = await supabase
            .from('p2p_visa')
            .select('visa_number, status')
            .eq('wallet_address', walletAddress)
            .eq('status', 'active')
            .maybeSingle();

          if (visa) {
            setVisaNumber(visa.visa_number);
            setIdentityId(visa.visa_number);
            const uuid = await identityToUUID(visa.visa_number);
            setUserId(uuid);
          } else {
            setVisaNumber(null);
            setIdentityId(null);
            setUserId(null);
          }
        } else {
          setIdentityId(null);
          setUserId(null);
          setVisaNumber(null);
        }
      } catch (error) {
        console.error('P2P identity resolution error:', error);
        setIdentityId(null);
        setUserId(null);
      } finally {
        setLoading(false);
      }
    };

    resolve();
  }, [isCitizen, citizenNumber, nftDetails.citizenNFT, walletAddress, dashboardLoading]);

  const applyForVisa = async (): Promise<string | null> => {
    if (!walletAddress) return null;
    if (isCitizen) return null; // Citizens don't need visas

    try {
      const { data, error } = await supabase.rpc('issue_p2p_visa', {
        p_wallet_address: walletAddress,
      });

      if (error) throw error;

      if (data?.success) {
        const vn = data.visa_number as string;
        setVisaNumber(vn);
        setIdentityId(vn);
        const uuid = await identityToUUID(vn);
        setUserId(uuid);
        return vn;
      }
      return null;
    } catch (error) {
      console.error('Failed to apply for visa:', error);
      return null;
    }
  };

  return (
    <P2PIdentityContext.Provider value={{
      userId,
      identityId,
      walletAddress,
      isCitizen,
      isVisa,
      hasIdentity,
      loading,
      applyForVisa,
    }}>
      {children}
    </P2PIdentityContext.Provider>
  );
}

export function useP2PIdentity() {
  const context = useContext(P2PIdentityContext);
  if (context === undefined) {
    throw new Error('useP2PIdentity must be used within a P2PIdentityProvider');
  }
  return context;
}
