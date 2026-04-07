// server/domains/crypto.js
// Domain actions for crypto: portfolio analytics, transaction verification,
// gas estimation, risk scoring, and on-chain pattern detection.

export default function registerCryptoActions(registerLensAction) {
  /**
   * portfolioAnalysis
   * Compute portfolio metrics from artifact.data.holdings:
   * [{ token, amount, priceUsd, costBasis? }]
   * Returns allocation breakdown, concentration risk (HHI), unrealized P&L,
   * and diversification score.
   */
  registerLensAction("crypto", "portfolioAnalysis", (ctx, artifact, _params) => {
    const holdings = artifact.data?.holdings || [];
    if (holdings.length === 0) {
      return { ok: true, result: { holdings: [], totalValue: 0, message: "No holdings to analyze." } };
    }

    // Compute per-holding value
    const valued = holdings.map(h => {
      const amount = h.amount || 0;
      const price = h.priceUsd || 0;
      const value = amount * price;
      const costBasis = h.costBasis != null ? h.costBasis : null;
      const unrealizedPnl = costBasis != null ? value - costBasis : null;
      const pnlPercent = costBasis != null && costBasis > 0
        ? Math.round(((value - costBasis) / costBasis) * 10000) / 100
        : null;
      return { token: h.token, amount, priceUsd: price, value, costBasis, unrealizedPnl, pnlPercent };
    });

    const totalValue = valued.reduce((s, h) => s + h.value, 0);

    // Allocation weights and Herfindahl-Hirschman Index (concentration risk)
    const allocations = valued.map(h => {
      const weight = totalValue > 0 ? h.value / totalValue : 0;
      return { ...h, weight: Math.round(weight * 10000) / 100 };
    }).sort((a, b) => b.value - a.value);

    const hhi = allocations.reduce((s, h) => {
      const w = h.weight / 100;
      return s + w * w;
    }, 0);

    // Concentration thresholds
    const concentrationRisk = hhi > 0.5 ? "critical" : hhi > 0.25 ? "high" : hhi > 0.15 ? "moderate" : "low";

    const totalUnrealizedPnl = valued
      .filter(h => h.unrealizedPnl != null)
      .reduce((s, h) => s + h.unrealizedPnl, 0);
    const totalCostBasis = valued
      .filter(h => h.costBasis != null)
      .reduce((s, h) => s + h.costBasis, 0);

    // Stablecoin exposure
    const stablecoins = new Set(["USDT", "USDC", "DAI", "BUSD", "TUSD", "FRAX", "LUSD", "USDP"]);
    const stablecoinWeight = allocations
      .filter(h => stablecoins.has((h.token || "").toUpperCase()))
      .reduce((s, h) => s + h.weight, 0);

    artifact.data.lastAnalysis = {
      totalValue: Math.round(totalValue * 100) / 100,
      hhi: Math.round(hhi * 10000) / 10000,
      concentrationRisk,
      analyzedAt: new Date().toISOString(),
    };

    return {
      ok: true, result: {
        allocations, totalValue: Math.round(totalValue * 100) / 100,
        hhi: Math.round(hhi * 10000) / 10000, concentrationRisk,
        totalUnrealizedPnl: Math.round(totalUnrealizedPnl * 100) / 100,
        totalCostBasis: Math.round(totalCostBasis * 100) / 100,
        overallPnlPercent: totalCostBasis > 0 ? Math.round(((totalValue - totalCostBasis) / totalCostBasis) * 10000) / 100 : null,
        stablecoinExposure: Math.round(stablecoinWeight * 100) / 100,
        holdingCount: holdings.length,
      },
    };
  });

  /**
   * verifyTransaction
   * Validate a transaction object for structural integrity, gas sanity,
   * and replay-attack indicators.
   * artifact.data.transaction = { from, to, value, gasLimit, gasPrice, nonce, chainId, data? }
   */
  registerLensAction("crypto", "verifyTransaction", (ctx, artifact, params) => {
    const tx = params.transaction || artifact.data?.transaction || {};
    const checks = [];

    // Address format validation (Ethereum-style)
    const ethAddrRe = /^0x[0-9a-fA-F]{40}$/;
    checks.push({ field: "from", valid: ethAddrRe.test(tx.from || ""), value: tx.from });
    checks.push({ field: "to", valid: ethAddrRe.test(tx.to || ""), value: tx.to });

    // Self-send detection
    if (tx.from && tx.to && tx.from.toLowerCase() === tx.to.toLowerCase()) {
      checks.push({ field: "self_send", valid: false, warning: "Transaction sends to self" });
    }

    // Value sanity
    const value = parseFloat(tx.value || 0);
    checks.push({ field: "value", valid: value >= 0, value, warning: value === 0 && !tx.data ? "Zero-value transfer with no data (possible mistake)" : undefined });

    // Gas sanity checks
    const gasLimit = parseInt(tx.gasLimit || 0);
    const gasPrice = parseFloat(tx.gasPrice || 0);
    checks.push({ field: "gasLimit", valid: gasLimit >= 21000, value: gasLimit, warning: gasLimit > 10000000 ? "Unusually high gas limit" : gasLimit < 21000 ? "Below minimum gas for simple transfer" : undefined });
    checks.push({ field: "gasPrice", valid: gasPrice > 0, value: gasPrice, warning: gasPrice > 500 ? "Extremely high gas price (Gwei) — possible overpay" : undefined });

    // Nonce check
    const nonce = parseInt(tx.nonce);
    checks.push({ field: "nonce", valid: !isNaN(nonce) && nonce >= 0, value: nonce });

    // Chain ID (replay protection)
    const chainId = parseInt(tx.chainId);
    const knownChains = { 1: "Ethereum", 137: "Polygon", 56: "BSC", 42161: "Arbitrum", 10: "Optimism", 43114: "Avalanche", 8453: "Base" };
    checks.push({ field: "chainId", valid: !isNaN(chainId) && chainId > 0, value: chainId, network: knownChains[chainId] || "unknown" });

    // Max transaction cost
    const maxCostEth = (gasLimit * gasPrice) / 1e9;
    const totalCostEth = value + maxCostEth;

    const allValid = checks.every(c => c.valid);
    const warnings = checks.filter(c => c.warning).map(c => c.warning);

    return {
      ok: true, result: {
        valid: allValid, checks, warnings,
        maxGasCostEth: Math.round(maxCostEth * 1e8) / 1e8,
        totalCostEth: Math.round(totalCostEth * 1e8) / 1e8,
        network: knownChains[chainId] || "unknown",
      },
    };
  });

  /**
   * estimateGas
   * Estimate optimal gas settings from recent block data.
   * artifact.data.recentBlocks = [{ baseFee, gasUsed, gasLimit, txCount }]
   * Returns slow/standard/fast recommendations using EIP-1559 logic.
   */
  registerLensAction("crypto", "estimateGas", (ctx, artifact, params) => {
    const blocks = artifact.data?.recentBlocks || [];
    const txType = params.txType || "transfer"; // transfer, swap, deploy, nft

    // Base gas requirements by transaction type
    const baseGasMap = { transfer: 21000, swap: 150000, deploy: 500000, nft: 65000, erc20: 65000 };
    const baseGas = baseGasMap[txType] || 21000;

    if (blocks.length === 0) {
      // Fallback estimates when no block data available
      return {
        ok: true, result: {
          gasLimit: Math.ceil(baseGas * 1.2),
          recommendations: {
            slow: { maxFeeGwei: 10, priorityFeeGwei: 1, waitBlocks: "6+" },
            standard: { maxFeeGwei: 20, priorityFeeGwei: 2, waitBlocks: "2-4" },
            fast: { maxFeeGwei: 40, priorityFeeGwei: 3, waitBlocks: "1-2" },
          },
          source: "fallback",
        },
      };
    }

    // Compute base fee statistics from recent blocks
    const baseFees = blocks.map(b => b.baseFee || 0).filter(f => f > 0);
    const avgBaseFee = baseFees.reduce((s, f) => s + f, 0) / baseFees.length;
    const maxBaseFee = Math.max(...baseFees);
    const minBaseFee = Math.min(...baseFees);
    const baseFeeVolatility = avgBaseFee > 0
      ? Math.sqrt(baseFees.reduce((s, f) => s + Math.pow(f - avgBaseFee, 2), 0) / baseFees.length) / avgBaseFee
      : 0;

    // Network congestion from gas utilization
    const utilizations = blocks.map(b => b.gasLimit > 0 ? b.gasUsed / b.gasLimit : 0.5);
    const avgUtilization = utilizations.reduce((s, u) => s + u, 0) / utilizations.length;
    const congestion = avgUtilization > 0.9 ? "high" : avgUtilization > 0.5 ? "moderate" : "low";

    // EIP-1559 priority fee recommendations scaled by congestion
    const congestionMultiplier = avgUtilization > 0.8 ? 2 : avgUtilization > 0.5 ? 1.2 : 1;
    const slow = { maxFeeGwei: Math.round(avgBaseFee * 1.1), priorityFeeGwei: Math.max(1, Math.round(1 * congestionMultiplier)), waitBlocks: "6+" };
    const standard = { maxFeeGwei: Math.round(avgBaseFee * 1.5), priorityFeeGwei: Math.max(2, Math.round(2 * congestionMultiplier)), waitBlocks: "2-4" };
    const fast = { maxFeeGwei: Math.round(maxBaseFee * 2), priorityFeeGwei: Math.max(3, Math.round(5 * congestionMultiplier)), waitBlocks: "1-2" };

    return {
      ok: true, result: {
        gasLimit: Math.ceil(baseGas * 1.2),
        txType, baseGas,
        baseFeeStats: {
          avg: Math.round(avgBaseFee * 100) / 100,
          min: Math.round(minBaseFee * 100) / 100,
          max: Math.round(maxBaseFee * 100) / 100,
          volatility: Math.round(baseFeeVolatility * 10000) / 10000,
        },
        networkCongestion: congestion,
        avgUtilization: Math.round(avgUtilization * 100),
        recommendations: { slow, standard, fast },
        blocksAnalyzed: blocks.length,
        source: "block_analysis",
      },
    };
  });

  /**
   * detectPatterns
   * Analyze transaction history for on-chain patterns: wash trading,
   * circular flows, whale movements, and frequency anomalies.
   * artifact.data.transactions = [{ from, to, value, timestamp, hash? }]
   */
  registerLensAction("crypto", "detectPatterns", (ctx, artifact, _params) => {
    const txs = artifact.data?.transactions || [];
    if (txs.length < 2) {
      return { ok: true, result: { patterns: [], message: "Need at least 2 transactions for pattern detection." } };
    }

    const patterns = [];

    // 1. Circular flow detection: A→B→C→A
    const flowGraph = {};
    for (const tx of txs) {
      if (!tx.from || !tx.to) continue;
      const key = tx.from.toLowerCase();
      if (!flowGraph[key]) flowGraph[key] = [];
      flowGraph[key].push({ to: tx.to.toLowerCase(), value: parseFloat(tx.value || 0), timestamp: tx.timestamp });
    }

    const visited = new Set();
    for (const start of Object.keys(flowGraph)) {
      const queue = [[start]];
      while (queue.length > 0) {
        const path = queue.shift();
        const current = path[path.length - 1];
        if (path.length > 2 && current === start) {
          const pathKey = path.join("→");
          if (!visited.has(pathKey)) {
            visited.add(pathKey);
            patterns.push({ type: "circular_flow", path: path.map(a => a.slice(0, 10) + "..."), hops: path.length - 1, risk: "high" });
          }
          continue;
        }
        if (path.length > 5) continue; // limit search depth
        for (const edge of (flowGraph[current] || [])) {
          if (path.length > 1 && path.includes(edge.to) && edge.to !== start) continue;
          queue.push([...path, edge.to]);
        }
      }
      if (patterns.filter(p => p.type === "circular_flow").length >= 5) break; // cap results
    }

    // 2. Wash trading detection: same pair trading back and forth
    const pairCounts = {};
    for (const tx of txs) {
      if (!tx.from || !tx.to) continue;
      const pair = [tx.from.toLowerCase(), tx.to.toLowerCase()].sort().join("|");
      pairCounts[pair] = (pairCounts[pair] || 0) + 1;
    }
    for (const [pair, count] of Object.entries(pairCounts)) {
      if (count >= 3) {
        const [a, b] = pair.split("|");
        patterns.push({
          type: "wash_trading_suspect", addressA: a.slice(0, 10) + "...",
          addressB: b.slice(0, 10) + "...", occurrences: count, risk: count >= 5 ? "high" : "moderate",
        });
      }
    }

    // 3. Whale movements: single transactions > 2 standard deviations above mean
    const values = txs.map(tx => parseFloat(tx.value || 0)).filter(v => v > 0);
    if (values.length > 0) {
      const mean = values.reduce((s, v) => s + v, 0) / values.length;
      const stdDev = Math.sqrt(values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length);
      const threshold = mean + 2 * stdDev;
      const whales = txs.filter(tx => parseFloat(tx.value || 0) > threshold);
      if (whales.length > 0) {
        patterns.push({
          type: "whale_movement", count: whales.length,
          threshold: Math.round(threshold * 1e6) / 1e6,
          largest: Math.round(Math.max(...whales.map(w => parseFloat(w.value || 0))) * 1e6) / 1e6,
          risk: "informational",
        });
      }
    }

    // 4. Burst frequency: many transactions in a short window
    const sorted = [...txs].filter(t => t.timestamp).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    for (let i = 0; i < sorted.length - 4; i++) {
      const window = sorted.slice(i, i + 5);
      const spanMs = new Date(window[4].timestamp) - new Date(window[0].timestamp);
      if (spanMs > 0 && spanMs < 60000) { // 5 txs within 1 minute
        patterns.push({ type: "burst_activity", transactionsInWindow: 5, windowMs: spanMs, risk: "moderate" });
        break;
      }
    }

    artifact.data.lastPatternScan = { timestamp: new Date().toISOString(), patternsFound: patterns.length };

    return {
      ok: true, result: {
        patterns, totalTransactions: txs.length,
        riskSummary: {
          high: patterns.filter(p => p.risk === "high").length,
          moderate: patterns.filter(p => p.risk === "moderate").length,
          informational: patterns.filter(p => p.risk === "informational").length,
        },
      },
    };
  });
}
