use super::*;
use crate::{mock::*, Error, Event, ReferralCount, PendingReferrals};
use pallet_identity_kyc::types::OnKycApproved;
use frame_support::{assert_noop, assert_ok};
use sp_runtime::DispatchError;

type ReferralPallet = Pallet<Test>;

#[test]
fn initiate_referral_works() {
	new_test_ext().execute_with(|| {
		// Action: User 1 invites user 2.
		assert_ok!(ReferralPallet::initiate_referral(RuntimeOrigin::signed(1), 2));

		// Verification: Correct record is added to pending referrals list.
		assert_eq!(ReferralPallet::pending_referrals(2), Some(1));
		// Correct event is emitted.
		System::assert_last_event(Event::ReferralInitiated { referrer: 1, referred: 2 }.into());
	});
}

#[test]
fn initiate_referral_fails_for_self_referral() {
	new_test_ext().execute_with(|| {
		// Action & Verification: User cannot invite themselves.
		assert_noop!(
			ReferralPallet::initiate_referral(RuntimeOrigin::signed(1), 1),
			Error::<Test>::SelfReferral
		);
	});
}

#[test]
fn initiate_referral_fails_if_already_referred() {
	new_test_ext().execute_with(|| {
		// Setup: User 2 has already been invited by user 1.
		assert_ok!(ReferralPallet::initiate_referral(RuntimeOrigin::signed(1), 2));

		// Action & Verification: User 3 cannot invite user 2 who is already invited.
		assert_noop!(
			ReferralPallet::initiate_referral(RuntimeOrigin::signed(3), 2),
			Error::<Test>::AlreadyReferred
		);
	});
}

#[test]
fn on_kyc_approved_hook_works_when_referral_exists() {
	new_test_ext().execute_with(|| {
		// Setup: User 1 invites user 2.
		let referrer = 1;
		let referred = 2;

		// Most important step for test scenario: Create pending referral!
		assert_ok!(ReferralPallet::initiate_referral(RuntimeOrigin::signed(referrer), referred));

		// Preparing mock to behave as if KYC is approved.
		// Actually our mock always returns Approved, so this step isn't necessary,
		// but in real scenario we would set up state like this.
		// IdentityKyc::set_kyc_status_for_account(referred, KycLevel::Approved);

		// Set user's KYC as approved before action.
		pallet_identity_kyc::KycStatuses::<Test>::insert(referred, pallet_identity_kyc::types::KycLevel::Approved);

		// Action: KYC pallet notifies that user 2's KYC has been approved.
		ReferralPallet::on_kyc_approved(&referred);

		// Verification
		// 1. Pending referral record is deleted.
		assert_eq!(PendingReferrals::<Test>::get(referred), None);
		// 2. Referrer's referral count increases by 1.
		assert_eq!(ReferralCount::<Test>::get(referrer), 1);
		// 3. Permanent referral information is created.
		assert!(Referrals::<Test>::contains_key(referred));
		let referral_info = Referrals::<Test>::get(referred).unwrap();
		assert_eq!(referral_info.referrer, referrer);
		// 4. Correct event is emitted.
		System::assert_last_event(
			Event::ReferralConfirmed { referrer, referred, new_referrer_count: 1 }.into(),
		);
	});
}

#[test]
fn on_kyc_approved_hook_does_nothing_when_no_referral() {
	new_test_ext().execute_with(|| {
		// Setup: No referral status exists.
		let user_without_referral = 5;

		// Action: KYC approval comes.
		ReferralPallet::on_kyc_approved(&user_without_referral);

		// Verification: No storage changes and no events are emitted.
		// (For simplicity, we can check event count)
		assert_eq!(ReferralCount::<Test>::iter().count(), 0);
		assert_eq!(Referrals::<Test>::iter().count(), 0);
	});
}

// ============================================================================
// Referral Score Calculation Tests (4 tests)
// ============================================================================

#[test]
fn referral_score_tier_0_to_10() {
	use crate::types::ReferralScoreProvider;

	new_test_ext().execute_with(|| {
		let referrer = 1;

		// 0 referrals = 0 score
		assert_eq!(ReferralPallet::get_referral_score(&referrer), 0);

		// Simulate 1 referral
		ReferralCount::<Test>::insert(&referrer, 1);
		assert_eq!(ReferralPallet::get_referral_score(&referrer), 10); // 1 * 10

		// 5 referrals = 50 score
		ReferralCount::<Test>::insert(&referrer, 5);
		assert_eq!(ReferralPallet::get_referral_score(&referrer), 50); // 5 * 10

		// 10 referrals = 100 score
		ReferralCount::<Test>::insert(&referrer, 10);
		assert_eq!(ReferralPallet::get_referral_score(&referrer), 100); // 10 * 10
	});
}

#[test]
fn referral_score_tier_11_to_50() {
	use crate::types::ReferralScoreProvider;

	new_test_ext().execute_with(|| {
		let referrer = 1;

		// 11 referrals: 100 + (1 * 5) = 105
		ReferralCount::<Test>::insert(&referrer, 11);
		assert_eq!(ReferralPallet::get_referral_score(&referrer), 105);

		// 20 referrals: 100 + (10 * 5) = 150
		ReferralCount::<Test>::insert(&referrer, 20);
		assert_eq!(ReferralPallet::get_referral_score(&referrer), 150);

		// 50 referrals: 100 + (40 * 5) = 300
		ReferralCount::<Test>::insert(&referrer, 50);
		assert_eq!(ReferralPallet::get_referral_score(&referrer), 300);
	});
}

#[test]
fn referral_score_tier_51_to_100() {
	use crate::types::ReferralScoreProvider;

	new_test_ext().execute_with(|| {
		let referrer = 1;

		// 51 referrals: 300 + (1 * 4) = 304
		ReferralCount::<Test>::insert(&referrer, 51);
		assert_eq!(ReferralPallet::get_referral_score(&referrer), 304);

		// 75 referrals: 300 + (25 * 4) = 400
		ReferralCount::<Test>::insert(&referrer, 75);
		assert_eq!(ReferralPallet::get_referral_score(&referrer), 400);

		// 100 referrals: 300 + (50 * 4) = 500
		ReferralCount::<Test>::insert(&referrer, 100);
		assert_eq!(ReferralPallet::get_referral_score(&referrer), 500);
	});
}

#[test]
fn referral_score_capped_at_500() {
	use crate::types::ReferralScoreProvider;

	new_test_ext().execute_with(|| {
		let referrer = 1;

		// 101+ referrals capped at 500
		ReferralCount::<Test>::insert(&referrer, 101);
		assert_eq!(ReferralPallet::get_referral_score(&referrer), 500);

		// Even 200 referrals = 500
		ReferralCount::<Test>::insert(&referrer, 200);
		assert_eq!(ReferralPallet::get_referral_score(&referrer), 500);

		// Even 1000 referrals = 500
		ReferralCount::<Test>::insert(&referrer, 1000);
		assert_eq!(ReferralPallet::get_referral_score(&referrer), 500);
	});
}

// ============================================================================
// InviterProvider Trait Tests (2 tests)
// ============================================================================

#[test]
fn get_inviter_returns_correct_referrer() {
	use crate::types::InviterProvider;

	new_test_ext().execute_with(|| {
		let referrer = 1;
		let referred = 2;

		// Setup referral
		assert_ok!(ReferralPallet::initiate_referral(RuntimeOrigin::signed(referrer), referred));
		pallet_identity_kyc::KycStatuses::<Test>::insert(referred, pallet_identity_kyc::types::KycLevel::Approved);
		ReferralPallet::on_kyc_approved(&referred);

		// Verify InviterProvider trait
		let inviter = ReferralPallet::get_inviter(&referred);
		assert_eq!(inviter, Some(referrer));
	});
}

#[test]
fn get_inviter_returns_none_for_non_referred() {
	use crate::types::InviterProvider;

	new_test_ext().execute_with(|| {
		let user_without_referral = 99;

		// User was not referred by anyone
		let inviter = ReferralPallet::get_inviter(&user_without_referral);
		assert_eq!(inviter, None);
	});
}

// ============================================================================
// Edge Cases and Storage Tests (3 tests)
// ============================================================================

#[test]
fn multiple_referrals_for_same_referrer() {
	new_test_ext().execute_with(|| {
		let referrer = 1;
		let referred1 = 2;
		let referred2 = 3;
		let referred3 = 4;

		// Setup multiple referrals
		assert_ok!(ReferralPallet::initiate_referral(RuntimeOrigin::signed(referrer), referred1));
		assert_ok!(ReferralPallet::initiate_referral(RuntimeOrigin::signed(referrer), referred2));
		assert_ok!(ReferralPallet::initiate_referral(RuntimeOrigin::signed(referrer), referred3));

		// Approve all KYCs
		pallet_identity_kyc::KycStatuses::<Test>::insert(referred1, pallet_identity_kyc::types::KycLevel::Approved);
		pallet_identity_kyc::KycStatuses::<Test>::insert(referred2, pallet_identity_kyc::types::KycLevel::Approved);
		pallet_identity_kyc::KycStatuses::<Test>::insert(referred3, pallet_identity_kyc::types::KycLevel::Approved);

		ReferralPallet::on_kyc_approved(&referred1);
		ReferralPallet::on_kyc_approved(&referred2);
		ReferralPallet::on_kyc_approved(&referred3);

		// Verify count
		assert_eq!(ReferralCount::<Test>::get(referrer), 3);
	});
}

#[test]
fn referral_info_stores_block_number() {
	new_test_ext().execute_with(|| {
		let referrer = 1;
		let referred = 2;
		let block_number = 42;

		System::set_block_number(block_number);

		assert_ok!(ReferralPallet::initiate_referral(RuntimeOrigin::signed(referrer), referred));
		pallet_identity_kyc::KycStatuses::<Test>::insert(referred, pallet_identity_kyc::types::KycLevel::Approved);
		ReferralPallet::on_kyc_approved(&referred);

		// Verify stored block number
		let info = Referrals::<Test>::get(referred).unwrap();
		assert_eq!(info.created_at, block_number);
		assert_eq!(info.referrer, referrer);
	});
}

#[test]
fn events_emitted_correctly() {
	new_test_ext().execute_with(|| {
		System::set_block_number(1);

		let referrer = 1;
		let referred = 2;

		// Initiate referral - should emit ReferralInitiated
		assert_ok!(ReferralPallet::initiate_referral(RuntimeOrigin::signed(referrer), referred));

		let events = System::events();
		assert!(events.iter().any(|e| matches!(
			e.event,
			RuntimeEvent::Referral(Event::ReferralInitiated { .. })
		)));

		// Approve KYC - should emit ReferralConfirmed
		pallet_identity_kyc::KycStatuses::<Test>::insert(referred, pallet_identity_kyc::types::KycLevel::Approved);
		ReferralPallet::on_kyc_approved(&referred);

		let events = System::events();
		assert!(events.iter().any(|e| matches!(
			e.event,
			RuntimeEvent::Referral(Event::ReferralConfirmed { .. })
		)));
	});
}

// ============================================================================
// Integration Tests (2 tests)
// ============================================================================

#[test]
fn complete_referral_flow_integration() {
	use crate::types::{InviterProvider, ReferralScoreProvider};

	new_test_ext().execute_with(|| {
		let referrer = 1;
		let referred = 2;

		// Step 1: Initiate referral
		assert_ok!(ReferralPallet::initiate_referral(RuntimeOrigin::signed(referrer), referred));
		assert_eq!(PendingReferrals::<Test>::get(referred), Some(referrer));

		// Step 2: KYC approval triggers confirmation
		pallet_identity_kyc::KycStatuses::<Test>::insert(referred, pallet_identity_kyc::types::KycLevel::Approved);
		ReferralPallet::on_kyc_approved(&referred);

		// Step 3: Verify all storage updates
		assert_eq!(PendingReferrals::<Test>::get(referred), None);
		assert_eq!(ReferralCount::<Test>::get(referrer), 1);
		assert!(Referrals::<Test>::contains_key(referred));

		// Step 4: Verify trait implementations
		assert_eq!(ReferralPallet::get_inviter(&referred), Some(referrer));
		assert_eq!(ReferralPallet::get_referral_score(&referrer), 10); // 1 * 10
	});
}

#[test]
fn storage_consistency_multiple_operations() {
	new_test_ext().execute_with(|| {
		let referrer1 = 1;
		let referrer2 = 2;
		let referred1 = 10;
		let referred2 = 11;
		let referred3 = 12;

		// Referrer1 refers 2 people
		assert_ok!(ReferralPallet::initiate_referral(RuntimeOrigin::signed(referrer1), referred1));
		assert_ok!(ReferralPallet::initiate_referral(RuntimeOrigin::signed(referrer1), referred2));

		// Referrer2 refers 1 person
		assert_ok!(ReferralPallet::initiate_referral(RuntimeOrigin::signed(referrer2), referred3));

		// Approve all
		pallet_identity_kyc::KycStatuses::<Test>::insert(referred1, pallet_identity_kyc::types::KycLevel::Approved);
		pallet_identity_kyc::KycStatuses::<Test>::insert(referred2, pallet_identity_kyc::types::KycLevel::Approved);
		pallet_identity_kyc::KycStatuses::<Test>::insert(referred3, pallet_identity_kyc::types::KycLevel::Approved);

		ReferralPallet::on_kyc_approved(&referred1);
		ReferralPallet::on_kyc_approved(&referred2);
		ReferralPallet::on_kyc_approved(&referred3);

		// Verify independent counts
		assert_eq!(ReferralCount::<Test>::get(referrer1), 2);
		assert_eq!(ReferralCount::<Test>::get(referrer2), 1);

		// Verify all referrals stored
		assert!(Referrals::<Test>::contains_key(referred1));
		assert!(Referrals::<Test>::contains_key(referred2));
		assert!(Referrals::<Test>::contains_key(referred3));

		// Verify correct referrer stored
		assert_eq!(Referrals::<Test>::get(referred1).unwrap().referrer, referrer1);
		assert_eq!(Referrals::<Test>::get(referred2).unwrap().referrer, referrer1);
		assert_eq!(Referrals::<Test>::get(referred3).unwrap().referrer, referrer2);
	});
}

// ============================================================================
// Force Confirm Referral Tests (3 tests)
// ============================================================================

#[test]
fn force_confirm_referral_works() {
	use crate::types::{InviterProvider, ReferralScoreProvider};

	new_test_ext().execute_with(|| {
		let referrer = 1;
		let referred = 2;

		// Force confirm referral (sudo-only)
		assert_ok!(ReferralPallet::force_confirm_referral(
			RuntimeOrigin::root(),
			referrer,
			referred
		));

		// Verify storage updates
		assert_eq!(ReferralCount::<Test>::get(referrer), 1);
		assert!(Referrals::<Test>::contains_key(referred));
		assert_eq!(Referrals::<Test>::get(referred).unwrap().referrer, referrer);

		// Verify trait implementations
		assert_eq!(ReferralPallet::get_inviter(&referred), Some(referrer));
		assert_eq!(ReferralPallet::get_referral_score(&referrer), 10); // 1 * 10
	});
}

#[test]
fn force_confirm_referral_requires_root() {
	new_test_ext().execute_with(|| {
		let referrer = 1;
		let referred = 2;

		// Non-root origin should fail
		assert_noop!(
			ReferralPallet::force_confirm_referral(
				RuntimeOrigin::signed(referrer),
				referrer,
				referred
			),
			DispatchError::BadOrigin
		);
	});
}

#[test]
fn force_confirm_referral_prevents_self_referral() {
	new_test_ext().execute_with(|| {
		let user = 1;

		// Self-referral should fail
		assert_noop!(
			ReferralPallet::force_confirm_referral(
				RuntimeOrigin::root(),
				user,
				user
			),
			Error::<Test>::SelfReferral
		);
	});
}

#[test]
fn force_confirm_referral_prevents_duplicate() {
	new_test_ext().execute_with(|| {
		let referrer = 1;
		let referred = 2;

		// First force confirm succeeds
		assert_ok!(ReferralPallet::force_confirm_referral(
			RuntimeOrigin::root(),
			referrer,
			referred
		));

		// Second force confirm for same referred should fail
		assert_noop!(
			ReferralPallet::force_confirm_referral(
				RuntimeOrigin::root(),
				referrer,
				referred
			),
			Error::<Test>::AlreadyReferred
		);
	});
}

#[test]
fn force_confirm_referral_removes_pending() {
	new_test_ext().execute_with(|| {
		let referrer = 1;
		let referred = 2;

		// Setup pending referral first
		assert_ok!(ReferralPallet::initiate_referral(RuntimeOrigin::signed(referrer), referred));
		assert_eq!(PendingReferrals::<Test>::get(referred), Some(referrer));

		// Force confirm should remove pending
		assert_ok!(ReferralPallet::force_confirm_referral(
			RuntimeOrigin::root(),
			referrer,
			referred
		));

		assert_eq!(PendingReferrals::<Test>::get(referred), None);
		assert_eq!(ReferralCount::<Test>::get(referrer), 1);
	});
}