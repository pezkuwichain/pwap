import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, RefreshCw, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { getSigner } from '@/lib/get-signer';
import { usePezkuwi } from '@/contexts/PezkuwiContext';
import {
  getMultisigMembers,
  calculateMultisigAddress,
  approveMultisigTx,
  cancelMultisigTx,
  USDT_MULTISIG_CONFIG,
  BRIDGE_MULTISIG_SPECIFIC_ADDRESSES,
} from '@pezkuwi/lib/multisig';
import {
  listPendingOperations,
  decodeAndVerifyCallData,
  type PendingOperation,
} from '@pezkuwi/lib/multisig-operations';

interface MultisigOperationsProps {
  specificAddresses?: Record<string, string>;
}

export const MultisigOperations: React.FC<MultisigOperationsProps> = ({
  specificAddresses = BRIDGE_MULTISIG_SPECIFIC_ADDRESSES,
}) => {
  const { t } = useTranslation();
  const { api, isApiReady, selectedAccount, walletSource } = usePezkuwi();

  const [multisigAddress, setMultisigAddress] = useState('');
  const [otherSignatories, setOtherSignatories] = useState<string[]>([]);
  const [operations, setOperations] = useState<PendingOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingHash, setProcessingHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [manualCallData, setManualCallData] = useState<Record<string, string>>({});
  const [decodeErrors, setDecodeErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!api || !isApiReady) return;
    setLoading(true);
    setError(null);
    try {
      const allMembers = await getMultisigMembers(api, specificAddresses);
      const multisigAddr = calculateMultisigAddress(allMembers);
      setMultisigAddress(multisigAddr);

      if (selectedAccount) {
        setOtherSignatories(allMembers.filter((addr) => addr !== selectedAccount.address));
      }

      const ops = await listPendingOperations(api, multisigAddr);
      setOperations(ops);
    } catch (err) {
      if (import.meta.env.DEV) console.error('Error loading pending multisig operations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load pending operations');
    } finally {
      setLoading(false);
    }
  }, [api, isApiReady, selectedAccount, specificAddresses]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDecode = (callHash: string) => {
    if (!api) return;
    const hex = manualCallData[callHash];
    if (!hex) return;

    try {
      const { call, description } = decodeAndVerifyCallData(api, hex, callHash);
      setOperations((prev) =>
        prev.map((op) =>
          op.callHash === callHash ? { ...op, resolvedCall: call, description, isAutoMatched: false } : op
        )
      );
      setDecodeErrors((prev) => ({ ...prev, [callHash]: '' }));
    } catch (err) {
      setDecodeErrors((prev) => ({
        ...prev,
        [callHash]: err instanceof Error ? err.message : 'Failed to decode call data',
      }));
    }
  };

  const runExtrinsic = async (
    callHash: string,
    tx: ReturnType<typeof approveMultisigTx> | ReturnType<typeof cancelMultisigTx>,
    successMessage: string
  ) => {
    if (!api || !selectedAccount) return;

    setProcessingHash(callHash);
    setError(null);
    setSuccess(null);

    try {
      const injector = await getSigner(selectedAccount.address, walletSource, api);

      await new Promise<void>((resolve, reject) => {
        tx.signAndSend(selectedAccount.address, { signer: injector.signer }, ({ status, dispatchError }) => {
          if (status.isInBlock || status.isFinalized) {
            if (dispatchError) {
              if (dispatchError.isModule) {
                const decoded = api.registry.findMetaError(dispatchError.asModule);
                reject(new Error(`${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`));
              } else {
                reject(new Error(dispatchError.toString()));
              }
            } else {
              resolve();
            }
          }
        }).catch(reject);
      });

      setSuccess(successMessage);
      await load();
    } catch (err) {
      if (import.meta.env.DEV) console.error('Multisig operation submission failed:', err);
      setError(err instanceof Error ? err.message : 'Transaction failed');
    } finally {
      setProcessingHash(null);
    }
  };

  const handleApprove = (op: PendingOperation) => {
    if (!api || !op.resolvedCall) return;
    const tx = approveMultisigTx(api, op.resolvedCall, otherSignatories, op.when, op.threshold);
    runExtrinsic(op.callHash, tx, 'Approval submitted successfully.');
  };

  const handleReject = (op: PendingOperation) => {
    if (!api) return;
    const tx = cancelMultisigTx(api, op.callHash, otherSignatories, op.when, op.threshold);
    runExtrinsic(op.callHash, tx, 'Operation cancelled successfully.');
  };

  if (loading) {
    return (
      <Card className="p-6 bg-gray-800/50 border-gray-700">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-gray-800/50 border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-blue-400" />
          <div>
            <h3 className="text-lg font-bold text-white">{t('multisigOps.title')}</h3>
            <p className="text-sm text-gray-400">
              {t('multisigOps.subtitle', { count: operations.length })}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="border-gray-700">
          <RefreshCw className="h-4 w-4 mr-2" />
          {t('multisigOps.refresh')}
        </Button>
      </div>

      {error && (
        <Alert className="mb-4 bg-red-900/20 border-red-500">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-4 bg-green-900/20 border-green-500">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {operations.length === 0 ? (
        <div className="text-center py-8 text-gray-400">{t('multisigOps.empty')}</div>
      ) : (
        <div className="space-y-4">
          {operations.map((op) => {
            const alreadyApproved = selectedAccount ? op.approvals.includes(selectedAccount.address) : false;
            const canReject = selectedAccount ? op.depositor === selectedAccount.address : false;
            const isProcessing = processingHash === op.callHash;

            return (
              <div key={op.callHash} className="p-4 bg-gray-900/30 rounded-lg space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-white">{op.description}</p>
                    <code className="text-xs text-gray-500 font-mono">
                      {op.callHash.slice(0, 10)}...{op.callHash.slice(-8)}
                    </code>
                  </div>
                  <Badge
                    variant={op.approvalsCount >= op.threshold ? 'default' : 'outline'}
                    className="whitespace-nowrap"
                  >
                    {op.approvalsCount}/{op.threshold} {t('multisigOps.approvals')}
                  </Badge>
                </div>

                <div className="text-xs text-gray-400 space-y-1">
                  <p>
                    {t('multisigOps.proposedBy')}:{' '}
                    <code className="font-mono">
                      {op.depositor.slice(0, 8)}...{op.depositor.slice(-6)}
                    </code>
                  </p>
                  {alreadyApproved && (
                    <p className="text-green-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> {t('multisigOps.youApproved')}
                    </p>
                  )}
                </div>

                {!op.resolvedCall && (
                  <div className="space-y-2">
                    <p className="text-xs text-yellow-500">{t('multisigOps.unknownCallHint')}</p>
                    <Textarea
                      placeholder={t('multisigOps.pasteCallData')}
                      value={manualCallData[op.callHash] ?? ''}
                      onChange={(e) =>
                        setManualCallData((prev) => ({ ...prev, [op.callHash]: e.target.value }))
                      }
                      className="bg-gray-800 border-gray-700 text-white text-xs font-mono"
                      rows={2}
                    />
                    {decodeErrors[op.callHash] && (
                      <p className="text-xs text-red-400">{decodeErrors[op.callHash]}</p>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDecode(op.callHash)}
                      disabled={!manualCallData[op.callHash]}
                    >
                      {t('multisigOps.decode')}
                    </Button>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleApprove(op)}
                    disabled={!op.resolvedCall || alreadyApproved || isProcessing || !selectedAccount}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    {t('multisigOps.approve')}
                  </Button>
                  {canReject && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleReject(op)}
                      disabled={isProcessing}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      {t('multisigOps.reject')}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Alert className="mt-6 bg-blue-900/20 border-blue-500">
        <Shield className="h-4 w-4" />
        <AlertDescription className="text-sm">
          {t('multisigOps.thresholdNote', {
            threshold: USDT_MULTISIG_CONFIG.threshold,
            total: USDT_MULTISIG_CONFIG.members.length,
          })}
        </AlertDescription>
      </Alert>

      {multisigAddress && (
        <p className="mt-4 text-xs text-gray-500 text-center font-mono">{multisigAddress}</p>
      )}
    </Card>
  );
};
