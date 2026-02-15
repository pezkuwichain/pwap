import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { Loader2, CheckCircle, Clock, User, AlertTriangle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { approveReferral, getPendingApprovalsForReferrer } from '@pezkuwi/lib/citizenship-workflow';
import type { PendingApproval } from '@pezkuwi/lib/citizenship-workflow';

export function KycApprovalTab() {
  // identityKyc pallet is on People Chain - use peopleApi
  const { peopleApi, isPeopleReady, selectedAccount, connectWallet } = usePezkuwi();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [pendingApps, setPendingApps] = useState<PendingApproval[]>([]);
  const [processingAddress, setProcessingAddress] = useState<string | null>(null);

  // Load pending applications where current user is the referrer
  useEffect(() => {
    if (!peopleApi || !isPeopleReady || !selectedAccount) {
      setLoading(false);
      return;
    }

    loadPendingApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peopleApi, isPeopleReady, selectedAccount]);

  const loadPendingApplications = async () => {
    if (!peopleApi || !isPeopleReady || !selectedAccount) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const apps = await getPendingApprovalsForReferrer(peopleApi, selectedAccount.address);
      setPendingApps(apps);

      if (import.meta.env.DEV) console.log(`Loaded ${apps.length} pending referral approvals`);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error loading pending applications:', error);
      toast({
        title: 'Error',
        description: 'Failed to load pending applications',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApproveReferral = async (applicantAddress: string) => {
    if (!peopleApi || !selectedAccount) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      });
      return;
    }

    setProcessingAddress(applicantAddress);
    try {
      const result = await approveReferral(peopleApi, selectedAccount, applicantAddress);

      if (!result.success) {
        toast({
          title: 'Approval Failed',
          description: result.error || 'Failed to approve referral',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Referral Approved',
        description: `Successfully vouched for ${applicantAddress.slice(0, 8)}...${applicantAddress.slice(-4)}`,
      });

      // Reload after approval
      setTimeout(() => loadPendingApplications(), 2000);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error approving referral:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to approve referral',
        variant: 'destructive',
      });
    } finally {
      setProcessingAddress(null);
    }
  };

  if (!isPeopleReady) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
            <span className="ml-3 text-gray-400">Connecting to People Chain...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!selectedAccount) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Please connect your wallet to view referral approvals.
              <Button onClick={connectWallet} variant="outline" className="ml-4">
                Connect Wallet
              </Button>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Pending Referral Approvals</CardTitle>
        <Button onClick={loadPendingApplications} variant="outline" size="sm" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
          </div>
        ) : pendingApps.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-gray-400">No pending approvals</p>
            <p className="text-sm text-gray-600 mt-2">No one is waiting for your referral approval</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              These users listed you as their referrer. Approve to vouch for their identity.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Identity Hash</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingApps.map((app) => (
                  <TableRow key={app.applicantAddress}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="font-mono text-xs">
                          {app.applicantAddress.slice(0, 8)}...{app.applicantAddress.slice(-6)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-gray-500">
                        {app.identityHash ? `${app.identityHash.slice(0, 12)}...` : 'N/A'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                        <Clock className="w-3 h-3 mr-1" />
                        Pending Referral
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => handleApproveReferral(app.applicantAddress)}
                        disabled={processingAddress === app.applicantAddress}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {processingAddress === app.applicantAddress ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <CheckCircle className="w-4 h-4 mr-2" />
                        )}
                        Approve
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
