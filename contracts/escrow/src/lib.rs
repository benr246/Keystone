#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, token, Address, Env, String, Vec};

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
    /// Client creates an escrow: transfers the FULL sum of all milestone
    /// amounts from client into this contract's custody (inter-contract
    /// call: token.transfer(client, contract_address, total)).
    pub fn create_escrow(
        env: Env,
        client: Address,
        freelancer: Address,
        token: Address,
        milestones: Vec<(String, i128)>,
    ) -> u64 {
        client.require_auth();

        if milestones.len() < 2 || milestones.len() > 3 {
            panic!("must have 2 to 3 milestones");
        }
        if client == freelancer {
            panic!("client and freelancer must differ");
        }

        let mut total: i128 = 0;
        let mut stored: Vec<Milestone> = Vec::new(&env);
        for (title, amount) in milestones.iter() {
            if amount <= 0 {
                panic!("milestone amount must be positive");
            }
            total += amount;
            stored.push_back(Milestone {
                title,
                amount,
                status: MilestoneStatus::Locked,
            });
        }

        // Inter-contract call: move the full total into escrow custody.
        token::Client::new(&env, &token).transfer(
            &client,
            &env.current_contract_address(),
            &total,
        );

        let id = next_id(&env);
        let escrow = EscrowData {
            client,
            freelancer,
            token,
            milestones: stored,
            cancelled: false,
            created_at: env.ledger().timestamp(),
        };
        write_escrow(&env, id, &escrow);

        env.events().publish(
            (symbol_short!("escrow"), symbol_short!("created")),
            (id, escrow.client.clone(), escrow.freelancer.clone(), total),
        );
        id
    }

    /// Client releases milestone `index`: inter-contract call
    /// token.transfer(contract_address, freelancer, amount).
    pub fn release_milestone(env: Env, id: u64, index: u32) {
        let mut escrow = read_escrow(&env, id);
        escrow.client.require_auth();

        if escrow.cancelled {
            panic!("escrow is cancelled");
        }
        if index >= escrow.milestones.len() {
            panic!("milestone index out of range");
        }
        let mut milestone = escrow.milestones.get(index).unwrap();
        if milestone.status != MilestoneStatus::Locked {
            panic!("milestone is not locked");
        }

        // Inter-contract call: pay the freelancer from escrow custody.
        token::Client::new(&env, &escrow.token).transfer(
            &env.current_contract_address(),
            &escrow.freelancer,
            &milestone.amount,
        );

        let amount = milestone.amount;
        milestone.status = MilestoneStatus::Released;
        escrow.milestones.set(index, milestone);
        write_escrow(&env, id, &escrow);

        env.events().publish(
            (symbol_short!("escrow"), symbol_short!("released")),
            (id, index, amount),
        );
    }

    /// Client cancels the escrow: every still-Locked milestone is refunded
    /// to the client and marked Refunded. Released milestones untouched.
    pub fn cancel_escrow(env: Env, id: u64) {
        let mut escrow = read_escrow(&env, id);
        escrow.client.require_auth();

        if escrow.cancelled {
            panic!("escrow already cancelled");
        }

        let mut refunded_total: i128 = 0;
        let mut updated: Vec<Milestone> = Vec::new(&env);
        for m in escrow.milestones.iter() {
            if m.status == MilestoneStatus::Locked {
                refunded_total += m.amount;
                updated.push_back(Milestone {
                    title: m.title.clone(),
                    amount: m.amount,
                    status: MilestoneStatus::Refunded,
                });
            } else {
                updated.push_back(m);
            }
        }
        if refunded_total == 0 {
            panic!("nothing to refund");
        }

        // Inter-contract call: refund locked funds to the client.
        token::Client::new(&env, &escrow.token).transfer(
            &env.current_contract_address(),
            &escrow.client,
            &refunded_total,
        );

        escrow.milestones = updated;
        escrow.cancelled = true;
        write_escrow(&env, id, &escrow);

        env.events().publish(
            (symbol_short!("escrow"), symbol_short!("cancelled")),
            (id, refunded_total),
        );
    }

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
