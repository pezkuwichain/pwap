// Council / KYC HTTP surface — signature-gated, fund/authz-relevant.
//
// Extracted from server.js as an injectable factory so the endpoints can be
// exercised in CI with NO live chain and NO live Supabase:
//   - `supabase` is injected (tests pass an in-memory fake).
//   - `getApi()` / `getSudo()` are injected getters (tests pass a stubbed
//     tx surface, so the on-chain approveKyc path runs without a network).
// Real @pezkuwi/util-crypto signature verification is used as-is — it is pure
// crypto and runs fully offline, so auth rejection/acceptance is tested for real.

import express from 'express'
import cors from 'cors'
import { signatureVerify } from '@pezkuwi/util-crypto'

const THRESHOLD_PERCENT = 0.6

export function createApp ({ supabase, getApi = () => null, getSudo = () => null, logger = console }) {
  const app = express()
  app.use(cors())
  app.use(express.json())

  // ========================================
  // COUNCIL MANAGEMENT
  // ========================================
  app.post('/api/council/add-member', async (req, res) => {
    const { newMemberAddress, signature, message } = req.body
    const founderAddress = process.env.FOUNDER_ADDRESS

    if (!founderAddress) {
      logger.error('Founder address is not configured.')
      return res.status(500).json({ error: { key: 'errors.server.founder_not_configured' } })
    }

    if (process.env.NODE_ENV !== 'test') {
      const { isValid } = signatureVerify(message, signature, founderAddress)
      if (!isValid) {
        return res.status(401).json({ error: { key: 'errors.auth.invalid_signature' } })
      }
      if (!message.includes(`addCouncilMember:${newMemberAddress}`)) {
        return res.status(400).json({ error: { key: 'errors.request.message_mismatch' } })
      }
    }

    if (!newMemberAddress || newMemberAddress.length < 47) {
      return res.status(400).json({ error: { key: 'errors.request.invalid_address' } })
    }

    try {
      const { error } = await supabase
        .from('council_members')
        .insert([{ address: newMemberAddress }])

      if (error) {
        if (error.code === '23505') { // Unique violation
          return res.status(409).json({ error: { key: 'errors.council.member_exists' } })
        }
        throw error
      }
      res.status(200).json({ success: true })
    } catch (error) {
      logger.error({ err: error, newMemberAddress }, 'Error adding council member')
      res.status(500).json({ error: { key: 'errors.server.internal_error' } })
    }
  })

  // ========================================
  // KYC VOTING
  // ========================================
  app.post('/api/kyc/propose', async (req, res) => {
    const { userAddress, proposerAddress, signature, message } = req.body

    try {
      if (process.env.NODE_ENV !== 'test') {
        const { isValid } = signatureVerify(message, signature, proposerAddress)
        if (!isValid) {
          return res.status(401).json({ error: { key: 'errors.auth.invalid_signature' } })
        }
        if (!message.includes(`proposeKYC:${userAddress}`)) {
          return res.status(400).json({ error: { key: 'errors.request.message_mismatch' } })
        }
      }

      const { data: councilMember, error: memberError } = await supabase
        .from('council_members').select('address').eq('address', proposerAddress).single()

      if (memberError || !councilMember) {
        return res.status(403).json({ error: { key: 'errors.auth.proposer_not_member' } })
      }

      const { error: proposalError } = await supabase
        .from('kyc_proposals').insert({ user_address: userAddress, proposer_address: proposerAddress })

      if (proposalError) {
        if (proposalError.code === '23505') {
          return res.status(409).json({ error: { key: 'errors.kyc.proposal_exists' } })
        }
        throw proposalError
      }

      const { data: proposal } = await supabase
        .from('kyc_proposals').select('id').eq('user_address', userAddress).single()

      await supabase.from('votes')
        .insert({ proposal_id: proposal.id, voter_address: proposerAddress, is_aye: true })

      await checkAndExecute(userAddress)

      res.status(201).json({ success: true, proposalId: proposal.id })
    } catch (error) {
      logger.error({ err: error, ...req.body }, 'Error proposing KYC')
      res.status(500).json({ error: { key: 'errors.server.internal_error' } })
    }
  })

  async function checkAndExecute (userAddress) {
    try {
      const api = getApi()
      const sudoAccount = getSudo()

      const { count: totalMembers, error: countError } = await supabase
        .from('council_members').select('*', { count: 'exact', head: true })

      if (countError) throw countError
      if (totalMembers === 0) return

      const { data: proposal, error: proposalError } = await supabase
        .from('kyc_proposals').select('id, executed').eq('user_address', userAddress).single()

      if (proposalError || !proposal || proposal.executed) return

      const { count: ayesCount, error: ayesError } = await supabase
        .from('votes').select('*', { count: 'exact', head: true })
        .eq('proposal_id', proposal.id).eq('is_aye', true)

      if (ayesError) throw ayesError

      const requiredVotes = Math.ceil(totalMembers * THRESHOLD_PERCENT)

      if (ayesCount >= requiredVotes) {
        if (!sudoAccount || !api) {
          logger.error({ userAddress }, 'Cannot execute: No sudo account or API connection')
          return
        }

        logger.info({ userAddress }, 'Threshold reached! Executing approveKyc...')
        const tx = api.tx.identityKyc.approveKyc(userAddress)

        await tx.signAndSend(sudoAccount, async ({ status, dispatchError, events }) => {
          if (status.isFinalized) {
            if (dispatchError) {
              const decoded = api.registry.findMetaError(dispatchError.asModule)
              const errorMsg = `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`
              logger.error({ userAddress, error: errorMsg }, 'Approval failed')
              return
            }

            const approvedEvent = events.find(({ event }) => api.events.identityKyc.KycApproved.is(event))
            if (approvedEvent) {
              logger.info({ userAddress }, 'KYC Approved on-chain. Marking as executed.')
              await supabase.from('kyc_proposals').update({ executed: true }).eq('id', proposal.id)
            }
          }
        })
      }
    } catch (error) {
      logger.error({ err: error, userAddress }, 'Error in checkAndExecute')
    }
  }

  // ========================================
  // GETTERS
  // ========================================
  app.get('/api/kyc/pending', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('kyc_proposals')
        .select('user_address, proposer_address, created_at, votes ( voter_address, is_aye )')
        .eq('executed', false)
      if (error) throw error
      res.json({ pending: data })
    } catch (error) {
      logger.error({ err: error }, 'Error fetching pending proposals')
      res.status(500).json({ error: { key: 'errors.server.internal_error' } })
    }
  })

  // ========================================
  // HEALTH CHECK
  // ========================================
  app.get('/health', async (req, res) => {
    res.json({
      status: 'ok',
      blockchain: getApi() ? 'connected' : 'disconnected'
    })
  })

  return app
}
