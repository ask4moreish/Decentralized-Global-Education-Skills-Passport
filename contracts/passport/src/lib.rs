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

    /// Update administrator address. Requires current admin authorization.
    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), PassportError> {
        let current_admin = storage::get_admin(&env)?;
        current_admin.require_auth();
        storage::set_admin(&env, &new_admin);

        env.events().publish(
            (Symbol::new(&env, "passport"), Symbol::new(&env, "admin_updated")),
            new_admin,
        );

        Ok(())
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
        let admin = storage::get_admin(&env)?;
        if !storage::is_issuer_authorized(&env, &issuer) {
            return Err(PassportError::IssuerNotFound);
        }

        // Must be authorized by the issuer itself or the contract admin
        if !issuer.to_val().is_void() {
            // Check auth
            if env.auths().is_empty() {
                issuer.require_auth();
            } else {
                // If caller is admin, accept
                let is_admin = admin == issuer;
                if !is_admin {
                    issuer.require_auth();
                }
            }
        }

        let mut record = storage::get_issuer(&env, &issuer).ok_or(PassportError::IssuerNotFound)?;
        record.name = name.clone();
        record.metadata_uri = metadata_uri.clone();
        storage::set_issuer(&env, &record);

        env.events().publish(
            (Symbol::new(&env, "issuer"), Symbol::new(&env, "updated")),
            (issuer, name),
        );

        Ok(())
    }

    /// Deauthorize an issuer (disallowing future issuance and flagging existing credentials).
    pub fn deauthorize_issuer(env: Env, issuer: Address) -> Result<(), PassportError> {
        let admin = storage::get_admin(&env)?;
        admin.require_auth();

        let mut record = storage::get_issuer(&env, &issuer).ok_or(PassportError::IssuerNotFound)?;
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

        let mut record = storage::get_issuer(&env, &issuer).ok_or(PassportError::IssuerNotFound)?;
        record.is_active = true;
        storage::set_issuer(&env, &record);

        env.events().publish(
            (Symbol::new(&env, "issuer"), Symbol::new(&env, "reactivated")),
            issuer,
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
        issuer.require_auth();

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
        issuer.require_auth();

        if !storage::is_issuer_authorized(&env, &issuer) {
            return Err(PassportError::IssuerNotAuthorized);
        }

        if storage::get_credential(&env, &credential_id).is_some() {
            return Err(PassportError::CredentialAlreadyExists);
        }

        let now = env.ledger().timestamp();
        if let Some(exp) = expires_at {
            if exp <= now {
                return Err(PassportError::InvalidExpiration);
            }
        }

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

    /// Batch issue credentials to multiple learners atomically in a single transaction.
    pub fn batch_issue_credentials(
        env: Env,
        issuer: Address,
        credentials: Vec<BatchIssueItem>,
    ) -> Result<u32, PassportError> {
        issuer.require_auth();

        if !storage::is_issuer_authorized(&env, &issuer) {
            return Err(PassportError::IssuerNotAuthorized);
        }

        let now = env.ledger().timestamp();
        let mut count: u32 = 0;

        for item in credentials.iter() {
            if storage::get_credential(&env, &item.credential_id).is_some() {
                return Err(PassportError::CredentialAlreadyExists);
            }

            if let Some(exp) = item.expires_at {
                if exp <= now {
                    return Err(PassportError::InvalidExpiration);
                }
            }

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

    /// Revoke an issued credential. Callable only by the issuing institution or contract admin.
    pub fn revoke_credential(
        env: Env,
        caller: Address,
        credential_id: BytesN<32>,
        reason: String,
    ) -> Result<(), PassportError> {
        caller.require_auth();

        let mut record =
            storage::get_credential(&env, &credential_id).ok_or(PassportError::CredentialNotFound)?;

        let admin = storage::get_admin(&env)?;
        if caller != record.issuer && caller != admin {
            return Err(PassportError::Unauthorized);
        }

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

    /// Suspend an issued credential pending review. Callable only by the issuing institution or contract admin.
    pub fn suspend_credential(
        env: Env,
        caller: Address,
        credential_id: BytesN<32>,
        reason: String,
    ) -> Result<(), PassportError> {
        caller.require_auth();

        let mut record =
            storage::get_credential(&env, &credential_id).ok_or(PassportError::CredentialNotFound)?;

        let admin = storage::get_admin(&env)?;
        if caller != record.issuer && caller != admin {
            return Err(PassportError::Unauthorized);
        }

        if record.status == CredentialStatus::Revoked {
            return Err(PassportError::CredentialAlreadyRevoked);
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

    /// Reactivate a suspended credential. Cannot reactivate permanently revoked credentials.
    pub fn reactivate_credential(
        env: Env,
        caller: Address,
        credential_id: BytesN<32>,
    ) -> Result<(), PassportError> {
        caller.require_auth();

        let mut record =
            storage::get_credential(&env, &credential_id).ok_or(PassportError::CredentialNotFound)?;

        let admin = storage::get_admin(&env)?;
        if caller != record.issuer && caller != admin {
            return Err(PassportError::Unauthorized);
        }

        if record.status != CredentialStatus::Suspended {
            return Err(PassportError::CredentialNotSuspended);
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
