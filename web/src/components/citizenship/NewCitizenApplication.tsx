import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, AlertTriangle, CheckCircle, User, Users as UsersIcon, MapPin, Briefcase, Mail, Check, X, AlertCircle } from 'lucide-react';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { blake2AsHex } from '@pezkuwi/util-crypto';
import type { CitizenshipData, Region, MaritalStatus, KycStatus } from '@pezkuwi/lib/citizenship-workflow';
import { submitKycApplication, subscribeToKycApproval, getKycStatus, cancelApplication, confirmCitizenship } from '@pezkuwi/lib/citizenship-workflow';
import { encryptData, saveLocalCitizenshipData, uploadToIPFS } from '@pezkuwi/lib/citizenship-workflow';

interface NewCitizenApplicationProps {
  onClose: () => void;
  referrerAddress?: string | null;
}

type FormData = Omit<CitizenshipData, 'walletAddress' | 'timestamp'>;

export const NewCitizenApplication: React.FC<NewCitizenApplicationProps> = ({ onClose, referrerAddress }) => {
  // identityKyc pallet is on People Chain
  const { peopleApi, isPeopleReady, selectedAccount, connectWallet } = usePezkuwi();
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>();

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<KycStatus>('NotStarted');
  const [kycApproved, setKycApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [applicationHash, setApplicationHash] = useState<string>('');

  const maritalStatus = watch('maritalStatus');
  const childrenCount = watch('childrenCount');

  const handleConfirmCitizenship = async () => {
    if (!peopleApi || !isPeopleReady || !selectedAccount) {
      setError('Please connect your wallet and wait for People Chain connection');
      return;
    }

    setConfirming(true);
    setError(null);
    try {
      const result = await confirmCitizenship(peopleApi, selectedAccount);

      if (!result.success) {
        setError(result.error || 'Failed to confirm citizenship');
        setConfirming(false);
        return;
      }

      setKycApproved(true);
      setCurrentStatus('Approved');

      setTimeout(() => {
        onClose();
        window.location.href = '/dashboard';
      }, 2000);
    } catch (err) {
      if (import.meta.env.DEV) console.error('Confirmation error:', err);
      setError((err as Error).message || 'Failed to confirm citizenship');
    } finally {
      setConfirming(false);
    }
  };

  const handleCancelApplication = async () => {
    if (!peopleApi || !isPeopleReady || !selectedAccount) {
      setError('Please connect your wallet and wait for People Chain connection');
      return;
    }

    setCanceling(true);
    setError(null);
    try {
      const result = await cancelApplication(peopleApi, selectedAccount);

      if (!result.success) {
        setError(result.error || 'Failed to cancel application');
        setCanceling(false);
        return;
      }

      if (import.meta.env.DEV) console.log('Application canceled, deposit returned');
      onClose();
      window.location.href = '/';
    } catch (err) {
      if (import.meta.env.DEV) console.error('Cancel error:', err);
      setError((err as Error).message || 'Failed to cancel application');
    } finally {
      setCanceling(false);
    }
  };

  // Check KYC status on mount (identityKyc pallet is on People Chain)
  useEffect(() => {
    const checkKycStatus = async () => {
      if (!peopleApi || !isPeopleReady || !selectedAccount) {
        return;
      }

      try {
        const status = await getKycStatus(peopleApi, selectedAccount.address);
        if (import.meta.env.DEV) console.log('Current KYC Status from People Chain:', status);
        setCurrentStatus(status);

        if (status === 'Approved') {
          setKycApproved(true);
          setTimeout(() => {
            onClose();
            window.location.href = '/dashboard';
          }, 2000);
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('Error checking KYC status:', err);
      }
    };

    checkKycStatus();
  }, [peopleApi, isPeopleReady, selectedAccount, onClose]);

  // Subscribe to citizenship events on People Chain
  useEffect(() => {
    const isPending = currentStatus === 'PendingReferral' || currentStatus === 'ReferrerApproved';
    if (!peopleApi || !isPeopleReady || !selectedAccount || !isPending) {
      return;
    }

    if (import.meta.env.DEV) console.log('Setting up citizenship event listener on People Chain for:', selectedAccount.address);

    const unsubscribe = subscribeToKycApproval(
      peopleApi,
      selectedAccount.address,
      () => {
        // CitizenshipConfirmed
        setKycApproved(true);
        setCurrentStatus('Approved');
        setTimeout(() => {
          onClose();
          window.location.href = '/dashboard';
        }, 2000);
      },
      (error) => {
        if (import.meta.env.DEV) console.error('Citizenship event subscription error:', error);
        setError(`Failed to monitor status: ${error}`);
      },
      () => {
        // ReferralApproved - referrer vouched, now user can confirm
        setCurrentStatus('ReferrerApproved');
      }
    );

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [peopleApi, isPeopleReady, selectedAccount, currentStatus, onClose]);

  const onSubmit = async (data: FormData) => {
    // identityKyc pallet is on People Chain
    if (!peopleApi || !isPeopleReady || !selectedAccount) {
      setError('Please connect your wallet and wait for People Chain connection');
      return;
    }

    if (!agreed) {
      setError('Please agree to the terms');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      // Check KYC status before submitting (from People Chain)
      const status = await getKycStatus(peopleApi, selectedAccount.address);

      if (status === 'Approved') {
        setError('Your citizenship is already approved! Redirecting to dashboard...');
        setKycApproved(true);
        setTimeout(() => {
          onClose();
          window.location.href = '/dashboard';
        }, 2000);
        return;
      }

      if (status === 'PendingReferral' || status === 'ReferrerApproved') {
        setError('You already have a pending citizenship application.');
        setCurrentStatus(status);
        return;
      }

      // Prepare complete citizenship data
      const citizenshipData: CitizenshipData = {
        ...data,
        walletAddress: selectedAccount.address,
        timestamp: Date.now(),
        referralCode: data.referralCode || referrerAddress || undefined
      };

      // Compute identity hash (H256) from citizenship data
      const identityHash = blake2AsHex(
        JSON.stringify({
          fullName: citizenshipData.fullName,
          fatherName: citizenshipData.fatherName,
          grandfatherName: citizenshipData.grandfatherName,
          motherName: citizenshipData.motherName,
          tribe: citizenshipData.tribe,
          region: citizenshipData.region,
          email: citizenshipData.email,
          profession: citizenshipData.profession,
          walletAddress: citizenshipData.walletAddress
        }),
        256
      );

      if (import.meta.env.DEV) console.log('Identity Hash:', identityHash);

      // Encrypt data and upload to IPFS as off-chain backup
      const encryptedData = encryptData(citizenshipData);
      saveLocalCitizenshipData(citizenshipData);
      const ipfsCid = await uploadToIPFS(encryptedData);
      if (import.meta.env.DEV) console.log('IPFS CID (off-chain backup):', ipfsCid);

      // Determine referrer: explicit referrer address > referral code > default (pallet uses DefaultReferrer)
      const effectiveReferrer = referrerAddress || data.referralCode || undefined;

      // Submit to blockchain - single call: applyForCitizenship(identity_hash, referrer)
      if (import.meta.env.DEV) console.log('Submitting citizenship application to People Chain...');
      const result = await submitKycApplication(
        peopleApi,
        selectedAccount,
        identityHash,
        effectiveReferrer
      );

      if (!result.success) {
        setError(result.error || 'Failed to submit citizenship application');
        setSubmitting(false);
        return;
      }

      if (import.meta.env.DEV) console.log('Citizenship application submitted to blockchain');

      if (result.blockHash) {
        setApplicationHash(result.blockHash.slice(0, 16) + '...');
      }

      setSubmitted(true);
      setSubmitting(false);
      setCurrentStatus('PendingReferral');

    } catch (err) {
      if (import.meta.env.DEV) console.error('Submission error:', err);
      setError('Failed to submit citizenship application');
      setSubmitting(false);
    }
  };

  if (!selectedAccount) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Connect Wallet Required</CardTitle>
          <CardDescription>
            You need to connect your wallet to apply for citizenship
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={connectWallet} className="w-full">
            Connect Wallet
          </Button>
        </CardContent>
      </Card>
    );
  }

  // KYC Approved - Success state
  if (kycApproved) {
    return (
      <Card>
        <CardContent className="pt-6 flex flex-col items-center justify-center py-8 space-y-4">
          <CheckCircle className="h-16 w-16 text-green-500 animate-pulse" />
          <h3 className="text-lg font-semibold text-center text-green-500">KYC Approved!</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Congratulations! Your citizenship application has been approved. Redirecting to citizen dashboard...
          </p>
        </CardContent>
      </Card>
    );
  }

  // PendingReferral - waiting for referrer to approve
  if (currentStatus === 'PendingReferral') {
    return (
      <Card>
        <CardContent className="pt-6 flex flex-col items-center justify-center py-8 space-y-6">
          <div className="relative">
            <div className="h-24 w-24 rounded-full border-4 border-yellow-500/20 flex items-center justify-center">
              <Loader2 className="h-10 w-10 text-yellow-500 animate-spin" />
            </div>
          </div>

          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">Waiting for Referrer Approval</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Your application has been submitted. Your referrer needs to vouch for your identity before you can proceed.
            </p>
          </div>

          <div className="w-full max-w-md space-y-3 pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Application Submitted</p>
                <p className="text-xs text-muted-foreground">Transaction hash: {applicationHash || 'Confirmed'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">1 HEZ Deposit Reserved</p>
                <p className="text-xs text-muted-foreground">Deposit will be returned if you cancel</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900">
                <Loader2 className="h-5 w-5 text-yellow-600 dark:text-yellow-400 animate-spin" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Waiting for Referrer</p>
                <p className="text-xs text-muted-foreground">Your referrer must approve your identity</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 w-full max-w-md pt-4">
            <Button
              onClick={handleCancelApplication}
              disabled={canceling}
              variant="destructive"
              className="flex-1"
            >
              {canceling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Canceling...
                </>
              ) : (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Cancel Application
                </>
              )}
            </Button>
          </div>

          {error && (
            <Alert variant="destructive" className="w-full max-w-md">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button variant="outline" onClick={onClose} className="mt-2">
            Close
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ReferrerApproved - referrer vouched, now user can confirm
  if (currentStatus === 'ReferrerApproved') {
    return (
      <Card>
        <CardContent className="pt-6 flex flex-col items-center justify-center py-8 space-y-6">
          <div className="relative">
            <div className="h-24 w-24 rounded-full border-4 border-green-500/20 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-green-500" />
            </div>
          </div>

          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold text-green-600">Referrer Approved!</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Your referrer has vouched for you. Confirm your citizenship to mint your Welati Tiki NFT.
            </p>
          </div>

          <div className="w-full max-w-md space-y-3 pt-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Application Submitted</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Referrer Approved</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Confirm Citizenship</p>
                <p className="text-xs text-muted-foreground">Click below to mint your Welati Tiki NFT</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 w-full max-w-md pt-4">
            <Button
              onClick={handleConfirmCitizenship}
              disabled={confirming}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {confirming ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Confirming...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Confirm Citizenship
                </>
              )}
            </Button>
          </div>

          {error && (
            <Alert variant="destructive" className="w-full max-w-md">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button variant="outline" onClick={onClose} className="mt-2">
            Close
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Initial submission success (before blockchain confirmation)
  if (submitted && currentStatus === 'NotStarted') {
    return (
      <Card>
        <CardContent className="pt-6 flex flex-col items-center justify-center py-8 space-y-4">
          <Loader2 className="h-16 w-16 text-cyan-500 animate-spin" />
          <h3 className="text-lg font-semibold text-center">Processing Application...</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Encrypting your data and submitting to the blockchain. Please wait...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Personal Identity Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Nasnameya Kesane (Personal Identity)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Navê Te (Your Full Name) *</Label>
            <Input {...register('fullName', { required: true })} placeholder="e.g., Berzê Ronahî" />
            {errors.fullName && <p className="text-xs text-red-500">Required</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="fatherName">Navê Bavê Te (Father&apos;s Name) *</Label>
            <Input {...register('fatherName', { required: true })} placeholder="e.g., Şêrko" />
            {errors.fatherName && <p className="text-xs text-red-500">Required</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="grandfatherName">Navê Bavkalê Te (Grandfather&apos;s Name) *</Label>
            <Input {...register('grandfatherName', { required: true })} placeholder="e.g., Welat" />
            {errors.grandfatherName && <p className="text-xs text-red-500">Required</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="motherName">Navê Dayika Te (Mother&apos;s Name) *</Label>
            <Input {...register('motherName', { required: true })} placeholder="e.g., Gula" />
            {errors.motherName && <p className="text-xs text-red-500">Required</p>}
          </div>
        </CardContent>
      </Card>

      {/* Tribal Affiliation */}
      <Card>
        <CardHeader>
          <CardTitle>Eşîra Te (Tribal Affiliation)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="tribe">Eşîra Te (Your Tribe) *</Label>
            <Input {...register('tribe', { required: true })} placeholder="e.g., Barzanî, Soran, Hewramî..." />
            {errors.tribe && <p className="text-xs text-red-500">Required</p>}
          </div>
        </CardContent>
      </Card>

      {/* Family Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="h-5 w-5" />
            Rewşa Malbatê (Family Status)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Zewicî / Nezewicî (Married / Unmarried) *</Label>
            <RadioGroup
              onValueChange={(value) => setValue('maritalStatus', value as MaritalStatus)}
              defaultValue="nezewici"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="zewici" id="married" />
                <Label htmlFor="married">Zewicî (Married)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="nezewici" id="unmarried" />
                <Label htmlFor="unmarried">Nezewicî (Unmarried)</Label>
              </div>
            </RadioGroup>
          </div>

          {maritalStatus === 'zewici' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="childrenCount">Hejmara Zarokan (Number of Children)</Label>
                <Input
                  type="number"
                  {...register('childrenCount', { valueAsNumber: true })}
                  placeholder="0"
                  min="0"
                />
              </div>

              {childrenCount && childrenCount > 0 && (
                <div className="space-y-3">
                  <Label>Navên Zarokan (Children&apos;s Names)</Label>
                  {Array.from({ length: childrenCount }).map((_, i) => (
                    <div key={i} className="grid grid-cols-2 gap-2">
                      <Input
                        {...register(`children.${i}.name` as const)}
                        placeholder={`Zaroka ${i + 1} - Nav`}
                      />
                      <Input
                        type="number"
                        {...register(`children.${i}.birthYear` as const, { valueAsNumber: true })}
                        placeholder="Sala Dayikbûnê"
                        min="1900"
                        max={new Date().getFullYear()}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Geographic Origin */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Herêma Te (Your Region)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="region">Ji Kuderê yî? (Where are you from?) *</Label>
            <Select onValueChange={(value) => setValue('region', value as Region)}>
              <SelectTrigger>
                <SelectValue placeholder="Herêmeke hilbijêre (Select a region)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bakur">Bakur (North - Turkey/Türkiye)</SelectItem>
                <SelectItem value="basur">Başûr (South - Iraq)</SelectItem>
                <SelectItem value="rojava">Rojava (West - Syria)</SelectItem>
                <SelectItem value="rojhelat">Rojhilat (East - Iran)</SelectItem>
                <SelectItem value="kurdistan_a_sor">Kurdistan a Sor (Red Kurdistan - Armenia/Azerbaijan)</SelectItem>
                <SelectItem value="diaspora">Diaspora (Living Abroad)</SelectItem>
              </SelectContent>
            </Select>
            {errors.region && <p className="text-xs text-red-500">Required</p>}
          </div>
        </CardContent>
      </Card>

      {/* Contact & Profession */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Têkilî û Pîşe (Contact & Profession)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              E-mail *
            </Label>
            <Input
              type="email"
              {...register('email', { required: true, pattern: /^\S+@\S+$/i })}
              placeholder="example@email.com"
            />
            {errors.email && <p className="text-xs text-red-500">Valid email required</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="profession">Pîşeya Te (Your Profession) *</Label>
            <Input {...register('profession', { required: true })} placeholder="e.g., Mamosta, Bijîşk, Xebatkar..." />
            {errors.profession && <p className="text-xs text-red-500">Required</p>}
          </div>
        </CardContent>
      </Card>

      {/* Referral */}
      <Card className="bg-purple-500/10 border-purple-500/30">
        <CardHeader>
          <CardTitle>Koda Referral (Referral Code - Optional)</CardTitle>
          <CardDescription>
            If you were invited by another citizen, enter their referral code
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Input {...register('referralCode')} placeholder="Referral code (optional)" className="placeholder:text-gray-500 placeholder:opacity-50" />
          <p className="text-xs text-muted-foreground mt-2">
            If empty, you will be automatically linked to the Founder (Satoshi Qazi Muhammed)
          </p>
        </CardContent>
      </Card>

      {/* Deposit Notice */}
      <Card className="bg-yellow-500/10 border-yellow-500/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-yellow-600">1 HEZ Deposit Required</p>
              <p className="text-muted-foreground mt-1">
                A deposit of 1 HEZ will be reserved when you submit your application. It will be returned if you cancel your application.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Terms Agreement */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-start space-x-2">
            <Checkbox id="terms" checked={agreed} onCheckedChange={(checked) => setAgreed(checked as boolean)} />
            <Label htmlFor="terms" className="text-sm leading-relaxed cursor-pointer">
              Ez pejirandim ku daneyên min bi awayekî ewle (ZK-proof) tên hilanîn û li ser blockchain-ê hash-a wan tê tomarkirin.
              <br />
              <span className="text-xs text-muted-foreground">
                (I agree that my data is securely stored with ZK-proof and only its hash is recorded on the blockchain)
              </span>
            </Label>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={submitting || !agreed} className="w-full" size="lg">
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Şandina Daxwazê...
              </>
            ) : (
              'Şandina Daxwazê (Submit Application)'
            )}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
};
