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
import { useP2PIdentity } from '@/contexts/P2PIdentityContext';

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

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode; labelKey: string }> = {
  open: {
    color: 'bg-amber-500',
    icon: <Clock className="h-4 w-4" />,
    labelKey: 'p2pDispute.statusOpen',
  },
  under_review: {
    color: 'bg-blue-500',
    icon: <Scale className="h-4 w-4" />,
    labelKey: 'p2pDispute.statusUnderReview',
  },
  resolved: {
    color: 'bg-green-500',
    icon: <CheckCircle className="h-4 w-4" />,
    labelKey: 'p2pDispute.statusResolved',
  },
  closed: {
    color: 'bg-gray-500',
    icon: <XCircle className="h-4 w-4" />,
    labelKey: 'p2pDispute.statusClosed',
  },
};

const RESOLUTION_LABEL_KEYS: Record<string, string> = {
  release_to_buyer: 'p2pDispute.releasedToBuyer',
  refund_to_seller: 'p2pDispute.refundedToSeller',
  split: 'p2pDispute.splitDecision',
};

export default function P2PDispute() {
  const { disputeId } = useParams<{ disputeId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { userId } = useP2PIdentity();

  const [dispute, setDispute] = useState<DisputeDetails | null>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    const fetchDispute = async () => {
      if (!disputeId) return;

      try {
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
        toast.error(t('p2pDispute.failedToLoad'));
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disputeId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !dispute || !userId) return;

    setIsUploading(true);

    try {
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) {
          toast.error(t('p2pDispute.fileTooLarge', { name: file.name }));
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
          uploaded_by: userId,
          evidence_type: file.type.startsWith('image/') ? 'screenshot' : 'document',
          file_url: urlData.publicUrl,
          description: file.name,
        });
      }

      toast.success(t('p2pDispute.evidenceUploaded'));
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error(t('p2pDispute.failedToUpload'));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const isParticipant = dispute?.trade &&
    (dispute.trade.buyer_id === userId || dispute.trade.seller_id === userId);

  const isBuyer = dispute?.trade?.buyer_id === userId;
  const isSeller = dispute?.trade?.seller_id === userId;
  const isOpener = dispute?.opened_by === userId;

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
            <h2 className="text-lg font-semibold mb-2">{t('p2pDispute.notFound')}</h2>
            <p className="text-muted-foreground mb-4">
              {t('p2pDispute.notFoundDesc')}
            </p>
            <Button onClick={() => navigate('/p2p/orders')}>
              {t('p2pDispute.goToTrades')}
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
        {t('p2p.back')}
      </Button>

      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                {t('p2pDispute.disputeId', { id: dispute.id.slice(0, 8) })}
              </CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <Calendar className="h-4 w-4" />
                {t('p2pDispute.opened', { date: new Date(dispute.created_at).toLocaleDateString() })}
              </CardDescription>
            </div>
            <Badge className={`${statusConfig.color} text-white flex items-center gap-1`}>
              {statusConfig.icon}
              {t(statusConfig.labelKey)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Trade Info Summary */}
          {dispute.trade && (
            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('p2pDispute.relatedTrade')}</p>
                  <p className="font-medium">
                    {t('p2pDispute.tradeAmountFor', { cryptoAmount: dispute.trade.crypto_amount, token: dispute.trade.token, fiatAmount: dispute.trade.fiat_amount, currency: dispute.trade.fiat_currency })}
                  </p>
                </div>
                <Link to={`/p2p/trade/${dispute.trade_id}`}>
                  <Button variant="outline" size="sm">
                    {t('p2pDispute.viewTrade')}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                <div>
                  <span className="text-muted-foreground">{t('p2p.buyer')}:</span>{' '}
                  <span className={isBuyer ? 'font-medium text-primary' : ''}>
                    {formatAddress(dispute.trade.buyer_wallet, 6, 4)}
                    {isBuyer && ` ${t('p2p.you')}`}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('p2p.seller')}:</span>{' '}
                  <span className={isSeller ? 'font-medium text-primary' : ''}>
                    {formatAddress(dispute.trade.seller_wallet, 6, 4)}
                    {isSeller && ` ${t('p2p.you')}`}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Dispute Details */}
          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              {t('p2pDispute.disputeReason')}
            </h3>
            <Badge variant="outline" className="mb-2">
              {dispute.reason.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </Badge>
            <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
              {dispute.description}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {t('p2pDispute.openedBy', { party: isOpener ? t('p2p.you').replace(/[()]/g, '') : (isBuyer ? t('p2p.seller') : t('p2p.buyer')) })}
            </p>
          </div>

          {/* Resolution (if resolved) */}
          {dispute.status === 'resolved' && dispute.resolution && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h3 className="font-semibold mb-2 flex items-center gap-2 text-green-700 dark:text-green-300">
                <CheckCircle className="h-4 w-4" />
                {t('p2pDispute.resolutionTitle')}
              </h3>
              <p className="font-medium text-green-800 dark:text-green-200">
                {t(RESOLUTION_LABEL_KEYS[dispute.resolution])}
              </p>
              {dispute.resolution_notes && (
                <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                  {dispute.resolution_notes}
                </p>
              )}
              {dispute.resolved_at && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                  {t('p2pDispute.resolvedOn', { date: new Date(dispute.resolved_at).toLocaleString() })}
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
            <CardTitle className="text-lg">{t('p2pDispute.evidenceTitle')}</CardTitle>
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
                  {isUploading ? t('p2pDispute.uploading') : t('p2pDispute.addEvidence')}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {evidence.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>{t('p2pDispute.noEvidence')}</p>
              {isParticipant && dispute.status !== 'resolved' && (
                <p className="text-sm mt-1">
                  {t('p2pDispute.uploadEvidenceHelp')}
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {evidence.map((item) => {
                const isImage = item.evidence_type === 'screenshot' ||
                  item.file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                const isMyEvidence = item.uploaded_by === userId;

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
                        {isMyEvidence ? t('p2p.you').replace(/[()]/g, '') : (
                          item.uploaded_by === dispute.trade?.buyer_id ? t('p2p.buyer') : t('p2p.seller')
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
          <CardTitle className="text-lg">{t('p2pDispute.statusTimeline')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Opened */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center">
                <Clock className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="font-medium">{t('p2pDispute.disputeOpenedStep')}</p>
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
                  <p className="font-medium">{t('p2pDispute.underReviewStep')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('p2pDispute.adminReviewing')}
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
                  <p className="font-medium">{t('p2pDispute.resolvedStep')}</p>
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
                    <p className="font-medium">{t('p2pDispute.underReviewStep')}</p>
                    <p className="text-sm text-muted-foreground">{t('p2pDispute.pending')}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 opacity-40">
                  <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">{t('p2pDispute.resolutionStep')}</p>
                    <p className="text-sm text-muted-foreground">{t('p2pDispute.pending')}</p>
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
              <h3 className="font-medium">{t('p2pDispute.needHelp')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('p2pDispute.supportResponse')}
              </p>
            </div>
            <Button variant="outline" asChild>
              <a href="mailto:support@pezkuwichain.io">{t('p2pDispute.contactSupport')}</a>
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
