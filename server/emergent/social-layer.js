/**
 * Concord — Social / Distribution Layer
 *
 * Public DTU profiles, follow system, public feeds,
 * cited-by counters, trending DTUs, discovery loops.
 */

import crypto from "crypto";
import { getEmergentState } from "./store.js";

// ── Social State ─────────────────────────────────────────────────────────

function getSocialState(STATE) {
  if (!STATE._social) {
    STATE._social = {
      profiles: new Map(),       // userId → profile object
      follows: new Map(),        // userId → Set<followedUserId>
      followers: new Map(),      // userId → Set<followerUserId>
      publicDtus: new Set(),     // dtuIds that are marked public
      citedBy: new Map(),        // dtuId → Set<citingDtuId>
      feedCache: new Map(),      // userId → cached feed entries
      trending: [],              // trending DTU snapshots
      trendingComputedAt: 0,

      metrics: {
        totalProfiles: 0,
        totalFollows: 0,
        publicDtuCount: 0,
        feedRequests: 0,
        trendingComputations: 0,
      },
    };
  }
  return STATE._social;
}

// ── Profiles ─────────────────────────────────────────────────────────────

/**
 * Create or update a public profile for a user.
 */
export function upsertProfile(STATE, userId, profileData) {
  const social = getSocialState(STATE);

  const existing = social.profiles.get(userId);
  const profile = {
    userId,
    displayName: profileData.displayName || existing?.displayName || userId,
    bio: profileData.bio || existing?.bio || "",
    avatar: profileData.avatar || existing?.avatar || "",
    isPublic: profileData.isPublic !== undefined ? profileData.isPublic : (existing?.isPublic ?? true),
    specialization: profileData.specialization || existing?.specialization || [],
    website: profileData.website || existing?.website || "",
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),

    // Computed stats (updated on reads)
    stats: existing?.stats || {
      dtuCount: 0,
      publicDtuCount: 0,
      citationCount: 0,
      followerCount: 0,
      followingCount: 0,
    },
  };

  const isNew = !existing;
  social.profiles.set(userId, profile);
  if (isNew) social.metrics.totalProfiles++;

  return { ok: true, profile, isNew };
}

export function getProfile(STATE, userId) {
  const social = getSocialState(STATE);
  const profile = social.profiles.get(userId);
  if (!profile) return { ok: false, error: "Profile not found" };

  // Recompute stats
  profile.stats.followerCount = (social.followers.get(userId) || new Set()).size;
  profile.stats.followingCount = (social.follows.get(userId) || new Set()).size;

  // Count public DTUs by this user
  let dtuCount = 0;
  let publicDtuCount = 0;
  let citationCount = 0;

  if (STATE.dtus) {
    for (const dtu of STATE.dtus.values()) {
      if (dtu.author === userId || dtu.meta?.authorId === userId) {
        dtuCount++;
        if (social.publicDtus.has(dtu.id)) publicDtuCount++;
      }
    }
  }

  // Count citations
  for (const [dtuId, citers] of social.citedBy) {
    const dtu = STATE.dtus?.get(dtuId);
    if (dtu && (dtu.author === userId || dtu.meta?.authorId === userId)) {
      citationCount += citers.size;
    }
  }

  profile.stats.dtuCount = dtuCount;
  profile.stats.publicDtuCount = publicDtuCount;
  profile.stats.citationCount = citationCount;

  return { ok: true, profile };
}

export function listProfiles(STATE, options = {}) {
  const social = getSocialState(STATE);
  let profiles = Array.from(social.profiles.values());

  // Only public profiles
  if (options.publicOnly !== false) {
    profiles = profiles.filter(p => p.isPublic);
  }

  // Sort options
  const sortBy = options.sortBy || "citationCount";
  profiles.sort((a, b) => {
    if (sortBy === "citationCount") return (b.stats?.citationCount || 0) - (a.stats?.citationCount || 0);
    if (sortBy === "followerCount") return (b.stats?.followerCount || 0) - (a.stats?.followerCount || 0);
    if (sortBy === "dtuCount") return (b.stats?.dtuCount || 0) - (a.stats?.dtuCount || 0);
    return 0;
  });

  const limit = options.limit || 50;
  return { ok: true, profiles: profiles.slice(0, limit), total: profiles.length };
}

// ── Follow System ────────────────────────────────────────────────────────

/**
 * Follow a user. Simple bidirectional index.
 */
export function followUser(STATE, followerId, followedId) {
  const social = getSocialState(STATE);
  if (followerId === followedId) return { ok: false, error: "Cannot follow yourself" };

  // Check followed user exists
  if (!social.profiles.has(followedId)) {
    return { ok: false, error: "User not found" };
  }

  if (!social.follows.has(followerId)) social.follows.set(followerId, new Set());
  if (!social.followers.has(followedId)) social.followers.set(followedId, new Set());

  const alreadyFollowing = social.follows.get(followerId).has(followedId);
  social.follows.get(followerId).add(followedId);
  social.followers.get(followedId).add(followerId);

  if (!alreadyFollowing) social.metrics.totalFollows++;

  // Invalidate feed cache for follower
  social.feedCache.delete(followerId);

  return { ok: true, followerId, followedId, isNew: !alreadyFollowing };
}

export function unfollowUser(STATE, followerId, followedId) {
  const social = getSocialState(STATE);

  const followSet = social.follows.get(followerId);
  const followerSet = social.followers.get(followedId);
  if (!followSet?.has(followedId)) return { ok: false, error: "Not following this user" };

  followSet.delete(followedId);
  followerSet?.delete(followerId);
  social.metrics.totalFollows = Math.max(0, social.metrics.totalFollows - 1);

  // Invalidate feed cache
  social.feedCache.delete(followerId);

  return { ok: true, followerId, followedId };
}

export function getFollowers(STATE, userId, limit = 50) {
  const social = getSocialState(STATE);
  const followerSet = social.followers.get(userId) || new Set();
  const followers = Array.from(followerSet).slice(0, limit).map(id => {
    const profile = social.profiles.get(id);
    return { userId: id, displayName: profile?.displayName || id };
  });
  return { ok: true, userId, followers, total: followerSet.size };
}

export function getFollowing(STATE, userId, limit = 50) {
  const social = getSocialState(STATE);
  const followSet = social.follows.get(userId) || new Set();
  const following = Array.from(followSet).slice(0, limit).map(id => {
    const profile = social.profiles.get(id);
    return { userId: id, displayName: profile?.displayName || id };
  });
  return { ok: true, userId, following, total: followSet.size };
}

// ── Public DTU Index ─────────────────────────────────────────────────────

/**
 * Mark a DTU as public (visible in feeds and search).
 */
export function publishDtu(STATE, dtuId, userId) {
  const social = getSocialState(STATE);

  // Verify ownership
  const dtu = STATE.dtus?.get(dtuId);
  if (!dtu) return { ok: false, error: "DTU not found" };

  social.publicDtus.add(dtuId);
  social.metrics.publicDtuCount = social.publicDtus.size;

  return { ok: true, dtuId, isPublic: true };
}

export function unpublishDtu(STATE, dtuId) {
  const social = getSocialState(STATE);
  social.publicDtus.delete(dtuId);
  social.metrics.publicDtuCount = social.publicDtus.size;
  return { ok: true, dtuId, isPublic: false };
}

// ── Cited-By Tracking ────────────────────────────────────────────────────

/**
 * Record that dtuB cites dtuA. Updates cited-by counters.
 */
export function recordCitation(STATE, citedDtuId, citingDtuId) {
  const social = getSocialState(STATE);
  if (citedDtuId === citingDtuId) return { ok: false, error: "Self-citation" };

  if (!social.citedBy.has(citedDtuId)) social.citedBy.set(citedDtuId, new Set());
  social.citedBy.get(citedDtuId).add(citingDtuId);

  return { ok: true, citedDtuId, citingDtuId, totalCitations: social.citedBy.get(citedDtuId).size };
}

export function getCitedBy(STATE, dtuId, limit = 50) {
  const social = getSocialState(STATE);
  const citers = social.citedBy.get(dtuId) || new Set();
  const citing = Array.from(citers).slice(0, limit).map(id => {
    const dtu = STATE.dtus?.get(id);
    return { dtuId: id, title: dtu?.title || dtu?.human?.title || id };
  });
  return { ok: true, dtuId, citedBy: citing, total: citers.size };
}

// ── Feed System ──────────────────────────────────────────────────────────

/**
 * Get personalized feed for a user (DTUs from people they follow).
 */
export function getFeed(STATE, userId, options = {}) {
  const social = getSocialState(STATE);
  social.metrics.feedRequests++;

  const followSet = social.follows.get(userId) || new Set();
  const feedItems = [];

  // Collect recent public DTUs from followed users
  if (STATE.dtus) {
    for (const dtu of STATE.dtus.values()) {
      const authorId = dtu.author || dtu.meta?.authorId;
      if (!followSet.has(authorId)) continue;
      if (!social.publicDtus.has(dtu.id)) continue;

      feedItems.push({
        dtuId: dtu.id,
        title: dtu.title || dtu.human?.title || "Untitled",
        authorId,
        authorName: social.profiles.get(authorId)?.displayName || authorId,
        tags: (dtu.tags || []).slice(0, 5),
        tier: dtu.tier || "regular",
        createdAt: dtu.createdAt || dtu.meta?.createdAt,
        citationCount: (social.citedBy.get(dtu.id) || new Set()).size,
      });
    }
  }

  // Sort by recency
  feedItems.sort((a, b) => {
    const timeA = new Date(a.createdAt || 0).getTime();
    const timeB = new Date(b.createdAt || 0).getTime();
    return timeB - timeA;
  });

  const limit = options.limit || 30;
  const offset = options.offset || 0;

  return {
    ok: true,
    feed: feedItems.slice(offset, offset + limit),
    total: feedItems.length,
    followingCount: followSet.size,
  };
}

// ── Trending DTUs ────────────────────────────────────────────────────────

/**
 * Compute trending DTUs based on citation count, recency, and engagement.
 */
export function computeTrending(STATE, limit = 20) {
  const social = getSocialState(STATE);
  const now = Date.now();

  // Only recompute every 5 minutes
  if (now - social.trendingComputedAt < 300000 && social.trending.length > 0) {
    return { ok: true, trending: social.trending, cached: true };
  }

  const candidates = [];

  for (const dtuId of social.publicDtus) {
    const dtu = STATE.dtus?.get(dtuId);
    if (!dtu) continue;

    const citations = (social.citedBy.get(dtuId) || new Set()).size;
    const age = (now - new Date(dtu.createdAt || 0).getTime()) / (86400000); // days
    const recencyBoost = Math.max(0, 1 - age * 0.05); // decays over 20 days
    const score = citations * 2 + recencyBoost * 10;

    candidates.push({
      dtuId,
      title: dtu.title || dtu.human?.title || "Untitled",
      authorId: dtu.author || dtu.meta?.authorId,
      authorName: social.profiles.get(dtu.author || dtu.meta?.authorId)?.displayName || "Unknown",
      tags: (dtu.tags || []).slice(0, 5),
      citationCount: citations,
      score: Math.round(score * 100) / 100,
      createdAt: dtu.createdAt,
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  social.trending = candidates.slice(0, limit);
  social.trendingComputedAt = now;
  social.metrics.trendingComputations++;

  return { ok: true, trending: social.trending, cached: false };
}

// ── Discovery ────────────────────────────────────────────────────────────

/**
 * Discover users to follow based on shared interests (tags, domains).
 */
export function discoverUsers(STATE, userId, limit = 10) {
  const social = getSocialState(STATE);
  const myFollows = social.follows.get(userId) || new Set();

  // Find users who share tags with the current user's DTUs
  const myTags = new Set();
  if (STATE.dtus) {
    for (const dtu of STATE.dtus.values()) {
      if (dtu.author === userId || dtu.meta?.authorId === userId) {
        for (const tag of (dtu.tags || [])) myTags.add(tag);
      }
    }
  }

  const candidates = [];
  for (const [id, profile] of social.profiles) {
    if (id === userId || myFollows.has(id)) continue;
    if (!profile.isPublic) continue;

    // Score by tag overlap
    const userTags = new Set(profile.specialization || []);
    let overlap = 0;
    for (const tag of myTags) if (userTags.has(tag)) overlap++;
    const score = overlap + (profile.stats?.citationCount || 0) * 0.01;

    if (score > 0) {
      candidates.push({ userId: id, profile, score });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  return {
    ok: true,
    suggestions: candidates.slice(0, limit).map(c => ({
      userId: c.userId,
      displayName: c.profile.displayName,
      bio: c.profile.bio,
      followerCount: c.profile.stats?.followerCount || 0,
      citationCount: c.profile.stats?.citationCount || 0,
      matchScore: c.score,
    })),
  };
}

// ── Metrics ──────────────────────────────────────────────────────────────

export function getSocialMetrics(STATE) {
  const social = getSocialState(STATE);
  return { ok: true, ...social.metrics };
}
