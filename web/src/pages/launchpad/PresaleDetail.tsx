import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePolkadot } from '@/contexts/PolkadotContext';
import { useWallet } from '@/contexts/WalletContext';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2,
  ArrowLeft,
  TrendingUp,
  Users,
  Clock,
  Target,
  AlertCircle,
  CheckCircle2,
  Wallet,
  RefreshCcw,
} from 'lucide-react';
import { toast } from 'sonner';

export default function PresaleDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { api, selectedAccount, isApiReady } = usePolkadot();
  const { balances } = useWallet();
  const navigate = useNavigate();

  const [presale, setPresale] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [contributing, setContributing] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [amount, setAmount] = useState('');
  const [myContribution, setMyContribution] = useState('0');
  const [currentBlock, setCurrentBlock] = useState(0);
  const [totalRaised, setTotalRaised] = useState('0');
  const [contributorsCount, setContributorsCount] = useState(0);

  useEffect(() => {
    if (isApiReady && id) {
      loadPresaleData();
      const interval = setInterval(loadPresaleData, 10000);
      return () => clearInterval(interval);
    }
  }, [api, selectedAccount, isApiReady, id]);

  const loadPresaleData = async () => {
    if (!api || !id) return;

    try {
      const header = await api.rpc.chain.getHeader();
      setCurrentBlock(header.number.toNumber());

      const presaleData = await api.query.presale.presales(parseInt(id));

      if (presaleData.isNone) {
        toast.error('Presale not found');
        navigate('/launchpad');
        return;
      }

      const presaleInfo = presaleData.unwrap();
      setPresale(presaleInfo.toHuman());

      const raised = await api.query.presale.totalRaised(parseInt(id));
      setTotalRaised(raised.toString());

      const contributors = await api.query.presale.contributors(parseInt(id));
      setContributorsCount(contributors.length);

      if (selectedAccount) {
        const contribution = await api.query.presale.contributions(
          parseInt(id),
          selectedAccount.address
        );
        setMyContribution(contribution.toString());
      }
    } catch (error) {
      console.error('Error loading presale:', error);
      toast.error('Failed to load presale data');
    } finally {
      setLoading(false);
    }
  };

  const handleContribute = async () => {
    if (!api || !selectedAccount || !amount || !id) return;

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setContributing(true);

    try {
      const amountInSmallestUnit = Math.floor(amountValue * 1_000_000);

      const tx = api.tx.presale.contribute(parseInt(id), amountInSmallestUnit);

      await tx.signAndSend(selectedAccount.address, ({ status, events }) => {
        if (status.isInBlock) {
          toast.success('Contribution submitted!');
        }

        if (status.isFinalized) {
          events.forEach(({ event }) => {
            if (api.events.system.ExtrinsicSuccess.is(event)) {
              toast.success('Contribution successful!');
              setAmount('');
              loadPresaleData();
            } else if (api.events.system.ExtrinsicFailed.is(event)) {
              toast.error('Contribution failed');
            }
          });
          setContributing(false);
        }
      });
    } catch (error: any) {
      console.error('Contribution error:', error);
      toast.error(error.message || 'Failed to contribute');
      setContributing(false);
    }
  };

  const handleRefund = async () => {
    if (!api || !selectedAccount || !id) return;

    setRefunding(true);

    try {
      const tx = api.tx.presale.refund(parseInt(id));

      await tx.signAndSend(selectedAccount.address, ({ status, events }) => {
        if (status.isInBlock) {
          toast.success('Refund submitted!');
        }

        if (status.isFinalized) {
          events.forEach(({ event }) => {
            if (api.events.system.ExtrinsicSuccess.is(event)) {
              toast.success('Refund successful!');
              loadPresaleData();
            } else if (api.events.system.ExtrinsicFailed.is(event)) {
              toast.error('Refund failed');
            }
          });
          setRefunding(false);
        }
      });
    } catch (error: any) {
      console.error('Refund error:', error);
      toast.error(error.message || 'Failed to refund');
      setRefunding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!presale) {
    return null;
  }

  const getTimeRemaining = () => {
    const endBlock = parseInt(presale.startBlock) + parseInt(presale.duration);
    const remaining = endBlock - currentBlock;
    if (remaining <= 0) return 'Ended';

    const days = Math.floor((remaining * 6) / 86400);
    const hours = Math.floor(((remaining * 6) % 86400) / 3600);
    const minutes = Math.floor(((remaining * 6) % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const getProgress = () => {
    const raised = parseFloat(totalRaised) / 1_000_000;
    const cap = parseFloat(presale.limits.hardCap.replace(/,/g, '')) / 1_000_000;
    return (raised / cap) * 100;
  };

  const calculateReward = () => {
    const amountValue = parseFloat(amount);
    if (isNaN(amountValue)) return 0;

    // Dynamic calculation: (user_contribution / total_raised) * tokens_for_sale
    const raised = parseFloat(totalRaised) || 1; // Avoid division by zero
    const tokensForSale = parseFloat(presale.tokensForSale.replace(/,/g, ''));
    return (amountValue / raised) * tokensForSale;
  };

  const getCurrentRate = () => {
    if (!presale || !totalRaised) return 'Dynamic';
    const raised = parseFloat(totalRaised) / 1_000_000;
    if (raised === 0) return 'TBD';
    const tokensForSale = parseFloat(presale.tokensForSale.replace(/,/g, '')) / 1_000_000;
    return `1:${(tokensForSale / raised).toFixed(2)}`;
  };

  const isGracePeriod = () => {
    const graceEnd = parseInt(presale.startBlock) + parseInt(presale.gracePeriodBlocks);
    return currentBlock <= graceEnd;
  };

  const wusdtBalance = balances.find((b) => b.assetId === 2)?.balance || '0';

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => navigate('/launchpad')}
        className="mb-6 gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Launchpad
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <Card className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h1 className="text-3xl font-bold mb-2">Presale #{id}</h1>
                <p className="text-muted-foreground">
                  Current Rate: {getCurrentRate()} (Dynamic)
                </p>
              </div>
              <div className="flex gap-2">
                <Badge
                  variant={
                    presale.status.type === 'Active'
                      ? 'default'
                      : presale.status.type === 'Finalized'
                      ? 'secondary'
                      : 'destructive'
                  }
                >
                  {presale.status.type}
                </Badge>
                <Badge variant="outline">{presale.accessControl.type}</Badge>
              </div>
            </div>

            {/* Progress */}
            <div className="mb-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-semibold">Progress</span>
                <span className="font-semibold">{getProgress().toFixed(2)}%</span>
              </div>
              <Progress value={getProgress()} className="mb-2" />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{(parseFloat(totalRaised) / 1_000_000).toFixed(2)} USDT Raised</span>
                <span>
                  {(parseFloat(presale.limits.hardCap.replace(/,/g, '')) / 1_000_000).toFixed(0)} USDT Hard Cap
                </span>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <Users className="w-6 h-6 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{contributorsCount}</p>
                <p className="text-xs text-muted-foreground">Contributors</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <Clock className="w-6 h-6 mx-auto mb-2 text-orange-500" />
                <p className="text-lg font-bold">{getTimeRemaining()}</p>
                <p className="text-xs text-muted-foreground">Time Left</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <Target className="w-6 h-6 mx-auto mb-2 text-green-500" />
                <p className="text-lg font-bold">
                  {(parseFloat(presale.limits.minContribution.replace(/,/g, '')) / 1_000_000).toFixed(0)} USDT
                </p>
                <p className="text-xs text-muted-foreground">Min</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <Target className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                <p className="text-lg font-bold">
                  {(parseFloat(presale.limits.maxContribution.replace(/,/g, '')) / 1_000_000).toFixed(0)} USDT
                </p>
                <p className="text-xs text-muted-foreground">Max</p>
              </div>
            </div>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="details">
            <TabsList className="w-full">
              <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
              <TabsTrigger value="vesting" className="flex-1">Vesting</TabsTrigger>
              <TabsTrigger value="refund" className="flex-1">Refund Policy</TabsTrigger>
            </TabsList>

            <TabsContent value="details">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Presale Information</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment Asset</span>
                    <span className="font-semibold">Asset #{presale.paymentAsset}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reward Asset</span>
                    <span className="font-semibold">Asset #{presale.rewardAsset}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tokens For Sale</span>
                    <span className="font-semibold">
                      {(parseFloat(presale.tokensForSale.replace(/,/g, '')) / 1_000_000).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current Rate</span>
                    <span className="font-semibold">
                      {getCurrentRate()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="font-semibold">
                      {Math.floor((parseInt(presale.duration) * 6) / 86400)} days
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Owner</span>
                    <span className="font-mono text-xs">{presale.owner.slice(0, 12)}...</span>
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="vesting">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Vesting Schedule</h3>
                {presale.vesting ? (
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Immediate Release</span>
                      <span className="font-semibold">
                        {presale.vesting.immediateReleasePercent}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vesting Duration</span>
                      <span className="font-semibold">
                        {Math.floor((parseInt(presale.vesting.vestingDurationBlocks) * 6) / 86400)} days
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cliff Period</span>
                      <span className="font-semibold">
                        {Math.floor((parseInt(presale.vesting.cliffBlocks) * 6) / 86400)} days
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No vesting schedule - tokens released immediately</p>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="refund">
              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">Refund Policy</h3>
                <div className="space-y-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {isGracePeriod() ? (
                        <span className="text-green-600 font-semibold">
                          Grace Period Active: {presale.graceRefundFeePercent}% fee
                        </span>
                      ) : (
                        <span>
                          Normal Period: {presale.refundFeePercent}% fee
                        </span>
                      )}
                    </AlertDescription>
                  </Alert>
                  <div className="space-y-2 text-sm">
                    <p>
                      Grace Period ({Math.floor((parseInt(presale.gracePeriodBlocks) * 6) / 3600)}h):
                      <span className="font-semibold ml-2">{presale.graceRefundFeePercent}% fee</span>
                    </p>
                    <p>
                      After Grace Period:
                      <span className="font-semibold ml-2">{presale.refundFeePercent}% fee</span>
                    </p>
                    <p className="text-muted-foreground text-xs mt-4">
                      Platform fee split: 50% Treasury, 25% Burn, 25% Stakers
                    </p>
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contribute Card */}
          {presale.status.type === 'Active' && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Contribute</h3>

              {!selectedAccount ? (
                <Alert>
                  <Wallet className="h-4 w-4" />
                  <AlertDescription>
                    Please connect your wallet to contribute
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Amount (wUSDT)</label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      disabled={contributing}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Balance: {(parseFloat(wusdtBalance) / 1_000_000).toFixed(2)} wUSDT
                    </p>
                  </div>

                  {amount && (
                    <Alert>
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertDescription>
                        You will receive: <strong>{calculateReward().toFixed(2)}</strong> tokens
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    className="w-full"
                    onClick={handleContribute}
                    disabled={contributing || !amount}
                  >
                    {contributing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {contributing ? 'Contributing...' : 'Contribute Now'}
                  </Button>

                  <div className="text-xs text-center text-muted-foreground">
                    Platform fee: 2% (split 50-25-25)
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* My Contribution Card */}
          {selectedAccount && parseFloat(myContribution) > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">My Contribution</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contributed</span>
                  <span className="font-bold">
                    {(parseFloat(myContribution) / 1_000_000).toFixed(2)} wUSDT
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Will Receive (Est.)</span>
                  <span className="font-bold">
                    {(() => {
                      const raised = parseFloat(totalRaised) / 1_000_000;
                      const myContr = parseFloat(myContribution) / 1_000_000;
                      const tokensForSale = parseFloat(presale.tokensForSale.replace(/,/g, '')) / 1_000_000;
                      return raised > 0 ? ((myContr / raised) * tokensForSale).toFixed(2) : '0.00';
                    })()}{' '}
                    tokens
                  </span>
                </div>

                {presale.status.type === 'Active' && (
                  <Button
                    variant="outline"
                    className="w-full mt-4 gap-2"
                    onClick={handleRefund}
                    disabled={refunding}
                  >
                    {refunding && <Loader2 className="w-4 h-4 animate-spin" />}
                    <RefreshCcw className="w-4 h-4" />
                    {refunding ? 'Processing...' : 'Request Refund'}
                  </Button>
                )}
              </div>
            </Card>
          )}

          {/* Info Card */}
          <Card className="p-6 bg-muted">
            <h4 className="font-semibold mb-3">Important Information</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Contributions are subject to 2% platform fee</li>
              <li>• Refunds available before presale ends (fees apply)</li>
              <li>• Lower fees during grace period</li>
              <li>• Check vesting schedule before contributing</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
