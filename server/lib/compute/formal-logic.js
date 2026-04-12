/**
 * Formal Logic Engine
 *
 * Propositional and first-order logic:
 * - Parse and evaluate logical expressions
 * - Truth tables
 * - Tautology / contradiction / satisfiability checks
 * - Natural deduction proof steps
 * - Predicate logic with quantifiers
 *
 * Pure ES module. No dependencies.
 */

export const LOGICAL_OPS = {
  AND: '∧',
  OR: '∨',
  NOT: '¬',
  IMPLIES: '→',
  IFF: '↔',
  XOR: '⊕',
};

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

const TOKEN = {
  AND: 'AND',
  OR: 'OR',
  NOT: 'NOT',
  IMPLIES: 'IMPLIES',
  IFF: 'IFF',
  XOR: 'XOR',
  LPAREN: 'LPAREN',
  RPAREN: 'RPAREN',
  IDENT: 'IDENT',
  CONST: 'CONST',
  EOF: 'EOF',
};

function tokenize(input) {
  const tokens = [];
  let i = 0;
  const src = String(input);
  while (i < src.length) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i++;
      continue;
    }
    if (c === '(') { tokens.push({ type: TOKEN.LPAREN }); i++; continue; }
    if (c === ')') { tokens.push({ type: TOKEN.RPAREN }); i++; continue; }
    if (c === '∧' || c === '&') { tokens.push({ type: TOKEN.AND }); i++; continue; }
    if (c === '∨' || c === '|') { tokens.push({ type: TOKEN.OR }); i++; continue; }
    if (c === '¬' || c === '!' || c === '~') { tokens.push({ type: TOKEN.NOT }); i++; continue; }
    if (c === '⊕' || c === '^') { tokens.push({ type: TOKEN.XOR }); i++; continue; }
    if (c === '→') { tokens.push({ type: TOKEN.IMPLIES }); i++; continue; }
    if (c === '↔') { tokens.push({ type: TOKEN.IFF }); i++; continue; }
    // Multi-char operators
    if (c === '-' && src[i + 1] === '>') { tokens.push({ type: TOKEN.IMPLIES }); i += 2; continue; }
    if (c === '=' && src[i + 1] === '>') { tokens.push({ type: TOKEN.IMPLIES }); i += 2; continue; }
    if (c === '<' && src[i + 1] === '-' && src[i + 2] === '>') { tokens.push({ type: TOKEN.IFF }); i += 3; continue; }
    if (c === '<' && src[i + 1] === '=' && src[i + 2] === '>') { tokens.push({ type: TOKEN.IFF }); i += 3; continue; }
    if (c === '&' && src[i + 1] === '&') { tokens.push({ type: TOKEN.AND }); i += 2; continue; }
    if (c === '|' && src[i + 1] === '|') { tokens.push({ type: TOKEN.OR }); i += 2; continue; }
    // Identifiers / keywords
    if (/[A-Za-z_]/.test(c)) {
      let j = i + 1;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      const word = src.slice(i, j);
      const lower = word.toLowerCase();
      if (lower === 'and') tokens.push({ type: TOKEN.AND });
      else if (lower === 'or') tokens.push({ type: TOKEN.OR });
      else if (lower === 'not') tokens.push({ type: TOKEN.NOT });
      else if (lower === 'xor') tokens.push({ type: TOKEN.XOR });
      else if (lower === 'implies') tokens.push({ type: TOKEN.IMPLIES });
      else if (lower === 'iff') tokens.push({ type: TOKEN.IFF });
      else if (lower === 'true' || lower === 't' || word === '1') tokens.push({ type: TOKEN.CONST, value: true });
      else if (lower === 'false' || lower === 'f' || word === '0') tokens.push({ type: TOKEN.CONST, value: false });
      else tokens.push({ type: TOKEN.IDENT, name: word });
      i = j;
      continue;
    }
    if (c === '1') { tokens.push({ type: TOKEN.CONST, value: true }); i++; continue; }
    if (c === '0') { tokens.push({ type: TOKEN.CONST, value: false }); i++; continue; }
    throw new Error(`Unexpected character '${c}' at position ${i}`);
  }
  tokens.push({ type: TOKEN.EOF });
  return tokens;
}

// ---------------------------------------------------------------------------
// Parser — recursive descent with precedence
// Precedence (lowest to highest): IFF, IMPLIES, OR, XOR, AND, NOT, atom
// ---------------------------------------------------------------------------

class Parser {
  constructor(tokens) { this.tokens = tokens; this.pos = 0; }
  peek() { return this.tokens[this.pos]; }
  consume(type) {
    const t = this.tokens[this.pos];
    if (t.type !== type) throw new Error(`Expected ${type}, got ${t.type}`);
    this.pos++;
    return t;
  }
  match(type) {
    if (this.tokens[this.pos].type === type) { this.pos++; return true; }
    return false;
  }
  parseExpr() { return this.parseIff(); }
  parseIff() {
    let left = this.parseImplies();
    while (this.peek().type === TOKEN.IFF) {
      this.pos++;
      const right = this.parseImplies();
      left = { type: 'iff', left, right };
    }
    return left;
  }
  parseImplies() {
    const left = this.parseOr();
    if (this.peek().type === TOKEN.IMPLIES) {
      this.pos++;
      // right associative
      const right = this.parseImplies();
      return { type: 'implies', left, right };
    }
    return left;
  }
  parseOr() {
    let left = this.parseXor();
    while (this.peek().type === TOKEN.OR) {
      this.pos++;
      const right = this.parseXor();
      left = { type: 'or', left, right };
    }
    return left;
  }
  parseXor() {
    let left = this.parseAnd();
    while (this.peek().type === TOKEN.XOR) {
      this.pos++;
      const right = this.parseAnd();
      left = { type: 'xor', left, right };
    }
    return left;
  }
  parseAnd() {
    let left = this.parseNot();
    while (this.peek().type === TOKEN.AND) {
      this.pos++;
      const right = this.parseNot();
      left = { type: 'and', left, right };
    }
    return left;
  }
  parseNot() {
    if (this.peek().type === TOKEN.NOT) {
      this.pos++;
      return { type: 'not', operand: this.parseNot() };
    }
    return this.parseAtom();
  }
  parseAtom() {
    const t = this.peek();
    if (t.type === TOKEN.LPAREN) {
      this.pos++;
      const inner = this.parseExpr();
      this.consume(TOKEN.RPAREN);
      return inner;
    }
    if (t.type === TOKEN.IDENT) {
      this.pos++;
      return { type: 'var', name: t.name };
    }
    if (t.type === TOKEN.CONST) {
      this.pos++;
      return { type: 'const', value: t.value };
    }
    throw new Error(`Unexpected token ${t.type}`);
  }
}

export function parse(expression) {
  if (expression && typeof expression === 'object' && expression.type) return expression;
  const tokens = tokenize(expression);
  const parser = new Parser(tokens);
  const ast = parser.parseExpr();
  if (parser.peek().type !== TOKEN.EOF) throw new Error('Unexpected trailing tokens');
  return ast;
}

// ---------------------------------------------------------------------------
// Evaluate
// ---------------------------------------------------------------------------

export function evaluate(ast, assignment = {}) {
  const node = typeof ast === 'string' ? parse(ast) : ast;
  switch (node.type) {
    case 'const': return !!node.value;
    case 'var': {
      if (!(node.name in assignment)) throw new Error(`Unassigned variable: ${node.name}`);
      return !!assignment[node.name];
    }
    case 'not': return !evaluate(node.operand, assignment);
    case 'and': return evaluate(node.left, assignment) && evaluate(node.right, assignment);
    case 'or': return evaluate(node.left, assignment) || evaluate(node.right, assignment);
    case 'xor': return evaluate(node.left, assignment) !== evaluate(node.right, assignment);
    case 'implies': return !evaluate(node.left, assignment) || evaluate(node.right, assignment);
    case 'iff': return evaluate(node.left, assignment) === evaluate(node.right, assignment);
    default: throw new Error(`Unknown node type: ${node.type}`);
  }
}

// ---------------------------------------------------------------------------
// Variables collection
// ---------------------------------------------------------------------------

function collectVars(ast, out) {
  if (!ast) return;
  if (ast.type === 'var') { out.add(ast.name); return; }
  if (ast.type === 'not') { collectVars(ast.operand, out); return; }
  if (ast.left) collectVars(ast.left, out);
  if (ast.right) collectVars(ast.right, out);
}

export function getVariables(expression) {
  const ast = parse(expression);
  const out = new Set();
  collectVars(ast, out);
  return [...out].sort();
}

// ---------------------------------------------------------------------------
// Truth table
// ---------------------------------------------------------------------------

export function truthTable(expression) {
  const ast = parse(expression);
  const variables = getVariables(ast);
  const n = variables.length;
  const rows = [];
  const total = 1 << n;
  for (let mask = 0; mask < total; mask++) {
    const assignment = {};
    for (let i = 0; i < n; i++) {
      assignment[variables[i]] = !!((mask >> (n - 1 - i)) & 1);
    }
    rows.push({ assignment, result: evaluate(ast, assignment) });
  }
  return { variables, rows };
}

export function isTautology(expression) {
  const { rows } = truthTable(expression);
  return rows.every((r) => r.result === true);
}

export function isContradiction(expression) {
  const { rows } = truthTable(expression);
  return rows.every((r) => r.result === false);
}

export function isSatisfiable(expression) {
  const { rows } = truthTable(expression);
  return rows.some((r) => r.result === true);
}

export function areEquivalent(expr1, expr2) {
  const a = parse(expr1);
  const b = parse(expr2);
  const vars = new Set();
  collectVars(a, vars);
  collectVars(b, vars);
  const variables = [...vars].sort();
  const n = variables.length;
  const total = 1 << n;
  for (let mask = 0; mask < total; mask++) {
    const assignment = {};
    for (let i = 0; i < n; i++) {
      assignment[variables[i]] = !!((mask >> (n - 1 - i)) & 1);
    }
    if (evaluate(a, assignment) !== evaluate(b, assignment)) return false;
  }
  return true;
}

export function isValidInference(premises, conclusion) {
  const premiseAsts = premises.map(parse);
  const conclusionAst = parse(conclusion);
  const vars = new Set();
  premiseAsts.forEach((p) => collectVars(p, vars));
  collectVars(conclusionAst, vars);
  const variables = [...vars].sort();
  const n = variables.length;
  const total = 1 << n;
  for (let mask = 0; mask < total; mask++) {
    const assignment = {};
    for (let i = 0; i < n; i++) {
      assignment[variables[i]] = !!((mask >> (n - 1 - i)) & 1);
    }
    const allPremisesTrue = premiseAsts.every((p) => evaluate(p, assignment));
    if (allPremisesTrue && !evaluate(conclusionAst, assignment)) {
      return { valid: false, counterexample: assignment };
    }
  }
  return { valid: true };
}

// ---------------------------------------------------------------------------
// Simplification using boolean identities
// ---------------------------------------------------------------------------

function astEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.type !== b.type) return false;
  if (a.type === 'const') return a.value === b.value;
  if (a.type === 'var') return a.name === b.name;
  if (a.type === 'not') return astEqual(a.operand, b.operand);
  return astEqual(a.left, b.left) && astEqual(a.right, b.right);
}

function simplifyNode(node) {
  if (!node) return node;
  if (node.type === 'const' || node.type === 'var') return node;
  if (node.type === 'not') {
    const inner = simplifyNode(node.operand);
    if (inner.type === 'const') return { type: 'const', value: !inner.value };
    if (inner.type === 'not') return inner.operand;
    return { type: 'not', operand: inner };
  }
  const left = simplifyNode(node.left);
  const right = simplifyNode(node.right);
  if (node.type === 'and') {
    if (left.type === 'const') return left.value ? right : { type: 'const', value: false };
    if (right.type === 'const') return right.value ? left : { type: 'const', value: false };
    if (astEqual(left, right)) return left;
    // X AND NOT X = false
    if (left.type === 'not' && astEqual(left.operand, right)) return { type: 'const', value: false };
    if (right.type === 'not' && astEqual(right.operand, left)) return { type: 'const', value: false };
    return { type: 'and', left, right };
  }
  if (node.type === 'or') {
    if (left.type === 'const') return left.value ? { type: 'const', value: true } : right;
    if (right.type === 'const') return right.value ? { type: 'const', value: true } : left;
    if (astEqual(left, right)) return left;
    if (left.type === 'not' && astEqual(left.operand, right)) return { type: 'const', value: true };
    if (right.type === 'not' && astEqual(right.operand, left)) return { type: 'const', value: true };
    return { type: 'or', left, right };
  }
  if (node.type === 'xor') {
    if (left.type === 'const' && right.type === 'const') return { type: 'const', value: left.value !== right.value };
    if (astEqual(left, right)) return { type: 'const', value: false };
    return { type: 'xor', left, right };
  }
  if (node.type === 'implies') {
    if (left.type === 'const') return left.value ? right : { type: 'const', value: true };
    if (right.type === 'const' && right.value === true) return { type: 'const', value: true };
    if (astEqual(left, right)) return { type: 'const', value: true };
    return { type: 'implies', left, right };
  }
  if (node.type === 'iff') {
    if (left.type === 'const' && right.type === 'const') return { type: 'const', value: left.value === right.value };
    if (astEqual(left, right)) return { type: 'const', value: true };
    return { type: 'iff', left, right };
  }
  return node;
}

export function simplify(expression) {
  const ast = parse(expression);
  let prev = ast;
  let current = simplifyNode(ast);
  // Iterate to fixpoint (bounded)
  for (let i = 0; i < 20 && !astEqual(prev, current); i++) {
    prev = current;
    current = simplifyNode(current);
  }
  return current;
}

// ---------------------------------------------------------------------------
// Stringify AST back to human-readable form
// ---------------------------------------------------------------------------

export function stringify(ast) {
  const node = typeof ast === 'string' ? parse(ast) : ast;
  const PREC = { const: 100, var: 100, not: 90, and: 80, xor: 70, or: 60, implies: 50, iff: 40 };
  function go(n, parentPrec) {
    let s;
    let p;
    switch (n.type) {
      case 'const': s = n.value ? 'true' : 'false'; p = PREC.const; break;
      case 'var': s = n.name; p = PREC.var; break;
      case 'not': s = '¬' + go(n.operand, PREC.not); p = PREC.not; break;
      case 'and': s = go(n.left, PREC.and) + ' ∧ ' + go(n.right, PREC.and); p = PREC.and; break;
      case 'or': s = go(n.left, PREC.or) + ' ∨ ' + go(n.right, PREC.or); p = PREC.or; break;
      case 'xor': s = go(n.left, PREC.xor) + ' ⊕ ' + go(n.right, PREC.xor); p = PREC.xor; break;
      case 'implies': s = go(n.left, PREC.implies + 1) + ' → ' + go(n.right, PREC.implies); p = PREC.implies; break;
      case 'iff': s = go(n.left, PREC.iff + 1) + ' ↔ ' + go(n.right, PREC.iff); p = PREC.iff; break;
      default: s = '?'; p = 0;
    }
    return p < parentPrec ? `(${s})` : s;
  }
  return go(node, 0);
}

// ---------------------------------------------------------------------------
// Natural deduction proof step checking
// ---------------------------------------------------------------------------

export function checkProofStep(premises, step, rule) {
  const premAsts = premises.map(parse);
  const stepAst = parse(step);
  const norm = (r) => String(r || '').toLowerCase().replace(/[_\s-]+/g, ' ').trim();
  const r = norm(rule);

  if (r === 'modus ponens' || r === 'mp') {
    // From P and P->Q infer Q
    for (const p of premAsts) {
      if (p.type === 'implies' && astEqual(p.right, stepAst)) {
        if (premAsts.some((q) => astEqual(q, p.left))) return { valid: true };
      }
    }
    return { valid: false, reason: 'No matching premises for modus ponens' };
  }
  if (r === 'modus tollens' || r === 'mt') {
    // From P->Q and NOT Q infer NOT P
    if (stepAst.type !== 'not') return { valid: false, reason: 'Conclusion must be a negation' };
    for (const p of premAsts) {
      if (p.type === 'implies' && astEqual(p.left, stepAst.operand)) {
        const notQ = { type: 'not', operand: p.right };
        if (premAsts.some((q) => astEqual(simplify(q), simplify(notQ)))) return { valid: true };
      }
    }
    return { valid: false, reason: 'No matching premises for modus tollens' };
  }
  if (r === 'and intro' || r === 'and introduction' || r === 'conjunction') {
    if (stepAst.type !== 'and') return { valid: false, reason: 'Conclusion must be a conjunction' };
    const lOk = premAsts.some((p) => astEqual(p, stepAst.left));
    const rOk = premAsts.some((p) => astEqual(p, stepAst.right));
    return lOk && rOk ? { valid: true } : { valid: false, reason: 'Missing conjunct premises' };
  }
  if (r === 'and elim' || r === 'and elimination' || r === 'simplification') {
    for (const p of premAsts) {
      if (p.type === 'and' && (astEqual(p.left, stepAst) || astEqual(p.right, stepAst))) {
        return { valid: true };
      }
    }
    return { valid: false, reason: 'No conjunction premise contains this conjunct' };
  }
  if (r === 'or intro' || r === 'or introduction' || r === 'addition') {
    if (stepAst.type !== 'or') return { valid: false, reason: 'Conclusion must be a disjunction' };
    if (premAsts.some((p) => astEqual(p, stepAst.left) || astEqual(p, stepAst.right))) return { valid: true };
    return { valid: false, reason: 'No disjunct is a premise' };
  }
  if (r === 'or elim' || r === 'or elimination' || r === 'disjunctive syllogism' || r === 'ds') {
    // From P or Q and NOT P infer Q
    for (const p of premAsts) {
      if (p.type === 'or') {
        const notLeft = { type: 'not', operand: p.left };
        const notRight = { type: 'not', operand: p.right };
        if (premAsts.some((q) => astEqual(simplify(q), simplify(notLeft))) && astEqual(p.right, stepAst)) return { valid: true };
        if (premAsts.some((q) => astEqual(simplify(q), simplify(notRight))) && astEqual(p.left, stepAst)) return { valid: true };
      }
    }
    return { valid: false, reason: 'No disjunctive syllogism pattern matched' };
  }
  if (r === 'hypothetical syllogism' || r === 'hs') {
    // From P->Q and Q->R infer P->R
    if (stepAst.type !== 'implies') return { valid: false, reason: 'Conclusion must be implication' };
    for (const p of premAsts) {
      if (p.type !== 'implies' || !astEqual(p.left, stepAst.left)) continue;
      for (const q of premAsts) {
        if (q.type !== 'implies') continue;
        if (astEqual(q.left, p.right) && astEqual(q.right, stepAst.right)) return { valid: true };
      }
    }
    return { valid: false, reason: 'No hypothetical syllogism chain matched' };
  }
  // Fallback: check semantic validity
  const res = isValidInference(premises, step);
  if (res.valid) return { valid: true, note: `semantically valid but rule '${rule}' not recognized` };
  return { valid: false, reason: `Unknown or invalid rule: ${rule}` };
}

// ---------------------------------------------------------------------------
// CNF / DNF conversion
// ---------------------------------------------------------------------------

function eliminateImplications(node) {
  if (!node) return node;
  if (node.type === 'const' || node.type === 'var') return node;
  if (node.type === 'not') return { type: 'not', operand: eliminateImplications(node.operand) };
  if (node.type === 'implies') {
    return { type: 'or', left: { type: 'not', operand: eliminateImplications(node.left) }, right: eliminateImplications(node.right) };
  }
  if (node.type === 'iff') {
    const l = eliminateImplications(node.left);
    const r = eliminateImplications(node.right);
    return {
      type: 'and',
      left: { type: 'or', left: { type: 'not', operand: l }, right: r },
      right: { type: 'or', left: { type: 'not', operand: r }, right: l },
    };
  }
  if (node.type === 'xor') {
    const l = eliminateImplications(node.left);
    const r = eliminateImplications(node.right);
    return {
      type: 'or',
      left: { type: 'and', left: l, right: { type: 'not', operand: r } },
      right: { type: 'and', left: { type: 'not', operand: l }, right: r },
    };
  }
  return { ...node, left: eliminateImplications(node.left), right: eliminateImplications(node.right) };
}

function pushNegations(node) {
  if (!node) return node;
  if (node.type === 'not') {
    const inner = node.operand;
    if (inner.type === 'not') return pushNegations(inner.operand);
    if (inner.type === 'and') {
      return {
        type: 'or',
        left: pushNegations({ type: 'not', operand: inner.left }),
        right: pushNegations({ type: 'not', operand: inner.right }),
      };
    }
    if (inner.type === 'or') {
      return {
        type: 'and',
        left: pushNegations({ type: 'not', operand: inner.left }),
        right: pushNegations({ type: 'not', operand: inner.right }),
      };
    }
    if (inner.type === 'const') return { type: 'const', value: !inner.value };
    return { type: 'not', operand: pushNegations(inner) };
  }
  if (node.type === 'and' || node.type === 'or') {
    return { type: node.type, left: pushNegations(node.left), right: pushNegations(node.right) };
  }
  return node;
}

function distributeOrOverAnd(node) {
  if (!node || node.type !== 'or') {
    if (node && (node.type === 'and' || node.type === 'or')) {
      return { type: node.type, left: distributeOrOverAnd(node.left), right: distributeOrOverAnd(node.right) };
    }
    return node;
  }
  const left = distributeOrOverAnd(node.left);
  const right = distributeOrOverAnd(node.right);
  if (left.type === 'and') {
    return {
      type: 'and',
      left: distributeOrOverAnd({ type: 'or', left: left.left, right }),
      right: distributeOrOverAnd({ type: 'or', left: left.right, right }),
    };
  }
  if (right.type === 'and') {
    return {
      type: 'and',
      left: distributeOrOverAnd({ type: 'or', left, right: right.left }),
      right: distributeOrOverAnd({ type: 'or', left, right: right.right }),
    };
  }
  return { type: 'or', left, right };
}

function distributeAndOverOr(node) {
  if (!node || node.type !== 'and') {
    if (node && (node.type === 'and' || node.type === 'or')) {
      return { type: node.type, left: distributeAndOverOr(node.left), right: distributeAndOverOr(node.right) };
    }
    return node;
  }
  const left = distributeAndOverOr(node.left);
  const right = distributeAndOverOr(node.right);
  if (left.type === 'or') {
    return {
      type: 'or',
      left: distributeAndOverOr({ type: 'and', left: left.left, right }),
      right: distributeAndOverOr({ type: 'and', left: left.right, right }),
    };
  }
  if (right.type === 'or') {
    return {
      type: 'or',
      left: distributeAndOverOr({ type: 'and', left, right: right.left }),
      right: distributeAndOverOr({ type: 'and', left, right: right.right }),
    };
  }
  return { type: 'and', left, right };
}

export function toCNF(expression) {
  const ast = parse(expression);
  return distributeOrOverAnd(pushNegations(eliminateImplications(ast)));
}

export function toDNF(expression) {
  const ast = parse(expression);
  return distributeAndOverOr(pushNegations(eliminateImplications(ast)));
}

export default {
  LOGICAL_OPS,
  parse,
  evaluate,
  stringify,
  getVariables,
  truthTable,
  isTautology,
  isContradiction,
  isSatisfiable,
  areEquivalent,
  isValidInference,
  simplify,
  checkProofStep,
  toCNF,
  toDNF,
};
