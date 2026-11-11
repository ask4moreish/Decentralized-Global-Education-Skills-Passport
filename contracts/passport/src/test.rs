#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, BytesN, Env, String, Symbol,
};

fn setup_test() -> (
    Env,
    Address,
    Address,
    Address,
    SkillsPassportContractClient<'static>,
) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(SkillsPassportContract, ());
    let client = SkillsPassportContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);
    let learner = Address::generate(&env);

    client.initialize(&admin);

    client.register_issuer(
        &issuer,
        &String::from_str(&env, "MIT Digital Credentials"),
        &String::from_str(&env, "https://mit.edu/credentials"),
    );

    (env, admin, issuer, learner, client)
}

#[test]
fn test_initialize_and_admin() {
    let (env, admin, _, _, client) = setup_test();
    assert_eq!(client.get_admin(), admin);

    let new_admin = Address::generate(&env);
    client.set_admin(&new_admin);
    assert_eq!(client.get_admin(), new_admin);
}

#[test]
fn test_register_and_deauthorize_issuer() {
    let (_env, _, issuer, _, client) = setup_test();
    assert!(client.is_issuer_authorized(&issuer));

    let issuer_record = client.get_issuer(&issuer).unwrap();
    assert_eq!(issuer_record.address, issuer);
    assert_eq!(issuer_record.is_active, true);

    client.deauthorize_issuer(&issuer);
    assert!(!client.is_issuer_authorized(&issuer));

    client.reactivate_issuer(&issuer);
    assert!(client.is_issuer_authorized(&issuer));
}

#[test]
fn test_scenario_1_and_2_issue_and_learner_view() {
    let (env, _, issuer, learner, client) = setup_test();

    let credential_id = BytesN::from_array(&env, &[1u8; 32]);
    let credential_hash = BytesN::from_array(&env, &[2u8; 32]);
    let template_id = Symbol::new(&env, "Degree");

    client.issue_credential(
        &issuer,
        &learner,
        &credential_id,
        &credential_hash,
        &template_id,
        &None,
    );

    let cred = client.get_credential(&credential_id).unwrap();
    assert_eq!(cred.issuer, issuer);
    assert_eq!(cred.recipient, learner);
    assert_eq!(cred.credential_hash, credential_hash);
    assert_eq!(cred.status, CredentialStatus::Active);
    assert_eq!(cred.expires_at, None);

    let learner_creds = client.get_learner_credentials(&learner);
    assert_eq!(learner_creds.len(), 1);
    assert_eq!(learner_creds.get(0).unwrap(), credential_id);
}

#[test]
fn test_scenario_3_employer_verify_valid() {
    let (env, _, issuer, learner, client) = setup_test();

    let credential_id = BytesN::from_array(&env, &[11u8; 32]);
    let credential_hash = BytesN::from_array(&env, &[22u8; 32]);
    let template_id = Symbol::new(&env, "Certificate");

    client.issue_credential(
        &issuer,
        &learner,
        &credential_id,
        &credential_hash,
        &template_id,
        &None,
    );

    let res = client.verify_credential(&credential_id, &credential_hash);
    assert!(res.is_valid);
    assert!(res.hash_matches);
    assert!(res.issuer_authorized);
    assert!(!res.is_expired);
    assert_eq!(res.status, CredentialStatus::Active);
    assert_eq!(res.issuer, issuer);
    assert_eq!(res.recipient, learner);
}

#[test]
fn test_scenario_4_tampered_credential_fails_verification() {
    let (env, _, issuer, learner, client) = setup_test();

    let credential_id = BytesN::from_array(&env, &[31u8; 32]);
    let credential_hash = BytesN::from_array(&env, &[32u8; 32]);
    let tampered_hash = BytesN::from_array(&env, &[99u8; 32]);
    let template_id = Symbol::new(&env, "SkillBadge");

    client.issue_credential(
        &issuer,
        &learner,
        &credential_id,
        &credential_hash,
        &template_id,
        &None,
    );

    let res = client.verify_credential(&credential_id, &tampered_hash);
    assert!(!res.is_valid);
    assert!(!res.hash_matches);
    assert!(res.issuer_authorized);
}

#[test]
fn test_scenario_5_unauthorized_issuer_cannot_issue() {
    let (env, _, _, learner, client) = setup_test();

    let rogue_issuer = Address::generate(&env);
    let credential_id = BytesN::from_array(&env, &[41u8; 32]);
    let credential_hash = BytesN::from_array(&env, &[42u8; 32]);
    let template_id = Symbol::new(&env, "Degree");

    let result = client.try_issue_credential(
        &rogue_issuer,
        &learner,
        &credential_id,
        &credential_hash,
        &template_id,
        &None,
    );

    assert_eq!(result, Err(Ok(PassportError::IssuerNotAuthorized)));
}

#[test]
fn test_scenario_6_revoked_credential_rejected() {
    let (env, _, issuer, learner, client) = setup_test();

    let credential_id = BytesN::from_array(&env, &[51u8; 32]);
    let credential_hash = BytesN::from_array(&env, &[52u8; 32]);
    let template_id = Symbol::new(&env, "Degree");

    client.issue_credential(
        &issuer,
        &learner,
        &credential_id,
        &credential_hash,
        &template_id,
        &None,
    );

    client.revoke_credential(
        &issuer,
        &credential_id,
        &String::from_str(&env, "Academic misconduct"),
    );

    let cred = client.get_credential(&credential_id).unwrap();
    assert_eq!(cred.status, CredentialStatus::Revoked);
    assert_eq!(
        cred.revocation_reason,
        Some(String::from_str(&env, "Academic misconduct"))
    );

    let res = client.verify_credential(&credential_id, &credential_hash);
    assert!(!res.is_valid);
    assert_eq!(res.status, CredentialStatus::Revoked);

    // Double revocation rejected
    let second_revocation = client.try_revoke_credential(
        &issuer,
        &credential_id,
        &String::from_str(&env, "Again"),
    );
    assert_eq!(
        second_revocation,
        Err(Ok(PassportError::CredentialAlreadyRevoked))
    );
}

#[test]
fn test_scenario_7_expired_credential_identified() {
    let (env, _, issuer, learner, client) = setup_test();

    env.ledger().set_timestamp(1000);

    let credential_id = BytesN::from_array(&env, &[61u8; 32]);
    let credential_hash = BytesN::from_array(&env, &[62u8; 32]);
    let template_id = Symbol::new(&env, "Certification");
    let expires_at = Some(2000);

    client.issue_credential(
        &issuer,
        &learner,
        &credential_id,
        &credential_hash,
        &template_id,
        &expires_at,
    );

    // Before expiry
    let res_active = client.verify_credential(&credential_id, &credential_hash);
    assert!(res_active.is_valid);
    assert!(!res_active.is_expired);

    // Advance time past expiry
    env.ledger().set_timestamp(2500);

    let res_expired = client.verify_credential(&credential_id, &credential_hash);
    assert!(!res_expired.is_valid);
    assert!(res_expired.is_expired);
}

#[test]
fn test_scenario_8_learner_selective_disclosure_isolation() {
    let (env, _, issuer, learner, client) = setup_test();

    let cred_1 = BytesN::from_array(&env, &[71u8; 32]);
    let cred_2 = BytesN::from_array(&env, &[72u8; 32]);
    let hash_1 = BytesN::from_array(&env, &[81u8; 32]);
    let hash_2 = BytesN::from_array(&env, &[82u8; 32]);

    client.issue_credential(
        &issuer,
        &learner,
        &cred_1,
        &hash_1,
        &Symbol::new(&env, "Course"),
        &None,
    );

    client.issue_credential(
        &issuer,
        &learner,
        &cred_2,
        &hash_2,
        &Symbol::new(&env, "Degree"),
        &None,
    );

    // Verifier with access only to cred_1 verifies cred_1 independently
    let res_1 = client.verify_credential(&cred_1, &hash_1);
    assert!(res_1.is_valid);
    assert_eq!(res_1.recipient, learner);

    // Verifier verifying cred_1 learns nothing about cred_2
    assert_ne!(cred_1, cred_2);
}

#[test]
fn test_suspension_and_reactivation_lifecycle() {
    let (env, _, issuer, learner, client) = setup_test();

    let credential_id = BytesN::from_array(&env, &[91u8; 32]);
    let credential_hash = BytesN::from_array(&env, &[92u8; 32]);

    client.issue_credential(
        &issuer,
        &learner,
        &credential_id,
        &credential_hash,
        &Symbol::new(&env, "SkillBadge"),
        &None,
    );

    // Suspend
    client.suspend_credential(
        &issuer,
        &credential_id,
        &String::from_str(&env, "Pending accreditation review"),
    );

    let res_suspended = client.verify_credential(&credential_id, &credential_hash);
    assert!(!res_suspended.is_valid);
    assert_eq!(res_suspended.status, CredentialStatus::Suspended);

    // Reactivate
    client.reactivate_credential(&issuer, &credential_id);

    let res_reactivated = client.verify_credential(&credential_id, &credential_hash);
    assert!(res_reactivated.is_valid);
    assert_eq!(res_reactivated.status, CredentialStatus::Active);
}

#[test]
fn test_unauthorized_party_cannot_revoke_or_suspend() {
    let (env, _, issuer, learner, client) = setup_test();

    let credential_id = BytesN::from_array(&env, &[101u8; 32]);
    let credential_hash = BytesN::from_array(&env, &[102u8; 32]);
    let malicious_party = Address::generate(&env);

    client.issue_credential(
        &issuer,
        &learner,
        &credential_id,
        &credential_hash,
        &Symbol::new(&env, "Degree"),
        &None,
    );

    let res = client.try_revoke_credential(
        &malicious_party,
        &credential_id,
        &String::from_str(&env, "Hack"),
    );
    assert_eq!(res, Err(Ok(PassportError::Unauthorized)));

    let res_suspend = client.try_suspend_credential(
        &malicious_party,
        &credential_id,
        &String::from_str(&env, "Hack"),
    );
    assert_eq!(res_suspend, Err(Ok(PassportError::Unauthorized)));
}

#[test]
fn test_duplicate_credential_id_rejected() {
    let (env, _, issuer, learner, client) = setup_test();

    let credential_id = BytesN::from_array(&env, &[111u8; 32]);
    let credential_hash = BytesN::from_array(&env, &[112u8; 32]);

    client.issue_credential(
        &issuer,
        &learner,
        &credential_id,
        &credential_hash,
        &Symbol::new(&env, "Certificate"),
        &None,
    );

    let dup = client.try_issue_credential(
        &issuer,
        &learner,
        &credential_id,
        &credential_hash,
        &Symbol::new(&env, "Certificate"),
        &None,
    );
    assert_eq!(dup, Err(Ok(PassportError::CredentialAlreadyExists)));
}

#[test]
fn test_deauthorized_issuer_invalidates_credentials() {
    let (env, _, issuer, learner, client) = setup_test();

    let credential_id = BytesN::from_array(&env, &[121u8; 32]);
    let credential_hash = BytesN::from_array(&env, &[122u8; 32]);

    client.issue_credential(
        &issuer,
        &learner,
        &credential_id,
        &credential_hash,
        &Symbol::new(&env, "Degree"),
        &None,
    );

    // Initial check: valid
    assert!(client.verify_credential(&credential_id, &credential_hash).is_valid);

    // Deauthorize institution
    client.deauthorize_issuer(&issuer);

    // Verification check: invalid because issuer is no longer authorized
    let res = client.verify_credential(&credential_id, &credential_hash);
    assert!(!res.is_valid);
    assert!(!res.issuer_authorized);
}

#[test]
fn test_update_issuer_metadata() {
    let (env, _, issuer, _, client) = setup_test();

    let new_name = String::from_str(&env, "MIT Center for Quantum & Blockchain Studies");
    let new_uri = String::from_str(&env, "https://mit.edu/quantum-creds");

    client.update_issuer_metadata(&issuer, &new_name, &new_uri);

    let updated = client.get_issuer(&issuer).unwrap();
    assert_eq!(updated.name, new_name);
    assert_eq!(updated.metadata_uri, new_uri);
}

#[test]
fn test_template_registration_and_lookup() {
    let (env, _, issuer, _, client) = setup_test();

    let template_id = Symbol::new(&env, "MScDegree");
    let name = String::from_str(&env, "Master of Science in Distributed Systems");
    let schema_uri = String::from_str(&env, "https://w3id.org/skills-passport/schemas/msc-v1.json");

    client.register_template(&issuer, &template_id, &name, &schema_uri);

    let tmpl = client.get_template(&template_id).unwrap();
    assert_eq!(tmpl.template_id, template_id);
    assert_eq!(tmpl.issuer, issuer);
    assert_eq!(tmpl.name, name);
    assert_eq!(tmpl.schema_uri, schema_uri);

    // Duplicate template registration rejected
    let dup = client.try_register_template(&issuer, &template_id, &name, &schema_uri);
    assert_eq!(dup, Err(Ok(PassportError::TemplateAlreadyExists)));
}

#[test]
fn test_batch_issue_credentials() {
    let (env, _, issuer, learner, client) = setup_test();

    let learner_2 = Address::generate(&env);
    let mut batch = Vec::new(&env);

    let cred_1 = BytesN::from_array(&env, &[131u8; 32]);
    let hash_1 = BytesN::from_array(&env, &[132u8; 32]);
    let cred_2 = BytesN::from_array(&env, &[133u8; 32]);
    let hash_2 = BytesN::from_array(&env, &[134u8; 32]);

    batch.push_back(BatchIssueItem {
        recipient: learner.clone(),
        credential_id: cred_1.clone(),
        credential_hash: hash_1.clone(),
        template_id: Symbol::new(&env, "BatchBSc"),
        expires_at: None,
    });

    batch.push_back(BatchIssueItem {
        recipient: learner_2.clone(),
        credential_id: cred_2.clone(),
        credential_hash: hash_2.clone(),
        template_id: Symbol::new(&env, "BatchBSc"),
        expires_at: None,
    });

    let count = client.batch_issue_credentials(&issuer, &batch);
    assert_eq!(count, 2);

    assert!(client.verify_credential(&cred_1, &hash_1).is_valid);
    assert!(client.verify_credential(&cred_2, &hash_2).is_valid);
    assert_eq!(client.get_learner_credentials(&learner).len(), 1);
    assert_eq!(client.get_learner_credentials(&learner_2).len(), 1);
}

#[test]
fn test_fast_status_query() {
    let (env, _, issuer, learner, client) = setup_test();

    let credential_id = BytesN::from_array(&env, &[141u8; 32]);
    let credential_hash = BytesN::from_array(&env, &[142u8; 32]);

    client.issue_credential(
        &issuer,
        &learner,
        &credential_id,
        &credential_hash,
        &Symbol::new(&env, "SkillBadge"),
        &None,
    );

    let (status, expires_at, reason) = client.get_credential_status(&credential_id);
    assert_eq!(status, CredentialStatus::Active);
    assert_eq!(expires_at, None);
    assert_eq!(reason, None);

    client.revoke_credential(
        &issuer,
        &credential_id,
        &String::from_str(&env, "Certificate rescinded"),
    );

    let (status_rev, _, reason_rev) = client.get_credential_status(&credential_id);
    assert_eq!(status_rev, CredentialStatus::Revoked);
    assert_eq!(reason_rev, Some(String::from_str(&env, "Certificate rescinded")));
}

#[test]
fn test_reactivate_revoked_credential_fails() {
    let (env, _, issuer, learner, client) = setup_test();

    let credential_id = BytesN::from_array(&env, &[151u8; 32]);
    let credential_hash = BytesN::from_array(&env, &[152u8; 32]);

    client.issue_credential(
        &issuer,
        &learner,
        &credential_id,
        &credential_hash,
        &Symbol::new(&env, "Degree"),
        &None,
    );

    client.revoke_credential(
        &issuer,
        &credential_id,
        &String::from_str(&env, "Rescinded permanently"),
    );

    // Attempting to reactivate a revoked credential must fail with CredentialNotSuspended
    let res = client.try_reactivate_credential(&issuer, &credential_id);
    assert_eq!(res, Err(Ok(PassportError::CredentialNotSuspended)));
}

#[test]
fn test_credential_substitution_attack() {
    let (env, _, issuer, learner, client) = setup_test();

    let victim_cred_id = BytesN::from_array(&env, &[161u8; 32]);
    let victim_hash = BytesN::from_array(&env, &[162u8; 32]);

    client.issue_credential(
        &issuer,
        &learner,
        &victim_cred_id,
        &victim_hash,
        &Symbol::new(&env, "BScCompSci"),
        &None,
    );

    // An attacker tries to substitute a fake claim hash or another learner's credential ID
    let attacker_fake_hash = BytesN::from_array(&env, &[163u8; 32]);
    let verify_res = client.verify_credential(&victim_cred_id, &attacker_fake_hash);

    assert!(!verify_res.is_valid);
    assert!(!verify_res.hash_matches);
    assert_eq!(verify_res.status, CredentialStatus::Active);
}

#[test]
fn test_uninitialized_and_double_initialize_rejected() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(SkillsPassportContract, ());
    let client = SkillsPassportContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);

    assert_eq!(client.try_get_admin(), Err(Ok(PassportError::NotInitialized)));
    assert_eq!(
        client.try_register_issuer(
            &issuer,
            &String::from_str(&env, "MIT"),
            &String::from_str(&env, "https://mit.edu"),
        ),
        Err(Ok(PassportError::NotInitialized))
    );

    client.initialize(&admin);
    assert_eq!(
        client.try_initialize(&admin),
        Err(Ok(PassportError::AlreadyInitialized))
    );
}

#[test]
#[should_panic]
fn test_register_issuer_panics_without_admin_auth() {
    use soroban_sdk::IntoVal;
    let env = Env::default();
    let contract_id = env.register(SkillsPassportContract, ());
    let client = SkillsPassportContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);

    // Explicitly authorize initialize only, then attempt register_issuer without admin auth
    env.mock_auths(&[soroban_sdk::testutils::MockAuth {
        address: &admin,
        invoke: &soroban_sdk::testutils::MockAuthInvoke {
            contract: &contract_id,
            fn_name: "initialize",
            args: soroban_sdk::vec![&env, admin.clone().into_val(&env)],
            sub_invokes: &[],
        },
    }]);
    client.initialize(&admin);

    // No mock auth provided -> must panic due to missing admin signature
    client.register_issuer(
        &issuer,
        &String::from_str(&env, "Rogue"),
        &String::from_str(&env, "https://rogue.example"),
    );
}

#[test]
#[should_panic]
fn test_issue_credential_panics_without_issuer_auth() {
    let env = Env::default();
    let contract_id = env.register(SkillsPassportContract, ());
    let client = SkillsPassportContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);
    let learner = Address::generate(&env);

    env.mock_all_auths();
    client.initialize(&admin);
    client.register_issuer(
        &issuer,
        &String::from_str(&env, "MIT"),
        &String::from_str(&env, "https://mit.edu"),
    );

    // Clear mocked auths by creating an empty auth list
    env.set_auths(&[]);
    client.issue_credential(
        &issuer,
        &learner,
        &BytesN::from_array(&env, &[1u8; 32]),
        &BytesN::from_array(&env, &[2u8; 32]),
        &Symbol::new(&env, "Degree"),
        &None,
    );
}

#[test]
fn test_input_validation_rejects_zero_ids_zero_hashes_self_issuance_and_empty_strings() {
    let (env, _, issuer, learner, client) = setup_test();
    env.ledger().set_timestamp(5_000);

    let zero = BytesN::from_array(&env, &[0u8; 32]);
    let valid_id = BytesN::from_array(&env, &[11u8; 32]);
    let valid_hash = BytesN::from_array(&env, &[22u8; 32]);
    let tmpl = Symbol::new(&env, "Degree");

    // Zero credential ID rejected
    assert_eq!(
        client.try_issue_credential(&issuer, &learner, &zero, &valid_hash, &tmpl, &None),
        Err(Ok(PassportError::InvalidInput))
    );
    // Zero credential hash rejected
    assert_eq!(
        client.try_issue_credential(&issuer, &learner, &valid_id, &zero, &tmpl, &None),
        Err(Ok(PassportError::InvalidInput))
    );
    // Self-issuance rejected
    assert_eq!(
        client.try_issue_credential(&issuer, &issuer, &valid_id, &valid_hash, &tmpl, &None),
        Err(Ok(PassportError::InvalidInput))
    );
    // Past or equal expiration rejected
    assert_eq!(
        client.try_issue_credential(&issuer, &learner, &valid_id, &valid_hash, &tmpl, &Some(5_000)),
        Err(Ok(PassportError::InvalidExpiration))
    );
    assert_eq!(
        client.try_issue_credential(&issuer, &learner, &valid_id, &valid_hash, &tmpl, &Some(4_999)),
        Err(Ok(PassportError::InvalidExpiration))
    );

    // Empty strings rejected on issuer/template/revoke/suspend
    let other_issuer = Address::generate(&env);
    assert_eq!(
        client.try_register_issuer(
            &other_issuer,
            &String::from_str(&env, ""),
            &String::from_str(&env, "https://x.edu"),
        ),
        Err(Ok(PassportError::InvalidInput))
    );
    assert_eq!(
        client.try_register_issuer(
            &other_issuer,
            &String::from_str(&env, "Uni"),
            &String::from_str(&env, ""),
        ),
        Err(Ok(PassportError::InvalidInput))
    );
    assert_eq!(
        client.try_register_template(
            &issuer,
            &Symbol::new(&env, "EmptyTmpl"),
            &String::from_str(&env, ""),
            &String::from_str(&env, "https://x.edu/s.json"),
        ),
        Err(Ok(PassportError::InvalidInput))
    );

    client.issue_credential(&issuer, &learner, &valid_id, &valid_hash, &tmpl, &None);
    assert_eq!(
        client.try_revoke_credential(&issuer, &valid_id, &String::from_str(&env, "")),
        Err(Ok(PassportError::InvalidInput))
    );
    assert_eq!(
        client.try_suspend_credential(&issuer, &valid_id, &String::from_str(&env, "")),
        Err(Ok(PassportError::InvalidInput))
    );
}

#[test]
fn test_batch_issue_limits_and_atomicity_rollback() {
    let (env, _, issuer, learner, client) = setup_test();
    env.ledger().set_timestamp(1_000);

    // Empty batch rejected
    let empty_batch = Vec::new(&env);
    assert_eq!(
        client.try_batch_issue_credentials(&issuer, &empty_batch),
        Err(Ok(PassportError::InvalidInput))
    );

    // Batch > MAX_BATCH_SIZE (50) rejected
    let mut oversized = Vec::new(&env);
    for i in 0u8..51u8 {
        let mut id_bytes = [0u8; 32];
        id_bytes[0] = i + 1;
        oversized.push_back(BatchIssueItem {
            recipient: learner.clone(),
            credential_id: BytesN::from_array(&env, &id_bytes),
            credential_hash: BytesN::from_array(&env, &[9u8; 32]),
            template_id: Symbol::new(&env, "Degree"),
            expires_at: None,
        });
    }
    assert_eq!(
        client.try_batch_issue_credentials(&issuer, &oversized),
        Err(Ok(PassportError::BatchTooLarge))
    );

    // Intra-batch duplicate ID: item 1 valid, item 2 duplicates item 1 -> entire batch must revert!
    let dup_id = BytesN::from_array(&env, &[77u8; 32]);
    let mut dup_batch = Vec::new(&env);
    dup_batch.push_back(BatchIssueItem {
        recipient: learner.clone(),
        credential_id: dup_id.clone(),
        credential_hash: BytesN::from_array(&env, &[88u8; 32]),
        template_id: Symbol::new(&env, "Degree"),
        expires_at: None,
    });
    dup_batch.push_back(BatchIssueItem {
        recipient: learner.clone(),
        credential_id: dup_id.clone(),
        credential_hash: BytesN::from_array(&env, &[89u8; 32]),
        template_id: Symbol::new(&env, "Degree"),
        expires_at: None,
    });
    assert_eq!(
        client.try_batch_issue_credentials(&issuer, &dup_batch),
        Err(Ok(PassportError::CredentialAlreadyExists))
    );
    assert_eq!(client.get_credential(&dup_id), None);
    assert_eq!(client.get_learner_credential_count(&learner), 0);

    // Mixed valid + expired item in batch -> atomic rollback leaves item 1 unstored
    let rollback_id = BytesN::from_array(&env, &[78u8; 32]);
    let mut mixed_batch = Vec::new(&env);
    mixed_batch.push_back(BatchIssueItem {
        recipient: learner.clone(),
        credential_id: rollback_id.clone(),
        credential_hash: BytesN::from_array(&env, &[88u8; 32]),
        template_id: Symbol::new(&env, "Degree"),
        expires_at: None,
    });
    mixed_batch.push_back(BatchIssueItem {
        recipient: learner.clone(),
        credential_id: BytesN::from_array(&env, &[79u8; 32]),
        credential_hash: BytesN::from_array(&env, &[89u8; 32]),
        template_id: Symbol::new(&env, "Degree"),
        expires_at: Some(500), // expired!
    });
    assert_eq!(
        client.try_batch_issue_credentials(&issuer, &mixed_batch),
        Err(Ok(PassportError::InvalidExpiration))
    );
    assert_eq!(client.get_credential(&rollback_id), None);
}

#[test]
fn test_deauthorized_issuer_cannot_issue_template_update_or_mutate_credentials() {
    let (env, admin, issuer, learner, client) = setup_test();
    let cred_id = BytesN::from_array(&env, &[201u8; 32]);
    let cred_hash = BytesN::from_array(&env, &[202u8; 32]);

    client.issue_credential(
        &issuer,
        &learner,
        &cred_id,
        &cred_hash,
        &Symbol::new(&env, "Degree"),
        &None,
    );

    client.deauthorize_issuer(&issuer);
    // Double deauthorize rejected
    assert_eq!(
        client.try_deauthorize_issuer(&issuer),
        Err(Ok(PassportError::IssuerAlreadyDeauthorized))
    );

    // Compromised/deauthorized issuer locked out from issuing, updating metadata, templates, suspending, revoking
    assert_eq!(
        client.try_issue_credential(
            &issuer,
            &learner,
            &BytesN::from_array(&env, &[203u8; 32]),
            &cred_hash,
            &Symbol::new(&env, "Degree"),
            &None,
        ),
        Err(Ok(PassportError::IssuerNotAuthorized))
    );
    assert_eq!(
        client.try_update_issuer_metadata(
            &issuer,
            &String::from_str(&env, "Hacked Name"),
            &String::from_str(&env, "https://evil.example"),
        ),
        Err(Ok(PassportError::IssuerNotAuthorized))
    );
    assert_eq!(
        client.try_register_template(
            &issuer,
            &Symbol::new(&env, "RogueTmpl"),
            &String::from_str(&env, "Rogue"),
            &String::from_str(&env, "https://evil.example/schema"),
        ),
        Err(Ok(PassportError::IssuerNotAuthorized))
    );
    assert_eq!(
        client.try_suspend_credential(&issuer, &cred_id, &String::from_str(&env, "Vandalism")),
        Err(Ok(PassportError::IssuerNotAuthorized))
    );
    assert_eq!(
        client.try_revoke_credential(&issuer, &cred_id, &String::from_str(&env, "Vandalism")),
        Err(Ok(PassportError::IssuerNotAuthorized))
    );

    // Contract admin CAN still suspend/revoke credentials of a deauthorized issuer
    client.suspend_credential(&admin, &cred_id, &String::from_str(&env, "Admin hold"));
    assert_eq!(
        client.try_reactivate_credential(&issuer, &cred_id),
        Err(Ok(PassportError::IssuerNotAuthorized))
    );
    client.revoke_credential(&admin, &cred_id, &String::from_str(&env, "Compromised issuer cleanup"));
    assert_eq!(
        client.get_credential(&cred_id).unwrap().status,
        CredentialStatus::Revoked
    );
}

#[test]
fn test_template_ownership_prevents_cross_issuer_spoofing() {
    let (env, _, issuer_a, learner, client) = setup_test();
    let issuer_b = Address::generate(&env);
    client.register_issuer(
        &issuer_b,
        &String::from_str(&env, "Other University"),
        &String::from_str(&env, "https://other.edu"),
    );

    let tmpl = Symbol::new(&env, "MITMSc");
    client.register_template(
        &issuer_a,
        &tmpl,
        &String::from_str(&env, "MIT MSc"),
        &String::from_str(&env, "https://mit.edu/schema.json"),
    );

    // Issuer B cannot issue using Issuer A's registered template
    assert_eq!(
        client.try_issue_credential(
            &issuer_b,
            &learner,
            &BytesN::from_array(&env, &[211u8; 32]),
            &BytesN::from_array(&env, &[212u8; 32]),
            &tmpl,
            &None,
        ),
        Err(Ok(PassportError::Unauthorized))
    );
}

#[test]
fn test_suspension_and_reactivation_edge_cases() {
    let (env, _, issuer, learner, client) = setup_test();
    env.ledger().set_timestamp(1_000);

    let cred_id = BytesN::from_array(&env, &[221u8; 32]);
    let cred_hash = BytesN::from_array(&env, &[222u8; 32]);
    client.issue_credential(
        &issuer,
        &learner,
        &cred_id,
        &cred_hash,
        &Symbol::new(&env, "Degree"),
        &Some(2_000),
    );

    // Cannot reactivate an Active credential
    assert_eq!(
        client.try_reactivate_credential(&issuer, &cred_id),
        Err(Ok(PassportError::CredentialNotSuspended))
    );

    client.suspend_credential(&issuer, &cred_id, &String::from_str(&env, "Audit"));
    // Double suspend rejected
    assert_eq!(
        client.try_suspend_credential(&issuer, &cred_id, &String::from_str(&env, "Again")),
        Err(Ok(PassportError::CredentialAlreadySuspended))
    );

    // Advance past expiration -> reactivating expired suspended credential must fail
    env.ledger().set_timestamp(2_000);
    assert_eq!(
        client.try_reactivate_credential(&issuer, &cred_id),
        Err(Ok(PassportError::InvalidExpiration))
    );

    // Missing credential ID returns CredentialNotFound
    let missing = BytesN::from_array(&env, &[229u8; 32]);
    assert_eq!(
        client.try_verify_credential(&missing, &cred_hash),
        Err(Ok(PassportError::CredentialNotFound))
    );
    assert_eq!(
        client.try_get_credential_status(&missing),
        Err(Ok(PassportError::CredentialNotFound))
    );
}

#[test]
fn test_two_step_admin_transfer_and_self_assignment_guard() {
    let (env, admin, _, _, client) = setup_test();
    let new_admin = Address::generate(&env);

    assert_eq!(
        client.try_set_admin(&admin),
        Err(Ok(PassportError::InvalidInput))
    );
    assert_eq!(
        client.try_propose_admin(&admin),
        Err(Ok(PassportError::InvalidInput))
    );
    assert_eq!(
        client.try_accept_admin(),
        Err(Ok(PassportError::NoPendingAdmin))
    );

    client.propose_admin(&new_admin);
    assert_eq!(client.get_pending_admin(), Some(new_admin.clone()));

    client.accept_admin();
    assert_eq!(client.get_admin(), new_admin);
    assert_eq!(client.get_pending_admin(), None);
}

#[test]
fn test_issuer_key_compromise_and_rotation_recovery() {
    let (env, _, old_issuer, learner, client) = setup_test();
    let new_issuer = Address::generate(&env);

    let old_cred_id = BytesN::from_array(&env, &[231u8; 32]);
    let old_hash = BytesN::from_array(&env, &[232u8; 32]);
    client.issue_credential(
        &old_issuer,
        &learner,
        &old_cred_id,
        &old_hash,
        &Symbol::new(&env, "Degree"),
        &None,
    );

    // Rotate compromised key to new_issuer
    client.rotate_issuer_key(&old_issuer, &new_issuer);

    assert!(!client.is_issuer_authorized(&old_issuer));
    assert!(client.is_issuer_authorized(&new_issuer));

    let new_rec = client.get_issuer(&new_issuer).unwrap();
    assert_eq!(new_rec.name, String::from_str(&env, "MIT Digital Credentials"));

    // Old key can no longer issue, and its unmigrated credential shows issuer_authorized = false
    assert!(!client.verify_credential(&old_cred_id, &old_hash).is_valid);
    assert_eq!(
        client.try_issue_credential(
            &old_issuer,
            &learner,
            &BytesN::from_array(&env, &[233u8; 32]),
            &old_hash,
            &Symbol::new(&env, "Degree"),
            &None,
        ),
        Err(Ok(PassportError::IssuerNotAuthorized))
    );

    // New rotated key can issue fresh replacement credentials
    let new_cred_id = BytesN::from_array(&env, &[234u8; 32]);
    let new_hash = BytesN::from_array(&env, &[235u8; 32]);
    client.issue_credential(
        &new_issuer,
        &learner,
        &new_cred_id,
        &new_hash,
        &Symbol::new(&env, "Degree"),
        &None,
    );
    assert!(client.verify_credential(&new_cred_id, &new_hash).is_valid);

    // Rotating to self or already-registered issuer fails
    assert_eq!(
        client.try_rotate_issuer_key(&new_issuer, &new_issuer),
        Err(Ok(PassportError::InvalidInput))
    );
    assert_eq!(
        client.try_rotate_issuer_key(&new_issuer, &old_issuer),
        Err(Ok(PassportError::IssuerAlreadyRegistered))
    );
}

#[test]
fn test_emergency_pause_circuit_breaker() {
    let (env, admin, issuer, learner, client) = setup_test();
    let cred_id = BytesN::from_array(&env, &[241u8; 32]);
    let cred_hash = BytesN::from_array(&env, &[242u8; 32]);

    client.issue_credential(
        &issuer,
        &learner,
        &cred_id,
        &cred_hash,
        &Symbol::new(&env, "Degree"),
        &None,
    );

    client.pause();
    assert!(client.is_paused());

    // Issuance & registration blocked while paused
    assert_eq!(
        client.try_issue_credential(
            &issuer,
            &learner,
            &BytesN::from_array(&env, &[243u8; 32]),
            &cred_hash,
            &Symbol::new(&env, "Degree"),
            &None,
        ),
        Err(Ok(PassportError::ContractPaused))
    );
    assert_eq!(
        client.try_register_issuer(
            &Address::generate(&env),
            &String::from_str(&env, "Paused Uni"),
            &String::from_str(&env, "https://paused.edu"),
        ),
        Err(Ok(PassportError::ContractPaused))
    );

    // Verification and emergency revocation STILL work while paused!
    assert!(client.verify_credential(&cred_id, &cred_hash).is_valid);
    client.revoke_credential(&admin, &cred_id, &String::from_str(&env, "Emergency revoke"));
    assert!(!client.verify_credential(&cred_id, &cred_hash).is_valid);

    client.unpause();
    assert!(!client.is_paused());
}

#[test]
fn test_learner_credentials_pagination() {
    let (env, _, issuer, learner, client) = setup_test();

    for i in 0u8..5u8 {
        let mut id = [0u8; 32];
        id[0] = 50 + i;
        client.issue_credential(
            &issuer,
            &learner,
            &BytesN::from_array(&env, &id),
            &BytesN::from_array(&env, &[99u8; 32]),
            &Symbol::new(&env, "SkillBadge"),
            &None,
        );
    }

    assert_eq!(client.get_learner_credential_count(&learner), 5);
    let page1 = client.get_learner_credentials_page(&learner, &0, &2);
    assert_eq!(page1.len(), 2);
    let page2 = client.get_learner_credentials_page(&learner, &2, &2);
    assert_eq!(page2.len(), 2);
    let page3 = client.get_learner_credentials_page(&learner, &4, &2);
    assert_eq!(page3.len(), 1);
    let empty_beyond = client.get_learner_credentials_page(&learner, &10, &2);
    assert_eq!(empty_beyond.len(), 0);

    // Invalid limits rejected
    assert_eq!(
        client.try_get_learner_credentials_page(&learner, &0, &0),
        Err(Ok(PassportError::InvalidInput))
    );
    assert_eq!(
        client.try_get_learner_credentials_page(&learner, &0, &101),
        Err(Ok(PassportError::InvalidInput))
    );
}

#[test]
fn test_errors_md_documents_every_variant() {
    extern crate std;
    let docs = include_str!("../ERRORS.md");
    let variants = [
        PassportError::NotInitialized,
        PassportError::AlreadyInitialized,
        PassportError::Unauthorized,
        PassportError::IssuerNotAuthorized,
        PassportError::CredentialAlreadyExists,
        PassportError::CredentialNotFound,
        PassportError::CredentialAlreadyRevoked,
        PassportError::CredentialNotSuspended,
        PassportError::InvalidExpiration,
        PassportError::IssuerAlreadyRegistered,
        PassportError::IssuerNotFound,
        PassportError::TemplateAlreadyExists,
        PassportError::TemplateNotFound,
        PassportError::InvalidInput,
        PassportError::BatchTooLarge,
        PassportError::CredentialAlreadySuspended,
        PassportError::ContractPaused,
        PassportError::NoPendingAdmin,
        PassportError::IssuerAlreadyDeauthorized,
        PassportError::IssuerAlreadyActive,
    ];
    for err in variants {
        let (code, name) = match err {
            PassportError::NotInitialized => (1, "NotInitialized"),
            PassportError::AlreadyInitialized => (2, "AlreadyInitialized"),
            PassportError::Unauthorized => (3, "Unauthorized"),
            PassportError::IssuerNotAuthorized => (4, "IssuerNotAuthorized"),
            PassportError::CredentialAlreadyExists => (5, "CredentialAlreadyExists"),
            PassportError::CredentialNotFound => (6, "CredentialNotFound"),
            PassportError::CredentialAlreadyRevoked => (7, "CredentialAlreadyRevoked"),
            PassportError::CredentialNotSuspended => (8, "CredentialNotSuspended"),
            PassportError::InvalidExpiration => (9, "InvalidExpiration"),
            PassportError::IssuerAlreadyRegistered => (10, "IssuerAlreadyRegistered"),
            PassportError::IssuerNotFound => (11, "IssuerNotFound"),
            PassportError::TemplateAlreadyExists => (12, "TemplateAlreadyExists"),
            PassportError::TemplateNotFound => (13, "TemplateNotFound"),
            PassportError::InvalidInput => (14, "InvalidInput"),
            PassportError::BatchTooLarge => (15, "BatchTooLarge"),
            PassportError::CredentialAlreadySuspended => (16, "CredentialAlreadySuspended"),
            PassportError::ContractPaused => (17, "ContractPaused"),
            PassportError::NoPendingAdmin => (18, "NoPendingAdmin"),
            PassportError::IssuerAlreadyDeauthorized => (19, "IssuerAlreadyDeauthorized"),
            PassportError::IssuerAlreadyActive => (20, "IssuerAlreadyActive"),
        };
        let row_marker = std::format!("| {} | `{}` |", code, name);
        assert!(
            docs.contains(&row_marker),
            "ERRORS.md missing documentation row for {}",
            name
        );
    }
}
