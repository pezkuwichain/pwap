import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  Upload,
  FileText,
  Download,
  User,
  MessageSquare,
  Calendar,
  Scale,
  ChevronRight,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatAddress } from '@pezkuwi/utils/formatting';

interface DisputeDetails {
  id: string;
  trade_id: string;
  opened_by: string;
  reason: string;
  description: string;
  status: 'open' | 'under_review' | 'resolved' | 'closed';
  resolution?: 'release_to_buyer' | 'refund_to_seller' | 'split';
  resolution_notes?: string;
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
  trade?: {
    id: string;
    buyer_id: string;
    seller_id: string;
    buyer_wallet: string;
    seller_wallet: string;
    crypto_amount: string;
    fiat_amount: string;
    token: string;
    fiat_currency: string;
    status: string;
  };
  opener?: {
    id: string;
    email: string;
  };
}

interface Evidence {
  id: string;
  dispute_id: string;
  uploaded_by: string;
  evidence_type: string;
  file_url: string;
  description: string;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  open: {
    color: 'bg-amber-500',
    icon: <Clock className="h-4 w-4" />,
    label: 'Open',
  },
  under_review: {
    color: 'bg-blue-500',
    icon: <Scale className="h-4 w-4" />,
    label: 'Under Review',
  },
  resolved: {
    color: 'bg-green-500',
    icon: <CheckCircle className="h-4 w-4" />,
    label: 'Resolved',
  },
  closed: {
    color: 'bg-gray-500',
    icon: <XCircle className="h-4 w-4" />,
    label: 'Closed',
  },
};

const RESOLUTION_LABELS: Record<string, string> = {
  release_to_buyer: 'Released to Buyer',
  refund_to_seller: 'Refunded to Seller',
  split: 'Split Decision',
};

export default function P2PDispute() {
  const { disputeId } = useParams<{ disputeId: string }>();
  const navigate = useNavigate();
  useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dispute, setDispute] = useState<DisputeDetails | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    const fetchDispute = async () => {
      if (!disputeId) return;

      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUserId(user?.id || null);

        // Fetch dispute with trade info
        const { data: disputeData, error: disputeError } = await supabase
          .from('p2p_disputes')
          .select(`
            *,
            trade:p2p_fiat_trades(
              id, buyer_id, seller_id, buyer_wallet, seller_wallet,
              crypto_amount, fiat_amount, token, fiat_currency, status
            )
          `)
          .eq('id', disputeId)
          .single();

        if (disputeError) throw disputeError;
        setDispute(disputeData);

        // Fetch evidence
        const { data: evidenceData, error: evidenceError } = await supabase
          .from('p2p_dispute_evidence')
          .select('*')
          .eq('dispute_id', disputeId)
          .order('created_at', { ascending: true });

        if (!evidenceError && evidenceData) {
          setEvidence(evidenceData);
        }
      } catch (error) {
        console.error('Failed to fetch dispute:', error);
        toast.error('Failed to load dispute details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDispute();

    // Subscribe to dispute updates
    const channel = supabase
      .channel(`dispute-${disputeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'p2p_disputes',
          filter: `id=eq.${disputeId}`,
        },
        (payload) => {
          if (payload.new) {
            setDispute((prev) => prev ? { ...prev, ...payload.new } : null);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'p2p_dispute_evidence',
          filter: `dispute_id=eq.${disputeId}`,
        },
        (payload) => {
          if (payload.new) {
            setEvidence((prev) => [...prev, payload.new as Evidence]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [disputeId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !dispute || !currentUserId) return;

    setIsUploading(true);

    try {
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`File ${file.name} is too large (max 10MB)`);
          continue;
        }

        const fileName = `disputes/${dispute.id}/${Date.now()}-${file.name}`;
        const { data, error } = await supabase.storage
          .from('p2p-evidence')
          .upload(fileName, file);

        if (error) throw error;

        const { data: urlData } = supabase.storage
          .from('p2p-evidence')
          .getPublicUrl(data.path);

        // Insert evidence record
        await supabase.from('p2p_dispute_evidence').insert({
          dispute_id: dispute.id,
          uploaded_by: currentUserId,
          evidence_type: file.type.startsWith('image/') ? 'screenshot' : 'document',
          file_url: urlData.publicUrl,
          description: file.name,
        });
      }

      toast.success('Evidence uploaded successfully');
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Failed to upload evidence');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const isParticipant = dispute?.trade &&
    (dispute.trade.buyer_id === currentUserId || dispute.trade.seller_id === currentUserId);

  const isBuyer = dispute?.trade?.buyer_id === currentUserId;
  const isSeller = dispute?.trade?.seller_id === currentUserId;
  const isOpener = dispute?.opened_by === currentUserId;

  if (isLoading) {
    return (
      <div className="container max-w-4xl mx-auto p-4 space-y-4">
        <Skeleton className="h-10 w-32" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!dispute) {
    return (
      <div className="container max-w-4xl mx-auto p-4">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
            <h2 className="text-lg font-semibold mb-2">Dispute Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The dispute you are looking for does not exist or you do not have access.
            </p>
            <Button onClick={() => navigate('/p2p/orders')}>
              Go to My Trades
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[dispute.status] || STATUS_CONFIG.open;

  return (
    <div className="container max-w-4xl mx-auto p-4 space-y-4">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => navigate(-1)}
        className="gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Dispute #{dispute.id.slice(0, 8)}
              </CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <Calendar className="h-4 w-4" />
                Opened {new Date(dispute.created_at).toLocaleDateString()}
              </CardDescription>
            </div>
            <Badge className={`${statusConfig.color} text-white flex items-center gap-1`}>
              {statusConfig.icon}
              {statusConfig.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Trade Info Summary */}
          {dispute.trade && (
            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Related Trade</p>
                  <p className="font-medium">
                    {dispute.trade.crypto_amount} {dispute.trade.token} for{' '}
                    {dispute.trade.fiat_amount} {dispute.trade.fiat_currency}
                  </p>
                </div>
                <Link to={`/p2p/trade/${dispute.trade_id}`}>
                  <Button variant="outline" size="sm">
                    View Trade
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Buyer:</span>{' '}
                  <span className={isBuyer ? 'font-medium text-primary' : ''}>
                    {formatAddress(dispute.trade.buyer_wallet, 6, 4)}
                    {isBuyer && ' (You)'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Seller:</span>{' '}
                  <span className={isSeller ? 'font-medium text-primary' : ''}>
                    {formatAddress(dispute.trade.seller_wallet, 6, 4)}
                    {isSeller && ' (You)'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Dispute Details */}
          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Dispute Reason
            </h3>
            <Badge variant="outline" className="mb-2">
              {dispute.reason.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </Badge>
            <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
              {dispute.description}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Opened by: {isOpener ? 'You' : (isBuyer ? 'Seller' : 'Buyer')}
            </p>
          </div>

          {/* Resolution (if resolved) */}
          {dispute.status === 'resolved' && dispute.resolution && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h3 className="font-semibold mb-2 flex items-center gap-2 text-green-700 dark:text-green-300">
                <CheckCircle className="h-4 w-4" />
                Resolution
              </h3>
              <p className="font-medium text-green-800 dark:text-green-200">
                {RESOLUTION_LABELS[dispute.resolution]}
              </p>
              {dispute.resolution_notes && (
                <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                  {dispute.resolution_notes}
                </p>
              )}
              {dispute.resolved_at && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                  Resolved on {new Date(dispute.resolved_at).toLocaleString()}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Evidence Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Evidence</CardTitle>
            {isParticipant && dispute.status !== 'resolved' && (
              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*,.pdf,.doc,.docx"
                  multiple
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploading ? 'Uploading...' : 'Add Evidence'}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {evidence.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No evidence submitted yet</p>
              {isParticipant && dispute.status !== 'resolved' && (
                <p className="text-sm mt-1">
                  Upload screenshots, receipts, or documents to support your case
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {evidence.map((item) => {
                const isImage = item.evidence_type === 'screenshot' ||
                  item.file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                const isMyEvidence = item.uploaded_by === currentUserId;

                return (
                  <div
                    key={item.id}
                    className={`relative border rounded-lg overflow-hidden ${
                      isMyEvidence ? 'border-primary' : ''
                    }`}
                  >
                    {isImage ? (
                      <img
                        src={item.file_url}
                        alt={item.description}
                        className="w-full h-24 object-cover cursor-pointer hover:opacity-80 transition"
                        onClick={() => setSelectedImage(item.file_url)}
                      />
                    ) : (
                      <div className="w-full h-24 flex items-center justify-center bg-muted">
                        <FileText className="h-8 w-8 text-blue-500" />
                      </div>
                    )}
                    <div className="p-2 text-xs">
                      <p className="truncate font-medium">{item.description}</p>
                      <p className="text-muted-foreground">
                        {isMyEvidence ? 'You' : (
                          item.uploaded_by === dispute.trade?.buyer_id ? 'Buyer' : 'Seller'
                        )}
                      </p>
                    </div>
                    <a
                      href={item.file_url}
                      download
                      className="absolute top-1 right-1 p-1 bg-black/50 rounded text-white hover:bg-black/70"
                    >
                      <Download className="h-3 w-3" />
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Status Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Opened */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center">
                <Clock className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="font-medium">Dispute Opened</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(dispute.created_at).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Under Review (if applicable) */}
            {(dispute.status === 'under_review' || dispute.status === 'resolved') && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                  <Scale className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="font-medium">Under Review</p>
                  <p className="text-sm text-muted-foreground">
                    Admin is reviewing the case
                  </p>
                </div>
              </div>
            )}

            {/* Resolved (if applicable) */}
            {dispute.status === 'resolved' && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="font-medium">Resolved</p>
                  <p className="text-sm text-muted-foreground">
                    {dispute.resolved_at && new Date(dispute.resolved_at).toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            {/* Pending steps */}
            {dispute.status === 'open' && (
              <>
                <div className="flex items-start gap-3 opacity-40">
                  <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                    <Scale className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">Under Review</p>
                    <p className="text-sm text-muted-foreground">Pending</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 opacity-40">
                  <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">Resolution</p>
                    <p className="text-sm text-muted-foreground">Pending</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Help Card */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <User className="h-10 w-10 text-muted-foreground" />
            <div className="flex-1">
              <h3 className="font-medium">Need Help?</h3>
              <p className="text-sm text-muted-foreground">
                Our support team typically responds within 24-48 hours.
              </p>
            </div>
            <Button variant="outline" asChild>
              <a href="mailto:support@pezkuwichain.io">Contact Support</a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Image Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300"
            onClick={() => setSelectedImage(null)}
          >
            <X className="h-8 w-8" />
          </button>
          <img
            src={selectedImage}
            alt="Evidence"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
