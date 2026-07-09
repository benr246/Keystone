#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MilestoneStatus {
    Locked,
    Released,
    Refunded,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Milestone {
    pub title: String,
    pub amount: i128,
    pub status: MilestoneStatus,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EscrowData {
    pub client: Address,
    pub freelancer: Address,
    pub token: Address,
    pub milestones: Vec<Milestone>,
    pub cancelled: bool,
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Escrow(u64),
    NextId,
}

const TTL_THRESHOLD: u32 = 518_400; // ~30 days of ledgers
const TTL_EXTEND_TO: u32 = 1_036_800; // ~60 days of ledgers

fn read_escrow(env: &Env, id: u64) -> EscrowData {
    let key = DataKey::Escrow(id);
    let escrow: EscrowData = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| panic!("escrow not found"));
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
    escrow
}

fn write_escrow(env: &Env, id: u64, escrow: &EscrowData) {
    let key = DataKey::Escrow(id);
    env.storage().persistent().set(&key, escrow);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

fn next_id(env: &Env) -> u64 {
    let id: u64 = env
        .storage()
        .persistent()
        .get(&DataKey::NextId)
        .unwrap_or(0);
    env.storage().persistent().set(&DataKey::NextId, &(id + 1));
    env.storage()
        .persistent()
        .extend_ttl(&DataKey::NextId, TTL_THRESHOLD, TTL_EXTEND_TO);
    id
}

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    pub fn get_escrow(env: Env, id: u64) -> EscrowData {
        read_escrow(&env, id)
    }

    pub fn get_progress(env: Env, id: u64) -> (i128, i128) {
        let escrow = read_escrow(&env, id);
        let mut released: i128 = 0;
        let mut locked: i128 = 0;
        for m in escrow.milestones.iter() {
            match m.status {
                MilestoneStatus::Released => released += m.amount,
                MilestoneStatus::Locked => locked += m.amount,
                MilestoneStatus::Refunded => {}
            }
        }
        (released, locked)
    }

    pub fn get_escrow_count(env: Env) -> u64 {
        env.storage()
            .persistent()
            .get(&DataKey::NextId)
            .unwrap_or(0)
    }
}

mod test;
