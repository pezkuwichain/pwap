import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
// import { Button } from '@/components/ui/button';
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTreasury } from '@/hooks/useTreasury';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,

  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { LoadingState } from '@pezkuwi/components/AsyncComponent';

interface BudgetCategory {
  id: string;
  name: string;
  allocated: number;
  spent: number;
  remaining: number;
  color: string;
}

export const TreasuryOverview: React.FC = () => {
  const { t } = useTranslation();
  const { metrics, proposals, loading, error } = useTreasury();

  const [categories] = useState<BudgetCategory[]>([
    { id: '1', name: 'Development', allocated: 500000, spent: 320000, remaining: 180000, color: 'bg-blue-500' },
    { id: '2', name: 'Marketing', allocated: 200000, spent: 150000, remaining: 50000, color: 'bg-purple-500' },
    { id: '3', name: 'Operations', allocated: 300000, spent: 180000, remaining: 120000, color: 'bg-green-500' },
    { id: '4', name: 'Community', allocated: 150000, spent: 80000, remaining: 70000, color: 'bg-yellow-500' },
    { id: '5', name: 'Research', allocated: 250000, spent: 100000, remaining: 150000, color: 'bg-pink-500' },
    { id: '6', name: 'Infrastructure', allocated: 400000, spent: 350000, remaining: 50000, color: 'bg-indigo-500' }
  ]);

  const getHealthStatus = (score: number) => {
    if (score >= 80) return { label: 'treasury.healthExcellent', color: 'text-green-500', icon: CheckCircle };
    if (score >= 60) return { label: 'treasury.healthGood', color: 'text-blue-500', icon: Activity };
    if (score >= 40) return { label: 'treasury.healthFair', color: 'text-yellow-500', icon: AlertCircle };
    return { label: 'treasury.healthCritical', color: 'text-red-500', icon: AlertCircle };
  };

  const healthStatus = getHealthStatus(metrics.healthScore);
  const HealthIcon = healthStatus.icon;

  if (loading) {
    return <LoadingState message={t('treasury.loading')} />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {t('treasury.errorLoad', { error })}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Live Data Badge */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
          <Activity className="h-3 w-3 mr-1" />
          {t('treasury.liveData')}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {t('treasury.activeProposals', { count: proposals.length })} • {metrics.pezBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} PEZ • {metrics.hezBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })} HEZ
        </span>
      </div>

      {/* Treasury Health Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{t('treasury.health')}</span>
            <HealthIcon className={`h-6 w-6 ${healthStatus.color}`} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{metrics.healthScore}%</span>
              <Badge className={healthStatus.color}>{t(healthStatus.label)}</Badge>
            </div>
            <Progress value={metrics.healthScore} className="h-3" />
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">{t('treasury.runway')}</p>
                <p className="font-semibold">{t('treasury.runwayMonths', { months: '20.8' })}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('treasury.burnRate')}</p>
                <p className="font-semibold">$120k/month</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('treasury.totalBalance')}</p>
                <p className="text-lg font-bold">{metrics.pezBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} PEZ</p>
                <p className="text-sm font-semibold text-muted-foreground">{metrics.hezBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })} HEZ</p>
                <p className="text-xs text-green-500 flex items-center mt-1">
                  <ArrowUpRight className="h-3 w-3 mr-1" />
                  {t('treasury.thisMonth', { percent: '12.5' })}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('treasury.monthlyIncome')}</p>
                <p className="text-2xl font-bold">${(metrics.monthlyIncome / 1000).toFixed(0)}k</p>
                <p className="text-xs text-green-500 flex items-center mt-1">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  {t('treasury.vsLastMonth', { percent: '+8.3' })}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('treasury.monthlyExpenses')}</p>
                <p className="text-2xl font-bold">${(metrics.monthlyExpenses / 1000).toFixed(0)}k</p>
                <p className="text-xs text-red-500 flex items-center mt-1">
                  <ArrowDownRight className="h-3 w-3 mr-1" />
                  {t('treasury.vsLastMonth', { percent: '-5.2' })}
                </p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('treasury.pendingProposals')}</p>
                <p className="text-2xl font-bold">{metrics.pendingProposals}</p>
                <p className="text-xs text-yellow-500 flex items-center mt-1">
                  <Clock className="h-3 w-3 mr-1" />
                  {t('treasury.requested', { amount: '450' })}
                </p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budget Categories */}
      <Card>
        <CardHeader>
          <CardTitle>{t('treasury.budgetAllocation')}</CardTitle>
          <CardDescription>{t('treasury.quarterUtilization')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {categories.map((category) => {
              const utilization = (category.spent / category.allocated) * 100;
              return (
                <div key={category.id} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{category.name}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-muted-foreground">
                        ${(category.spent / 1000).toFixed(0)}k / ${(category.allocated / 1000).toFixed(0)}k
                      </span>
                      <Badge variant={utilization > 80 ? 'destructive' : 'secondary'}>
                        {utilization.toFixed(0)}%
                      </Badge>
                    </div>
                  </div>
                  <Progress value={utilization} className="h-2" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};