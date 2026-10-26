use soroban_sdk::{Address, BytesN, Env, Symbol, Vec};

use crate::types::{CredentialRecord, DataKey, IssuerRecord, PassportError, TemplateRecord};

const LEDGERS_PER_DAY: u32 = 17_280;
pub const PERSISTENT_BUMP: u32 = 120 * LEDGERS_PER_DAY; // ~120 days
pub const PERSISTENT_THRESHOLD: u32 = 60 * LEDGERS_PER_DAY; // ~60 days

pub fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(PERSISTENT_THRESHOLD, PERSISTENT_BUMP);
}

fn bump_persistent(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, PERSISTENT_THRESHOLD, PERSISTENT_BUMP);
}

pub fn is_initialized(env: &Env) -> bool {
    env.storage().instance().has(&DataKey::Admin)
}

pub fn get_admin(env: &Env) -> Result<Address, PassportError> {
    bump_instance(env);
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(PassportError::NotInitialized)
}

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::Admin, admin);
    bump_instance(env);
}

pub fn get_issuer(env: &Env, issuer: &Address) -> Option<IssuerRecord> {
    let key = DataKey::Issuer(issuer.clone());
    if env.storage().persistent().has(&key) {
        bump_persistent(env, &key);
        env.storage().persistent().get(&key)
    } else {
        None
    }
}

pub fn set_issuer(env: &Env, issuer_record: &IssuerRecord) {
    let key = DataKey::Issuer(issuer_record.address.clone());
    env.storage().persistent().set(&key, issuer_record);
    bump_persistent(env, &key);
}

pub fn is_issuer_authorized(env: &Env, issuer: &Address) -> bool {
    match get_issuer(env, issuer) {
        Some(record) => record.is_active,
        None => false,
    }
}

pub fn get_template(env: &Env, template_id: &Symbol) -> Option<TemplateRecord> {
    let key = DataKey::Template(template_id.clone());
    if env.storage().persistent().has(&key) {
        bump_persistent(env, &key);
        env.storage().persistent().get(&key)
    } else {
        None
    }
}

pub fn set_template(env: &Env, template_record: &TemplateRecord) {
    let key = DataKey::Template(template_record.template_id.clone());
    env.storage().persistent().set(&key, template_record);
    bump_persistent(env, &key);
}

pub fn get_credential(env: &Env, credential_id: &BytesN<32>) -> Option<CredentialRecord> {
    let key = DataKey::Credential(credential_id.clone());
    if env.storage().persistent().has(&key) {
        bump_persistent(env, &key);
        env.storage().persistent().get(&key)
    } else {
        None
    }
}

pub fn set_credential(env: &Env, record: &CredentialRecord) {
    let key = DataKey::Credential(record.credential_id.clone());
    env.storage().persistent().set(&key, record);
    bump_persistent(env, &key);
}

pub fn get_learner_credentials(env: &Env, recipient: &Address) -> Vec<BytesN<32>> {
    let key = DataKey::LearnerCredentials(recipient.clone());
    if env.storage().persistent().has(&key) {
        bump_persistent(env, &key);
        env.storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| Vec::new(env))
    } else {
        Vec::new(env)
    }
}

pub fn add_learner_credential(env: &Env, recipient: &Address, credential_id: &BytesN<32>) {
    let key = DataKey::LearnerCredentials(recipient.clone());
    let mut list = get_learner_credentials(env, recipient);
    list.push_back(credential_id.clone());
    env.storage().persistent().set(&key, &list);
    bump_persistent(env, &key);
}
