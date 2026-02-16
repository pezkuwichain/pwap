import React, { useState, useEffect } from 'react';
import { useReferral } from '@/contexts/ReferralContext';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { InviteUserModal } from './InviteUserModal';
import { Users, UserPlus, Trophy, Award, Loader2, CheckCircle, Clock, User } from 'lucide-react';
import { getPendingApprovalsForReferrer, approveReferral } from '@pezkuwi/lib/citizenship-workflow';
import type { PendingApproval } from '@pezkuwi/lib/citizenship-workflow';

export const ReferralDashboard: React.FC = () => {
  const { stats, myReferrals, loading } = useReferral();
  const { peopleApi, isPeopleReady, selectedAccount } = usePezkuwi();
  const { toast } = useToast();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [loadingApprovals, setLoadingApprovals] = useState(false);
  const [processingAddress, setProcessingAddress] = useState<string | null>(null);

  // Load pending approvals for this referrer
  useEffect(() => {
    if (!peopleApi || !isPeopleReady || !selectedAccount) return;

    const loadApprovals = async () => {
      setLoadingApprovals(true);
      try {
        const approvals = await getPendingApprovalsForReferrer(peopleApi, selectedAccount.address);
        setPendingApprovals(approvals);
      } catch (err) {
        if (import.meta.env.DEV) console.error('Error loading pending approvals:', err);
      } finally {
        setLoadingApprovals(false);
      }
    };

    loadApprovals();
  }, [peopleApi, isPeopleReady, selectedAccount]);

  const handleApprove = async (applicantAddress: string) => {
    if (!peopleApi || !selectedAccount) return;

    setProcessingAddress(applicantAddress);
    try {
      const result = await approveReferral(peopleApi, selectedAccount, applicantAddress);
      if (result.success) {
        toast({
          title: 'Referral Approved',
          description: `Vouched for ${applicantAddress.slice(0, 8)}...${applicantAddress.slice(-4)}`,
        });
        setPendingApprovals(prev => prev.filter(a => a.applicantAddress !== applicantAddress));
      } else {
        toast({
          title: 'Approval Failed',
          description: result.error || 'Failed to approve',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to approve referral',
        variant: 'destructive',
      });
    } finally {
      setProcessingAddress(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-green-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-green-500" />
            Referral System
          </h2>
          <p className="text-gray-400 mt-1">
            Invite friends to PezkuwiChain and earn trust score
          </p>
        </div>
        <Button
          onClick={() => setShowInviteModal(true)}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Invite Friend
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Referral Count */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-green-500" />
              Total Referrals
            </CardTitle>
            <CardDescription className="text-gray-400">
              Confirmed referrals (KYC completed)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-green-500">
              {stats?.referralCount ?? 0}
            </div>
          </CardContent>
        </Card>

        {/* Referral Score */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Referral Score
            </CardTitle>
            <CardDescription className="text-gray-400">
              Score earned from referrals
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-yellow-500">
              {stats?.referralScore ?? 0}
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Max: 500 points
            </div>
          </CardContent>
        </Card>

        {/* Pending Approvals Count */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-500" />
              Pending Approvals
            </CardTitle>
            <CardDescription className="text-gray-400">
              Waiting for your approval
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-yellow-500">
              {loadingApprovals ? '...' : pendingApprovals.length}
            </div>
            {stats?.whoInvitedMe && (
              <div className="mt-2 text-xs text-gray-500">
                You were invited by {stats.whoInvitedMe.slice(0, 8)}...{stats.whoInvitedMe.slice(-6)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Score Breakdown */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Score Calculation</CardTitle>
          <CardDescription className="text-gray-400">
            How referrals contribute to your trust score
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
              <span className="text-gray-300">1-10 referrals</span>
              <span className="text-green-400 font-semibold">10 points each</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
              <span className="text-gray-300">11-50 referrals</span>
              <span className="text-blue-400 font-semibold">100 + 5 points each</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
              <span className="text-gray-300">51-100 referrals</span>
              <span className="text-yellow-400 font-semibold">300 + 4 points each</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
              <span className="text-gray-300">101+ referrals</span>
              <span className="text-red-400 font-semibold">500 points (max)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* My Invitations - Combined pending + confirmed */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-green-500" />
            My Invitations ({pendingApprovals.length + myReferrals.length})
          </CardTitle>
          <CardDescription className="text-gray-400">
            People you invited — approve pending ones to complete step 2
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingApprovals ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-yellow-500" />
            </div>
          ) : pendingApprovals.length === 0 && myReferrals.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500">No invitations yet</p>
              <p className="text-gray-600 text-sm mt-1">
                Invite friends to start building your network
              </p>
              <Button
                onClick={() => setShowInviteModal(true)}
                className="mt-4 bg-green-600 hover:bg-green-700"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Send First Invitation
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Pending approvals first */}
              {pendingApprovals.map((approval) => (
                <div
                  key={approval.applicantAddress}
                  className="flex items-center justify-between p-3 bg-yellow-900/10 border border-yellow-600/20 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-yellow-600/20 flex items-center justify-center">
                      <User className="w-4 h-4 text-yellow-400" />
                    </div>
                    <div>
                      <div className="text-sm font-mono text-white">
                        {approval.applicantAddress.slice(0, 10)}...{approval.applicantAddress.slice(-8)}
                      </div>
                      <div className="text-xs mt-0.5">
                        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px] px-1.5 py-0">
                          Pending — Waiting Your Approval
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleApprove(approval.applicantAddress)}
                    disabled={processingAddress === approval.applicantAddress}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {processingAddress === approval.applicantAddress ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-1" />
                    )}
                    Approve
                  </Button>
                </div>
              ))}

              {/* Confirmed referrals */}
              {myReferrals.map((address, index) => (
                <div
                  key={address}
                  className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-600/20 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                    </div>
                    <div>
                      <div className="text-sm font-mono text-white">
                        {address.slice(0, 10)}...{address.slice(-8)}
                      </div>
                      <div className="text-xs mt-0.5">
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px] px-1.5 py-0">
                          Confirmed
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="text-green-400 text-sm font-semibold">
                    +{index < 10 ? 10 : index < 50 ? 5 : index < 100 ? 4 : 0} pts
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Referral Notification */}
      {stats?.pendingReferral && (
        <Card className="bg-blue-900/20 border-blue-600/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-600/30 flex items-center justify-center">
                <Award className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1">
                <div className="text-white font-semibold">Pending Invitation</div>
                <div className="text-sm text-blue-300">
                  Complete KYC to confirm your referral from{' '}
                  <span className="font-mono">
                    {stats.pendingReferral.slice(0, 8)}...{stats.pendingReferral.slice(-6)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invite Modal */}
      <InviteUserModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
      />
    </div>
  );
};
