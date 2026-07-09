#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    vec, Address, Env, String,
};

struct Setup<'a> {
    env: Env,
    client: Address,
    freelancer: Address,
    token_addr: Address,
    token: TokenClient<'a>,
    escrow: EscrowContractClient<'a>,
    contract_addr: Address,
}

fn setup(env: &Env) -> Setup<'_> {
    env.mock_all_auths();

    let admin = Address::generate(env);
    let client = Address::generate(env);
    let freelancer = Address::generate(env);

    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let token_addr = sac.address();
    let token = TokenClient::new(env, &token_addr);
    let token_admin = StellarAssetClient::new(env, &token_addr);
    token_admin.mint(&client, &10_000_i128);

    let contract_addr = env.register(EscrowContract, ());
    let escrow = EscrowContractClient::new(env, &contract_addr);

    Setup {
        env: env.clone(),
        client,
        freelancer,
        token_addr,
        token,
        escrow,
        contract_addr,
    }
}

fn three_milestones(env: &Env) -> Vec<(String, i128)> {
    vec![
        env,
        (String::from_str(env, "Design mockups"), 1000_i128),
        (String::from_str(env, "Build frontend"), 1500_i128),
        (String::from_str(env, "Deploy & handover"), 2500_i128),
    ]
}

#[test]
fn test_create_escrow_locks_total() {
    let env = Env::default();
    let s = setup(&env);

    let id = s.escrow.create_escrow(
        &s.client,
        &s.freelancer,
        &s.token_addr,
        &three_milestones(&env),
    );

    assert_eq!(id, 0);
    assert_eq!(s.token.balance(&s.contract_addr), 5000);
    assert_eq!(s.token.balance(&s.client), 5000);

    let data = s.escrow.get_escrow(&id);
    assert_eq!(data.client, s.client);
    assert_eq!(data.freelancer, s.freelancer);
    assert_eq!(data.milestones.len(), 3);
    assert_eq!(data.milestones.get(0).unwrap().amount, 1000);
    assert_eq!(data.milestones.get(0).unwrap().status, MilestoneStatus::Locked);
    assert!(!data.cancelled);
    assert_eq!(s.escrow.get_escrow_count(), 1);
    assert_eq!(s.escrow.get_progress(&id), (0, 5000));
}

#[test]
fn test_release_pays_correct_amount() {
    let env = Env::default();
    let s = setup(&env);

    let id = s.escrow.create_escrow(
        &s.client,
        &s.freelancer,
        &s.token_addr,
        &three_milestones(&env),
    );

    assert_eq!(s.token.balance(&s.freelancer), 0);
    s.escrow.release_milestone(&id, &0);
    // Real inter-contract effect: freelancer received exactly milestone 0.
    assert_eq!(s.token.balance(&s.freelancer), 1000);
    assert_eq!(s.token.balance(&s.contract_addr), 4000);

    let data = s.escrow.get_escrow(&id);
    assert_eq!(data.milestones.get(0).unwrap().status, MilestoneStatus::Released);
    assert_eq!(s.escrow.get_progress(&id), (1000, 4000));
}

#[test]
fn test_release_requires_client_auth() {
    let env = Env::default();
    let s = setup(&env);

    let id = s.escrow.create_escrow(
        &s.client,
        &s.freelancer,
        &s.token_addr,
        &three_milestones(&env),
    );

    // Drop auth mocking: unauthenticated release must fail.
    s.env.set_auths(&[]);
    let result = s.escrow.try_release_milestone(&id, &0);
    assert!(result.is_err());
}

#[test]
#[should_panic(expected = "milestone is not locked")]
fn test_double_release_fails() {
    let env = Env::default();
    let s = setup(&env);

    let id = s.escrow.create_escrow(
        &s.client,
        &s.freelancer,
        &s.token_addr,
        &three_milestones(&env),
    );

    s.escrow.release_milestone(&id, &0);
    s.escrow.release_milestone(&id, &0);
}

#[test]
fn test_cancel_refunds_only_locked() {
    let env = Env::default();
    let s = setup(&env);

    let id = s.escrow.create_escrow(
        &s.client,
        &s.freelancer,
        &s.token_addr,
        &three_milestones(&env),
    );

    s.escrow.release_milestone(&id, &0);
    s.escrow.cancel_escrow(&id);

    // Client refunded total minus released milestone 0: 5000 locked, 1000 released.
    assert_eq!(s.token.balance(&s.client), 5000 + 4000);
    assert_eq!(s.token.balance(&s.freelancer), 1000);
    assert_eq!(s.token.balance(&s.contract_addr), 0);

    let data = s.escrow.get_escrow(&id);
    assert!(data.cancelled);
    assert_eq!(data.milestones.get(0).unwrap().status, MilestoneStatus::Released);
    assert_eq!(data.milestones.get(1).unwrap().status, MilestoneStatus::Refunded);
    assert_eq!(data.milestones.get(2).unwrap().status, MilestoneStatus::Refunded);
    assert_eq!(s.escrow.get_progress(&id), (1000, 0));
}

#[test]
#[should_panic(expected = "nothing to refund")]
fn test_cancel_with_nothing_locked_fails() {
    let env = Env::default();
    let s = setup(&env);

    let id = s.escrow.create_escrow(
        &s.client,
        &s.freelancer,
        &s.token_addr,
        &vec![
            &env,
            (String::from_str(&env, "A"), 100_i128),
            (String::from_str(&env, "B"), 200_i128),
        ],
    );
    s.escrow.release_milestone(&id, &0);
    s.escrow.release_milestone(&id, &1);
    s.escrow.cancel_escrow(&id);
}

#[test]
#[should_panic(expected = "must have 2 to 3 milestones")]
fn test_create_fails_one_milestone() {
    let env = Env::default();
    let s = setup(&env);
    s.escrow.create_escrow(
        &s.client,
        &s.freelancer,
        &s.token_addr,
        &vec![&env, (String::from_str(&env, "Only"), 100_i128)],
    );
}

#[test]
#[should_panic(expected = "must have 2 to 3 milestones")]
fn test_create_fails_four_milestones() {
    let env = Env::default();
    let s = setup(&env);
    s.escrow.create_escrow(
        &s.client,
        &s.freelancer,
        &s.token_addr,
        &vec![
            &env,
            (String::from_str(&env, "A"), 100_i128),
            (String::from_str(&env, "B"), 100_i128),
            (String::from_str(&env, "C"), 100_i128),
            (String::from_str(&env, "D"), 100_i128),
        ],
    );
}

#[test]
#[should_panic(expected = "milestone amount must be positive")]
fn test_create_fails_zero_amount() {
    let env = Env::default();
    let s = setup(&env);
    s.escrow.create_escrow(
        &s.client,
        &s.freelancer,
        &s.token_addr,
        &vec![
            &env,
            (String::from_str(&env, "A"), 0_i128),
            (String::from_str(&env, "B"), 100_i128),
        ],
    );
}

#[test]
#[should_panic(expected = "client and freelancer must differ")]
fn test_create_fails_client_is_freelancer() {
    let env = Env::default();
    let s = setup(&env);
    s.escrow.create_escrow(
        &s.client,
        &s.client,
        &s.token_addr,
        &vec![
            &env,
            (String::from_str(&env, "A"), 100_i128),
            (String::from_str(&env, "B"), 100_i128),
        ],
    );
}

#[test]
#[should_panic(expected = "escrow is cancelled")]
fn test_release_after_cancel_fails() {
    let env = Env::default();
    let s = setup(&env);

    let id = s.escrow.create_escrow(
        &s.client,
        &s.freelancer,
        &s.token_addr,
        &three_milestones(&env),
    );
    s.escrow.cancel_escrow(&id);
    s.escrow.release_milestone(&id, &0);
}
