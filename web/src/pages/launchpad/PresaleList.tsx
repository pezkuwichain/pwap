import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, TrendingUp, Users, Clock, Target } from 'lucide-react';

interface PresaleInfo {
  id: number;
  owner: string;
  paymentAsset: number;
  rewardAsset: number;
  tokensForSale: string;
  startBlock: number;
  duration: number;
  status: 'Active' | 'Finalized' | 'Cancelled';
  totalRaised: string;
  contributorsCount: number;
  limits: {
    minContribution: string;
    maxContribution: string;
    hardCap: string;
  };
  accessControl: 'Public' | 'Whitelist';
}

export default function PresaleList() {
  const { t } = useTranslation();
  const { api, isApiReady } = usePezkuwi();
  const navigate = useNavigate();

  const [presales, setPresales] = useState<PresaleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentBlock, setCurrentBlock] = useState(0);

  const loadPresales = async () => {
    if (!api) return;

    try {
      // Get current block
      const header = await api.rpc.chain.getHeader();
      setCurrentBlock(header.number.toNumber());

      // Get next presale ID to know how many presales exist
      const nextId = await api.query.presale.nextPresaleId();
      const count = nextId.toNumber();

      const presaleList: PresaleInfo[] = [];

      // Load all presales
      for (let i = 0; i < count; i++) {
        const presaleData = await api.query.presale.presales(i);

        if (presaleData.isSome) {
          const presale = presaleData.unwrap();
          const totalRaised = await api.query.presale.totalRaised(i);
          const contributors = await api.query.presale.contributors(i);

          presaleList.push({
            id: i,
            owner: presale.owner.toString(),
            paymentAsset: presale.paymentAsset.toNumber(),
            rewardAsset: presale.rewardAsset.toNumber(),
            tokensForSale: presale.tokensForSale.toString(),
            startBlock: presale.startBlock.toNumber(),
            duration: presale.duration.toNumber(),
            status: presale.status.type,
            totalRaised: totalRaised.toString(),
            contributorsCount: contributors.length,
            limits: {
              minContribution: presale.limits.minContribution.toString(),
              maxContribution: presale.limits.maxContribution.toString(),
              hardCap: presale.limits.hardCap.toString(),
            },
            accessControl: presale.accessControl.type,
          });
        }
      }

      setPresales(presaleList.reverse()); // Show newest first
    } catch (error) {
      console.error('Error loading presales:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isApiReady) {
      loadPresales();
      const interval = setInterval(loadPresales, 15000);
      return () => clearInterval(interval);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, isApiReady]);

  const getTimeRemaining = (startBlock: number, duration: number) => {
    const endBlock = startBlock + duration;
    const remaining = endBlock - currentBlock;
    if (remaining <= 0) return 'Ended';

    const days = Math.floor((remaining * 6) / 86400);
    const hours = Math.floor(((remaining * 6) % 86400) / 3600);
    return `${days}d ${hours}h`;
  };

  const getProgress = (raised: string, hardCap: string) => {
    const raisedNum = parseFloat(raised) / 1_000_000;
    const capNum = parseFloat(hardCap) / 1_000_000;
    return (raisedNum / capNum) * 100;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            {t('presale.launchpad.title', 'PezkuwiChain Launchpad')}
          </h1>
          <p className="text-muted-foreground">
            {t('presale.launchpad.subtitle', 'Discover and invest in new token presales')}
          </p>
        </div>
        <Button onClick={() => navigate('/launchpad/create')} className="gap-2">
          <Plus className="w-4 h-4" />
          {t('presale.create.button', 'Create Presale')}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Total Presales</p>
              <p className="text-2xl font-bold">{presales.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Target className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-2xl font-bold">
                {presales.filter(p => p.status === 'Active').length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total Contributors</p>
              <p className="text-2xl font-bold">
                {presales.reduce((sum, p) => sum + p.contributorsCount, 0)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-orange-500" />
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold">
                {presales.filter(p => p.status === 'Finalized').length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Presale Cards */}
      {presales.length === 0 ? (
        <Card className="p-12 text-center">
          <Target className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-semibold mb-2">No Presales Yet</h3>
          <p className="text-muted-foreground mb-4">
            Be the first to create a presale on PezkuwiChain
          </p>
          <Button onClick={() => navigate('/launchpad/create')}>
            Create First Presale
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {presales.map((presale) => (
            <Card
              key={presale.id}
              className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(`/launchpad/${presale.id}`)}
            >
              {/* Status Badge */}
              <div className="flex justify-between items-start mb-4">
                <Badge
                  variant={
                    presale.status === 'Active'
                      ? 'default'
                      : presale.status === 'Finalized'
                      ? 'secondary'
                      : 'destructive'
                  }
                >
                  {presale.status}
                </Badge>
                <Badge variant="outline">{presale.accessControl}</Badge>
              </div>

              {/* Presale Info */}
              <h3 className="text-xl font-bold mb-2">
                Presale #{presale.id}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {parseFloat(presale.totalRaised) > 0
                  ? `Rate: 1:${((parseFloat(presale.tokensForSale) / parseFloat(presale.totalRaised))).toFixed(2)} (Dynamic)`
                  : `${(parseFloat(presale.tokensForSale) / 1_000_000).toLocaleString()} tokens for sale`
                }
              </p>

              {/* Progress */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span>Progress</span>
                  <span className="font-semibold">
                    {getProgress(presale.totalRaised, presale.limits.hardCap).toFixed(1)}%
                  </span>
                </div>
                <Progress
                  value={getProgress(presale.totalRaised, presale.limits.hardCap)}
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>
                    {(parseFloat(presale.totalRaised) / 1_000_000).toFixed(2)} USDT
                  </span>
                  <span>
                    {(parseFloat(presale.limits.hardCap) / 1_000_000).toFixed(0)} USDT
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-muted-foreground">Contributors</p>
                  <p className="text-lg font-semibold">{presale.contributorsCount}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Time Left</p>
                  <p className="text-lg font-semibold">
                    {presale.status === 'Active'
                      ? getTimeRemaining(presale.startBlock, presale.duration)
                      : '-'}
                  </p>
                </div>
              </div>

              {/* CTA */}
              <Button
                className="w-full"
                variant={presale.status === 'Active' ? 'default' : 'secondary'}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/launchpad/${presale.id}`);
                }}
              >
                {presale.status === 'Active' ? 'Contribute Now' : 'View Details'}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
