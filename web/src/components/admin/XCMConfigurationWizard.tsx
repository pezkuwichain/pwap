/**
 * XCM Configuration Wizard - Multi-Step Parachain Setup
 *
 * Guides admin through complete XCM integration:
 * 1. Reserve ParaId
 * 2. Generate Chain Artifacts (genesis + WASM)
 * 3. Register Parachain
 * 4. Open HRMP Channels
 * 5. Register Foreign Assets
 * 6. Test XCM Transfer
 */

import React, { useState, useEffect } from 'react';
import { usePolkadot } from '@/contexts/PolkadotContext';
import { useWallet } from '@/contexts/WalletContext';
import {
  X,
  CheckCircle,
  Circle,
  Loader2,
  AlertCircle,
  Download,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  reserveParaId,
  generateChainArtifacts,
  registerParachain,
  openHRMPChannels,
  registerForeignAssets,
  testXCMTransfer,
  getRelayChainEndpoint,
  getAssetHubParaId,
  type RelayChain,
  type ChainArtifacts,
  type HRMPChannel,
  type RegisteredAsset,
  type ForeignAsset,
} from '@pezkuwi/lib/xcm-wizard';
import { ApiPromise, WsProvider } from '@polkadot/api';

interface XCMConfigurationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface StepStatus {
  completed: boolean;
  data?: unknown;
  error?: string;
}

export const XCMConfigurationWizard: React.FC<XCMConfigurationWizardProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { api, isApiReady } = usePolkadot();
  const { account, signer } = useWallet();
  const { toast } = useToast();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [steps, setSteps] = useState<Record<number, StepStatus>>({
    1: { completed: false },
    2: { completed: false },
    3: { completed: false },
    4: { completed: false },
    5: { completed: false },
    6: { completed: false },
  });

  // Step 1: Reserve ParaId
  const [relayChain, setRelayChain] = useState<RelayChain>('westend');
  const [reservedParaId, setReservedParaId] = useState<number | null>(null);
  const [reserving, setReserving] = useState(false);

  // Step 2: Generate Artifacts
  const [artifacts, setArtifacts] = useState<ChainArtifacts | null>(null);
  const [generating, setGenerating] = useState(false);

  // Step 3: Register Parachain
  const [genesisFile, setGenesisFile] = useState<File | null>(null);
  const [wasmFile, setWasmFile] = useState<File | null>(null);
  const [registering, setRegistering] = useState(false);
  const [registrationTxHash, setRegistrationTxHash] = useState<string>('');

  // Step 4: HRMP Channels
  const [openingChannels, setOpeningChannels] = useState(false);
  const [openedChannels, setOpenedChannels] = useState<HRMPChannel[]>([]);

  // Step 5: Foreign Assets
  const [registeringAssets, setRegisteringAssets] = useState(false);
  const [registeredAssets, setRegisteredAssets] = useState<RegisteredAsset[]>([]);

  // Step 6: XCM Test
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; balance: string } | null>(null);

  const totalSteps = 6;
  const progress = (Object.values(steps).filter(s => s.completed).length / totalSteps) * 100;

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(1);
      setSteps({
        1: { completed: false },
        2: { completed: false },
        3: { completed: false },
        4: { completed: false },
        5: { completed: false },
        6: { completed: false },
      });
      setReservedParaId(null);
      setArtifacts(null);
      setOpenedChannels([]);
      setRegisteredAssets([]);
      setTestResult(null);
    }
  }, [isOpen]);

  // ========================================
  // STEP 1: RESERVE PARAID
  // ========================================
  const handleReserveParaId = async () => {
    if (!account || !signer) {
      toast({
        title: 'Wallet not connected',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      });
      return;
    }

    setReserving(true);
    try {
      // Connect to relay chain
      const endpoint = getRelayChainEndpoint(relayChain);
      const provider = new WsProvider(endpoint);
      const relayApi = await ApiPromise.create({ provider });

      // Reserve ParaId
      const paraId = await reserveParaId(relayApi, relayChain, account);
      setReservedParaId(paraId);

      // Mark step as completed
      setSteps(prev => ({
        ...prev,
        1: { completed: true, data: { paraId, relayChain } },
      }));

      toast({
        title: 'ParaId Reserved!',
        description: `Successfully reserved ParaId ${paraId} on ${relayChain}`,
      });

      // Auto-advance to next step
      setCurrentStep(2);

      await relayApi.disconnect();
    } catch (error) {
      console.error('Failed to reserve ParaId:', error);
      setSteps(prev => ({
        ...prev,
        1: { completed: false, error: error instanceof Error ? error.message : 'Unknown error' },
      }));
      toast({
        title: 'Reservation Failed',
        description: error instanceof Error ? error.message : 'Failed to reserve ParaId',
        variant: 'destructive',
      });
    } finally {
      setReserving(false);
    }
  };

  // ========================================
  // STEP 2: GENERATE CHAIN ARTIFACTS
  // ========================================
  const handleGenerateArtifacts = async () => {
    if (!reservedParaId) return;

    setGenerating(true);
    try {
      const chainName = `pezkuwichain-${relayChain}`;
      const artifactData = await generateChainArtifacts(chainName);
      setArtifacts(artifactData);

      setSteps(prev => ({
        ...prev,
        2: { completed: true, data: artifactData },
      }));

      toast({
        title: 'Artifacts Generated!',
        description: 'Genesis state and runtime WASM are ready for download',
      });

      setCurrentStep(3);
    } catch (error) {
      console.error('Failed to generate artifacts:', error);
      setSteps(prev => ({
        ...prev,
        2: { completed: false, error: error instanceof Error ? error.message : 'Unknown error' },
      }));
      toast({
        title: 'Generation Failed',
        description: 'Failed to generate chain artifacts',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  // ========================================
  // STEP 3: REGISTER PARACHAIN
  // ========================================
  const handleRegisterParachain = async () => {
    if (!reservedParaId || !genesisFile || !wasmFile || !account || !signer) {
      toast({
        title: 'Missing Data',
        description: 'Please upload both genesis and WASM files',
        variant: 'destructive',
      });
      return;
    }

    setRegistering(true);
    try {
      const endpoint = getRelayChainEndpoint(relayChain);
      const provider = new WsProvider(endpoint);
      const relayApi = await ApiPromise.create({ provider });

      const txHash = await registerParachain(relayApi, reservedParaId, genesisFile, wasmFile, account);
      setRegistrationTxHash(txHash);

      setSteps(prev => ({
        ...prev,
        3: { completed: true, data: { txHash, paraId: reservedParaId } },
      }));

      toast({
        title: 'Parachain Registered!',
        description: `ParaId ${reservedParaId} registered on ${relayChain}`,
      });

      setCurrentStep(4);

      await relayApi.disconnect();
    } catch (error) {
      console.error('Failed to register parachain:', error);
      setSteps(prev => ({
        ...prev,
        3: { completed: false, error: error instanceof Error ? error.message : 'Unknown error' },
      }));
      toast({
        title: 'Registration Failed',
        description: error instanceof Error ? error.message : 'Failed to register parachain',
        variant: 'destructive',
      });
    } finally {
      setRegistering(false);
    }
  };

  // ========================================
  // STEP 4: OPEN HRMP CHANNELS
  // ========================================
  const handleOpenHRMPChannels = async () => {
    if (!reservedParaId || !account || !signer) return;

    setOpeningChannels(true);
    try {
      const endpoint = getRelayChainEndpoint(relayChain);
      const provider = new WsProvider(endpoint);
      const relayApi = await ApiPromise.create({ provider });

      // Get Asset Hub ParaId
      const assetHubParaId = getAssetHubParaId(relayChain);

      // Open channels with Asset Hub
      const channels = await openHRMPChannels(relayApi, reservedParaId, [assetHubParaId], account);
      setOpenedChannels(channels);

      setSteps(prev => ({
        ...prev,
        4: { completed: true, data: { channels } },
      }));

      toast({
        title: 'HRMP Channels Opened!',
        description: `Opened ${channels.length} channel(s) with Asset Hub`,
      });

      setCurrentStep(5);

      await relayApi.disconnect();
    } catch (error) {
      console.error('Failed to open HRMP channels:', error);
      setSteps(prev => ({
        ...prev,
        4: { completed: false, error: error instanceof Error ? error.message : 'Unknown error' },
      }));
      toast({
        title: 'Channel Opening Failed',
        description: error instanceof Error ? error.message : 'Failed to open HRMP channels',
        variant: 'destructive',
      });
    } finally {
      setOpeningChannels(false);
    }
  };

  // ========================================
  // STEP 5: REGISTER FOREIGN ASSETS
  // ========================================
  const handleRegisterAssets = async () => {
    if (!api || !isApiReady || !account || !signer) return;

    setRegisteringAssets(true);
    try {
      // Define foreign assets to register (USDT, DOT, etc.)
      const foreignAssets: ForeignAsset[] = [
        {
          symbol: 'USDT',
          location: {
            parents: 1,
            interior: {
              X3: [{ Parachain: 1000 }, { PalletInstance: 50 }, { GeneralIndex: 1984 }],
            },
          },
          metadata: {
            name: 'Tether USD',
            symbol: 'USDT',
            decimals: 6,
            minBalance: '1000',
          },
        },
        {
          symbol: 'DOT',
          location: {
            parents: 1,
            interior: { Here: null },
          },
          metadata: {
            name: 'Polkadot',
            symbol: 'DOT',
            decimals: 10,
            minBalance: '10000000000',
          },
        },
      ];

      const registered = await registerForeignAssets(api, foreignAssets, account);
      setRegisteredAssets(registered);

      setSteps(prev => ({
        ...prev,
        5: { completed: true, data: { assets: registered } },
      }));

      toast({
        title: 'Assets Registered!',
        description: `Registered ${registered.length} foreign asset(s)`,
      });

      setCurrentStep(6);
    } catch (error) {
      console.error('Failed to register assets:', error);
      setSteps(prev => ({
        ...prev,
        5: { completed: false, error: error instanceof Error ? error.message : 'Unknown error' },
      }));
      toast({
        title: 'Asset Registration Failed',
        description: error instanceof Error ? error.message : 'Failed to register foreign assets',
        variant: 'destructive',
      });
    } finally {
      setRegisteringAssets(false);
    }
  };

  // ========================================
  // STEP 6: TEST XCM TRANSFER
  // ========================================
  const handleTestXCMTransfer = async () => {
    if (!api || !isApiReady || !account || !signer) return;

    setTesting(true);
    try {
      const result = await testXCMTransfer(api, '1000000', account); // 1 USDT (6 decimals)

      setTestResult(result);

      setSteps(prev => ({
        ...prev,
        6: { completed: result.success, data: result },
      }));

      if (result.success) {
        toast({
          title: 'XCM Test Successful!',
          description: `Received ${result.balance} wUSDT`,
        });
      } else {
        toast({
          title: 'XCM Test Failed',
          description: result.error || 'Test transfer failed',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to test XCM transfer:', error);
      setSteps(prev => ({
        ...prev,
        6: { completed: false, error: error instanceof Error ? error.message : 'Unknown error' },
      }));
      toast({
        title: 'Test Failed',
        description: error instanceof Error ? error.message : 'XCM test failed',
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  // ========================================
  // RENDER STEP CONTENT
  // ========================================
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Relay Chain</Label>
              <Select value={relayChain} onValueChange={(value: RelayChain) => setRelayChain(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="westend">Westend (Testnet)</SelectItem>
                  <SelectItem value="rococo">Rococo (Testnet)</SelectItem>
                  <SelectItem value="polkadot">Polkadot (Mainnet)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {reservedParaId && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  ParaId <strong>{reservedParaId}</strong> reserved on {relayChain}
                </AlertDescription>
              </Alert>
            )}

            {steps[1].error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{steps[1].error}</AlertDescription>
              </Alert>
            )}

            <Button onClick={handleReserveParaId} disabled={reserving || steps[1].completed} className="w-full">
              {reserving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reserving ParaId...
                </>
              ) : steps[1].completed ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  ParaId Reserved
                </>
              ) : (
                'Reserve ParaId'
              )}
            </Button>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            {artifacts && (
              <div className="space-y-2">
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Artifacts generated. Download files for registration.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={artifacts.genesisPath} download>
                      <Download className="mr-2 h-4 w-4" />
                      Genesis ({artifacts.genesisSize} bytes)
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href={artifacts.wasmPath} download>
                      <Download className="mr-2 h-4 w-4" />
                      WASM ({artifacts.wasmSize} bytes)
                    </a>
                  </Button>
                </div>
              </div>
            )}

            {steps[2].error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{steps[2].error}</AlertDescription>
              </Alert>
            )}

            <Button onClick={handleGenerateArtifacts} disabled={generating || steps[2].completed} className="w-full">
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Artifacts...
                </>
              ) : steps[2].completed ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Artifacts Generated
                </>
              ) : (
                'Generate Chain Artifacts'
              )}
            </Button>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Upload Genesis State</Label>
              <Input
                type="file"
                accept=".hex,.txt"
                onChange={(e) => setGenesisFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="space-y-2">
              <Label>Upload Runtime WASM</Label>
              <Input
                type="file"
                accept=".wasm"
                onChange={(e) => setWasmFile(e.target.files?.[0] || null)}
              />
            </div>

            {registrationTxHash && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Registered! TX: <code className="text-xs">{registrationTxHash.slice(0, 20)}...</code>
                </AlertDescription>
              </Alert>
            )}

            {steps[3].error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{steps[3].error}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleRegisterParachain}
              disabled={!genesisFile || !wasmFile || registering || steps[3].completed}
              className="w-full"
            >
              {registering ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registering Parachain...
                </>
              ) : steps[3].completed ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Parachain Registered
                </>
              ) : (
                'Register Parachain'
              )}
            </Button>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Opening HRMP channels with Asset Hub (ParaId {getAssetHubParaId(relayChain)})
            </p>

            {openedChannels.length > 0 && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Opened {openedChannels.length} channel(s):
                  <ul className="mt-2 space-y-1 text-xs">
                    {openedChannels.map((ch, idx) => (
                      <li key={idx}>
                        {ch.sender} → {ch.receiver} (ID: {ch.channelId.slice(0, 10)}...)
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {steps[4].error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{steps[4].error}</AlertDescription>
              </Alert>
            )}

            <Button onClick={handleOpenHRMPChannels} disabled={openingChannels || steps[4].completed} className="w-full">
              {openingChannels ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Opening HRMP Channels...
                </>
              ) : steps[4].completed ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Channels Opened
                </>
              ) : (
                'Open HRMP Channels'
              )}
            </Button>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Register foreign assets: USDT, DOT, and other cross-chain tokens
            </p>

            {registeredAssets.length > 0 && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Registered {registeredAssets.length} asset(s):
                  <ul className="mt-2 space-y-1 text-xs">
                    {registeredAssets.map((asset, idx) => (
                      <li key={idx}>
                        {asset.symbol} (Asset ID: {asset.assetId})
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {steps[5].error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{steps[5].error}</AlertDescription>
              </Alert>
            )}

            <Button onClick={handleRegisterAssets} disabled={registeringAssets || steps[5].completed} className="w-full">
              {registeringAssets ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registering Assets...
                </>
              ) : steps[5].completed ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Assets Registered
                </>
              ) : (
                'Register Foreign Assets'
              )}
            </Button>
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Test XCM transfer from Asset Hub to verify bridge functionality
            </p>

            {testResult && (
              <Alert variant={testResult.success ? 'default' : 'destructive'}>
                {testResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                <AlertDescription>
                  {testResult.success
                    ? `Test successful! Balance: ${testResult.balance} wUSDT`
                    : `Test failed: ${testResult.error}`}
                </AlertDescription>
              </Alert>
            )}

            {steps[6].error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{steps[6].error}</AlertDescription>
              </Alert>
            )}

            <Button onClick={handleTestXCMTransfer} disabled={testing || steps[6].completed} className="w-full">
              {testing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing XCM Transfer...
                </>
              ) : steps[6].completed ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  XCM Test Passed
                </>
              ) : (
                'Test XCM Transfer'
              )}
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  // Check if all steps are completed
  const allStepsCompleted = Object.values(steps).every(s => s.completed);

  // Handle Finish Configuration
  const handleFinishConfiguration = () => {
    toast({
      title: 'XCM Configuration Complete!',
      description: 'Your parachain is fully configured and ready for cross-chain transfers',
    });

    if (onSuccess) {
      onSuccess();
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>XCM Configuration Wizard</CardTitle>
              <CardDescription>
                Complete parachain setup and cross-chain integration
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-4">
            <Progress value={progress} className="h-2" />
            <p className="mt-2 text-xs text-muted-foreground text-center">
              {Object.values(steps).filter(s => s.completed).length} / {totalSteps} steps completed
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Step Navigation */}
          <div className="grid grid-cols-6 gap-2">
            {[1, 2, 3, 4, 5, 6].map((step) => (
              <button
                key={step}
                onClick={() => setCurrentStep(step)}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                  currentStep === step
                    ? 'bg-kurdish-green text-white'
                    : steps[step].completed
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {steps[step].completed ? (
                  <CheckCircle className="h-5 w-5" />
                ) : currentStep === step ? (
                  <Circle className="h-5 w-5 fill-current" />
                ) : (
                  <Circle className="h-5 w-5" />
                )}
                <span className="text-xs font-medium">{step}</span>
              </button>
            ))}
          </div>

          {/* Current Step Content */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline">Step {currentStep}</Badge>
              <h3 className="font-semibold">
                {currentStep === 1 && 'Reserve ParaId'}
                {currentStep === 2 && 'Generate Chain Artifacts'}
                {currentStep === 3 && 'Register Parachain'}
                {currentStep === 4 && 'Open HRMP Channels'}
                {currentStep === 5 && 'Register Foreign Assets'}
                {currentStep === 6 && 'Test XCM Transfer'}
              </h3>
            </div>

            {renderStepContent()}
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              disabled={currentStep === 1}
            >
              Previous
            </Button>

            {allStepsCompleted ? (
              <Button onClick={handleFinishConfiguration} className="bg-kurdish-green hover:bg-kurdish-green-dark">
                <CheckCircle className="mr-2 h-4 w-4" />
                Finish Configuration
              </Button>
            ) : (
              <Button
                onClick={() => setCurrentStep(Math.min(totalSteps, currentStep + 1))}
                disabled={currentStep === totalSteps || !steps[currentStep].completed}
              >
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
