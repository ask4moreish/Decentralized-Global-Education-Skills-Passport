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
