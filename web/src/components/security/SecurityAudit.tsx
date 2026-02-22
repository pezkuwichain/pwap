import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/lib/supabase';
import { Shield, AlertTriangle, CheckCircle, XCircle, Users, Key, Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface SecurityMetrics {
  totalUsers: number;
  activeUsers: number;
  twoFactorEnabled: number;
  suspiciousActivities: number;
  failedLogins: number;
  securityScore: number;
}

interface AuditLog {
  id: string;
  action: string;
  user_id: string;
  ip_address: string;
  created_at: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export function SecurityAudit() {
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState<SecurityMetrics>({
    totalUsers: 0,
    activeUsers: 0,
    twoFactorEnabled: 0,
    suspiciousActivities: 0,
    failedLogins: 0,
    securityScore: 0,
  });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  // const _loading = useState(true);

  useEffect(() => {
    loadSecurityData();
  }, []);

  const loadSecurityData = async () => {
    try {
      // Load user metrics
      const { data: users } = await supabase
        .from('profiles')
        .select('id, created_at');

      const { data: twoFactor } = await supabase
        .from('two_factor_auth')
        .select('user_id')
        .eq('enabled', true);

      const { data: sessions } = await supabase
        .from('user_sessions')
        .select('user_id')
        .eq('is_active', true);

      const { data: logs } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      // Calculate metrics
      const totalUsers = users?.length || 0;
      const activeUsers = sessions?.length || 0;
      const twoFactorEnabled = twoFactor?.length || 0;
      const suspiciousActivities = logs?.filter(l => 
        l.action.includes('failed') || l.action.includes('suspicious')
      ).length || 0;
      const failedLogins = logs?.filter(l => 
        l.action === 'login_failed'
      ).length || 0;

      // Calculate security score
      const score = Math.round(
        ((twoFactorEnabled / Math.max(totalUsers, 1)) * 40) +
        ((activeUsers / Math.max(totalUsers, 1)) * 20) +
        (Math.max(0, 40 - (suspiciousActivities * 2)))
      );

      setMetrics({
        totalUsers,
        activeUsers,
        twoFactorEnabled,
        suspiciousActivities,
        failedLogins,
        securityScore: score,
      });

      setAuditLogs(logs || []);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error loading security data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return { text: t('securityAudit.excellent'), variant: 'default' as const };
    if (score >= 60) return { text: t('securityAudit.good'), variant: 'secondary' as const };
    if (score >= 40) return { text: t('securityAudit.fair'), variant: 'outline' as const };
    return { text: t('securityAudit.poor'), variant: 'destructive' as const };
  };

  const pieData = [
    { name: t('securityAudit.pieEnabled'), value: metrics.twoFactorEnabled, color: '#10b981' },
    { name: t('securityAudit.pieNotEnabled'), value: metrics.totalUsers - metrics.twoFactorEnabled, color: '#ef4444' },
  ];

  const activityData = [
    { name: t('securityAudit.dayMon'), logins: 45, failures: 2 },
    { name: t('securityAudit.dayTue'), logins: 52, failures: 3 },
    { name: t('securityAudit.dayWed'), logins: 48, failures: 1 },
    { name: t('securityAudit.dayThu'), logins: 61, failures: 4 },
    { name: t('securityAudit.dayFri'), logins: 55, failures: 2 },
    { name: t('securityAudit.daySat'), logins: 32, failures: 1 },
    { name: t('securityAudit.daySun'), logins: 28, failures: 0 },
  ];

  const scoreBadge = getScoreBadge(metrics.securityScore);

  return (
    <div className="space-y-6">
      {/* Security Score Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {t('securityAudit.scoreTitle')}
            </span>
            <Badge variant={scoreBadge.variant}>{scoreBadge.text}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-center">
              <div className={`text-6xl font-bold ${getScoreColor(metrics.securityScore)}`}>
                {metrics.securityScore}
              </div>
              <p className="text-sm text-muted-foreground mt-2">{t('securityAudit.outOf')}</p>
            </div>
            <Progress value={metrics.securityScore} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('securityAudit.totalUsers')}</p>
                <p className="text-2xl font-bold">{metrics.totalUsers}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('securityAudit.twoFaEnabled')}</p>
                <p className="text-2xl font-bold">{metrics.twoFactorEnabled}</p>
              </div>
              <Key className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('securityAudit.activeSessions')}</p>
                <p className="text-2xl font-bold">{metrics.activeUsers}</p>
              </div>
              <Activity className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('securityAudit.suspicious')}</p>
                <p className="text-2xl font-bold">{metrics.suspiciousActivities}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('securityAudit.loginActivity')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="logins" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                <Area type="monotone" dataKey="failures" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('securityAudit.twoFaAdoption')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Security Events */}
      <Card>
        <CardHeader>
          <CardTitle>{t('securityAudit.recentEvents')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {auditLogs.slice(0, 10).map((log) => (
              <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  {log.severity === 'critical' && <XCircle className="h-5 w-5 text-red-500" />}
                  {log.severity === 'high' && <AlertTriangle className="h-5 w-5 text-orange-500" />}
                  {log.severity === 'medium' && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
                  {log.severity === 'low' && <CheckCircle className="h-5 w-5 text-green-500" />}
                  <div>
                    <p className="font-medium">{log.action}</p>
                    <p className="text-sm text-muted-foreground">{t('securityAudit.ip')}: {log.ip_address}</p>
                  </div>
                </div>
                <Badge variant={
                  log.severity === 'critical' ? 'destructive' :
                  log.severity === 'high' ? 'destructive' :
                  log.severity === 'medium' ? 'secondary' :
                  'outline'
                }>
                  {log.severity}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}