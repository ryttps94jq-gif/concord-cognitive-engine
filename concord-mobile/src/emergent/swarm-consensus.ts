// Concord Mobile — Swarm Consensus
//
// Implements lightweight swarm consensus for validating shared state across
// mesh peers. Uses a simple quorum-based voting mechanism where proposals
// require >= 2/3 of expected voters to agree before being accepted.

import type { MeshPeer } from '../utils/types';

// ── DTU Store Interface ──────────────────────────────────────────────────────

export interface DTUStore {
  getByType(type: number): import('../utils/types').DTU[];
  getByTags(tags: string[]): import('../utils/types').DTU[];
  size(): number;
}

// ── Local Types ──────────────────────────────────────────────────────────────

interface VoteRecord {
  peerId: string;
  vote: boolean;
  receivedAt: number;
}

type ProposalStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

interface ConsensusProposal {
  id: string;
  topic: string;
  value: string;
  proposerId: string;
  createdAt: number;
  expiresAt: number;
  expectedVoters: string[];
  votes: VoteRecord[];
  quorumThreshold: number; // fraction, e.g. 0.667
  status: ProposalStatus;
}

interface QuorumResult {
  reached: boolean;
  accepted: boolean;
  yesVotes: number;
  noVotes: number;
  totalVotes: number;
  expectedVoters: number;
  quorumThreshold: number;
  missingVoters: string[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_QUORUM_THRESHOLD = 2 / 3;
const DEFAULT_PROPOSAL_TTL_MS = 5 * 60 * 1000; // 5 minutes
const PROPOSAL_ID_PREFIX = 'csp_';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate a unique proposal ID from the topic and current timestamp.
 */
function generateProposalId(topic: string, timestamp: number): string {
  const hash = simpleHash(`${topic}:${timestamp}:${Math.random()}`);
  return `${PROPOSAL_ID_PREFIX}${hash}`;
}

/**
 * Simple non-cryptographic hash for proposal IDs. Not security-sensitive.
 */
function simpleHash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

// ── Core Functions ───────────────────────────────────────────────────────────

/**
 * Create a new consensus proposal to be distributed to mesh peers.
 *
 * The proposal is initialized with status "pending" and no votes. The
 * quorum threshold defaults to 2/3 of expected voters. The expected voter
 * list is derived from the provided mesh peers.
 *
 * @param topic - A short string identifying what is being decided
 * @param value - The proposed value (e.g., a JSON-encoded state update)
 * @param meshPeers - Array of currently known mesh peers who will vote
 * @returns A new ConsensusProposal ready for distribution
 */
export function proposeConsensus(
  topic: string,
  value: string,
  meshPeers: MeshPeer[],
  proposerId: string = '',
): ConsensusProposal {
  const now = Date.now();
  const expectedVoters = meshPeers.map((p) => p.id);

  return {
    id: generateProposalId(topic, now),
    topic,
    value,
    proposerId,
    createdAt: now,
    expiresAt: now + DEFAULT_PROPOSAL_TTL_MS,
    expectedVoters,
    votes: [],
    quorumThreshold: DEFAULT_QUORUM_THRESHOLD,
    status: 'pending',
  };
}

/**
 * Process a vote from a peer on an existing proposal.
 *
 * Validates that the peer is an expected voter and has not already voted.
 * After recording the vote, checks whether quorum has been reached and
 * updates the proposal status accordingly.
 *
 * @param proposal - The proposal being voted on (will be returned as a new object)
 * @param peerId - The ID of the voting peer
 * @param vote - true for accept, false for reject
 * @returns An updated copy of the proposal with the new vote applied
 */
export function processVote(
  proposal: ConsensusProposal,
  peerId: string,
  vote: boolean,
): ConsensusProposal {
  // Return unchanged if proposal is not pending
  if (proposal.status !== 'pending') {
    return { ...proposal };
  }

  // Ignore votes from peers not in the expected voter list
  if (!proposal.expectedVoters.includes(peerId)) {
    return { ...proposal };
  }

  // Ignore duplicate votes
  if (proposal.votes.some((v) => v.peerId === peerId)) {
    return { ...proposal };
  }

  const now = Date.now();

  // Check if proposal has expired
  if (now > proposal.expiresAt) {
    return {
      ...proposal,
      status: 'expired',
    };
  }

  const newVote: VoteRecord = {
    peerId,
    vote,
    receivedAt: now,
  };

  const updatedVotes = [...proposal.votes, newVote];
  const updated: ConsensusProposal = {
    ...proposal,
    votes: updatedVotes,
  };

  // Check quorum after adding the vote
  const quorum = checkQuorum(updated);
  if (quorum.reached) {
    updated.status = quorum.accepted ? 'accepted' : 'rejected';
  }

  return updated;
}

/**
 * Determine whether a proposal has reached quorum.
 *
 * Quorum is reached when the number of votes (yes or no) meets or exceeds
 * the quorum threshold fraction of expected voters. The proposal is accepted
 * if yes votes >= 2/3 of expected voters; it is rejected if no votes exceed
 * 1/3 of expected voters (making acceptance impossible).
 *
 * @param proposal - The proposal to check
 * @returns A QuorumResult with detailed vote counts and status
 */
export function checkQuorum(proposal: ConsensusProposal): QuorumResult {
  const yesVotes = proposal.votes.filter((v) => v.vote === true).length;
  const noVotes = proposal.votes.filter((v) => v.vote === false).length;
  const totalVotes = proposal.votes.length;
  const expectedCount = proposal.expectedVoters.length;

  const votedPeerIds = new Set(proposal.votes.map((v) => v.peerId));
  const missingVoters = proposal.expectedVoters.filter((id) => !votedPeerIds.has(id));

  const quorumThreshold = proposal.quorumThreshold;
  const requiredForAccept = Math.ceil(expectedCount * quorumThreshold);

  // Accepted if yes votes meet quorum threshold
  const accepted = yesVotes >= requiredForAccept;

  // Rejected if it is mathematically impossible to reach quorum
  // (remaining possible yes votes + current yes votes < required)
  const maxPossibleYes = yesVotes + missingVoters.length;
  const impossibleToAccept = maxPossibleYes < requiredForAccept;

  const reached = accepted || impossibleToAccept;

  return {
    reached,
    accepted,
    yesVotes,
    noVotes,
    totalVotes,
    expectedVoters: expectedCount,
    quorumThreshold,
    missingVoters,
  };
}

/**
 * Find and return IDs of proposals that have expired.
 *
 * This function does not mutate the map; the caller is responsible for
 * removing or updating expired proposals.
 *
 * @param proposals - Map of proposal ID to ConsensusProposal
 * @param now - Current timestamp in milliseconds
 * @returns Array of proposal IDs that have expired
 */
export function expireProposals(
  proposals: Map<string, ConsensusProposal>,
  now: number,
): string[] {
  const expired: string[] = [];

  for (const [id, proposal] of proposals) {
    if (proposal.status === 'pending' && now > proposal.expiresAt) {
      expired.push(id);
    }
  }

  return expired;
}

// ── Re-export types for testing ──────────────────────────────────────────────
export type { ConsensusProposal, QuorumResult, VoteRecord, ProposalStatus };
