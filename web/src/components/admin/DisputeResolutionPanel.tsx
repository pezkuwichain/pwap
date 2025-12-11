import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { formatAddress, formatDate } from '@pezkuwi/utils/formatting';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Gavel,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Scale,
  Shield,
  User,
  XCircle,
  ExternalLink,
  Download
} from 'lucide-react';

// Types
interface Dispute {
  id: string;
  trade_id: string;
  opened_by: string;
  reason: string;
  category: string;
  evidence_urls: string[];
  status: 'open' | 'under_review' | 'resolved' | 'escalated' | 'closed';
  decision?: string;
  decision_reasoning?: string;
  assigned_moderator_id?: string;
  assigned_at?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  trade?: Trade;
  opener?: UserProfile;
  evidence?: Evidence[];
}

interface Trade {
  id: string;
  offer_id: string;
  seller_id: string;
  buyer_id: string;
  crypto_amount: number;
  fiat_amount: number;
  status: string;
  created_at: string;
  seller?: UserProfile;
  buyer?: UserProfile;
}

interface UserProfile {
  id: string;
  username?: string;
  wallet_address?: string;
}

interface Evidence {
  id: string;
  dispute_id: string;
  uploaded_by: string;
  evidence_type: string;
  file_url: string;
  file_name?: string;
  description?: string;
  created_at: string;
  is_valid?: boolean;
  review_notes?: string;
}

// Decision options
const DECISION_OPTIONS = [
  { value: 'release_to_buyer', label: 'Release to Buyer', description: 'Release escrowed crypto to the buyer' },
  { value: 'refund_to_seller', label: 'Refund to Seller', description: 'Return escrowed crypto to the seller' },
  { value: 'split', label: 'Split 50/50', description: 'Split the escrowed amount between both parties' },
  { value: 'escalate', label: 'Escalate', description: 'Escalate to higher authority for complex cases' }
];

// Status badge colors
const STATUS_COLORS: Record<string, string> = {
  open: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
  under_review: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
  resolved: 'bg-green-500/20 text-green-500 border-green-500/30',
  escalated: 'bg-purple-500/20 text-purple-500 border-purple-500/30',
  closed: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
};

// Category labels
const CATEGORY_LABELS: Record<string, string> = {
  payment_not_received: 'Payment Not Received',
  wrong_amount: 'Wrong Amount',
  fake_payment_proof: 'Fake Payment Proof',
  seller_not_responding: 'Seller Not Responding',
  buyer_not_responding: 'Buyer Not Responding',
  fraudulent_behavior: 'Fraudulent Behavior',
  other: 'Other'
};

export function DisputeResolutionPanel() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('open');
  const [decision, setDecision] = useState('');
  const [reasoning, setReasoning] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Fetch disputes
  const fetchDisputes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('p2p_fiat_disputes')
        .select(`
          *,
          trade:p2p_fiat_trades(
            id,
            offer_id,
            seller_id,
            buyer_id,
            crypto_amount,
            fiat_amount,
            status,
            created_at
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch evidence for each dispute
      const disputesWithEvidence = await Promise.all(
        (data || []).map(async (dispute) => {
          const { data: evidence } = await supabase
            .from('p2p_dispute_evidence')
            .select('*')
            .eq('dispute_id', dispute.id)
            .order('created_at', { ascending: true });

          return {
            ...dispute,
            evidence: evidence || []
          };
        })
      );

      setDisputes(disputesWithEvidence);
    } catch (error) {
      console.error('Error fetching disputes:', error);
      toast.error('Failed to load disputes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisputes();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('admin-disputes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'p2p_fiat_disputes'
      }, () => {
        fetchDisputes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Filter disputes by status
  const filteredDisputes = disputes.filter(d => {
    if (activeTab === 'open') return d.status === 'open';
    if (activeTab === 'under_review') return d.status === 'under_review';
    if (activeTab === 'resolved') return ['resolved', 'closed'].includes(d.status);
    if (activeTab === 'escalated') return d.status === 'escalated';
    return true;
  });

  // Claim dispute for review
  const claimDispute = async (disputeId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('p2p_fiat_disputes')
        .update({
          status: 'under_review',
          assigned_moderator_id: user.id,
          assigned_at: new Date().toISOString()
        })
        .eq('id', disputeId);

      if (error) throw error;

      toast.success('Dispute claimed for review');
      fetchDisputes();
    } catch (error) {
      console.error('Error claiming dispute:', error);
      toast.error('Failed to claim dispute');
    }
  };

  // Resolve dispute
  const resolveDispute = async () => {
    if (!selectedDispute || !decision || !reasoning) {
      toast.error('Please select a decision and provide reasoning');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update dispute
      const { error: disputeError } = await supabase
        .from('p2p_fiat_disputes')
        .update({
          status: decision === 'escalate' ? 'escalated' : 'resolved',
          decision,
          decision_reasoning: reasoning,
          resolved_at: new Date().toISOString()
        })
        .eq('id', selectedDispute.id);

      if (disputeError) throw disputeError;

      // Update trade status based on decision
      if (decision !== 'escalate' && selectedDispute.trade) {
        const tradeStatus = decision === 'release_to_buyer' ? 'completed' : 'refunded';
        await supabase
          .from('p2p_fiat_trades')
          .update({ status: tradeStatus })
          .eq('id', selectedDispute.trade_id);
      }

      // Create notifications for both parties
      if (selectedDispute.trade) {
        const notificationPromises = [
          supabase.rpc('create_p2p_notification', {
            p_user_id: selectedDispute.trade.seller_id,
            p_type: 'dispute_resolved',
            p_title: 'Dispute Resolved',
            p_message: `The dispute has been resolved: ${DECISION_OPTIONS.find(o => o.value === decision)?.label}`,
            p_reference_type: 'dispute',
            p_reference_id: selectedDispute.id
          }),
          supabase.rpc('create_p2p_notification', {
            p_user_id: selectedDispute.trade.buyer_id,
            p_type: 'dispute_resolved',
            p_title: 'Dispute Resolved',
            p_message: `The dispute has been resolved: ${DECISION_OPTIONS.find(o => o.value === decision)?.label}`,
            p_reference_type: 'dispute',
            p_reference_id: selectedDispute.id
          })
        ];
        await Promise.all(notificationPromises);
      }

      toast.success('Dispute resolved successfully');
      setResolveOpen(false);
      setSelectedDispute(null);
      setDecision('');
      setReasoning('');
      fetchDisputes();
    } catch (error) {
      console.error('Error resolving dispute:', error);
      toast.error('Failed to resolve dispute');
    } finally {
      setSubmitting(false);
    }
  };

  // Open details modal
  const openDetails = (dispute: Dispute) => {
    setSelectedDispute(dispute);
    setDetailsOpen(true);
  };

  // Open resolve modal
  const openResolve = (dispute: Dispute) => {
    setSelectedDispute(dispute);
    setResolveOpen(true);
  };

  // Stats
  const stats = {
    open: disputes.filter(d => d.status === 'open').length,
    under_review: disputes.filter(d => d.status === 'under_review').length,
    resolved: disputes.filter(d => ['resolved', 'closed'].includes(d.status)).length,
    escalated: disputes.filter(d => d.status === 'escalated').length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Gavel className="h-6 w-6 text-kurdish-green" />
            Dispute Resolution
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Review and resolve P2P trading disputes
          </p>
        </div>
        <Button variant="outline" onClick={fetchDisputes} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-yellow-500/10 border-yellow-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Open</p>
                <p className="text-2xl font-bold text-yellow-500">{stats.open}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-500/10 border-blue-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Under Review</p>
                <p className="text-2xl font-bold text-blue-500">{stats.under_review}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-500/10 border-green-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Resolved</p>
                <p className="text-2xl font-bold text-green-500">{stats.resolved}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-purple-500/10 border-purple-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Escalated</p>
                <p className="text-2xl font-bold text-purple-500">{stats.escalated}</p>
              </div>
              <Scale className="h-8 w-8 text-purple-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Disputes Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-md">
          <TabsTrigger value="open" className="gap-1">
            Open
            {stats.open > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {stats.open}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="under_review">In Review</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
          <TabsTrigger value="escalated">Escalated</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {loading ? (
            <Card>
              <CardContent className="py-12 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : filteredDisputes.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Shield className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No disputes in this category</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredDisputes.map((dispute) => (
                <Card key={dispute.id} className="hover:border-kurdish-green/50 transition-colors">
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={STATUS_COLORS[dispute.status]}>
                            {dispute.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                          <Badge variant="outline">
                            {CATEGORY_LABELS[dispute.category] || dispute.category}
                          </Badge>
                          {dispute.evidence && dispute.evidence.length > 0 && (
                            <Badge variant="secondary" className="gap-1">
                              <ImageIcon className="h-3 w-3" />
                              {dispute.evidence.length} evidence
                            </Badge>
                          )}
                        </div>

                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {dispute.reason}
                        </p>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            Trade: {formatAddress(dispute.trade_id)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(dispute.created_at)}
                          </span>
                          {dispute.trade && (
                            <span className="flex items-center gap-1">
                              <Scale className="h-3 w-3" />
                              {dispute.trade.crypto_amount} crypto
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openDetails(dispute)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>

                        {dispute.status === 'open' && (
                          <Button
                            size="sm"
                            onClick={() => claimDispute(dispute.id)}
                          >
                            Claim
                          </Button>
                        )}

                        {dispute.status === 'under_review' && (
                          <Button
                            size="sm"
                            className="bg-kurdish-green hover:bg-kurdish-green-dark"
                            onClick={() => openResolve(dispute)}
                          >
                            <Gavel className="h-4 w-4 mr-1" />
                            Resolve
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Details Modal */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Dispute Details
            </DialogTitle>
            <DialogDescription>
              Review all information related to this dispute
            </DialogDescription>
          </DialogHeader>

          {selectedDispute && (
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6">
                {/* Status & Category */}
                <div className="flex items-center gap-2">
                  <Badge className={STATUS_COLORS[selectedDispute.status]}>
                    {selectedDispute.status.replace('_', ' ').toUpperCase()}
                  </Badge>
                  <Badge variant="outline">
                    {CATEGORY_LABELS[selectedDispute.category] || selectedDispute.category}
                  </Badge>
                </div>

                {/* Reason */}
                <div>
                  <h4 className="font-medium mb-2">Reason</h4>
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                    {selectedDispute.reason}
                  </p>
                </div>

                {/* Trade Info */}
                {selectedDispute.trade && (
                  <div>
                    <h4 className="font-medium mb-2">Trade Information</h4>
                    <div className="bg-muted p-3 rounded-lg space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Trade ID:</span>
                        <span className="font-mono">{formatAddress(selectedDispute.trade_id)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Amount:</span>
                        <span>{selectedDispute.trade.crypto_amount} crypto</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fiat:</span>
                        <span>{selectedDispute.trade.fiat_amount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Trade Status:</span>
                        <Badge variant="secondary">{selectedDispute.trade.status}</Badge>
                      </div>
                    </div>
                  </div>
                )}

                {/* Parties */}
                {selectedDispute.trade && (
                  <div>
                    <h4 className="font-medium mb-2">Parties</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-muted p-3 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Seller</span>
                        </div>
                        <p className="text-xs font-mono text-muted-foreground">
                          {formatAddress(selectedDispute.trade.seller_id)}
                        </p>
                      </div>
                      <div className="bg-muted p-3 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Buyer</span>
                        </div>
                        <p className="text-xs font-mono text-muted-foreground">
                          {formatAddress(selectedDispute.trade.buyer_id)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Evidence */}
                <div>
                  <h4 className="font-medium mb-2">
                    Evidence ({selectedDispute.evidence?.length || 0})
                  </h4>
                  {selectedDispute.evidence && selectedDispute.evidence.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {selectedDispute.evidence.map((ev) => (
                        <div
                          key={ev.id}
                          className="bg-muted p-3 rounded-lg cursor-pointer hover:bg-muted/80 transition-colors"
                          onClick={() => setLightboxImage(ev.file_url)}
                        >
                          <div className="aspect-video relative mb-2 rounded overflow-hidden bg-black/20">
                            {ev.evidence_type === 'screenshot' || ev.file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                              <img
                                src={ev.file_url}
                                alt={ev.description || 'Evidence'}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <FileText className="h-8 w-8 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="text-xs">
                            <Badge variant="outline" className="mb-1">
                              {ev.evidence_type}
                            </Badge>
                            {ev.description && (
                              <p className="text-muted-foreground line-clamp-2 mt-1">
                                {ev.description}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No evidence uploaded</p>
                  )}
                </div>

                {/* Timeline */}
                <div>
                  <h4 className="font-medium mb-2">Timeline</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-500" />
                      <span className="text-muted-foreground">Opened:</span>
                      <span>{formatDate(selectedDispute.created_at)}</span>
                    </div>
                    {selectedDispute.assigned_at && (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-muted-foreground">Claimed:</span>
                        <span>{formatDate(selectedDispute.assigned_at)}</span>
                      </div>
                    )}
                    {selectedDispute.resolved_at && (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-muted-foreground">Resolved:</span>
                        <span>{formatDate(selectedDispute.resolved_at)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Resolution (if resolved) */}
                {selectedDispute.decision && (
                  <div>
                    <h4 className="font-medium mb-2">Resolution</h4>
                    <div className="bg-green-500/10 border border-green-500/20 p-3 rounded-lg">
                      <Badge className="bg-green-500/20 text-green-500 mb-2">
                        {DECISION_OPTIONS.find(o => o.value === selectedDispute.decision)?.label}
                      </Badge>
                      {selectedDispute.decision_reasoning && (
                        <p className="text-sm text-muted-foreground">
                          {selectedDispute.decision_reasoning}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>
              Close
            </Button>
            {selectedDispute?.status === 'under_review' && (
              <Button
                className="bg-kurdish-green hover:bg-kurdish-green-dark"
                onClick={() => {
                  setDetailsOpen(false);
                  openResolve(selectedDispute);
                }}
              >
                <Gavel className="h-4 w-4 mr-2" />
                Resolve Dispute
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve Modal */}
      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gavel className="h-5 w-5 text-kurdish-green" />
              Resolve Dispute
            </DialogTitle>
            <DialogDescription>
              Make a final decision on this dispute. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Decision */}
            <div>
              <label className="text-sm font-medium mb-2 block">Decision</label>
              <Select value={decision} onValueChange={setDecision}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a decision..." />
                </SelectTrigger>
                <SelectContent>
                  {DECISION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex flex-col">
                        <span>{option.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reasoning */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Reasoning <span className="text-muted-foreground">(required)</span>
              </label>
              <Textarea
                value={reasoning}
                onChange={(e) => setReasoning(e.target.value)}
                placeholder="Explain your decision based on the evidence..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-1">
                This will be visible to both parties
              </p>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-500">Important</p>
                <p className="text-muted-foreground">
                  Your decision will trigger automatic actions on the escrowed funds.
                  Make sure you have reviewed all evidence carefully.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setResolveOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              className="bg-kurdish-green hover:bg-kurdish-green-dark"
              onClick={resolveDispute}
              disabled={submitting || !decision || !reasoning}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Confirm Resolution
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Lightbox */}
      <Dialog open={!!lightboxImage} onOpenChange={() => setLightboxImage(null)}>
        <DialogContent className="max-w-4xl p-0 bg-black/90">
          {lightboxImage && (
            <div className="relative">
              <img
                src={lightboxImage}
                alt="Evidence"
                className="w-full h-auto max-h-[80vh] object-contain"
              />
              <div className="absolute top-4 right-4 flex gap-2">
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={() => window.open(lightboxImage, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  asChild
                >
                  <a href={lightboxImage} download>
                    <Download className="h-4 w-4" />
                  </a>
                </Button>
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={() => setLightboxImage(null)}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DisputeResolutionPanel;
