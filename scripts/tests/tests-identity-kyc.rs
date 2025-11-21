use crate::{mock::*, Error, Event, PendingKycApplications};
use frame_support::{assert_noop, assert_ok, BoundedVec};
use sp_runtime::DispatchError;

// Kolay erişim için paletimize bir takma ad veriyoruz.
type IdentityKycPallet = crate::Pallet<Test>;

#[test]
fn set_identity_works() {
	new_test_ext().execute_with(|| {
		let user = 1;
		let name: BoundedVec<_, _> = b"Pezkuwi".to_vec().try_into().unwrap();
		let email: BoundedVec<_, _> = b"info@pezkuwi.com".to_vec().try_into().unwrap();

		assert_eq!(IdentityKycPallet::identity_of(user), None);

		assert_ok!(IdentityKycPallet::set_identity(
			RuntimeOrigin::signed(user),
			name.clone(),
			email.clone()
		));

		let stored_identity = IdentityKycPallet::identity_of(user).unwrap();
		assert_eq!(stored_identity.name, name);
		assert_eq!(stored_identity.email, email);

		System::assert_last_event(Event::IdentitySet { who: user }.into());
	});
}

#[test]
fn apply_for_kyc_works() {
	new_test_ext().execute_with(|| {
		let user = 1;
		let name: BoundedVec<_, _> = b"Pezkuwi".to_vec().try_into().unwrap();
		let email: BoundedVec<_, _> = b"info@pezkuwi.com".to_vec().try_into().unwrap();
		assert_ok!(IdentityKycPallet::set_identity(RuntimeOrigin::signed(user), name, email));

		let cids: BoundedVec<_, _> = vec![b"cid1".to_vec().try_into().unwrap()]
			.try_into()
			.unwrap();
		let notes: BoundedVec<_, _> = b"Application notes".to_vec().try_into().unwrap();

		assert_eq!(IdentityKycPallet::kyc_status_of(user), crate::KycLevel::NotStarted);
		assert_eq!(Balances::reserved_balance(user), 0);

		assert_ok!(IdentityKycPallet::apply_for_kyc(
			RuntimeOrigin::signed(user),
			cids.clone(),
			notes.clone()
		));

		assert_eq!(IdentityKycPallet::kyc_status_of(user), crate::KycLevel::Pending);
		let stored_app = IdentityKycPallet::pending_application_of(user).unwrap();
		assert_eq!(stored_app.cids, cids);
		assert_eq!(stored_app.notes, notes);
		assert_eq!(Balances::reserved_balance(user), KycApplicationDepositAmount::get());
		System::assert_last_event(Event::KycApplied { who: user }.into());
	});
}

#[test]
fn apply_for_kyc_fails_if_no_identity() {
	new_test_ext().execute_with(|| {
		let user = 1; // Bu kullanıcının kimliği hiç set edilmedi.
		let cids: BoundedVec<_, _> = vec![].try_into().unwrap();
		let notes: BoundedVec<_, _> = vec![].try_into().unwrap();

		assert_noop!(
			IdentityKycPallet::apply_for_kyc(RuntimeOrigin::signed(user), cids, notes),
			Error::<Test>::IdentityNotFound
		);
	});
}

#[test]
fn apply_for_kyc_fails_if_already_pending() {
	new_test_ext().execute_with(|| {
		let user = 1;
		// İlk başvuruyu yap
		assert_ok!(IdentityKycPallet::set_identity(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));
		assert_ok!(IdentityKycPallet::apply_for_kyc(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));

		// İkinci kez başvurmayı dene
		assert_noop!(
			IdentityKycPallet::apply_for_kyc(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()),
			Error::<Test>::KycApplicationAlreadyExists
		);
	});
}


#[test]
fn approve_kyc_works() {
	new_test_ext().execute_with(|| {
		let user = 1;
		// Başvuruyu yap
		assert_ok!(IdentityKycPallet::set_identity(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));
		assert_ok!(IdentityKycPallet::apply_for_kyc(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));
		assert_eq!(Balances::reserved_balance(user), KycApplicationDepositAmount::get());

		// Root olarak onayla
		assert_ok!(IdentityKycPallet::approve_kyc(RuntimeOrigin::root(), user));

		// Doğrulamalar
		assert_eq!(Balances::reserved_balance(user), 0);
		assert_eq!(IdentityKycPallet::pending_application_of(user), None);
		assert_eq!(IdentityKycPallet::kyc_status_of(user), crate::KycLevel::Approved);
		System::assert_last_event(Event::KycApproved { who: user }.into());
	});
}

#[test]
fn approve_kyc_fails_for_bad_origin() {
	new_test_ext().execute_with(|| {
		let user = 1;
		let non_root_user = 2;
		// Kurulum
		assert_ok!(IdentityKycPallet::set_identity(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));
		assert_ok!(IdentityKycPallet::apply_for_kyc(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));

		// Root olmayan kullanıcı onaylayamaz
		assert_noop!(
			IdentityKycPallet::approve_kyc(RuntimeOrigin::signed(non_root_user), user),
			DispatchError::BadOrigin
		);
	});
}

#[test]
fn revoke_kyc_works() {
	new_test_ext().execute_with(|| {
		let user = 1;
		// Kurulum: Başvur, onayla
		assert_ok!(IdentityKycPallet::set_identity(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));
		assert_ok!(IdentityKycPallet::apply_for_kyc(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));
		assert_ok!(IdentityKycPallet::approve_kyc(RuntimeOrigin::root(), user));
		assert_eq!(IdentityKycPallet::kyc_status_of(user), crate::KycLevel::Approved);

		// Eylem: Root olarak iptal et
		assert_ok!(IdentityKycPallet::revoke_kyc(RuntimeOrigin::root(), user));

		// Doğrulama
		assert_eq!(IdentityKycPallet::kyc_status_of(user), crate::KycLevel::Revoked);
		System::assert_last_event(Event::KycRevoked { who: user }.into());
	});
}

// ============================================================================
// reject_kyc Tests - CRITICAL: Previously completely untested
// ============================================================================

#[test]
fn reject_kyc_works() {
	new_test_ext().execute_with(|| {
		let user = 1;
		// Kurulum: Başvuru yap
		assert_ok!(IdentityKycPallet::set_identity(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));
		assert_ok!(IdentityKycPallet::apply_for_kyc(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));
		assert_eq!(Balances::reserved_balance(user), KycApplicationDepositAmount::get());

		// Eylem: Root olarak reddet
		assert_ok!(IdentityKycPallet::reject_kyc(RuntimeOrigin::root(), user));

		// Doğrulamalar
		assert_eq!(Balances::reserved_balance(user), 0); // Deposit iade edildi
		assert_eq!(IdentityKycPallet::pending_application_of(user), None); // Application temizlendi
		assert_eq!(IdentityKycPallet::kyc_status_of(user), crate::KycLevel::Rejected);
		System::assert_last_event(Event::KycRejected { who: user }.into());
	});
}

#[test]
fn reject_kyc_fails_for_bad_origin() {
	new_test_ext().execute_with(|| {
		let user = 1;
		let non_root_user = 2;
		// Kurulum
		assert_ok!(IdentityKycPallet::set_identity(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));
		assert_ok!(IdentityKycPallet::apply_for_kyc(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));

		// Root olmayan kullanıcı reddedeme
		assert_noop!(
			IdentityKycPallet::reject_kyc(RuntimeOrigin::signed(non_root_user), user),
			DispatchError::BadOrigin
		);
	});
}

#[test]
fn reject_kyc_fails_when_not_pending() {
	new_test_ext().execute_with(|| {
		let user = 1;
		// Kurulum: Henüz başvuru yok
		assert_ok!(IdentityKycPallet::set_identity(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));

		// NotStarted durumunda reddetme başarısız olmalı
		assert_noop!(
			IdentityKycPallet::reject_kyc(RuntimeOrigin::root(), user),
			Error::<Test>::CannotRejectKycInCurrentState
		);
	});
}

// ============================================================================
// set_identity Edge Cases
// ============================================================================

#[test]
fn set_identity_fails_if_already_exists() {
	new_test_ext().execute_with(|| {
		let user = 1;
		let name: BoundedVec<_, _> = b"Pezkuwi".to_vec().try_into().unwrap();
		let email: BoundedVec<_, _> = b"info@pezkuwi.com".to_vec().try_into().unwrap();

		// İlk set_identity başarılı
		assert_ok!(IdentityKycPallet::set_identity(
			RuntimeOrigin::signed(user),
			name.clone(),
			email.clone()
		));

		// İkinci set_identity başarısız olmalı
		assert_noop!(
			IdentityKycPallet::set_identity(
				RuntimeOrigin::signed(user),
				b"NewName".to_vec().try_into().unwrap(),
				b"new@email.com".to_vec().try_into().unwrap()
			),
			Error::<Test>::IdentityAlreadyExists
		);
	});
}

#[test]
fn set_identity_with_max_length_strings() {
	new_test_ext().execute_with(|| {
		let user = 1;
		// MaxStringLength = 50 (mock.rs'den)
		let max_name: BoundedVec<_, _> = vec![b'A'; 50].try_into().unwrap();
		let max_email: BoundedVec<_, _> = vec![b'B'; 50].try_into().unwrap();

		// Maksimum uzunlukta stringler kabul edilmeli
		assert_ok!(IdentityKycPallet::set_identity(
			RuntimeOrigin::signed(user),
			max_name.clone(),
			max_email.clone()
		));

		let stored_identity = IdentityKycPallet::identity_of(user).unwrap();
		assert_eq!(stored_identity.name, max_name);
		assert_eq!(stored_identity.email, max_email);
	});
}

// ============================================================================
// Deposit Handling Edge Cases
// ============================================================================

#[test]
fn apply_for_kyc_fails_insufficient_balance() {
	new_test_ext().execute_with(|| {
		let poor_user = 99; // Bu kullanıcının bakiyesi yok (mock'ta başlangıç bakiyesi verilmedi)

		// Önce identity set et
		assert_ok!(IdentityKycPallet::set_identity(
			RuntimeOrigin::signed(poor_user),
			vec![].try_into().unwrap(),
			vec![].try_into().unwrap()
		));

		// KYC başvurusu yetersiz bakiye nedeniyle başarısız olmalı
		assert_noop!(
			IdentityKycPallet::apply_for_kyc(
				RuntimeOrigin::signed(poor_user),
				vec![].try_into().unwrap(),
				vec![].try_into().unwrap()
			),
			pallet_balances::Error::<Test>::InsufficientBalance
		);
	});
}

// ============================================================================
// State Transition Tests - Re-application Scenarios
// ============================================================================

#[test]
fn reapply_after_rejection() {
	new_test_ext().execute_with(|| {
		let user = 1;

		// İlk başvuru
		assert_ok!(IdentityKycPallet::set_identity(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));
		assert_ok!(IdentityKycPallet::apply_for_kyc(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));
		assert_ok!(IdentityKycPallet::reject_kyc(RuntimeOrigin::root(), user));
		assert_eq!(IdentityKycPallet::kyc_status_of(user), crate::KycLevel::Rejected);

		// İkinci başvuru - Rejected durumundan tekrar başvuruda bulunmak mümkün DEĞİL
		// Çünkü apply_for_kyc sadece NotStarted durumunda çalışır
		assert_noop!(
			IdentityKycPallet::apply_for_kyc(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()),
			Error::<Test>::KycApplicationAlreadyExists
		);
	});
}

#[test]
fn reapply_after_revocation() {
	new_test_ext().execute_with(|| {
		let user = 1;

		// Başvur, onayla, iptal et
		assert_ok!(IdentityKycPallet::set_identity(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));
		assert_ok!(IdentityKycPallet::apply_for_kyc(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));
		assert_ok!(IdentityKycPallet::approve_kyc(RuntimeOrigin::root(), user));
		assert_ok!(IdentityKycPallet::revoke_kyc(RuntimeOrigin::root(), user));
		assert_eq!(IdentityKycPallet::kyc_status_of(user), crate::KycLevel::Revoked);

		// İptal edildikten sonra tekrar başvuru yapılamaz (durum Revoked)
		assert_noop!(
			IdentityKycPallet::apply_for_kyc(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()),
			Error::<Test>::KycApplicationAlreadyExists
		);
	});
}

// ============================================================================
// Hook Integration Tests
// ============================================================================

#[test]
fn approve_kyc_calls_hooks() {
	new_test_ext().execute_with(|| {
		let user = 1;
		// Kurulum
		assert_ok!(IdentityKycPallet::set_identity(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));
		assert_ok!(IdentityKycPallet::apply_for_kyc(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));

		// Onayla - bu OnKycApproved hook'unu ve CitizenNftProvider::mint_citizen_nft'yi çağırmalı
		assert_ok!(IdentityKycPallet::approve_kyc(RuntimeOrigin::root(), user));

		// Mock implementasyonlar başarılı olduğunda, KYC Approved durumunda olmalı
		assert_eq!(IdentityKycPallet::kyc_status_of(user), crate::KycLevel::Approved);
		System::assert_last_event(Event::KycApproved { who: user }.into());
	});
}

#[test]
fn multiple_users_kyc_flow() {
	new_test_ext().execute_with(|| {
		let user1 = 1;
		let user2 = 2;
		let user3 = 3;

		// User 1: Başvur ve onayla
		assert_ok!(IdentityKycPallet::set_identity(RuntimeOrigin::signed(user1), b"User1".to_vec().try_into().unwrap(), b"user1@test.com".to_vec().try_into().unwrap()));
		assert_ok!(IdentityKycPallet::apply_for_kyc(RuntimeOrigin::signed(user1), vec![].try_into().unwrap(), vec![].try_into().unwrap()));
		assert_ok!(IdentityKycPallet::approve_kyc(RuntimeOrigin::root(), user1));

		// User 2: Başvur ve reddet
		assert_ok!(IdentityKycPallet::set_identity(RuntimeOrigin::signed(user2), b"User2".to_vec().try_into().unwrap(), b"user2@test.com".to_vec().try_into().unwrap()));
		assert_ok!(IdentityKycPallet::apply_for_kyc(RuntimeOrigin::signed(user2), vec![].try_into().unwrap(), vec![].try_into().unwrap()));
		assert_ok!(IdentityKycPallet::reject_kyc(RuntimeOrigin::root(), user2));

		// User 3: Sadece identity set et, başvuru yapma
		assert_ok!(IdentityKycPallet::set_identity(RuntimeOrigin::signed(user3), b"User3".to_vec().try_into().unwrap(), b"user3@test.com".to_vec().try_into().unwrap()));

		// Doğrulamalar
		assert_eq!(IdentityKycPallet::kyc_status_of(user1), crate::KycLevel::Approved);
		assert_eq!(IdentityKycPallet::kyc_status_of(user2), crate::KycLevel::Rejected);
		assert_eq!(IdentityKycPallet::kyc_status_of(user3), crate::KycLevel::NotStarted);

		// Identity'ler hala mevcut olmalı
		assert!(IdentityKycPallet::identity_of(user1).is_some());
		assert!(IdentityKycPallet::identity_of(user2).is_some());
		assert!(IdentityKycPallet::identity_of(user3).is_some());

		// Pending applications temizlenmiş olmalı
		assert!(IdentityKycPallet::pending_application_of(user1).is_none());
		assert!(IdentityKycPallet::pending_application_of(user2).is_none());
		assert!(IdentityKycPallet::pending_application_of(user3).is_none());
	});
}

// ============================================================================
// confirm_citizenship Tests - Self-confirmation for Welati NFT
// ============================================================================

#[test]
fn confirm_citizenship_works() {
	new_test_ext().execute_with(|| {
		let user = 1;

		// Kurulum: Identity set et ve KYC başvurusu yap
		assert_ok!(IdentityKycPallet::set_identity(
			RuntimeOrigin::signed(user),
			vec![].try_into().unwrap(),
			vec![].try_into().unwrap()
		));
		assert_ok!(IdentityKycPallet::apply_for_kyc(
			RuntimeOrigin::signed(user),
			vec![].try_into().unwrap(),
			vec![].try_into().unwrap()
		));

		// Başlangıç durumunu doğrula
		assert_eq!(IdentityKycPallet::kyc_status_of(user), crate::KycLevel::Pending);
		assert_eq!(Balances::reserved_balance(user), KycApplicationDepositAmount::get());
		assert!(IdentityKycPallet::pending_application_of(user).is_some());

		// Eylem: Kullanıcı kendi vatandaşlığını onaylar (self-confirmation)
		assert_ok!(IdentityKycPallet::confirm_citizenship(RuntimeOrigin::signed(user)));

		// Doğrulamalar
		assert_eq!(IdentityKycPallet::kyc_status_of(user), crate::KycLevel::Approved);
		assert_eq!(Balances::reserved_balance(user), 0); // Deposit iade edildi
		assert_eq!(IdentityKycPallet::pending_application_of(user), None); // Application temizlendi
		System::assert_last_event(Event::CitizenshipConfirmed { who: user }.into());
	});
}

#[test]
fn confirm_citizenship_fails_when_not_pending() {
	new_test_ext().execute_with(|| {
		let user = 1;

		// Kurulum: Sadece identity set et, başvuru yapma
		assert_ok!(IdentityKycPallet::set_identity(
			RuntimeOrigin::signed(user),
			vec![].try_into().unwrap(),
			vec![].try_into().unwrap()
		));

		// NotStarted durumunda confirm_citizenship başarısız olmalı
		assert_noop!(
			IdentityKycPallet::confirm_citizenship(RuntimeOrigin::signed(user)),
			Error::<Test>::CannotConfirmInCurrentState
		);
	});
}

#[test]
fn confirm_citizenship_fails_when_already_approved() {
	new_test_ext().execute_with(|| {
		let user = 1;

		// Kurulum: Başvuru yap ve Root ile onayla
		assert_ok!(IdentityKycPallet::set_identity(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));
		assert_ok!(IdentityKycPallet::apply_for_kyc(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));
		assert_ok!(IdentityKycPallet::approve_kyc(RuntimeOrigin::root(), user));

		// Approved durumunda tekrar confirm_citizenship başarısız olmalı
		assert_noop!(
			IdentityKycPallet::confirm_citizenship(RuntimeOrigin::signed(user)),
			Error::<Test>::CannotConfirmInCurrentState
		);
	});
}

#[test]
fn confirm_citizenship_fails_when_no_pending_application() {
	new_test_ext().execute_with(|| {
		let user = 1;

		// Kurulum: Identity set et ve başvuru yap
		assert_ok!(IdentityKycPallet::set_identity(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));
		assert_ok!(IdentityKycPallet::apply_for_kyc(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));

		// Başvuruyu manuel olarak temizle (bu normalde olmamalı ama güvenlik kontrolü için)
		PendingKycApplications::<Test>::remove(user);

		// Pending application olmadan confirm_citizenship başarısız olmalı
		assert_noop!(
			IdentityKycPallet::confirm_citizenship(RuntimeOrigin::signed(user)),
			Error::<Test>::KycApplicationNotFound
		);
	});
}

#[test]
fn confirm_citizenship_calls_hooks() {
	new_test_ext().execute_with(|| {
		let user = 1;

		// Kurulum
		assert_ok!(IdentityKycPallet::set_identity(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));
		assert_ok!(IdentityKycPallet::apply_for_kyc(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));

		// Onayla - bu OnKycApproved hook'unu ve CitizenNftProvider::mint_citizen_nft_confirmed'i çağırmalı
		assert_ok!(IdentityKycPallet::confirm_citizenship(RuntimeOrigin::signed(user)));

		// Mock implementasyonlar başarılı olduğunda, KYC Approved durumunda olmalı
		assert_eq!(IdentityKycPallet::kyc_status_of(user), crate::KycLevel::Approved);
		System::assert_last_event(Event::CitizenshipConfirmed { who: user }.into());
	});
}

#[test]
fn confirm_citizenship_unreserves_deposit_correctly() {
	new_test_ext().execute_with(|| {
		let user = 1;
		let initial_balance = Balances::free_balance(user);

		// Başvuru yap
		assert_ok!(IdentityKycPallet::set_identity(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));
		assert_ok!(IdentityKycPallet::apply_for_kyc(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));

		assert_eq!(Balances::reserved_balance(user), KycApplicationDepositAmount::get());

		// Self-confirm
		assert_ok!(IdentityKycPallet::confirm_citizenship(RuntimeOrigin::signed(user)));

		// Deposit tamamen iade edildi
		assert_eq!(Balances::reserved_balance(user), 0);
		assert_eq!(Balances::free_balance(user), initial_balance);
	});
}

// ============================================================================
// renounce_citizenship Tests - Free exit from citizenship
// ============================================================================

#[test]
fn renounce_citizenship_works() {
	new_test_ext().execute_with(|| {
		let user = 1;

		// Kurulum: Vatandaş ol (başvur ve onayla)
		assert_ok!(IdentityKycPallet::set_identity(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));
		assert_ok!(IdentityKycPallet::apply_for_kyc(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));
		assert_ok!(IdentityKycPallet::confirm_citizenship(RuntimeOrigin::signed(user)));

		// Doğrula: Vatandaşlık onaylandı
		assert_eq!(IdentityKycPallet::kyc_status_of(user), crate::KycLevel::Approved);

		// Eylem: Vatandaşlıktan çık (renounce)
		assert_ok!(IdentityKycPallet::renounce_citizenship(RuntimeOrigin::signed(user)));

		// Doğrulamalar
		assert_eq!(IdentityKycPallet::kyc_status_of(user), crate::KycLevel::NotStarted); // Reset to NotStarted
		System::assert_last_event(Event::CitizenshipRenounced { who: user }.into());
	});
}

#[test]
fn renounce_citizenship_fails_when_not_citizen() {
	new_test_ext().execute_with(|| {
		let user = 1;

		// Kurulum: Sadece identity set et, vatandaş değil
		assert_ok!(IdentityKycPallet::set_identity(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));

		// NotStarted durumunda renounce başarısız olmalı
		assert_noop!(
			IdentityKycPallet::renounce_citizenship(RuntimeOrigin::signed(user)),
			Error::<Test>::NotACitizen
		);
	});
}

#[test]
fn renounce_citizenship_fails_when_pending() {
	new_test_ext().execute_with(|| {
		let user = 1;

		// Kurulum: Başvuru yap ama onaylanma
		assert_ok!(IdentityKycPallet::set_identity(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));
		assert_ok!(IdentityKycPallet::apply_for_kyc(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));

		// Pending durumunda renounce başarısız olmalı (henüz vatandaş değil)
		assert_noop!(
			IdentityKycPallet::renounce_citizenship(RuntimeOrigin::signed(user)),
			Error::<Test>::NotACitizen
		);
	});
}

#[test]
fn renounce_citizenship_fails_when_rejected() {
	new_test_ext().execute_with(|| {
		let user = 1;

		// Kurulum: Başvuru yap ve reddet
		assert_ok!(IdentityKycPallet::set_identity(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));
		assert_ok!(IdentityKycPallet::apply_for_kyc(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));
		assert_ok!(IdentityKycPallet::reject_kyc(RuntimeOrigin::root(), user));

		// Rejected durumunda renounce başarısız olmalı (zaten vatandaş değil)
		assert_noop!(
			IdentityKycPallet::renounce_citizenship(RuntimeOrigin::signed(user)),
			Error::<Test>::NotACitizen
		);
	});
}

#[test]
fn renounce_citizenship_calls_burn_hook() {
	new_test_ext().execute_with(|| {
		let user = 1;

		// Kurulum: Vatandaş ol
		assert_ok!(IdentityKycPallet::set_identity(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));
		assert_ok!(IdentityKycPallet::apply_for_kyc(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));
		assert_ok!(IdentityKycPallet::confirm_citizenship(RuntimeOrigin::signed(user)));

		// Renounce - bu CitizenNftProvider::burn_citizen_nft'yi çağırmalı
		assert_ok!(IdentityKycPallet::renounce_citizenship(RuntimeOrigin::signed(user)));

		// Mock implementasyon başarılı olduğunda, KYC NotStarted durumunda olmalı
		assert_eq!(IdentityKycPallet::kyc_status_of(user), crate::KycLevel::NotStarted);
		System::assert_last_event(Event::CitizenshipRenounced { who: user }.into());
	});
}

#[test]
fn renounce_citizenship_allows_reapplication() {
	new_test_ext().execute_with(|| {
		let user = 1;

		// İlk döngü: Vatandaş ol
		assert_ok!(IdentityKycPallet::set_identity(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));
		assert_ok!(IdentityKycPallet::apply_for_kyc(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));
		assert_ok!(IdentityKycPallet::confirm_citizenship(RuntimeOrigin::signed(user)));
		assert_eq!(IdentityKycPallet::kyc_status_of(user), crate::KycLevel::Approved);

		// Vatandaşlıktan çık
		assert_ok!(IdentityKycPallet::renounce_citizenship(RuntimeOrigin::signed(user)));
		assert_eq!(IdentityKycPallet::kyc_status_of(user), crate::KycLevel::NotStarted);

		// İkinci döngü: Tekrar başvur (özgür dünya - free world principle)
		assert_ok!(IdentityKycPallet::apply_for_kyc(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));
		assert_eq!(IdentityKycPallet::kyc_status_of(user), crate::KycLevel::Pending);

		// Tekrar onaylayabilmeli
		assert_ok!(IdentityKycPallet::confirm_citizenship(RuntimeOrigin::signed(user)));
		assert_eq!(IdentityKycPallet::kyc_status_of(user), crate::KycLevel::Approved);
	});
}

// ============================================================================
// Integration Tests - confirm_citizenship vs approve_kyc
// ============================================================================

#[test]
fn confirm_citizenship_and_approve_kyc_both_work() {
	new_test_ext().execute_with(|| {
		let user1 = 1; // Self-confirmation kullanacak
		let user2 = 2; // Admin approval kullanacak

		// User1: Self-confirmation
		assert_ok!(IdentityKycPallet::set_identity(RuntimeOrigin::signed(user1), b"User1".to_vec().try_into().unwrap(), b"user1@test.com".to_vec().try_into().unwrap()));
		assert_ok!(IdentityKycPallet::apply_for_kyc(RuntimeOrigin::signed(user1), vec![].try_into().unwrap(), vec![].try_into().unwrap()));
		assert_ok!(IdentityKycPallet::confirm_citizenship(RuntimeOrigin::signed(user1)));

		// User2: Admin approval
		assert_ok!(IdentityKycPallet::set_identity(RuntimeOrigin::signed(user2), b"User2".to_vec().try_into().unwrap(), b"user2@test.com".to_vec().try_into().unwrap()));
		assert_ok!(IdentityKycPallet::apply_for_kyc(RuntimeOrigin::signed(user2), vec![].try_into().unwrap(), vec![].try_into().unwrap()));
		assert_ok!(IdentityKycPallet::approve_kyc(RuntimeOrigin::root(), user2));

		// Her iki kullanıcı da Approved durumunda olmalı
		assert_eq!(IdentityKycPallet::kyc_status_of(user1), crate::KycLevel::Approved);
		assert_eq!(IdentityKycPallet::kyc_status_of(user2), crate::KycLevel::Approved);

		// Her ikisi de deposits iade edilmiş olmalı
		assert_eq!(Balances::reserved_balance(user1), 0);
		assert_eq!(Balances::reserved_balance(user2), 0);
	});
}

// ============================================================================
// Storage Consistency Tests
// ============================================================================

#[test]
fn storage_cleaned_on_rejection() {
	new_test_ext().execute_with(|| {
		let user = 1;
		let cids: BoundedVec<_, _> = vec![b"cid123".to_vec().try_into().unwrap()]
			.try_into()
			.unwrap();
		let notes: BoundedVec<_, _> = b"Test notes".to_vec().try_into().unwrap();

		// Başvuru yap
		assert_ok!(IdentityKycPallet::set_identity(RuntimeOrigin::signed(user), vec![].try_into().unwrap(), vec![].try_into().unwrap()));
		assert_ok!(IdentityKycPallet::apply_for_kyc(RuntimeOrigin::signed(user), cids.clone(), notes.clone()));

		// Başvuru storage'da olmalı
		assert!(IdentityKycPallet::pending_application_of(user).is_some());
		assert_eq!(IdentityKycPallet::kyc_status_of(user), crate::KycLevel::Pending);

		// Reddet
		assert_ok!(IdentityKycPallet::reject_kyc(RuntimeOrigin::root(), user));

		// Storage temizlenmiş olmalı
		assert_eq!(IdentityKycPallet::pending_application_of(user), None);
		assert_eq!(IdentityKycPallet::kyc_status_of(user), crate::KycLevel::Rejected);
		assert_eq!(Balances::reserved_balance(user), 0); // Deposit iade edildi

		// Identity hala mevcut olmalı (sadece başvuru temizlenir)
		assert!(IdentityKycPallet::identity_of(user).is_some());
	});
}