import React, { useCallback, useEffect, useState } from 'react';
import { web3Accounts } from '@pezkuwi/extension-dapp';
import type { InjectedAccountWithMeta } from '@pezkuwi/extension-inject/types';
import type { ApiPromise } from '@pezkuwi/api';
import {
  getMultisigMembers,
  calculateMultisigAddress,
  approveMultisigTx,
  cancelMultisigTx,
  isMultisigMember,
  USDT_MULTISIG_CONFIG,
} from '@pezkuwi/lib/multisig';
import {
  listPendingOperations,
  decodeAndVerifyCallData,
  type PendingOperation,
} from '@pezkuwi/lib/multisig-operations';
import { connectApi } from './lib/chain';
import { getSigner } from './lib/get-signer';
import { SIGNER_SETS, type SignerSet } from './signer-sets';

const PEX_MOM_URL = 'https://pex.mom';

interface OperationsPanelProps {
  api: ApiPromise;
  account: InjectedAccountWithMeta;
  signerSet: SignerSet;
}

function OperationsPanel({ api, account, signerSet }: OperationsPanelProps) {
  const [operations, setOperations] = useState<PendingOperation[]>([]);
  const [otherSignatories, setOtherSignatories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingHash, setProcessingHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [manualCallData, setManualCallData] = useState<Record<string, string>>({});
  const [decodeErrors, setDecodeErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const allMembers = await getMultisigMembers(api, signerSet.specificAddresses);
      const multisigAddr = calculateMultisigAddress(allMembers);
      setOtherSignatories(allMembers.filter((addr) => addr !== account.address));
      const ops = await listPendingOperations(api, multisigAddr);
      setOperations(ops);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pending operations');
    } finally {
      setLoading(false);
    }
  }, [api, account.address, signerSet]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDecode = (callHash: string) => {
    const hex = manualCallData[callHash];
    if (!hex) return;
    try {
      const { call, description } = decodeAndVerifyCallData(api, hex, callHash);
      setOperations((prev) =>
        prev.map((op) => (op.callHash === callHash ? { ...op, resolvedCall: call, description, isAutoMatched: false } : op))
      );
      setDecodeErrors((prev) => ({ ...prev, [callHash]: '' }));
    } catch (err) {
      setDecodeErrors((prev) => ({ ...prev, [callHash]: err instanceof Error ? err.message : 'Decode failed' }));
    }
  };

  const runExtrinsic = async (
    callHash: string,
    tx: ReturnType<typeof approveMultisigTx> | ReturnType<typeof cancelMultisigTx>,
    successMessage: string
  ) => {
    setProcessingHash(callHash);
    setError(null);
    setSuccess(null);
    try {
      const injector = await getSigner(account.address);
      await new Promise<void>((resolve, reject) => {
        tx.signAndSend(account.address, { signer: injector.signer }, ({ status, dispatchError }) => {
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
      setError(err instanceof Error ? err.message : 'Transaction failed');
    } finally {
      setProcessingHash(null);
    }
  };

  const handleApprove = (op: PendingOperation) => {
    if (!op.resolvedCall) return;
    const tx = approveMultisigTx(api, op.resolvedCall, otherSignatories, op.when, op.threshold);
    runExtrinsic(op.callHash, tx, 'Approval submitted successfully.');
  };

  const handleReject = (op: PendingOperation) => {
    const tx = cancelMultisigTx(api, op.callHash, otherSignatories, op.when, op.threshold);
    runExtrinsic(op.callHash, tx, 'Operation cancelled successfully.');
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>{signerSet.name}</h2>
        <button className="btn-outline" onClick={load} disabled={loading}>
          Refresh
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {loading ? (
        <div className="loading">Loading pending operations…</div>
      ) : operations.length === 0 ? (
        <div className="empty">No pending operations right now.</div>
      ) : (
        <div className="ops-list">
          {operations.map((op) => {
            const alreadyApproved = op.approvals.includes(account.address);
            const canReject = op.depositor === account.address;
            const isProcessing = processingHash === op.callHash;

            return (
              <div key={op.callHash} className="op-card">
                <div className="op-header">
                  <div>
                    <p className="op-desc">{op.description}</p>
                    <code className="op-hash">
                      {op.callHash.slice(0, 10)}…{op.callHash.slice(-8)}
                    </code>
                  </div>
                  <span className={`badge ${op.approvalsCount >= op.threshold ? 'badge-ready' : ''}`}>
                    {op.approvalsCount}/{op.threshold} approvals
                  </span>
                </div>

                <p className="op-meta">
                  Proposed by <code>{op.depositor.slice(0, 8)}…{op.depositor.slice(-6)}</code>
                </p>
                {alreadyApproved && <p className="op-approved">You already approved this operation</p>}

                {!op.resolvedCall && (
                  <div className="decode-box">
                    <p className="hint">This call couldn't be auto-identified from its hash alone - paste the known call data to decode and verify it.</p>
                    <textarea
                      placeholder="Paste call data (0x...)"
                      value={manualCallData[op.callHash] ?? ''}
                      onChange={(e) => setManualCallData((prev) => ({ ...prev, [op.callHash]: e.target.value }))}
                      rows={2}
                    />
                    {decodeErrors[op.callHash] && <p className="error-text">{decodeErrors[op.callHash]}</p>}
                    <button className="btn-outline" onClick={() => handleDecode(op.callHash)} disabled={!manualCallData[op.callHash]}>
                      Decode
                    </button>
                  </div>
                )}

                <div className="op-actions">
                  <button
                    className="btn-primary"
                    onClick={() => handleApprove(op)}
                    disabled={!op.resolvedCall || alreadyApproved || isProcessing}
                  >
                    {isProcessing ? 'Processing…' : 'Approve'}
                  </button>
                  {canReject && (
                    <button className="btn-danger" onClick={() => handleReject(op)} disabled={isProcessing}>
                      Reject
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="threshold-note">
        {USDT_MULTISIG_CONFIG.threshold} of {USDT_MULTISIG_CONFIG.members.length} signatures are required to execute any
        operation - no single signer, including this site, can move funds alone.
      </p>
    </section>
  );
}

export default function App() {
  const [api, setApi] = useState<ApiPromise | null>(null);
  const [apiReady, setApiReady] = useState(false);
  const [account, setAccount] = useState<InjectedAccountWithMeta | null>(null);
  const [accounts, setAccounts] = useState<InjectedAccountWithMeta[]>([]);
  const [authorizedSets, setAuthorizedSets] = useState<SignerSet[] | null>(null); // null = not checked yet
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  useEffect(() => {
    connectApi()
      .then((instance) => {
        setApi(instance);
        setApiReady(true);
      })
      .catch((err) => setConnectError(err instanceof Error ? err.message : 'Failed to connect to chain'));
  }, []);

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    setConnectError(null);
    try {
      const accs = await web3Accounts();
      if (accs.length === 0) {
        setConnectError(
          'No accounts found. Install a Pezkuwi/Substrate wallet extension, unlock it, and authorize this site.'
        );
        return;
      }
      setAccounts(accs);
      setAccount(accs[0]);
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : String(err));
    } finally {
      setConnecting(false);
    }
  }, []);

  // Gate: once a wallet is connected, check membership across every known signer set. Anyone
  // not authorized for at least one is bounced to pex.mom - this page has nothing to show them.
  useEffect(() => {
    if (!api || !apiReady || !account) return;
    let cancelled = false;

    Promise.all(SIGNER_SETS.map((set) => isMultisigMember(api, account.address, set.specificAddresses))).then(
      (results) => {
        if (cancelled) return;
        const matched = SIGNER_SETS.filter((_, i) => results[i]);
        if (matched.length === 0) {
          window.location.href = PEX_MOM_URL;
          return;
        }
        setAuthorizedSets(matched);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [api, apiReady, account]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>PezBridge Sign</h1>
        <p className="subtitle">Signing portal for PezkuwiChain multisig operations</p>
      </header>

      {connectError && <div className="alert alert-error">{connectError}</div>}

      {!account ? (
        <div className="connect-box">
          <p>Connect the wallet extension holding one of your authorized signer accounts.</p>
          <button className="btn-primary" onClick={handleConnect} disabled={connecting || !apiReady}>
            {connecting ? 'Connecting…' : !apiReady ? 'Connecting to chain…' : 'Connect Wallet'}
          </button>
        </div>
      ) : authorizedSets === null ? (
        <div className="loading">Verifying signer status on-chain…</div>
      ) : (
        <>
          {accounts.length > 1 && (
            <div className="account-switcher">
              <label htmlFor="account-select">Account:</label>
              <select
                id="account-select"
                value={account.address}
                onChange={(e) => {
                  const next = accounts.find((a) => a.address === e.target.value) ?? null;
                  setAccount(next);
                  setAuthorizedSets(null);
                }}
              >
                {accounts.map((a) => (
                  <option key={a.address} value={a.address}>
                    {a.meta.name ?? a.address}
                  </option>
                ))}
              </select>
            </div>
          )}
          {api &&
            authorizedSets.map((set) => <OperationsPanel key={set.name} api={api} account={account} signerSet={set} />)}
        </>
      )}
    </div>
  );
}
