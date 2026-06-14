use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("Stake111111111111111111111111111111111111111");

/// Staking program for $XYNQ.
///
/// Holders stake $XYNQ into a per-user stake account. A share of treasury
/// inflows is distributed to stakers proportional to stake-weight at each
/// epoch boundary (distribution is computed off-chain by the keeper and
/// settled via `claim`).
#[program]
pub mod xynq_staking {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, epoch_seconds: i64) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        pool.authority = ctx.accounts.authority.key();
        pool.mint = ctx.accounts.mint.key();
        pool.total_staked = 0;
        pool.epoch_seconds = epoch_seconds;
        pool.bump = ctx.bumps.pool;
        Ok(())
    }

    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        require!(amount > 0, StakeError::ZeroAmount);

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
        )?;

        let stake = &mut ctx.accounts.stake_account;
        stake.owner = ctx.accounts.user.key();
        stake.amount = stake.amount.checked_add(amount).ok_or(StakeError::Overflow)?;
        stake.since = Clock::get()?.unix_timestamp;

        let pool = &mut ctx.accounts.pool;
        pool.total_staked = pool.total_staked.checked_add(amount).ok_or(StakeError::Overflow)?;
        Ok(())
    }

    pub fn unstake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        let stake = &mut ctx.accounts.stake_account;
        require!(stake.amount >= amount, StakeError::InsufficientStake);

        let pool_key = ctx.accounts.pool.key();
        let seeds = &[b"vault", pool_key.as_ref(), &[ctx.accounts.pool.bump]];
        let signer = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.user_token.to_account_info(),
                    authority: ctx.accounts.pool.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;

        stake.amount -= amount;
        ctx.accounts.pool.total_staked -= amount;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = 8 + Pool::LEN, seeds = [b"pool", mint.key().as_ref()], bump)]
    pub pool: Account<'info, Pool>,
    pub mint: Account<'info, anchor_spl::token::Mint>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut, seeds = [b"pool", pool.mint.as_ref()], bump = pool.bump)]
    pub pool: Account<'info, Pool>,
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + StakeAccount::LEN,
        seeds = [b"stake", pool.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub stake_account: Account<'info, StakeAccount>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_token: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Pool {
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub total_staked: u64,
    pub epoch_seconds: i64,
    pub bump: u8,
}
impl Pool {
    pub const LEN: usize = 32 + 32 + 8 + 8 + 1;
}

#[account]
pub struct StakeAccount {
    pub owner: Pubkey,
    pub amount: u64,
    pub since: i64,
}
impl StakeAccount {
    pub const LEN: usize = 32 + 8 + 8;
}

#[error_code]
pub enum StakeError {
    #[msg("amount must be greater than zero")]
    ZeroAmount,
    #[msg("arithmetic overflow")]
    Overflow,
    #[msg("insufficient stake")]
    InsufficientStake,
}
