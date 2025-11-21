use crate::{mock::*, Error, Event};
use frame_support::{assert_noop, assert_ok, traits::fungibles::Inspect};
use sp_runtime::traits::Zero;

#[test]
fn start_presale_works() {
    new_test_ext().execute_with(|| {
        // Start presale as root
        assert_ok!(Presale::start_presale(RuntimeOrigin::root()));

        // Check presale is active
        assert!(Presale::presale_active());

        // Check start block is set
        assert!(Presale::presale_start_block().is_some());

        // Check event
        System::assert_last_event(
            Event::PresaleStarted {
                end_block: 101, // Current block 1 + Duration 100
            }
            .into(),
        );
    });
}

#[test]
fn start_presale_already_started_fails() {
    new_test_ext().execute_with(|| {
        assert_ok!(Presale::start_presale(RuntimeOrigin::root()));

        // Try to start again
        assert_noop!(
            Presale::start_presale(RuntimeOrigin::root()),
            Error::<Test>::AlreadyStarted
        );
    });
}

#[test]
fn start_presale_non_root_fails() {
    new_test_ext().execute_with(|| {
        assert_noop!(
            Presale::start_presale(RuntimeOrigin::signed(1)),
            sp_runtime::DispatchError::BadOrigin
        );
    });
}

#[test]
fn contribute_works() {
    new_test_ext().execute_with(|| {
        create_assets();

        // Mint wUSDT to Alice
        mint_assets(2, 1, 1000_000_000); // 1000 wUSDT (6 decimals)

        // Start presale
        assert_ok!(Presale::start_presale(RuntimeOrigin::root()));

        // Alice contributes 100 wUSDT
        let contribution = 100_000_000; // 100 wUSDT
        assert_ok!(Presale::contribute(RuntimeOrigin::signed(1), contribution));

        // Check contribution tracked
        assert_eq!(Presale::contributions(1), contribution);

        // Check total raised
        assert_eq!(Presale::total_raised(), contribution);

        // Check contributors list
        let contributors = Presale::contributors();
        assert_eq!(contributors.len(), 1);
        assert_eq!(contributors[0], 1);

        // Check wUSDT transferred to treasury
        let treasury = treasury_account();
        let balance = Assets::balance(2, treasury);
        assert_eq!(balance, contribution);

        // Check event
        System::assert_last_event(
            Event::Contributed {
                who: 1,
                amount: contribution,
            }
            .into(),
        );
    });
}

#[test]
fn contribute_multiple_times_works() {
    new_test_ext().execute_with(|| {
        create_assets();
        mint_assets(2, 1, 1000_000_000);

        assert_ok!(Presale::start_presale(RuntimeOrigin::root()));

        // First contribution
        assert_ok!(Presale::contribute(RuntimeOrigin::signed(1), 50_000_000));
        assert_eq!(Presale::contributions(1), 50_000_000);

        // Second contribution
        assert_ok!(Presale::contribute(RuntimeOrigin::signed(1), 30_000_000));
        assert_eq!(Presale::contributions(1), 80_000_000);

        // Contributors list should still have only 1 entry
        assert_eq!(Presale::contributors().len(), 1);

        // Total raised should be sum
        assert_eq!(Presale::total_raised(), 80_000_000);
    });
}

#[test]
fn contribute_multiple_users_works() {
    new_test_ext().execute_with(|| {
        create_assets();
        mint_assets(2, 1, 1000_000_000); // Alice
        mint_assets(2, 2, 1000_000_000); // Bob

        assert_ok!(Presale::start_presale(RuntimeOrigin::root()));

        // Alice contributes
        assert_ok!(Presale::contribute(RuntimeOrigin::signed(1), 100_000_000));

        // Bob contributes
        assert_ok!(Presale::contribute(RuntimeOrigin::signed(2), 200_000_000));

        // Check individual contributions
        assert_eq!(Presale::contributions(1), 100_000_000);
        assert_eq!(Presale::contributions(2), 200_000_000);

        // Check total raised
        assert_eq!(Presale::total_raised(), 300_000_000);

        // Check contributors list
        assert_eq!(Presale::contributors().len(), 2);
    });
}

#[test]
fn contribute_presale_not_active_fails() {
    new_test_ext().execute_with(|| {
        create_assets();
        mint_assets(2, 1, 1000_000_000);

        // Try to contribute without starting presale
        assert_noop!(
            Presale::contribute(RuntimeOrigin::signed(1), 100_000_000),
            Error::<Test>::PresaleNotActive
        );
    });
}

#[test]
fn contribute_zero_amount_fails() {
    new_test_ext().execute_with(|| {
        create_assets();
        assert_ok!(Presale::start_presale(RuntimeOrigin::root()));

        assert_noop!(
            Presale::contribute(RuntimeOrigin::signed(1), 0),
            Error::<Test>::ZeroContribution
        );
    });
}

#[test]
fn contribute_after_presale_ended_fails() {
    new_test_ext().execute_with(|| {
        create_assets();
        mint_assets(2, 1, 1000_000_000);

        assert_ok!(Presale::start_presale(RuntimeOrigin::root()));

        // Move past presale end (block 1 + 100 = 101)
        System::set_block_number(102);

        assert_noop!(
            Presale::contribute(RuntimeOrigin::signed(1), 100_000_000),
            Error::<Test>::PresaleEnded
        );
    });
}

#[test]
fn contribute_while_paused_fails() {
    new_test_ext().execute_with(|| {
        create_assets();
        mint_assets(2, 1, 1000_000_000);

        assert_ok!(Presale::start_presale(RuntimeOrigin::root()));
        assert_ok!(Presale::emergency_pause(RuntimeOrigin::root()));

        assert_noop!(
            Presale::contribute(RuntimeOrigin::signed(1), 100_000_000),
            Error::<Test>::PresalePaused
        );
    });
}

#[test]
fn finalize_presale_works() {
    new_test_ext().execute_with(|| {
        create_assets();

        // Setup: Mint wUSDT to users and PEZ to treasury
        mint_assets(2, 1, 1000_000_000); // Alice: 1000 wUSDT
        mint_assets(2, 2, 1000_000_000); // Bob: 1000 wUSDT

        let treasury = treasury_account();
        mint_assets(1, treasury, 100_000_000_000_000_000_000); // Treasury: 100,000 PEZ

        // Start presale
        assert_ok!(Presale::start_presale(RuntimeOrigin::root()));

        // Alice contributes 100 wUSDT
        assert_ok!(Presale::contribute(RuntimeOrigin::signed(1), 100_000_000));

        // Bob contributes 200 wUSDT
        assert_ok!(Presale::contribute(RuntimeOrigin::signed(2), 200_000_000));

        // Move to end of presale
        System::set_block_number(101);

        // Finalize presale
        assert_ok!(Presale::finalize_presale(RuntimeOrigin::root()));

        // Check presale is no longer active
        assert!(!Presale::presale_active());

        // Check Alice received correct PEZ amount
        // 100 wUSDT = 10,000 PEZ
        // 10,000 * 1_000_000_000_000 = 10_000_000_000_000_000
        let alice_pez = Assets::balance(1, 1);
        assert_eq!(alice_pez, 10_000_000_000_000_000);

        // Check Bob received correct PEZ amount
        // 200 wUSDT = 20,000 PEZ
        let bob_pez = Assets::balance(1, 2);
        assert_eq!(bob_pez, 20_000_000_000_000_000);

        // Check finalize event
        System::assert_last_event(
            Event::PresaleFinalized {
                total_raised: 300_000_000,
            }
            .into(),
        );
    });
}

#[test]
fn finalize_presale_before_end_fails() {
    new_test_ext().execute_with(|| {
        create_assets();
        assert_ok!(Presale::start_presale(RuntimeOrigin::root()));

        // Try to finalize immediately
        assert_noop!(
            Presale::finalize_presale(RuntimeOrigin::root()),
            Error::<Test>::PresaleNotEnded
        );
    });
}

#[test]
fn finalize_presale_not_started_fails() {
    new_test_ext().execute_with(|| {
        assert_noop!(
            Presale::finalize_presale(RuntimeOrigin::root()),
            Error::<Test>::PresaleNotActive
        );
    });
}

#[test]
fn emergency_pause_works() {
    new_test_ext().execute_with(|| {
        assert_ok!(Presale::start_presale(RuntimeOrigin::root()));
        assert_ok!(Presale::emergency_pause(RuntimeOrigin::root()));

        assert!(Presale::paused());

        System::assert_last_event(Event::EmergencyPaused.into());
    });
}

#[test]
fn emergency_unpause_works() {
    new_test_ext().execute_with(|| {
        assert_ok!(Presale::start_presale(RuntimeOrigin::root()));
        assert_ok!(Presale::emergency_pause(RuntimeOrigin::root()));
        assert_ok!(Presale::emergency_unpause(RuntimeOrigin::root()));

        assert!(!Presale::paused());

        System::assert_last_event(Event::EmergencyUnpaused.into());
    });
}

#[test]
fn calculate_pez_correct() {
    new_test_ext().execute_with(|| {
        // Test calculation: 100 wUSDT = 10,000 PEZ
        // wUSDT amount: 100_000_000 (6 decimals)
        // Expected PEZ: 10_000_000_000_000_000 (12 decimals)

        let wusdt_amount = 100_000_000;
        let expected_pez = 10_000_000_000_000_000;

        let result = Presale::calculate_pez(wusdt_amount);
        assert_ok!(&result);
        assert_eq!(result.unwrap(), expected_pez);
    });
}

#[test]
fn get_time_remaining_works() {
    new_test_ext().execute_with(|| {
        // Before presale
        assert_eq!(Presale::get_time_remaining(), 0);

        // Start presale at block 1
        assert_ok!(Presale::start_presale(RuntimeOrigin::root()));

        // At block 1, should have 100 blocks remaining
        assert_eq!(Presale::get_time_remaining(), 100);

        // Move to block 50
        System::set_block_number(50);
        assert_eq!(Presale::get_time_remaining(), 51);

        // Move past end
        System::set_block_number(102);
        assert_eq!(Presale::get_time_remaining(), 0);
    });
}

#[test]
fn treasury_account_derivation_works() {
    new_test_ext().execute_with(|| {
        let treasury = treasury_account();

        // Treasury account should be deterministic from PalletId
        use sp_runtime::traits::AccountIdConversion;
        let expected = PresalePalletId::get().into_account_truncating();

        assert_eq!(treasury, expected);
    });
}
