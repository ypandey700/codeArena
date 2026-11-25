const { createHash } = require('node:crypto');

// Tokenize before collapsing whitespace so literals and adjacent operators retain their meaning.
const codeTokens = (code, language) => {
  const comments = language === 'python' ? '#[^\\n]*' : '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/';
  const quoted = String.raw`"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|` + '`(?:\\\\[\\s\\S]|[^`\\\\])*`';
  const tokens = new RegExp(`(${comments})|(${quoted})|[\\p{L}\\p{N}_$]+|===|!==|==|!=|<=|>=|=>|\\+\\+|--|\\+=|-=|&&|\\|\\||[^\\s]`, 'gu');
  return Array.from(String(code || '').matchAll(tokens)).filter((match) => !match[1]);
};
const normalizeCode = (code, language) => codeTokens(code, language).map((match) => match[0]).join(' ');
const hash = (normalized) => createHash('sha256').update(normalized).digest('hex');

// Captured from the original seed and BattleArena before replacing the starters.
const LEGACY_SOLVED = {
  "two-sum": {
    "python": "3024b6236f9e0d7d0fb2de526341786a6fd368600a75628bc7b6e646476b4896",
    "javascript": "c48358c3c8d9e189aa7775dd4e03e6663c16a95d7bf88480ef31eec9694aa11f",
    "cpp": "13554685c845db56f2fb95b8d69c6f232b61f98fc45b75db12bee58c01027e4b",
    "java": "2547360adfd4ce2f24ee4fb3cab0a5a0264e2dbf8a139a59388b9cf60763e786"
  },
  "reverse-string": {
    "python": "614770ad892f883887441855ac6b3d3aebdd07eab1987d909a55e90c9d13b3fd",
    "javascript": "d6829ce0b5c323f6bd45591861e225f843f2cdb771642f31af9e3e264ab5aa3e",
    "cpp": "e462846b3ce093d5043fd8d6c400f23885d636b1583035d188e07bdd33b7486c",
    "java": "410abeb5bf6f2e9c2779f032a549ba955ce26473d2f251992e76cc70ead4ad44"
  },
  "fizzbuzz": {
    "python": "c6d75208780c134caa1faf92391ee337884786c3e783671a34d73be2c4d06090",
    "javascript": "daf2cabd947b6790c47e48a50c30455b1b8f64184f1027a046d707600cdb25e3",
    "cpp": "c523c6f1ec41871d6c73188905703f527811ec6f569f413d2d4f6d2176a91ee9",
    "java": "5d0fe1222f9a0fafddd7046e0d30f6f8d45f61de42c0d6387cd277eef8bb5ea0"
  },
  "palindrome-check": {
    "python": "3fb3ad4d3ec1d4259a82b7f4f010be0ff99b1a091cf55b4995192962f747fc4f",
    "javascript": "99e834ec1e8a599ffec40f158a5500c804a5d1fe7e76bf40b8aca3b54d661e79",
    "cpp": "c70a953375c444d3a97b09fb81c5308d489add9907e1ea9b6f1450739ddb6462",
    "java": "fd3ff8a838f2c31767aa14ad58428eefa507f7f47ee30221c8b179bab7d098cc"
  },
  "valid-parentheses": {
    "python": "0eebbc63f336b6d2fe2d8d83725cd7ddbfed65d39cbc7398bde014c175ee8ad6",
    "javascript": "730dbcdb4fb2762a5d7210e697657c810e50f24958d87d5873f5e9fcf86e0628",
    "cpp": "5046e5a5ce1578bc91a1011f7f1abf5302621faa7927e0e718626f143a23608a",
    "java": "78588c5a4c07e9b65fc63b29a332f9077d4eacc66bbee2bf1d357202f73d9811"
  },
  "maximum-subarray": {
    "python": "d9ff6889e88db1745f5594fbccd930802084d40b88717aacc18a7b7f49fc6f68",
    "javascript": "61e0ddee36e6723b755d097df2baa413c512979b9ddedf217baf4e8049d5598b",
    "cpp": "936241ab56cc32eb0d6504805b7067881cf72ae5dec54e72486def04cc6c9941",
    "java": "d3a9eba9ec2c0fa8487a8e3589926f15f9ea02ae8476d01bbb4492ff0c657887"
  },
  "merge-two-sorted-arrays": {
    "python": "a05d3f8cb4adb47058023ffe438acaadc0754a23f8bb933385ca65b4803515c6",
    "javascript": "b2e754a49a21525cea4492676eeecd070ad5675eb24f3455a85f9d71eb4928f7",
    "cpp": "a311f1afae5a4234c7dd6bad5f819346b77dc9e1d1c5b5cd6e5a80e182cb0bda",
    "java": "bce0b3ac09ce167ce29018d655d8a851bd2e90874daeadcdc86ed31ae5861b81"
  },
  "longest-substring-without-repeating-characters": {
    "python": "660f474342a798dedd1a2877eff2ec5f0c02361fc0565ff8329809cafee02111",
    "javascript": "67da5863f67549c3316952d6cac2e7c300090e528b9e698d3e724639270437d1",
    "cpp": "85deb07aeb408bfaef1180f005c03a8b90056c35352fcf56bd35085aab3637af",
    "java": "0d4f01aafc498fc5664134e17a38d9b22ea3c7f64e884429be82ff0a0084b94c"
  }
};
const EDITOR_FALLBACK_HASHES = {
  "python": "ea7a8074ff3696b4cbaf8a5c272743c7ba3dc35207afb0031c445e2af94ebf00",
  "javascript": "de387a9f3cf069712ba27e636614537b0d38f05da97c431b9dbf21dfddb34f15",
  "cpp": "a04bb85d0168d4ad5c54c6415b91e537a3eae28607537b56e1b9d7dfef8a35c4",
  "java": "6f4fafe47aadc5f5e243ad302f6d266e52d077b2b005f504dac263d1061b911d"
};

const EDITOR_STARTERS = Object.freeze({
  "python": "import sys\n\ndef solve():\n    data = sys.stdin.read().strip()\n    # Read the input, solve the problem, and print your answer.\n    pass\n\nif __name__ == \"__main__\":\n    solve()\n",
  "javascript": "const input = require(\"fs\").readFileSync(0, \"utf8\").trim();\n\nfunction solve(input) {\n  // Read the input, solve the problem, and print your answer.\n}\n\nsolve(input);\n",
  "cpp": "#include <iostream>\nusing namespace std;\n\nint main() {\n    // Read from cin and print your answer with cout.\n    return 0;\n}\n",
  "java": "import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner input = new Scanner(System.in);\n        // Read the input and print your answer.\n    }\n}\n"
});
// Keep the original input parsing and entry points for the seeded problems.
const INPUT_PARSERS = {
  'two-sum': {
    python: String.raw`    tokens = sys.stdin.read().split()
    if not tokens:
        return
    n = int(tokens[0])
    target = int(tokens[1])
    nums = [int(x) for x in tokens[2:2 + n]]`,
    javascript: String.raw`  const input = fs.readFileSync(0, 'utf-8').trim().split(/\s+/);
  if (!input || input.length < 2 || input[0] === '') return;
  const n = parseInt(input[0], 10);
  const target = parseInt(input[1], 10);
  const nums = input.slice(2, 2 + n).map(Number);`,
  },
  'reverse-string': {
    python: String.raw`    s = sys.stdin.read().rstrip('\r\n')`,
    javascript: String.raw`  const input = fs.readFileSync(0, 'utf-8').replace(/\r?\n$/, '');`,
  },
  'fizzbuzz': {
    python: String.raw`    tokens = sys.stdin.read().split()
    if not tokens:
        return
    n = int(tokens[0])`,
    javascript: String.raw`  const input = fs.readFileSync(0, 'utf-8').trim();
  if (!input) return;
  const n = parseInt(input, 10);`,
  },
  'palindrome-check': {
    python: String.raw`    s = sys.stdin.read().rstrip('\r\n')`,
    javascript: String.raw`  const input = fs.readFileSync(0, 'utf-8').replace(/\r?\n$/, '');`,
  },
  'valid-parentheses': {
    python: String.raw`    s = sys.stdin.read().strip()`,
    javascript: String.raw`  const s = fs.readFileSync(0, 'utf-8').trim();`,
  },
  'maximum-subarray': {
    python: String.raw`    tokens = sys.stdin.read().split()
    if not tokens:
        return
    n = int(tokens[0])
    nums = [int(x) for x in tokens[1:1 + n]]`,
    javascript: String.raw`  const tokens = fs.readFileSync(0, 'utf-8').trim().split(/\s+/);
  if (!tokens || tokens.length < 2 || tokens[0] === '') return;
  const n = parseInt(tokens[0], 10);
  const nums = tokens.slice(1, 1 + n).map(Number);`,
  },
  'merge-two-sorted-arrays': {
    python: String.raw`    tokens = sys.stdin.read().split()
    if not tokens:
        return
    n = int(tokens[0])
    m = int(tokens[1])
    a = [int(x) for x in tokens[2:2 + n]]
    b = [int(x) for x in tokens[2 + n:2 + n + m]]`,
    javascript: String.raw`  const tokens = fs.readFileSync(0, 'utf-8').trim().split(/\s+/);
  if (!tokens || tokens.length < 2 || tokens[0] === '') return;
  const n = parseInt(tokens[0], 10);
  const m = parseInt(tokens[1], 10);
  const a = tokens.slice(2, 2 + n).map(Number);
  const b = tokens.slice(2 + n, 2 + n + m).map(Number);`,
  },
  'longest-substring-without-repeating-characters': {
    python: String.raw`    s = sys.stdin.read().rstrip('\r\n')`,
    javascript: String.raw`  const s = fs.readFileSync(0, 'utf-8').replace(/\r?\n$/, '');`,
  },
};
const starterCodeFor = (slug) => {
  if (!Object.hasOwn(INPUT_PARSERS, slug)) return undefined;
  const { python, javascript } = INPUT_PARSERS[slug];
  return {
    ...EDITOR_STARTERS,
    python: `import sys\n\ndef solve():\n${python}\n    # Write your solution here and print the answer.\n    pass\n\nif __name__ == '__main__':\n    solve()\n`,
    javascript: `const fs = require('fs');\n\nfunction solve() {\n${javascript}\n  // Write your solution here and print the answer.\n}\n\nsolve();\n`,
  };
};
const isLegacyHash = (fingerprint, language) => Object.values(LEGACY_SOLVED).some((starters) => starters[language] === fingerprint);
const isLegacySolved = (code, language) => !!code && isLegacyHash(hash(normalizeCode(code, language)), language);

const sanitizeStarterCode = (problem) => {
  const data = problem.toObject ? problem.toObject() : { ...problem };
  const canonical = starterCodeFor(data.slug);
  if (!data.starterCode && !canonical) return data;
  const starters = { ...data.starterCode };
  for (const [language, stub] of Object.entries(canonical || EDITOR_STARTERS)) {
    if ((canonical && !starters[language]) || isLegacySolved(starters[language], language)) starters[language] = stub;
  }
  return { ...data, starterCode: starters };
};

const starterTemplates = (problem, language) => [sanitizeStarterCode(problem).starterCode?.[language], EDITOR_STARTERS[language]];

const isNoSubmission = (problem, language, code) => {
  const normalized = normalizeCode(code, language);
  if (!normalized) return true;
  const fingerprint = hash(normalized);

  return fingerprint === EDITOR_FALLBACK_HASHES[language] ||
    isLegacyHash(fingerprint, language) ||
    [starterCodeFor(problem?.slug)?.[language], problem?.starterCode?.[language]].some((stub) => stub && normalized === normalizeCode(stub, language));
};

module.exports = { starterCodeFor, starterTemplates, sanitizeStarterCode, isNoSubmission, isLegacySolved, normalizeCode, codeTokens };
