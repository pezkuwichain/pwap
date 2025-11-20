import { useState } from 'react';
import { usePolkadot } from '@/contexts/PolkadotContext';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Loader2, AlertCircle, Rocket } from 'lucide-react';
import { toast } from 'sonner';

export default function CreatePresale() {
  const { api, selectedAccount } = usePolkadot();
  const navigate = useNavigate();

  const [creating, setCreating] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    paymentAsset: '2', // wUSDT
    rewardAsset: '1', // PEZ (or custom)
    tokensForSale: '10000000', // 10M tokens for sale (with 6 decimals = 10M)
    durationDays: '45',
    isWhitelist: false,
    minContribution: '10',
    maxContribution: '10000',
    hardCap: '500000',
    enableVesting: false,
    vestingImmediatePercent: '20',
    vestingDurationDays: '180',
    vestingCliffDays: '30',
    gracePeriodHours: '24',
    refundFeePercent: '10',
    graceRefundFeePercent: '1',
  });

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    const {
      paymentAsset,
      rewardAsset,
      tokensForSale,
      durationDays,
      minContribution,
      maxContribution,
      hardCap,
      refundFeePercent,
      graceRefundFeePercent,
    } = formData;

    if (!paymentAsset || !rewardAsset) {
      toast.error('Please specify both payment and reward assets');
      return false;
    }

    if (parseFloat(tokensForSale) <= 0) {
      toast.error('Tokens for sale must be greater than 0');
      return false;
    }

    if (parseFloat(durationDays) <= 0) {
      toast.error('Duration must be greater than 0');
      return false;
    }

    if (parseFloat(minContribution) <= 0) {
      toast.error('Min contribution must be greater than 0');
      return false;
    }

    if (parseFloat(maxContribution) < parseFloat(minContribution)) {
      toast.error('Max contribution must be >= min contribution');
      return false;
    }

    if (parseFloat(hardCap) < parseFloat(minContribution)) {
      toast.error('Hard cap must be >= min contribution');
      return false;
    }

    if (
      parseFloat(refundFeePercent) > 100 ||
      parseFloat(graceRefundFeePercent) > 100
    ) {
      toast.error('Fee percentages must be <= 100');
      return false;
    }

    return true;
  };

  const handleCreate = async () => {
    if (!api || !selectedAccount) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!validateForm()) return;

    setCreating(true);

    try {
      // Convert values to chain format
      const paymentAssetId = parseInt(formData.paymentAsset);
      const rewardAssetId = parseInt(formData.rewardAsset);
      const tokensForSale = Math.floor(parseFloat(formData.tokensForSale) * 1_000_000); // with decimals
      const durationBlocks = Math.floor(parseFloat(formData.durationDays) * 14400); // 1 day = 14400 blocks (6s)
      const isWhitelist = formData.isWhitelist;
      const minContribution = Math.floor(parseFloat(formData.minContribution) * 1_000_000);
      const maxContribution = Math.floor(parseFloat(formData.maxContribution) * 1_000_000);
      const hardCap = Math.floor(parseFloat(formData.hardCap) * 1_000_000);
      const enableVesting = formData.enableVesting;
      const vestingImmediatePercent = parseInt(formData.vestingImmediatePercent);
      const vestingDurationBlocks = Math.floor(parseFloat(formData.vestingDurationDays) * 14400);
      const vestingCliffBlocks = Math.floor(parseFloat(formData.vestingCliffDays) * 14400);
      const gracePeriodBlocks = Math.floor(parseFloat(formData.gracePeriodHours) * 600); // 1 hour = 600 blocks
      const refundFeePercent = parseInt(formData.refundFeePercent);
      const graceRefundFeePercent = parseInt(formData.graceRefundFeePercent);

      const tx = api.tx.presale.createPresale(
        paymentAssetId,
        rewardAssetId,
        tokensForSale,
        durationBlocks,
        isWhitelist,
        minContribution,
        maxContribution,
        hardCap,
        enableVesting,
        vestingImmediatePercent,
        vestingDurationBlocks,
        vestingCliffBlocks,
        gracePeriodBlocks,
        refundFeePercent,
        graceRefundFeePercent
      );

      await tx.signAndSend(selectedAccount.address, ({ status, events }) => {
        if (status.isInBlock) {
          toast.success('Presale creation submitted!');
        }

        if (status.isFinalized) {
          events.forEach(({ event }) => {
            if (api.events.presale.PresaleCreated.is(event)) {
              const [presaleId] = event.data;
              toast.success(`Presale #${presaleId} created successfully!`);
              setTimeout(() => {
                navigate(`/launchpad/${presaleId}`);
              }, 2000);
            } else if (api.events.system.ExtrinsicFailed.is(event)) {
              toast.error('Presale creation failed');
              setCreating(false);
            }
          });
        }
      });
    } catch (error) {
      console.error('Create presale error:', error);
      toast.error((error as Error).message || 'Failed to create presale');
      setCreating(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/launchpad')} className="mb-4 gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Launchpad
        </Button>
        <h1 className="text-3xl font-bold mb-2">Create New Presale</h1>
        <p className="text-muted-foreground">
          Launch your token presale on PezkuwiChain Launchpad
        </p>
      </div>

      {/* Info Alert */}
      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Platform fee: 2% on all contributions (50% Treasury, 25% Burn, 25% Stakers)
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Settings */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Basic Settings</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="paymentAsset">Payment Asset ID</Label>
                  <Input
                    id="paymentAsset"
                    type="number"
                    value={formData.paymentAsset}
                    onChange={(e) => handleInputChange('paymentAsset', e.target.value)}
                    placeholder="2 (wUSDT)"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Default: 2 (wUSDT)</p>
                </div>
                <div>
                  <Label htmlFor="rewardAsset">Reward Asset ID</Label>
                  <Input
                    id="rewardAsset"
                    type="number"
                    value={formData.rewardAsset}
                    onChange={(e) => handleInputChange('rewardAsset', e.target.value)}
                    placeholder="1 (PEZ)"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Your token asset ID</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tokensForSale">Tokens For Sale</Label>
                  <Input
                    id="tokensForSale"
                    type="number"
                    value={formData.tokensForSale}
                    onChange={(e) => handleInputChange('tokensForSale', e.target.value)}
                    placeholder="10000000"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Total tokens available (with decimals)
                  </p>
                </div>
                <div>
                  <Label htmlFor="durationDays">Duration (Days)</Label>
                  <Input
                    id="durationDays"
                    type="number"
                    value={formData.durationDays}
                    onChange={(e) => handleInputChange('durationDays', e.target.value)}
                    placeholder="45"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Presale duration</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <Label htmlFor="isWhitelist" className="cursor-pointer">
                    Whitelist Only
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Restrict contributions to whitelisted accounts
                  </p>
                </div>
                <Switch
                  id="isWhitelist"
                  checked={formData.isWhitelist}
                  onCheckedChange={(checked) => handleInputChange('isWhitelist', checked)}
                />
              </div>
            </div>
          </Card>

          {/* Contribution Limits */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Contribution Limits</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="minContribution">Min Contribution (USDT)</Label>
                <Input
                  id="minContribution"
                  type="number"
                  value={formData.minContribution}
                  onChange={(e) => handleInputChange('minContribution', e.target.value)}
                  placeholder="10"
                />
              </div>
              <div>
                <Label htmlFor="maxContribution">Max Contribution (USDT)</Label>
                <Input
                  id="maxContribution"
                  type="number"
                  value={formData.maxContribution}
                  onChange={(e) => handleInputChange('maxContribution', e.target.value)}
                  placeholder="10000"
                />
              </div>
              <div>
                <Label htmlFor="hardCap">Hard Cap (USDT)</Label>
                <Input
                  id="hardCap"
                  type="number"
                  value={formData.hardCap}
                  onChange={(e) => handleInputChange('hardCap', e.target.value)}
                  placeholder="500000"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Total amount to raise
                </p>
              </div>
            </div>
          </Card>

          {/* Vesting */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Vesting Schedule</h2>
              <Switch
                checked={formData.enableVesting}
                onCheckedChange={(checked) => handleInputChange('enableVesting', checked)}
              />
            </div>

            {formData.enableVesting && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="vestingImmediatePercent">Immediate Release (%)</Label>
                  <Input
                    id="vestingImmediatePercent"
                    type="number"
                    value={formData.vestingImmediatePercent}
                    onChange={(e) =>
                      handleInputChange('vestingImmediatePercent', e.target.value)
                    }
                    placeholder="20"
                    max="100"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Released immediately after presale
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="vestingDurationDays">Vesting Duration (Days)</Label>
                    <Input
                      id="vestingDurationDays"
                      type="number"
                      value={formData.vestingDurationDays}
                      onChange={(e) =>
                        handleInputChange('vestingDurationDays', e.target.value)
                      }
                      placeholder="180"
                    />
                  </div>
                  <div>
                    <Label htmlFor="vestingCliffDays">Cliff Period (Days)</Label>
                    <Input
                      id="vestingCliffDays"
                      type="number"
                      value={formData.vestingCliffDays}
                      onChange={(e) =>
                        handleInputChange('vestingCliffDays', e.target.value)
                      }
                      placeholder="30"
                    />
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Refund Policy */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Refund Policy</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="gracePeriodHours">Grace Period (Hours)</Label>
                <Input
                  id="gracePeriodHours"
                  type="number"
                  value={formData.gracePeriodHours}
                  onChange={(e) => handleInputChange('gracePeriodHours', e.target.value)}
                  placeholder="24"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Lower fee period for refunds
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="graceRefundFeePercent">Grace Period Fee (%)</Label>
                  <Input
                    id="graceRefundFeePercent"
                    type="number"
                    value={formData.graceRefundFeePercent}
                    onChange={(e) =>
                      handleInputChange('graceRefundFeePercent', e.target.value)
                    }
                    placeholder="1"
                    max="100"
                  />
                </div>
                <div>
                  <Label htmlFor="refundFeePercent">Normal Fee (%)</Label>
                  <Input
                    id="refundFeePercent"
                    type="number"
                    value={formData.refundFeePercent}
                    onChange={(e) => handleInputChange('refundFeePercent', e.target.value)}
                    placeholder="10"
                    max="100"
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Summary Sidebar */}
        <div className="space-y-6">
          <Card className="p-6 sticky top-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Rocket className="w-5 h-5" />
              Presale Summary
            </h3>
            <Separator className="mb-4" />
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tokens For Sale</span>
                <span className="font-semibold">{parseFloat(formData.tokensForSale).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimated Rate</span>
                <span className="font-semibold text-xs">
                  {formData.hardCap && formData.tokensForSale
                    ? `1:${(parseFloat(formData.tokensForSale) / parseFloat(formData.hardCap)).toFixed(2)}`
                    : 'Dynamic'
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-semibold">{formData.durationDays} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hard Cap</span>
                <span className="font-semibold">{formData.hardCap} USDT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Min/Max</span>
                <span className="font-semibold">
                  {formData.minContribution}/{formData.maxContribution}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Access</span>
                <Badge variant={formData.isWhitelist ? 'secondary' : 'default'}>
                  {formData.isWhitelist ? 'Whitelist' : 'Public'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vesting</span>
                <Badge variant={formData.enableVesting ? 'default' : 'outline'}>
                  {formData.enableVesting ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              <Separator />
              <div className="text-xs text-muted-foreground">
                <p className="mb-2">Platform Fee: 2%</p>
                <ul className="space-y-1">
                  <li>• 50% → Treasury</li>
                  <li>• 25% → Burn</li>
                  <li>• 25% → Stakers</li>
                </ul>
              </div>
            </div>

            <Button
              className="w-full mt-6"
              onClick={handleCreate}
              disabled={creating || !selectedAccount}
            >
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {creating ? 'Creating...' : 'Create Presale'}
            </Button>

            {!selectedAccount && (
              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Connect wallet to create presale</AlertDescription>
              </Alert>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'secondary' | 'outline' }) {
  const variants = {
    default: 'bg-primary text-primary-foreground',
    secondary: 'bg-secondary text-secondary-foreground',
    outline: 'border border-input bg-background',
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${variants[variant]}`}>
      {children}
    </span>
  );
}
