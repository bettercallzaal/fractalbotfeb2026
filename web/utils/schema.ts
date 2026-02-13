import { pgTable, serial, bigint, varchar, integer, timestamp, text, boolean, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table - Discord users with wallet integration
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  discordId: varchar('discord_id', { length: 255 }).notNull().unique(),
  username: varchar('username', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 255 }),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  walletAddress: varchar('wallet_address', { length: 255 }).unique(),
  walletType: varchar('wallet_type', { length: 50 }), // 'ethereum', 'solana', etc.
  totalFractals: integer('total_fractals').default(0),
  totalWins: integer('total_wins').default(0),
  totalVotes: integer('total_votes').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Fractals table - Individual fractal sessions
export const fractals = pgTable('fractals', {
  id: serial('id').primaryKey(),
  threadId: varchar('thread_id', { length: 255 }).unique(),
  name: varchar('name', { length: 255 }).notNull(),
  guildId: varchar('guild_id', { length: 255 }).notNull(),
  facilitatorId: integer('facilitator_id').references(() => users.id),
  status: varchar('status', { length: 50 }).default('active'), // 'active', 'completed', 'cancelled'
  participantCount: integer('participant_count').default(0),
  currentLevel: integer('current_level').default(6),
  isPaused: boolean('is_paused').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

// Fractal participants - Many-to-many relationship
export const fractalParticipants = pgTable('fractal_participants', {
  id: serial('id').primaryKey(),
  fractalId: integer('fractal_id').references(() => fractals.id).notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  joinedAt: timestamp('joined_at').defaultNow(),
  finalRank: integer('final_rank'), // 1st, 2nd, 3rd place, etc.
  levelsWon: text('levels_won').array(), // Array of levels won
  totalVotesReceived: integer('total_votes_received').default(0),
});

// Voting rounds - Each level of voting
export const votingRounds = pgTable('voting_rounds', {
  id: serial('id').primaryKey(),
  fractalId: integer('fractal_id').references(() => fractals.id).notNull(),
  level: integer('level').notNull(), // 6, 5, 4, 3, 2, 1
  winnerId: integer('winner_id').references(() => users.id),
  totalVotes: integer('total_votes').default(0),
  voteData: jsonb('vote_data'), // Store vote counts and details
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

// Individual votes
export const votes = pgTable('votes', {
  id: serial('id').primaryKey(),
  roundId: integer('round_id').references(() => votingRounds.id).notNull(),
  voterId: integer('voter_id').references(() => users.id).notNull(),
  candidateId: integer('candidate_id').references(() => users.id).notNull(),
  votedAt: timestamp('voted_at').defaultNow(),
});

// User achievements/badges
export const achievements = pgTable('achievements', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  type: varchar('type', { length: 100 }).notNull(), // 'first_win', 'facilitator', 'voter', etc.
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  iconUrl: varchar('icon_url', { length: 500 }),
  earnedAt: timestamp('earned_at').defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  facilitatedFractals: many(fractals),
  participations: many(fractalParticipants),
  votes: many(votes),
  achievements: many(achievements),
}));

export const fractalsRelations = relations(fractals, ({ one, many }) => ({
  facilitator: one(users, {
    fields: [fractals.facilitatorId],
    references: [users.id],
  }),
  participants: many(fractalParticipants),
  rounds: many(votingRounds),
}));

export const fractalParticipantsRelations = relations(fractalParticipants, ({ one }) => ({
  fractal: one(fractals, {
    fields: [fractalParticipants.fractalId],
    references: [fractals.id],
  }),
  user: one(users, {
    fields: [fractalParticipants.userId],
    references: [users.id],
  }),
}));

export const votingRoundsRelations = relations(votingRounds, ({ one, many }) => ({
  fractal: one(fractals, {
    fields: [votingRounds.fractalId],
    references: [fractals.id],
  }),
  winner: one(users, {
    fields: [votingRounds.winnerId],
    references: [users.id],
  }),
  votes: many(votes),
}));

export const votesRelations = relations(votes, ({ one }) => ({
  round: one(votingRounds, {
    fields: [votes.roundId],
    references: [votingRounds.id],
  }),
  voter: one(users, {
    fields: [votes.voterId],
    references: [users.id],
  }),
  candidate: one(users, {
    fields: [votes.candidateId],
    references: [users.id],
  }),
}));

export const achievementsRelations = relations(achievements, ({ one }) => ({
  user: one(users, {
    fields: [achievements.userId],
    references: [users.id],
  }),
}));
