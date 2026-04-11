export default function registerSecurityActions(registerLensAction) {
  registerLensAction("security", "incidentTrend", (ctx, artifact, _params) => {
    const incidents = artifact.data?.incidents || [artifact.data];
    const byType = {};
    const byLocation = {};
    const byMonth = {};
    incidents.forEach(inc => {
      const type = inc.type || 'unknown';
      const location = inc.location || 'unknown';
      const month = (inc.date || '').substring(0, 7) || 'unknown';
      byType[type] = (byType[type] || 0) + 1;
      byLocation[location] = (byLocation[location] || 0) + 1;
      byMonth[month] = (byMonth[month] || 0) + 1;
    });
    return { ok: true, result: { byType, byLocation, byMonth, totalIncidents: incidents.length, analyzedAt: new Date().toISOString() } };
  });

  registerLensAction("security", "patrolCoverage", (ctx, artifact, _params) => {
    const checkpoints = artifact.data?.checkpoints || [];
    if (checkpoints.length === 0) return { ok: true, result: { coverage: 0, completed: 0, total: 0 } };
    const completed = checkpoints.filter(cp => cp.status === 'completed' || cp.checkedAt).length;
    const coverage = Math.round((completed / checkpoints.length) * 100);
    const missed = checkpoints.filter(cp => cp.status !== 'completed' && !cp.checkedAt).map(cp => ({ location: cp.location, scheduledTime: cp.time }));
    return { ok: true, result: { patrol: artifact.title, coverage, completed, total: checkpoints.length, missed } };
  });

  registerLensAction("security", "threatMatrix", (ctx, artifact, _params) => {
    const threats = artifact.data?.threats || [artifact.data];
    const matrix = threats.map(t => {
      const severity = t.severity || 3;
      const likelihood = t.probability || t.likelihood || 3;
      const riskScore = severity * likelihood;
      return {
        name: t.name || artifact.title,
        type: t.type || 'unknown',
        severity,
        likelihood,
        riskScore,
        riskLevel: riskScore >= 15 ? 'critical' : riskScore >= 10 ? 'high' : riskScore >= 5 ? 'medium' : 'low',
        mitigations: t.mitigations || [],
      };
    }).sort((a, b) => b.riskScore - a.riskScore);
    return { ok: true, result: { matrix, totalThreats: matrix.length, criticalCount: matrix.filter(m => m.riskLevel === 'critical').length } };
  });

  registerLensAction("security", "incidentEscalate", (ctx, artifact, params) => {
    const incident = artifact.data || {};
    const severity = incident.severity || params.severity || 3;
    const impact = incident.impact || params.impact || 'medium';
    const type = incident.type || params.type || 'unknown';

    const impactScore = { critical: 5, high: 4, medium: 3, low: 2, minimal: 1 }[impact] || 3;
    const escalationScore = severity * impactScore;

    let level, responseTime, notifyRoles;
    if (escalationScore >= 20) {
      level = 'critical';
      responseTime = '15 minutes';
      notifyRoles = ['security_director', 'ciso', 'executive_team', 'incident_commander', 'legal'];
    } else if (escalationScore >= 12) {
      level = 'high';
      responseTime = '1 hour';
      notifyRoles = ['security_manager', 'incident_commander', 'team_lead'];
    } else if (escalationScore >= 6) {
      level = 'medium';
      responseTime = '4 hours';
      notifyRoles = ['security_manager', 'team_lead'];
    } else {
      level = 'low';
      responseTime = '24 hours';
      notifyRoles = ['team_lead'];
    }

    const notifications = notifyRoles.map(role => ({
      role,
      method: escalationScore >= 20 ? 'phone_and_email' : escalationScore >= 12 ? 'email_and_slack' : 'email',
      priority: level,
    }));

    return {
      ok: true,
      result: {
        incidentId: artifact.id,
        title: artifact.title,
        type,
        severity,
        impact,
        escalationScore,
        escalationLevel: level,
        requiredResponseTime: responseTime,
        notifications,
        escalatedAt: new Date().toISOString(),
      },
    };
  });

  registerLensAction("security", "threatAssessment", (ctx, artifact, _params) => {
    const threats = artifact.data?.threats || [artifact.data];
    const assessments = threats.map(t => {
      const probability = parseFloat(t.probability || t.likelihood) || 3;
      const impact = parseFloat(t.impact || t.severity) || 3;
      const riskScore = Math.round(probability * impact * 100) / 100;
      const vulnerabilities = t.vulnerabilities || [];
      const existingControls = t.controls || t.mitigations || [];
      const controlEffectiveness = existingControls.length > 0
        ? Math.round(existingControls.filter(c => c.status === 'active' || c.effective).length / existingControls.length * 100)
        : 0;
      const residualRisk = Math.round(riskScore * (1 - controlEffectiveness / 100) * 100) / 100;

      const mitigations = [];
      if (residualRisk >= 15) mitigations.push('Implement immediate containment measures');
      if (vulnerabilities.length > 0) mitigations.push(`Address ${vulnerabilities.length} identified vulnerabilit${vulnerabilities.length === 1 ? 'y' : 'ies'}`);
      if (controlEffectiveness < 50) mitigations.push('Strengthen existing security controls');
      if (probability >= 4) mitigations.push('Deploy proactive monitoring and early warning systems');
      if (impact >= 4) mitigations.push('Develop and test business continuity plan');

      return {
        name: t.name || artifact.title,
        type: t.type || 'unknown',
        probability,
        impact,
        riskScore,
        riskLevel: riskScore >= 20 ? 'critical' : riskScore >= 12 ? 'high' : riskScore >= 6 ? 'medium' : 'low',
        vulnerabilities: vulnerabilities.length,
        existingControls: existingControls.length,
        controlEffectiveness,
        residualRisk,
        mitigations,
      };
    }).sort((a, b) => b.riskScore - a.riskScore);

    const overallRisk = assessments.length > 0 ? Math.round(assessments.reduce((s, a) => s + a.riskScore, 0) / assessments.length * 100) / 100 : 0;

    return {
      ok: true,
      result: {
        assessedAt: new Date().toISOString(),
        threatsAssessed: assessments.length,
        overallRiskScore: overallRisk,
        overallRiskLevel: overallRisk >= 20 ? 'critical' : overallRisk >= 12 ? 'high' : overallRisk >= 6 ? 'medium' : 'low',
        criticalCount: assessments.filter(a => a.riskLevel === 'critical').length,
        highCount: assessments.filter(a => a.riskLevel === 'high').length,
        assessments,
      },
    };
  });

  registerLensAction("security", "vulnerabilityScan", (ctx, artifact, _params) => {
    const systems = artifact.data?.systems || artifact.data?.assets || [artifact.data];
    const findings = [];

    for (const sys of systems) {
      const sysName = sys.name || sys.hostname || artifact.title;

      // Check configurations
      const configs = sys.configurations || sys.config || {};
      if (configs.firewall === false || configs.firewallEnabled === false) {
        findings.push({ system: sysName, type: 'configuration', severity: 'critical', detail: 'Firewall disabled' });
      }
      if (configs.defaultCredentials || configs.defaultPassword) {
        findings.push({ system: sysName, type: 'weak_password', severity: 'critical', detail: 'Default credentials in use' });
      }
      if (configs.encryption === false || configs.encryptionEnabled === false) {
        findings.push({ system: sysName, type: 'configuration', severity: 'high', detail: 'Encryption disabled' });
      }
      if (configs.mfa === false || configs.mfaEnabled === false) {
        findings.push({ system: sysName, type: 'configuration', severity: 'high', detail: 'Multi-factor authentication disabled' });
      }

      // Expired certificates
      const certs = sys.certificates || [];
      const now = new Date();
      for (const cert of certs) {
        const expiry = cert.expiryDate ? new Date(cert.expiryDate) : null;
        if (expiry && expiry < now) {
          findings.push({ system: sysName, type: 'expired_cert', severity: 'high', detail: `Certificate '${cert.name || cert.domain || 'unknown'}' expired ${cert.expiryDate}` });
        } else if (expiry) {
          const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
          if (daysLeft <= 30) {
            findings.push({ system: sysName, type: 'expiring_cert', severity: 'medium', detail: `Certificate '${cert.name || cert.domain || 'unknown'}' expires in ${daysLeft} days` });
          }
        }
      }

      // Open ports
      const openPorts = sys.openPorts || sys.ports || [];
      const riskyPorts = [21, 23, 25, 135, 139, 445, 3389];
      for (const port of openPorts) {
        const portNum = typeof port === 'object' ? port.port : port;
        if (riskyPorts.includes(portNum)) {
          findings.push({ system: sysName, type: 'open_port', severity: 'medium', detail: `Risky port ${portNum} is open` });
        }
      }

      // Weak passwords
      const accounts = sys.accounts || sys.users || [];
      for (const acct of accounts) {
        if (acct.passwordAge && acct.passwordAge > 90) {
          findings.push({ system: sysName, type: 'weak_password', severity: 'medium', detail: `Account '${acct.name || acct.username}' password age: ${acct.passwordAge} days` });
        }
        if (acct.weakPassword || acct.passwordStrength === 'weak') {
          findings.push({ system: sysName, type: 'weak_password', severity: 'high', detail: `Account '${acct.name || acct.username}' has weak password` });
        }
      }
    }

    findings.sort((a, b) => {
      const sev = { critical: 0, high: 1, medium: 2, low: 3 };
      return (sev[a.severity] || 4) - (sev[b.severity] || 4);
    });

    return {
      ok: true,
      result: {
        scannedAt: new Date().toISOString(),
        systemsScanned: systems.length,
        totalFindings: findings.length,
        criticalCount: findings.filter(f => f.severity === 'critical').length,
        highCount: findings.filter(f => f.severity === 'high').length,
        mediumCount: findings.filter(f => f.severity === 'medium').length,
        findings,
      },
    };
  });

  registerLensAction("security", "evidenceChain", (ctx, artifact, _params) => {
    const evidenceLog = artifact.data?.evidenceLog || [];
    let intact = true;
    const issues = [];
    for (let i = 0; i < evidenceLog.length; i++) {
      const entry = evidenceLog[i];
      if (!entry.handler || !entry.date) {
        intact = false;
        issues.push({ position: i, issue: 'Missing handler or date', entry });
      }
      if (i > 0 && entry.date < evidenceLog[i - 1].date) {
        intact = false;
        issues.push({ position: i, issue: 'Date out of sequence', entry });
      }
    }
    return { ok: true, result: { investigationId: artifact.id, intact, transfers: evidenceLog.length, issues, verifiedAt: new Date().toISOString() } };
  });
};
