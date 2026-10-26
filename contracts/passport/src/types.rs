use soroban_sdk::{contracterror, contracttype, Address, BytesN, String, Symbol};

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracterror]
#[repr(u32)]
pub enum PassportError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    IssuerNotAuthorized = 4,
    CredentialAlreadyExists = 5,
    CredentialNotFound = 6,
    CredentialAlreadyRevoked = 7,
    CredentialNotSuspended = 8,
    InvalidExpiration = 9,
    IssuerAlreadyRegistered = 10,
    IssuerNotFound = 11,
    TemplateAlreadyExists = 12,
    TemplateNotFound = 13,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[contracttype]
#[repr(u32)]
pub enum CredentialStatus {
    Active = 1,
    Revoked = 2,
    Suspended = 3,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct IssuerRecord {
    pub address: Address,
    pub name: String,
    pub metadata_uri: String,
    pub is_active: bool,
    pub registered_at: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct TemplateRecord {
    pub template_id: Symbol,
    pub issuer: Address,
    pub name: String,
    pub schema_uri: String,
    pub registered_at: u64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct CredentialRecord {
    pub credential_id: BytesN<32>,
    pub issuer: Address,
    pub recipient: Address,
    pub credential_hash: BytesN<32>,
    pub template_id: Symbol,
    pub issued_at: u64,
    pub expires_at: Option<u64>,
    pub status: CredentialStatus,
    pub revocation_reason: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct BatchIssueItem {
    pub recipient: Address,
    pub credential_id: BytesN<32>,
    pub credential_hash: BytesN<32>,
    pub template_id: Symbol,
    pub expires_at: Option<u64>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct VerificationResult {
    pub is_valid: bool,
    pub status: CredentialStatus,
    pub issuer_authorized: bool,
    pub hash_matches: bool,
    pub is_expired: bool,
    pub issued_at: u64,
    pub expires_at: Option<u64>,
    pub issuer: Address,
    pub recipient: Address,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Issuer(Address),
    Template(Symbol),
    Credential(BytesN<32>),
    LearnerCredentials(Address),
}
