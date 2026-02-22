export interface FractalEntry {
  id: number;
  group_name: string;
  facilitator_id: string;
  facilitator_name: string;
  fractal_number: string;
  group_number: string;
  guild_id: string;
  thread_id: string;
  rankings: RankingEntry[];
  completed_at: string;
}

export interface RankingEntry {
  user_id: string;
  display_name: string;
  level: number;
  respect: number;
}

export interface CombinedLeaderboardEntry {
  rank: number;
  name: string;
  wallet: string;
  ogRespect: number;
  zorRespect: number;
  offchainRespect: number;
  totalRespect: number;
  participations: number;
}

export interface DashboardStats {
  totalMembers: number;
  totalOGRespect: number;
  totalZORRespect: number;
  totalOffchainRespect: number;
  totalFractals: number;
  activeProposals: number;
}

export interface MemberProfile {
  name: string;
  wallet: string | null;
  hasIntro: boolean;
  introText: string | null;
  ogRespect: number;
  zorRespect: number;
  offchainRespect: number;
  totalRespect: number;
  fractalHistory: FractalParticipation[];
  stats: {
    participations: number;
    firstPlace: number;
    secondPlace: number;
    thirdPlace: number;
    avgRespect: number;
  };
  contributions: ContributionEntry[];
}

export interface FractalParticipation {
  fractalId: number;
  groupName: string;
  date: string;
  rank: number;
  level: number;
  respect: number;
}

export interface ContributionEntry {
  id: number;
  memberName: string;
  type: string;
  description: string;
  respectAmount: number;
  createdAt: string;
}

export interface AllocationEntry {
  id: number;
  memberName: string;
  walletAddress: string;
  amount: number;
  reason: string | null;
  status: string;
  contributionId: number | null;
  createdAt: string;
  distributedAt: string | null;
}

export interface ActivityItem {
  type: 'fractal' | 'proposal' | 'contribution';
  title: string;
  description: string;
  timestamp: string;
}
