import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, Upload, X, FileText } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface DisputeModalProps {
  isOpen: boolean;
  onClose: () => void;
  tradeId: string;
  counterpartyId: string;
  counterpartyWallet: string;
  isBuyer: boolean;
}

interface EvidenceFile {
  id: string;
  file: File;
  preview?: string;
  type: 'image' | 'document';
}

const DISPUTE_REASON_KEYS: Record<string, string> = {
  payment_not_received: 'p2pDispute.paymentNotReceived',
  wrong_amount: 'p2pDispute.wrongAmount',
  seller_not_responding: 'p2pDispute.sellerNotResponding',
  buyer_not_responding: 'p2pDispute.buyerNotResponding',
  fraudulent_behavior: 'p2pDispute.fraudulentBehavior',
  fake_payment_proof: 'p2pDispute.fakePaymentProof',
  account_mismatch: 'p2pDispute.accountMismatch',
  other: 'p2pDispute.other',
};

const DISPUTE_REASONS = Object.keys(DISPUTE_REASON_KEYS);

export function DisputeModal({
  isOpen,
  onClose,
  tradeId,
  counterpartyId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  counterpartyWallet,
  isBuyer,
}: DisputeModalProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFile[]>([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter reasons based on role
  const availableReasons = DISPUTE_REASONS.filter((value) => {
    if (isBuyer) {
      return value !== 'buyer_not_responding' && value !== 'payment_not_received';
    } else {
      return value !== 'seller_not_responding' && value !== 'fake_payment_proof';
    }
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles: EvidenceFile[] = [];

    Array.from(files).forEach((file) => {
      if (evidenceFiles.length + newFiles.length >= 5) {
        toast.error(t('p2pDispute.maxFilesError'));
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.error(t('p2pDispute.fileTooLarge', { name: file.name }));
        return;
      }

      const isImage = file.type.startsWith('image/');
      const evidence: EvidenceFile = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        type: isImage ? 'image' : 'document',
      };

      if (isImage) {
        evidence.preview = URL.createObjectURL(file);
      }

      newFiles.push(evidence);
    });

    setEvidenceFiles((prev) => [...prev, ...newFiles]);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeEvidence = (id: string) => {
    setEvidenceFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  const uploadEvidence = async (disputeId: string): Promise<string[]> => {
    const uploadedUrls: string[] = [];

    for (const evidence of evidenceFiles) {
      const fileName = `disputes/${disputeId}/${evidence.id}-${evidence.file.name}`;

      const { data, error } = await supabase.storage
        .from('p2p-evidence')
        .upload(fileName, evidence.file);

      if (error) {
        console.error('Evidence upload failed:', error);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from('p2p-evidence')
        .getPublicUrl(data.path);

      uploadedUrls.push(urlData.publicUrl);
    }

    return uploadedUrls;
  };

  const handleSubmit = async () => {
    if (!reason) {
      toast.error(t('p2pDispute.selectReasonError'));
      return;
    }

    if (!description || description.length < 20) {
      toast.error(t('p2pDispute.descriptionError'));
      return;
    }

    if (!termsAccepted) {
      toast.error(t('p2pDispute.acceptTermsError'));
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create dispute
      const { data: dispute, error: disputeError } = await supabase
        .from('p2p_disputes')
        .insert({
          trade_id: tradeId,
          opened_by: user.id,
          reason,
          description,
          status: 'open',
        })
        .select()
        .single();

      if (disputeError) throw disputeError;

      // Upload evidence files
      if (evidenceFiles.length > 0) {
        const evidenceUrls = await uploadEvidence(dispute.id);

        // Insert evidence records
        const evidenceRecords = evidenceUrls.map((url, index) => ({
          dispute_id: dispute.id,
          uploaded_by: user.id,
          evidence_type: evidenceFiles[index].type === 'image' ? 'screenshot' : 'document',
          file_url: url,
          description: `Evidence ${index + 1}`,
        }));

        await supabase.from('p2p_dispute_evidence').insert(evidenceRecords);
      }

      // Update trade status to disputed
      await supabase
        .from('p2p_fiat_trades')
        .update({ status: 'disputed' })
        .eq('id', tradeId);

      // Create notification for counterparty
      await supabase.from('p2p_notifications').insert({
        user_id: counterpartyId,
        type: 'dispute_opened',
        title: 'Dispute Opened',
        message: `A dispute has been opened for your trade. Reason: ${reason}`,
        reference_type: 'dispute',
        reference_id: dispute.id,
      });

      // Fetch admin user IDs and create notifications for each admin
      const { data: adminIds, error: adminError } = await supabase.rpc('get_admin_user_ids');
      if (adminError) {
        console.error('Failed to fetch admin IDs:', adminError);
        // Continue without admin notifications if fetching fails, but log the error
      } else if (adminIds && adminIds.length > 0) {
        const adminNotifications = adminIds.map((admin: { user_id: string }) => ({
          user_id: admin.user_id,
          type: 'dispute_opened',
          title: 'New Dispute Requires Attention',
          message: `Dispute #${dispute.id.slice(0, 8)} opened. Trade: ${tradeId.slice(0, 8)}`,
          reference_type: 'dispute',
          reference_id: dispute.id,
        }));
        await supabase.from('p2p_notifications').insert(adminNotifications);
      }

      toast.success(t('p2pDispute.disputeOpened'));
      onClose();
    } catch (error) {
      console.error('Failed to open dispute:', error);
      toast.error(t('p2pDispute.failedToOpen'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Cleanup previews
    evidenceFiles.forEach((f) => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    setReason('');
    setDescription('');
    setEvidenceFiles([]);
    setTermsAccepted(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-500">
            <AlertTriangle className="h-5 w-5" />
            {t('p2pDispute.title')}
          </DialogTitle>
          <DialogDescription>
            {t('p2pDispute.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Reason Selection */}
          <div className="space-y-2">
            <Label htmlFor="reason">{t('p2pDispute.reasonLabel')}</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder={t('p2pDispute.selectReason')} />
              </SelectTrigger>
              <SelectContent>
                {availableReasons.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(DISPUTE_REASON_KEYS[value])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">
              {t('p2pDispute.detailedDescription')} <span className="text-muted-foreground text-xs">{t('p2pDispute.minChars')}</span>
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('p2pDispute.descriptionPlaceholder')}
              rows={4}
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground text-right">
              {description.length}/2000
            </p>
          </div>

          {/* Evidence Upload */}
          <div className="space-y-2">
            <Label>{t('p2pDispute.evidenceLabel')}</Label>
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*,.pdf,.doc,.docx"
                multiple
                className="hidden"
              />
              <div className="text-center">
                <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={evidenceFiles.length >= 5}
                >
                  {t('p2pDispute.uploadEvidence')}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  {t('p2pDispute.evidenceTypes')}
                </p>
              </div>
            </div>

            {/* Evidence Preview */}
            {evidenceFiles.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                {evidenceFiles.map((evidence) => (
                  <div
                    key={evidence.id}
                    className="relative border rounded-lg p-2 flex items-center gap-2"
                  >
                    {evidence.type === 'image' ? (
                      <img
                        src={evidence.preview}
                        alt={t('p2pDispute.evidenceAlt')}
                        className="w-10 h-10 object-cover rounded"
                      />
                    ) : (
                      <FileText className="w-10 h-10 text-blue-500" />
                    )}
                    <span className="text-xs truncate flex-1">
                      {evidence.file.name}
                    </span>
                    <button
                      onClick={() => removeEvidence(evidence.id)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Warning Box */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <div className="flex gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  {t('p2pDispute.importantNotice')}
                </p>
                <ul className="text-amber-700 dark:text-amber-300 text-xs mt-1 space-y-1">
                  <li>• {t('p2pDispute.falseDisputes')}</li>
                  <li>• {t('p2pDispute.resolutionTime')}</li>
                  <li>• {t('p2pDispute.bothParties')}</li>
                  <li>• {t('p2pDispute.adminFinal')}</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Terms Checkbox */}
          <div className="flex items-start gap-2">
            <Checkbox
              id="terms"
              checked={termsAccepted}
              onCheckedChange={(checked) => setTermsAccepted(checked === true)}
            />
            <Label htmlFor="terms" className="text-sm leading-tight cursor-pointer">
              {t('p2pDispute.termsCheckbox')}
            </Label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            {t('cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={isSubmitting || !reason || !description || !termsAccepted}
          >
            {isSubmitting ? t('p2pDispute.submitting') : t('p2pDispute.openDispute')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
