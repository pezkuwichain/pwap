//! pallet-staking-score için testler.

use crate::{mock::*, Error, Event, StakingScoreProvider, MONTH_IN_BLOCKS, UNITS};
use frame_support::{assert_noop, assert_ok};
use pallet_staking::RewardDestination;

// Testlerde kullanacağımız sabitler
const USER_STASH: AccountId = 10;
const USER_CONTROLLER: AccountId = 10;

#[test]
fn zero_stake_should_return_zero_score() {
	ExtBuilder::default().build_and_execute(|| {
		// ExtBuilder'da 10 numaralı hesap için bir staker oluşturmadık.
		// Bu nedenle, palet 0 puan vermelidir.
		assert_eq!(StakingScore::get_staking_score(&USER_STASH).0, 0);
	});
}

#[test]
fn score_is_calculated_correctly_without_time_tracking() {
	ExtBuilder::default()
		.build_and_execute(|| {
			// 50 HEZ stake edelim. Staking::bond çağrısı ile stake işlemini başlat.
			assert_ok!(Staking::bond(
				RuntimeOrigin::signed(USER_STASH),
				50 * UNITS,
				RewardDestination::Staked
			));

			// Süre takibi yokken, puan sadece miktara göre hesaplanmalı (20 puan).
			assert_eq!(StakingScore::get_staking_score(&USER_STASH).0, 20);
		});
}

#[test]
fn start_score_tracking_works_and_enables_duration_multiplier() {
	ExtBuilder::default()
		.build_and_execute(|| {
			// --- 1. Kurulum ve Başlangıç ---
			let initial_block = 10;
			System::set_block_number(initial_block);

			// 500 HEZ stake edelim. Bu, 40 temel puan demektir.
			assert_ok!(Staking::bond(
				RuntimeOrigin::signed(USER_STASH),
				500 * UNITS,
				RewardDestination::Staked
			));

			// Eylem: Süre takibini başlat. Depolamaya `10` yazılacak.
			assert_ok!(StakingScore::start_score_tracking(RuntimeOrigin::signed(USER_STASH)));

			// Doğrulama: Başlangıç puanı doğru mu?
			assert_eq!(StakingScore::get_staking_score(&USER_STASH).0, 40, "Initial score should be 40");

			// --- 2. Dört Ay Sonrası ---
			let target_block_4m = initial_block + (4 * MONTH_IN_BLOCKS) as u64;
			let expected_duration_4m = target_block_4m - initial_block;
			// Eylem: Zamanı 4 ay ileri "yaşat".
			System::set_block_number(target_block_4m);

			let (score_4m, duration_4m) = StakingScore::get_staking_score(&USER_STASH);
			assert_eq!(duration_4m, expected_duration_4m, "Duration after 4 months is wrong");
			assert_eq!(score_4m, 56, "Score after 4 months should be 56");

			// --- 3. On Üç Ay Sonrası ---
			let target_block_13m = initial_block + (13 * MONTH_IN_BLOCKS) as u64;
			let expected_duration_13m = target_block_13m - initial_block;
			// Eylem: Zamanı başlangıçtan 13 ay sonrasına "yaşat".
			System::set_block_number(target_block_13m);

			let (score_13m, duration_13m) = StakingScore::get_staking_score(&USER_STASH);
			assert_eq!(duration_13m, expected_duration_13m, "Duration after 13 months is wrong");
			assert_eq!(score_13m, 80, "Score after 13 months should be 80");
		});
}

#[test]
fn get_staking_score_works_without_explicit_tracking() {
    ExtBuilder::default().build_and_execute(|| {
		// 751 HEZ stake edelim. Bu, 50 temel puan demektir.
		assert_ok!(Staking::bond(
			RuntimeOrigin::signed(USER_STASH),
			751 * UNITS,
			RewardDestination::Staked
		));

        // Puanın 50 olmasını bekliyoruz.
        assert_eq!(StakingScore::get_staking_score(&USER_STASH).0, 50);

        // Zamanı ne kadar ileri alırsak alalım, `start_score_tracking` çağrılmadığı
        // için puan değişmemeli.
        System::set_block_number(1_000_000_000);
        assert_eq!(StakingScore::get_staking_score(&USER_STASH).0, 50);
    });
}

// ============================================================================
// Amount-Based Scoring Edge Cases (4 tests)
// ============================================================================

#[test]
fn amount_score_boundary_100_hez() {
	ExtBuilder::default().build_and_execute(|| {
		// Exactly 100 HEZ should give 20 points
		assert_ok!(Staking::bond(
			RuntimeOrigin::signed(USER_STASH),
			100 * UNITS,
			RewardDestination::Staked
		));

		assert_eq!(StakingScore::get_staking_score(&USER_STASH).0, 20);
	});
}

#[test]
fn amount_score_boundary_250_hez() {
	ExtBuilder::default().build_and_execute(|| {
		// Exactly 250 HEZ should give 30 points
		assert_ok!(Staking::bond(
			RuntimeOrigin::signed(USER_STASH),
			250 * UNITS,
			RewardDestination::Staked
		));

		assert_eq!(StakingScore::get_staking_score(&USER_STASH).0, 30);
	});
}

#[test]
fn amount_score_boundary_750_hez() {
	ExtBuilder::default().build_and_execute(|| {
		// Exactly 750 HEZ should give 40 points
		assert_ok!(Staking::bond(
			RuntimeOrigin::signed(USER_STASH),
			750 * UNITS,
			RewardDestination::Staked
		));

		assert_eq!(StakingScore::get_staking_score(&USER_STASH).0, 40);
	});
}

#[test]
fn score_capped_at_100() {
	ExtBuilder::default().build_and_execute(|| {
		// Stake maximum amount and advance time to get maximum multiplier
		assert_ok!(Staking::bond(
			RuntimeOrigin::signed(USER_STASH),
			1000 * UNITS, // 50 base points
			RewardDestination::Staked
		));

		assert_ok!(StakingScore::start_score_tracking(RuntimeOrigin::signed(USER_STASH)));

		// Advance 12+ months to get 2.0x multiplier
		System::set_block_number((12 * MONTH_IN_BLOCKS + 1) as u64);

		// 50 * 2.0 = 100, should be capped at 100
		let (score, _) = StakingScore::get_staking_score(&USER_STASH);
		assert_eq!(score, 100);
	});
}

// ============================================================================
// Duration Multiplier Tests (3 tests)
// ============================================================================

#[test]
fn duration_multiplier_1_month() {
	ExtBuilder::default().build_and_execute(|| {
		assert_ok!(Staking::bond(
			RuntimeOrigin::signed(USER_STASH),
			500 * UNITS, // 40 base points
			RewardDestination::Staked
		));

		assert_ok!(StakingScore::start_score_tracking(RuntimeOrigin::signed(USER_STASH)));

		// Advance 1 month
		System::set_block_number((1 * MONTH_IN_BLOCKS + 1) as u64);

		// 40 * 1.2 = 48
		let (score, _) = StakingScore::get_staking_score(&USER_STASH);
		assert_eq!(score, 48);
	});
}

#[test]
fn duration_multiplier_6_months() {
	ExtBuilder::default().build_and_execute(|| {
		assert_ok!(Staking::bond(
			RuntimeOrigin::signed(USER_STASH),
			500 * UNITS, // 40 base points
			RewardDestination::Staked
		));

		assert_ok!(StakingScore::start_score_tracking(RuntimeOrigin::signed(USER_STASH)));

		// Advance 6 months
		System::set_block_number((6 * MONTH_IN_BLOCKS + 1) as u64);

		// 40 * 1.7 = 68
		let (score, _) = StakingScore::get_staking_score(&USER_STASH);
		assert_eq!(score, 68);
	});
}

#[test]
fn duration_multiplier_progression() {
	ExtBuilder::default().build_and_execute(|| {
		let base_block = 100;
		System::set_block_number(base_block);

		assert_ok!(Staking::bond(
			RuntimeOrigin::signed(USER_STASH),
			100 * UNITS, // 20 base points
			RewardDestination::Staked
		));

		assert_ok!(StakingScore::start_score_tracking(RuntimeOrigin::signed(USER_STASH)));

		// Start: 20 * 1.0 = 20
		assert_eq!(StakingScore::get_staking_score(&USER_STASH).0, 20);

		// After 3 months: 20 * 1.4 = 28
		System::set_block_number(base_block + (3 * MONTH_IN_BLOCKS) as u64);
		assert_eq!(StakingScore::get_staking_score(&USER_STASH).0, 28);

		// After 12 months: 20 * 2.0 = 40
		System::set_block_number(base_block + (12 * MONTH_IN_BLOCKS) as u64);
		assert_eq!(StakingScore::get_staking_score(&USER_STASH).0, 40);
	});
}

// ============================================================================
// start_score_tracking Extrinsic Tests (3 tests)
// ============================================================================

#[test]
fn start_tracking_fails_without_stake() {
	ExtBuilder::default().build_and_execute(|| {
		// Try to start tracking without any stake
		assert_noop!(
			StakingScore::start_score_tracking(RuntimeOrigin::signed(USER_STASH)),
			Error::<Test>::NoStakeFound
		);
	});
}

#[test]
fn start_tracking_fails_if_already_started() {
	ExtBuilder::default().build_and_execute(|| {
		assert_ok!(Staking::bond(
			RuntimeOrigin::signed(USER_STASH),
			100 * UNITS,
			RewardDestination::Staked
		));

		// First call succeeds
		assert_ok!(StakingScore::start_score_tracking(RuntimeOrigin::signed(USER_STASH)));

		// Second call fails
		assert_noop!(
			StakingScore::start_score_tracking(RuntimeOrigin::signed(USER_STASH)),
			Error::<Test>::TrackingAlreadyStarted
		);
	});
}

#[test]
fn start_tracking_emits_event() {
	ExtBuilder::default().build_and_execute(|| {
		System::set_block_number(1);

		assert_ok!(Staking::bond(
			RuntimeOrigin::signed(USER_STASH),
			100 * UNITS,
			RewardDestination::Staked
		));

		assert_ok!(StakingScore::start_score_tracking(RuntimeOrigin::signed(USER_STASH)));

		// Check event was emitted
		let events = System::events();
		assert!(events.iter().any(|event| {
			matches!(
				event.event,
				RuntimeEvent::StakingScore(Event::ScoreTrackingStarted { .. })
			)
		}));
	});
}

// ============================================================================
// Edge Cases and Integration (2 tests)
// ============================================================================

#[test]
fn multiple_users_independent_scores() {
	ExtBuilder::default().build_and_execute(|| {
		// Use USER_STASH (10) and account 11 which have pre-allocated balances
		let user1 = USER_STASH; // Account 10
		let user2 = 11; // Account 11 (already has stake in mock)

		// User1: Add new stake, no tracking
		assert_ok!(Staking::bond(
			RuntimeOrigin::signed(user1),
			100 * UNITS,
			RewardDestination::Staked
		));

		// User2 already has stake from mock (100 HEZ)
		// Start tracking for user2
		assert_ok!(StakingScore::start_score_tracking(RuntimeOrigin::signed(user2)));

		// User1 should have base score of 20 (100 HEZ)
		assert_eq!(StakingScore::get_staking_score(&user1).0, 20);

		// User2 should have base score of 20 (100 HEZ from mock)
		assert_eq!(StakingScore::get_staking_score(&user2).0, 20);

		// Advance time
		System::set_block_number((3 * MONTH_IN_BLOCKS) as u64);

		// User1 score unchanged (no tracking)
		assert_eq!(StakingScore::get_staking_score(&user1).0, 20);

		// User2 score increased (20 * 1.4 = 28)
		assert_eq!(StakingScore::get_staking_score(&user2).0, 28);
	});
}

#[test]
fn duration_returned_correctly() {
	ExtBuilder::default().build_and_execute(|| {
		let start_block = 100;
		System::set_block_number(start_block);

		assert_ok!(Staking::bond(
			RuntimeOrigin::signed(USER_STASH),
			100 * UNITS,
			RewardDestination::Staked
		));

		// Without tracking, duration should be 0
		let (_, duration) = StakingScore::get_staking_score(&USER_STASH);
		assert_eq!(duration, 0);

		assert_ok!(StakingScore::start_score_tracking(RuntimeOrigin::signed(USER_STASH)));

		// After 5 months
		let target_block = start_block + (5 * MONTH_IN_BLOCKS) as u64;
		System::set_block_number(target_block);

		let (_, duration) = StakingScore::get_staking_score(&USER_STASH);
		assert_eq!(duration, target_block - start_block);
	});
}