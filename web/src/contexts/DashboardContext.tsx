import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { supabase } from '@/lib/supabase';
import { getAllTikiNFTDetails, generateCitizenNumber, type TikiNFTDetails } from '@pezkuwi/lib/tiki';
import { getKycStatus } from '@pezkuwi/lib/kyc';

interface DashboardData {
  profile: Record<string, unknown> | null | null;
  nftDetails: { citizenNFT: TikiNFTDetails | null; roleNFTs: TikiNFTDetails[]; totalNFTs: number };
  kycStatus: string;
  citizenNumber: string;
  loading: boolean;
}

const DashboardContext = createContext<DashboardData | undefined>(undefined);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { peopleApi, isPeopleReady, selectedAccount } = usePezkuwi();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [nftDetails, setNftDetails] = useState<{ citizenNFT: TikiNFTDetails | null; roleNFTs: TikiNFTDetails[]; totalNFTs: number }>({
    citizenNFT: null,
    roleNFTs: [],
    totalNFTs: 0
  });
  const [kycStatus, setKycStatus] = useState<string>('NotStarted');
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        if (import.meta.env.DEV) console.warn('Profile fetch error (this is normal if Supabase is not configured):', error.message);
        return;
      }

      setProfile(data);
    } catch (error) {
      if (import.meta.env.DEV) console.warn('Error fetching profile (this is normal if Supabase is not configured):', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchScoresAndTikis = useCallback(async () => {
    // tiki and identityKyc pallets are on People Chain, not Relay Chain
    if (!selectedAccount || !peopleApi || !isPeopleReady) return;

    setLoading(true);
    try {
      const status = await getKycStatus(peopleApi, selectedAccount.address);
      setKycStatus(status);

      const details = await getAllTikiNFTDetails(peopleApi, selectedAccount.address);
      setNftDetails(details);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error fetching tiki/kyc data from People Chain:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedAccount, peopleApi, isPeopleReady]);

  useEffect(() => {
    fetchProfile();
    if (selectedAccount && peopleApi && isPeopleReady) {
      fetchScoresAndTikis();
    }
  }, [user, selectedAccount, peopleApi, isPeopleReady, fetchProfile, fetchScoresAndTikis]);

  const citizenNumber = nftDetails.citizenNFT
    ? generateCitizenNumber(nftDetails.citizenNFT.owner, nftDetails.citizenNFT.collectionId, nftDetails.citizenNFT.itemId)
    : 'N/A';

  return (
    <DashboardContext.Provider value={{ profile, nftDetails, kycStatus, citizenNumber, loading }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
}
