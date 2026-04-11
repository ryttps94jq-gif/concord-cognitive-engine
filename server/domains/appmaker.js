// server/domains/appmaker.js
// Domain actions for app building/prototyping: scaffold generation,
// UI complexity measurement, and wireframe validation.

export default function registerAppmakerActions(registerLensAction) {
  /**
   * scaffoldApp
   * Generate app scaffold structure from a spec. Builds component tree,
   * route mapping, and state management plan.
   * artifact.data.spec = { pages: [{ name, path, components: [{ type, props?, children? }] }], auth?: bool }
   * params.framework = "react" | "vue" | "svelte" (default "react")
   */
  registerLensAction("app-maker", "scaffoldApp", (ctx, artifact, params) => {
    const spec = artifact.data?.spec || {};
    const pages = spec.pages || [];
    const framework = params.framework || "react";
    const hasAuth = spec.auth !== false;

    if (pages.length === 0) return { ok: true, result: { message: "No pages defined in spec." } };

    // Build component tree with deduplication
    const componentRegistry = {};
    let totalComponents = 0;

    function walkComponents(comps, parentPath) {
      const nodes = [];
      for (const comp of comps || []) {
        totalComponents++;
        const id = `${parentPath}/${comp.type || "Unknown"}`;
        const node = {
          type: comp.type || "Unknown",
          path: id,
          props: Object.keys(comp.props || {}),
          childCount: (comp.children || []).length,
          children: walkComponents(comp.children, id),
        };
        nodes.push(node);

        // Track component reuse
        const key = comp.type || "Unknown";
        if (!componentRegistry[key]) componentRegistry[key] = { count: 0, locations: [] };
        componentRegistry[key].count++;
        componentRegistry[key].locations.push(parentPath);
      }
      return nodes;
    }

    // Build route map
    const routes = pages.map(page => {
      const tree = walkComponents(page.components, `/${page.name}`);
      const isDynamic = (page.path || "").includes(":");
      const paramNames = ((page.path || "").match(/:(\w+)/g) || []).map(p => p.slice(1));
      return {
        name: page.name,
        path: page.path || `/${page.name.toLowerCase()}`,
        dynamic: isDynamic,
        params: paramNames,
        componentTree: tree,
        componentCount: tree.reduce(function countNodes(sum, n) {
          return sum + 1 + n.children.reduce(countNodes, 0);
        }, 0),
      };
    });

    // Compute max nesting depth
    function maxDepth(nodes) {
      if (!nodes || nodes.length === 0) return 0;
      return 1 + Math.max(...nodes.map(n => maxDepth(n.children)));
    }
    const deepestNesting = Math.max(...routes.map(r => maxDepth(r.componentTree)));

    // State management plan: identify shared state from component reuse
    const sharedComponents = Object.entries(componentRegistry)
      .filter(([, info]) => info.count > 1)
      .map(([type, info]) => ({ type, reuseCount: info.count, locations: info.locations }));

    const stateSlices = [];
    if (hasAuth) stateSlices.push({ name: "auth", fields: ["user", "token", "isAuthenticated"], scope: "global" });
    stateSlices.push({ name: "ui", fields: ["theme", "sidebarOpen", "loading"], scope: "global" });

    // Infer data slices from page names
    const pageDataSlices = pages.map(p => ({
      name: p.name.toLowerCase(),
      fields: ["items", "loading", "error", "pagination"],
      scope: "page",
    }));
    stateSlices.push(...pageDataSlices);

    // Generate file structure
    const files = [];
    const srcDir = framework === "svelte" ? "src" : "src";
    files.push({ path: `${srcDir}/App.${framework === "svelte" ? "svelte" : framework === "vue" ? "vue" : "jsx"}`, type: "root" });
    files.push({ path: `${srcDir}/router.${framework === "vue" ? "js" : "jsx"}`, type: "routing" });
    if (hasAuth) files.push({ path: `${srcDir}/auth/AuthProvider.${framework === "svelte" ? "svelte" : "jsx"}`, type: "auth" });
    for (const route of routes) {
      files.push({ path: `${srcDir}/pages/${route.name}.${framework === "svelte" ? "svelte" : framework === "vue" ? "vue" : "jsx"}`, type: "page" });
    }
    for (const [type] of Object.entries(componentRegistry)) {
      files.push({ path: `${srcDir}/components/${type}.${framework === "svelte" ? "svelte" : framework === "vue" ? "vue" : "jsx"}`, type: "component" });
    }
    files.push({ path: `${srcDir}/store/index.js`, type: "state" });
    for (const slice of stateSlices) {
      files.push({ path: `${srcDir}/store/${slice.name}.js`, type: "state-slice" });
    }

    // Complexity estimate
    const estimatedLOC = totalComponents * 45 + routes.length * 30 + stateSlices.length * 25 + (hasAuth ? 120 : 0);

    artifact.data.scaffold = { files, routes: routes.map(r => ({ name: r.name, path: r.path })) };

    return {
      ok: true, result: {
        framework,
        routes,
        componentRegistry: Object.entries(componentRegistry).map(([type, info]) => ({ type, ...info })),
        stateManagement: { slices: stateSlices, sharedComponents },
        fileStructure: files,
        metrics: {
          totalPages: pages.length,
          totalComponents,
          uniqueComponents: Object.keys(componentRegistry).length,
          maxNestingDepth: deepestNesting,
          totalFiles: files.length,
          estimatedLOC,
          hasAuth,
        },
      },
    };
  });

  /**
   * uiComplexity
   * Measure UI complexity: widget count, nesting depth, interaction paths,
   * and cognitive load estimation.
   * artifact.data.screens = [{ name, widgets: [{ type, interactive?, children? }] }]
   */
  registerLensAction("app-maker", "uiComplexity", (ctx, artifact, params) => {
    const screens = artifact.data?.screens || [];
    if (screens.length === 0) return { ok: true, result: { message: "No screens to analyze." } };

    const interactiveTypes = new Set(["button", "input", "select", "checkbox", "radio", "slider", "toggle", "link", "dropdown", "datepicker", "form"]);

    const screenMetrics = screens.map(screen => {
      let widgetCount = 0;
      let interactiveCount = 0;
      let maxDepth = 0;
      const typeFrequency = {};

      function walk(widgets, depth) {
        for (const w of widgets || []) {
          widgetCount++;
          const wType = (w.type || "unknown").toLowerCase();
          typeFrequency[wType] = (typeFrequency[wType] || 0) + 1;
          if (w.interactive || interactiveTypes.has(wType)) interactiveCount++;
          if (depth > maxDepth) maxDepth = depth;
          walk(w.children, depth + 1);
        }
      }
      walk(screen.widgets, 1);

      // Interaction paths: approximate as permutations of interactive elements
      // bounded by typical user flows (sequential interactions)
      const interactionPaths = interactiveCount <= 1 ? interactiveCount
        : Math.min(interactiveCount * (interactiveCount - 1), 100);

      // Cognitive load estimation (based on Miller's Law and Hick's Law)
      // Miller's Law: 7 +/- 2 items for working memory
      // Hick's Law: decision time = log2(n + 1)
      const millerOverload = widgetCount > 9 ? (widgetCount - 9) / 9 : 0;
      const hicksDecisionTime = interactiveCount > 0 ? Math.log2(interactiveCount + 1) : 0;
      const depthPenalty = maxDepth > 3 ? (maxDepth - 3) * 0.15 : 0;

      // Composite cognitive load score (0-1 scale, higher = more complex)
      const cognitiveLoad = Math.min(1, (millerOverload * 0.4 + hicksDecisionTime / 7 * 0.35 + depthPenalty * 0.25));

      return {
        name: screen.name,
        widgetCount,
        interactiveCount,
        maxNestingDepth: maxDepth,
        interactionPaths,
        typeDistribution: typeFrequency,
        cognitiveLoad: Math.round(cognitiveLoad * 10000) / 100,
        cognitiveLevel: cognitiveLoad > 0.7 ? "overloaded" : cognitiveLoad > 0.4 ? "moderate" : "manageable",
      };
    });

    // Global metrics
    const totalWidgets = screenMetrics.reduce((s, m) => s + m.widgetCount, 0);
    const totalInteractive = screenMetrics.reduce((s, m) => s + m.interactiveCount, 0);
    const avgWidgetsPerScreen = totalWidgets / screenMetrics.length;
    const maxDepthOverall = Math.max(...screenMetrics.map(m => m.maxNestingDepth));
    const avgCognitiveLoad = screenMetrics.reduce((s, m) => s + m.cognitiveLoad, 0) / screenMetrics.length;

    // Consistency score: standard deviation of widget counts across screens
    const widgetStdDev = Math.sqrt(
      screenMetrics.reduce((s, m) => s + Math.pow(m.widgetCount - avgWidgetsPerScreen, 2), 0) / screenMetrics.length
    );
    const consistencyScore = avgWidgetsPerScreen > 0
      ? Math.max(0, 100 - (widgetStdDev / avgWidgetsPerScreen) * 100)
      : 100;

    return {
      ok: true, result: {
        screens: screenMetrics,
        globalMetrics: {
          totalScreens: screens.length,
          totalWidgets,
          totalInteractiveElements: totalInteractive,
          avgWidgetsPerScreen: Math.round(avgWidgetsPerScreen * 100) / 100,
          maxNestingDepth: maxDepthOverall,
          avgCognitiveLoad: Math.round(avgCognitiveLoad * 100) / 100,
          consistencyScore: Math.round(consistencyScore * 100) / 100,
        },
        recommendations: [
          ...(avgCognitiveLoad > 60 ? ["Reduce visual density — average cognitive load is high"] : []),
          ...(maxDepthOverall > 4 ? [`Max nesting depth is ${maxDepthOverall} — flatten component hierarchy`] : []),
          ...(consistencyScore < 50 ? ["High variance in widget counts across screens — consider more consistent layouts"] : []),
          ...(totalInteractive > totalWidgets * 0.7 ? ["Very high ratio of interactive elements — consider grouping related controls"] : []),
        ],
      },
    };
  });

  /**
   * wireframeValidate
   * Validate wireframe consistency: check navigation completeness, identify
   * dead-end screens, and assess action coverage.
   * artifact.data.wireframe = { screens: [{ name, links: [targetScreen], actions: [{ type, target? }] }] }
   */
  registerLensAction("app-maker", "wireframeValidate", (ctx, artifact, params) => {
    const wireframe = artifact.data?.wireframe || {};
    const screens = wireframe.screens || [];
    if (screens.length === 0) return { ok: true, result: { message: "No wireframe screens to validate." } };

    const screenNames = new Set(screens.map(s => s.name));
    const issues = [];

    // Build navigation graph
    const navGraph = {};
    const inDegree = {};
    for (const name of screenNames) {
      navGraph[name] = new Set();
      inDegree[name] = 0;
    }

    for (const screen of screens) {
      const links = screen.links || [];
      const actions = screen.actions || [];
      const targets = [...links, ...actions.filter(a => a.target).map(a => a.target)];

      for (const target of targets) {
        if (!screenNames.has(target)) {
          issues.push({ type: "broken_link", screen: screen.name, target, severity: "error" });
        } else {
          navGraph[screen.name].add(target);
          inDegree[target]++;
        }
      }
    }

    // Detect dead-end screens (no outgoing links except to self)
    const deadEnds = [];
    for (const screen of screens) {
      const outgoing = [...(navGraph[screen.name] || [])].filter(t => t !== screen.name);
      if (outgoing.length === 0) {
        deadEnds.push(screen.name);
        issues.push({ type: "dead_end", screen: screen.name, severity: "warning" });
      }
    }

    // Detect orphan screens (no incoming links, except the entry/home screen)
    const entryScreen = screens[0]?.name;
    const orphans = [];
    for (const [name, deg] of Object.entries(inDegree)) {
      if (deg === 0 && name !== entryScreen) {
        orphans.push(name);
        issues.push({ type: "orphan_screen", screen: name, severity: "warning" });
      }
    }

    // Navigation completeness: BFS from entry to check reachability
    const reachable = new Set();
    if (entryScreen) {
      const queue = [entryScreen];
      reachable.add(entryScreen);
      while (queue.length > 0) {
        const current = queue.shift();
        for (const neighbor of navGraph[current] || []) {
          if (!reachable.has(neighbor)) {
            reachable.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
    }
    const unreachable = [...screenNames].filter(s => !reachable.has(s));
    for (const s of unreachable) {
      issues.push({ type: "unreachable", screen: s, severity: "error" });
    }

    // Action coverage: check that common actions are present
    const requiredActionTypes = new Set(["navigate", "submit", "cancel", "back"]);
    const allActionTypes = new Set();
    for (const screen of screens) {
      for (const action of screen.actions || []) {
        allActionTypes.add(action.type);
      }
    }
    const missingActionTypes = [...requiredActionTypes].filter(a => !allActionTypes.has(a));
    if (missingActionTypes.length > 0) {
      issues.push({ type: "missing_action_types", missingTypes: missingActionTypes, severity: "info" });
    }

    // Screen-level action coverage
    const screenCoverage = screens.map(screen => {
      const actionTypes = new Set((screen.actions || []).map(a => a.type));
      const hasNavigation = (screen.links || []).length > 0 || actionTypes.has("navigate");
      return {
        name: screen.name,
        linkCount: (screen.links || []).length,
        actionCount: (screen.actions || []).length,
        hasNavigation,
        actionTypes: [...actionTypes],
      };
    });

    // Compute navigation depth (longest shortest path from entry)
    let maxNavDepth = 0;
    if (entryScreen) {
      const distances = { [entryScreen]: 0 };
      const bfsQueue = [entryScreen];
      while (bfsQueue.length > 0) {
        const current = bfsQueue.shift();
        for (const neighbor of navGraph[current] || []) {
          if (distances[neighbor] === undefined) {
            distances[neighbor] = distances[current] + 1;
            maxNavDepth = Math.max(maxNavDepth, distances[neighbor]);
            bfsQueue.push(neighbor);
          }
        }
      }
    }

    const navigationCompleteness = screenNames.size > 0
      ? Math.round((reachable.size / screenNames.size) * 10000) / 100
      : 100;

    return {
      ok: true, result: {
        valid: issues.filter(i => i.severity === "error").length === 0,
        issues,
        summary: {
          totalScreens: screens.length,
          reachableScreens: reachable.size,
          deadEndScreens: deadEnds.length,
          orphanScreens: orphans.length,
          unreachableScreens: unreachable.length,
          navigationCompleteness,
          maxNavigationDepth: maxNavDepth,
          errorCount: issues.filter(i => i.severity === "error").length,
          warningCount: issues.filter(i => i.severity === "warning").length,
        },
        screenCoverage,
        deadEnds,
        orphans,
        unreachable,
      },
    };
  });
}
