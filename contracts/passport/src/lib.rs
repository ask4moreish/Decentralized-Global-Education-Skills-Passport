#![no_std]

pub mod storage;
pub mod types;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, String, Symbol, Vec};
use types::{
    BatchIssueItem, CredentialRecord, CredentialStatus, IssuerRecord, PassportError,
    TemplateRecord, VerificationResult,
};

pub const MAX_BATCH_SIZE: u32 = 50;
pub const MAX_NAME_LEN: u32 = 256;
pub const MAX_URI_LEN: u32 = 512;
pub const MAX_REASON_LEN: u32 = 512;
pub const MAX_PAGE_LIMIT: u32 = 100;

fn require_not_paused(env: &Env) -> Result<(), PassportError> {
    if storage::is_paused(env) {
        return Err(PassportError::ContractPaused);
    }
    Ok(())
}

fn require_non_empty_bounded(s: &String, max_len: u32) -> Result<(), PassportError> {
    let len = s.len();
    if len == 0 || len > max_len {
        return Err(PassportError::InvalidInput);
    }
    Ok(())
}

fn is_zero_bytes32(env: &Env, val: &BytesN<32>) -> bool {
    let zero = BytesN::from_array(env, &[0u8; 32]);
    val == &zero
}

fn require_lifecycle_caller(
    env: &Env,
    caller: &Address,
    record: &CredentialRecord,
) -> Result<(), PassportError> {
    let admin = storage::get_admin(env)?;
    if caller != &admin {
        if caller != &record.issuer {
            return Err(PassportError::Unauthorized);
        }
        if !storage::is_issuer_authorized(env, caller) {
            return Err(PassportError::IssuerNotAuthorized);
        }
    }
    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn validate_issue_item(
    env: &Env,
    issuer: &Address,
    recipient: &Address,
    credential_id: &BytesN<32>,
    credential_hash: &BytesN<32>,
    template_id: &Symbol,
    expires_at: Option<u64>,
    now: u64,
) -> Result<(), PassportError> {
    if issuer == recipient {
        return Err(PassportError::InvalidInput);
    }
    if is_zero_bytes32(env, credential_id) || is_zero_bytes32(env, credential_hash) {
        return Err(PassportError::InvalidInput);
    }
    if storage::get_credential(env, credential_id).is_some() {
        return Err(PassportError::CredentialAlreadyExists);
    }
    if let Some(exp) = expires_at {
        if exp <= now {
            return Err(PassportError::InvalidExpiration);
        }
    }
    if let Some(tmpl) = storage::get_template(env, template_id) {
        if &tmpl.issuer != issuer {
            return Err(PassportError::Unauthorized);
        }
    }
    Ok(())
}

#[contract]
pub struct SkillsPassportContract;

#[contractimpl]
impl SkillsPassportContract {
    /// Initialize the skills passport contract with an administrator address.
    pub fn initialize(env: Env, admin: Address) -> Result<(), PassportError> {
        if storage::is_initialized(&env) {
            return Err(PassportError::AlreadyInitialized);
        }
        admin.require_auth();
        storage::set_admin(&env, &admin);

        env.events().publish(
            (Symbol::new(&env, "passport"), Symbol::new(&env, "initialized")),
            admin,
        );

        Ok(())
    }

    /// Update administrator address directly. Rejects setting identical admin and clears pending transfer.
    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), PassportError> {
        let current_admin = storage::get_admin(&env)?;
        current_admin.require_auth();
        if new_admin == current_admin {
            return Err(PassportError::InvalidInput);
        }
        storage::set_admin(&env, &new_admin);
        storage::clear_pending_admin(&env);

        env.events().publish(
            (Symbol::new(&env, "passport"), Symbol::new(&env, "admin_updated")),
            new_admin,
        );

        Ok(())
    }

    /// Two-step admin rotation (step 1): propose a new admin address that must explicitly accept.
    pub fn propose_admin(env: Env, new_admin: Address) -> Result<(), PassportError> {
        let current_admin = storage::get_admin(&env)?;
        current_admin.require_auth();
        if new_admin == current_admin {
            return Err(PassportError::InvalidInput);
        }
        storage::set_pending_admin(&env, &new_admin);

        env.events().publish(
            (Symbol::new(&env, "passport"), Symbol::new(&env, "admin_proposed")),
            new_admin,
        );

        Ok(())
    }

    /// Two-step admin rotation (step 2): pending admin signs to accept administration.
    pub fn accept_admin(env: Env) -> Result<(), PassportError> {
        let _current = storage::get_admin(&env)?;
        let pending = storage::get_pending_admin(&env).ok_or(PassportError::NoPendingAdmin)?;
        pending.require_auth();
        storage::set_admin(&env, &pending);
        storage::clear_pending_admin(&env);

        env.events().publish(
            (Symbol::new(&env, "passport"), Symbol::new(&env, "admin_updated")),
            pending,
        );

        Ok(())
    }

    /// Query pending admin proposal if any.
    pub fn get_pending_admin(env: Env) -> Option<Address> {
        storage::get_pending_admin(&env)
    }

    /// Emergency pause: freezes state-changing issuance/registration while keeping verification and revocations active.
    pub fn pause(env: Env) -> Result<(), PassportError> {
        let admin = storage::get_admin(&env)?;
        admin.require_auth();
        storage::set_paused(&env, true);

        env.events().publish(
            (Symbol::new(&env, "passport"), Symbol::new(&env, "paused")),
            admin,
        );

        Ok(())
    }

    /// Resume contract after emergency pause.
    pub fn unpause(env: Env) -> Result<(), PassportError> {
        let admin = storage::get_admin(&env)?;
        admin.require_auth();
        storage::set_paused(&env, false);

        env.events().publish(
            (Symbol::new(&env, "passport"), Symbol::new(&env, "unpaused")),
            admin,
        );

        Ok(())
    }

    /// Check whether the contract is currently paused.
    pub fn is_paused(env: Env) -> bool {
        storage::is_paused(&env)
    }

    /// Read the administrator address.
    pub fn get_admin(env: Env) -> Result<Address, PassportError> {
        storage::get_admin(&env)
    }

    /// Register an authorized educational institution or certification issuer.
    pub fn register_issuer(
        env: Env,
        issuer: Address,
        name: String,
        metadata_uri: String,
    ) -> Result<(), PassportError> {
        let admin = storage::get_admin(&env)?;
        admin.require_auth();
        require_not_paused(&env)?;
        require_non_empty_bounded(&name, MAX_NAME_LEN)?;
        require_non_empty_bounded(&metadata_uri, MAX_URI_LEN)?;

        if storage::get_issuer(&env, &issuer).is_some() {
            return Err(PassportError::IssuerAlreadyRegistered);
        }

        let record = IssuerRecord {
            address: issuer.clone(),
            name: name.clone(),
            metadata_uri,
            is_active: true,
            registered_at: env.ledger().timestamp(),
        };

        storage::set_issuer(&env, &record);

        env.events().publish(
            (Symbol::new(&env, "issuer"), Symbol::new(&env, "registered")),
            (issuer, name),
        );

        Ok(())
    }

    /// Update metadata or name of an existing authorized issuer.
    pub fn update_issuer_metadata(
        env: Env,
        issuer: Address,
        name: String,
        metadata_uri: String,
    ) -> Result<(), PassportError> {
        require_not_paused(&env)?;
        require_non_empty_bounded(&name, MAX_NAME_LEN)?;
        require_non_empty_bounded(&metadata_uri, MAX_URI_LEN)?;

        let mut record = storage::get_issuer(&env, &issuer).ok_or(PassportError::IssuerNotFound)?;
        if !record.is_active {
            return Err(PassportError::IssuerNotAuthorized);
        }

        issuer.require_auth();

        record.name = name.clone();
        record.metadata_uri = metadata_uri;
        storage::set_issuer(&env, &record);

        env.events().publish(
            (Symbol::new(&env, "issuer"), Symbol::new(&env, "updated")),
            (issuer, name),
        );

        Ok(())
    }

    /// Deauthorize an issuer (disallowing future issuance and flagging existing credentials).
    /// Callable by admin even when paused for rapid key-compromise containment.
    pub fn deauthorize_issuer(env: Env, issuer: Address) -> Result<(), PassportError> {
        let admin = storage::get_admin(&env)?;
        admin.require_auth();

        let mut record = storage::get_issuer(&env, &issuer).ok_or(PassportError::IssuerNotFound)?;
        if !record.is_active {
            return Err(PassportError::IssuerAlreadyDeauthorized);
        }
        record.is_active = false;
        storage::set_issuer(&env, &record);

        env.events().publish(
            (Symbol::new(&env, "issuer"), Symbol::new(&env, "deauthorized")),
            issuer,
        );

        Ok(())
    }

    /// Reactivate a previously deauthorized issuer.
    pub fn reactivate_issuer(env: Env, issuer: Address) -> Result<(), PassportError> {
        let admin = storage::get_admin(&env)?;
        admin.require_auth();
        require_not_paused(&env)?;

        let mut record = storage::get_issuer(&env, &issuer).ok_or(PassportError::IssuerNotFound)?;
        if record.is_active {
            return Err(PassportError::IssuerAlreadyActive);
        }
        record.is_active = true;
        storage::set_issuer(&env, &record);

        env.events().publish(
            (Symbol::new(&env, "issuer"), Symbol::new(&env, "reactivated")),
            issuer,
        );

        Ok(())
    }

    /// Rotate a compromised or retiring issuer key to a new keypair under admin governance.
    /// Requires both current admin and new issuer authorization to prevent typo lockouts.
    pub fn rotate_issuer_key(
        env: Env,
        old_issuer: Address,
        new_issuer: Address,
    ) -> Result<(), PassportError> {
        let admin = storage::get_admin(&env)?;
        admin.require_auth();
        new_issuer.require_auth();

        if old_issuer == new_issuer {
            return Err(PassportError::InvalidInput);
        }

        let mut old_record =
            storage::get_issuer(&env, &old_issuer).ok_or(PassportError::IssuerNotFound)?;
        if storage::get_issuer(&env, &new_issuer).is_some() {
            return Err(PassportError::IssuerAlreadyRegistered);
        }

        old_record.is_active = false;
        storage::set_issuer(&env, &old_record);

        let new_record = IssuerRecord {
            address: new_issuer.clone(),
            name: old_record.name,
            metadata_uri: old_record.metadata_uri,
            is_active: true,
            registered_at: env.ledger().timestamp(),
        };
        storage::set_issuer(&env, &new_record);

        env.events().publish(
            (Symbol::new(&env, "issuer"), Symbol::new(&env, "rotated")),
            (old_issuer, new_issuer),
        );

        Ok(())
    }

    /// Check if an issuer is authorized and active.
    pub fn is_issuer_authorized(env: Env, issuer: Address) -> bool {
        storage::is_issuer_authorized(&env, &issuer)
    }

    /// Query issuer record by address.
    pub fn get_issuer(env: Env, issuer: Address) -> Option<IssuerRecord> {
        storage::get_issuer(&env, &issuer)
    }

    /// Register a credential template schema by an authorized institution.
    pub fn register_template(
        env: Env,
        issuer: Address,
        template_id: Symbol,
        name: String,
        schema_uri: String,
    ) -> Result<(), PassportError> {
        let _admin = storage::get_admin(&env)?;
        issuer.require_auth();
        require_not_paused(&env)?;
        require_non_empty_bounded(&name, MAX_NAME_LEN)?;
        require_non_empty_bounded(&schema_uri, MAX_URI_LEN)?;

        if !storage::is_issuer_authorized(&env, &issuer) {
            return Err(PassportError::IssuerNotAuthorized);
        }

        if storage::get_template(&env, &template_id).is_some() {
            return Err(PassportError::TemplateAlreadyExists);
        }

        let record = TemplateRecord {
            template_id: template_id.clone(),
            issuer: issuer.clone(),
            name: name.clone(),
            schema_uri,
            registered_at: env.ledger().timestamp(),
        };

        storage::set_template(&env, &record);

        env.events().publish(
            (Symbol::new(&env, "template"), Symbol::new(&env, "registered")),
            (template_id, issuer, name),
        );

        Ok(())
    }

    /// Query credential template schema by ID.
    pub fn get_template(env: Env, template_id: Symbol) -> Option<TemplateRecord> {
        storage::get_template(&env, &template_id)
    }

    /// Issue a new credential commitment. Requires authorization of an approved issuer.
    pub fn issue_credential(
        env: Env,
        issuer: Address,
        recipient: Address,
        credential_id: BytesN<32>,
        credential_hash: BytesN<32>,
        template_id: Symbol,
        expires_at: Option<u64>,
    ) -> Result<(), PassportError> {
        let _admin = storage::get_admin(&env)?;
        issuer.require_auth();
        require_not_paused(&env)?;

        if !storage::is_issuer_authorized(&env, &issuer) {
            return Err(PassportError::IssuerNotAuthorized);
        }

        let now = env.ledger().timestamp();
        validate_issue_item(
            &env,
            &issuer,
            &recipient,
            &credential_id,
            &credential_hash,
            &template_id,
            expires_at,
            now,
        )?;

        let record = CredentialRecord {
            credential_id: credential_id.clone(),
            issuer: issuer.clone(),
            recipient: recipient.clone(),
            credential_hash: credential_hash.clone(),
            template_id,
            issued_at: now,
            expires_at,
            status: CredentialStatus::Active,
            revocation_reason: None,
        };

        storage::set_credential(&env, &record);
        storage::add_learner_credential(&env, &recipient, &credential_id);

        env.events().publish(
            (
                Symbol::new(&env, "credential"),
                Symbol::new(&env, "issued"),
                recipient,
            ),
            (credential_id, issuer, credential_hash),
        );

        Ok(())
    }

    /// Batch issue up to 50 credentials atomically in a single transaction.
    pub fn batch_issue_credentials(
        env: Env,
        issuer: Address,
        credentials: Vec<BatchIssueItem>,
    ) -> Result<u32, PassportError> {
        let _admin = storage::get_admin(&env)?;
        issuer.require_auth();
        require_not_paused(&env)?;

        if !storage::is_issuer_authorized(&env, &issuer) {
            return Err(PassportError::IssuerNotAuthorized);
        }

        let total = credentials.len();
        if total == 0 {
            return Err(PassportError::InvalidInput);
        }
        if total > MAX_BATCH_SIZE {
            return Err(PassportError::BatchTooLarge);
        }

        let now = env.ledger().timestamp();
        let mut count: u32 = 0;

        for item in credentials.iter() {
            validate_issue_item(
                &env,
                &issuer,
                &item.recipient,
                &item.credential_id,
                &item.credential_hash,
                &item.template_id,
                item.expires_at,
                now,
            )?;

            let record = CredentialRecord {
                credential_id: item.credential_id.clone(),
                issuer: issuer.clone(),
                recipient: item.recipient.clone(),
                credential_hash: item.credential_hash.clone(),
                template_id: item.template_id,
                issued_at: now,
                expires_at: item.expires_at,
                status: CredentialStatus::Active,
                revocation_reason: None,
            };

            storage::set_credential(&env, &record);
            storage::add_learner_credential(&env, &item.recipient, &item.credential_id);

            env.events().publish(
                (
                    Symbol::new(&env, "credential"),
                    Symbol::new(&env, "issued"),
                    item.recipient,
                ),
                (item.credential_id, issuer.clone(), item.credential_hash),
            );

            count += 1;
        }

        Ok(count)
    }

    /// Revoke an issued credential. Callable only by an active issuing institution or contract admin.
    pub fn revoke_credential(
        env: Env,
        caller: Address,
        credential_id: BytesN<32>,
        reason: String,
    ) -> Result<(), PassportError> {
        caller.require_auth();
        require_non_empty_bounded(&reason, MAX_REASON_LEN)?;

        let mut record =
            storage::get_credential(&env, &credential_id).ok_or(PassportError::CredentialNotFound)?;

        require_lifecycle_caller(&env, &caller, &record)?;

        if record.status == CredentialStatus::Revoked {
            return Err(PassportError::CredentialAlreadyRevoked);
        }

        record.status = CredentialStatus::Revoked;
        record.revocation_reason = Some(reason.clone());
        storage::set_credential(&env, &record);

        env.events().publish(
            (Symbol::new(&env, "credential"), Symbol::new(&env, "revoked")),
            (credential_id, reason),
        );

        Ok(())
    }

    /// Suspend an issued credential pending review. Callable only by an active issuing institution or contract admin.
    pub fn suspend_credential(
        env: Env,
        caller: Address,
        credential_id: BytesN<32>,
        reason: String,
    ) -> Result<(), PassportError> {
        caller.require_auth();
        require_non_empty_bounded(&reason, MAX_REASON_LEN)?;

        let mut record =
            storage::get_credential(&env, &credential_id).ok_or(PassportError::CredentialNotFound)?;

        require_lifecycle_caller(&env, &caller, &record)?;

        if record.status == CredentialStatus::Revoked {
            return Err(PassportError::CredentialAlreadyRevoked);
        }
        if record.status == CredentialStatus::Suspended {
            return Err(PassportError::CredentialAlreadySuspended);
        }

        record.status = CredentialStatus::Suspended;
        record.revocation_reason = Some(reason.clone());
        storage::set_credential(&env, &record);

        env.events().publish(
            (Symbol::new(&env, "credential"), Symbol::new(&env, "suspended")),
            (credential_id, reason),
        );

        Ok(())
    }

    /// Reactivate a suspended credential. Cannot reactivate permanently revoked or expired credentials.
    pub fn reactivate_credential(
        env: Env,
        caller: Address,
        credential_id: BytesN<32>,
    ) -> Result<(), PassportError> {
        caller.require_auth();
        require_not_paused(&env)?;

        let mut record =
            storage::get_credential(&env, &credential_id).ok_or(PassportError::CredentialNotFound)?;

        require_lifecycle_caller(&env, &caller, &record)?;

        if record.status != CredentialStatus::Suspended {
            return Err(PassportError::CredentialNotSuspended);
        }

        if let Some(exp) = record.expires_at {
            if env.ledger().timestamp() >= exp {
                return Err(PassportError::InvalidExpiration);
            }
        }

        record.status = CredentialStatus::Active;
        record.revocation_reason = None;
        storage::set_credential(&env, &record);

        env.events().publish(
            (Symbol::new(&env, "credential"), Symbol::new(&env, "reactivated")),
            credential_id,
        );

        Ok(())
    }

    /// Fast status query returning (status, expires_at, revocation_reason) without full record overhead.
    pub fn get_credential_status(
        env: Env,
        credential_id: BytesN<32>,
    ) -> Result<(CredentialStatus, Option<u64>, Option<String>), PassportError> {
        let record =
            storage::get_credential(&env, &credential_id).ok_or(PassportError::CredentialNotFound)?;
        Ok((record.status, record.expires_at, record.revocation_reason))
    }

    /// Read a credential commitment record.
    pub fn get_credential(env: Env, credential_id: BytesN<32>) -> Option<CredentialRecord> {
        storage::get_credential(&env, &credential_id)
    }

    /// Get all credential identifiers registered for a learner address.
    pub fn get_learner_credentials(env: Env, recipient: Address) -> Vec<BytesN<32>> {
        storage::get_learner_credentials(&env, &recipient)
    }

    /// Get count of credentials registered for a learner address.
    pub fn get_learner_credential_count(env: Env, recipient: Address) -> u32 {
        storage::get_learner_credentials(&env, &recipient).len()
    }

    /// Paginated read over a learner's credential IDs (limit 1..=100).
    pub fn get_learner_credentials_page(
        env: Env,
        recipient: Address,
        cursor: u32,
        limit: u32,
    ) -> Result<Vec<BytesN<32>>, PassportError> {
        if limit == 0 || limit > MAX_PAGE_LIMIT {
            return Err(PassportError::InvalidInput);
        }
        let all = storage::get_learner_credentials(&env, &recipient);
        let len = all.len();
        let mut page = Vec::new(&env);
        if cursor >= len {
            return Ok(page);
        }
        let end = cursor.saturating_add(limit).min(len);
        let mut idx = cursor;
        while idx < end {
            if let Some(id) = all.get(idx) {
                page.push_back(id);
            }
            idx += 1;
        }
        Ok(page)
    }

    /// Independently verify a credential against on-chain status, issuer authenticity, and hash integrity.
    pub fn verify_credential(
        env: Env,
        credential_id: BytesN<32>,
        claimed_hash: BytesN<32>,
    ) -> Result<VerificationResult, PassportError> {
        let record =
            storage::get_credential(&env, &credential_id).ok_or(PassportError::CredentialNotFound)?;

        let issuer_authorized = storage::is_issuer_authorized(&env, &record.issuer);
        let hash_matches = record.credential_hash == claimed_hash;
        let now = env.ledger().timestamp();
        let is_expired = match record.expires_at {
            Some(exp) => now >= exp,
            None => false,
        };

        let is_valid = issuer_authorized
            && hash_matches
            && !is_expired
            && record.status == CredentialStatus::Active;

        Ok(VerificationResult {
            is_valid,
            status: record.status,
            issuer_authorized,
            hash_matches,
            is_expired,
            issued_at: record.issued_at,
            expires_at: record.expires_at,
            issuer: record.issuer,
            recipient: record.recipient,
        })
    }
}
