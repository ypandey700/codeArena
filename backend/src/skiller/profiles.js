const HOSTS = { leetcode: ['leetcode.com', 'www.leetcode.com'], gfg: ['geeksforgeeks.org', 'www.geeksforgeeks.org', 'auth.geeksforgeeks.org'], codechef: ['codechef.com', 'www.codechef.com'] };
const TAGS = { array: 'arrays', string: 'strings', 'hash-table': 'hashing', 'binary-search': 'binary-search', stack: 'stacks', 'dynamic-programming': 'dynamic-programming' };

function parseProfile(provider, input) {
  if (!HOSTS[provider]) throw Object.assign(new Error('Choose LeetCode, GeeksforGeeks, or CodeChef.'), { status: 400 });
  let url;
  try { url = new URL(String(input)); } catch { throw Object.assign(new Error('Enter a complete HTTPS profile URL.'), { status: 400 }); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !HOSTS[provider].includes(url.hostname.toLowerCase())) throw Object.assign(new Error('Use a public HTTPS profile link from the selected platform.'), { status: 400 });
  const parts = url.pathname.split('/').filter(Boolean);
  const username = provider === 'leetcode' ? parts[0] === 'u' && parts.length === 2 ? parts[1] : parts.length === 1 ? parts[0] : null : provider === 'codechef' ? parts[0] === 'users' && parts.length === 2 ? parts[1] : null : ['user', 'profile'].includes(parts[0]) && parts.length === 2 ? parts[1] : null;
  if (!username || !/^[a-zA-Z0-9_-]{1,60}$/.test(username)) throw Object.assign(new Error('That URL does not look like a user profile.'), { status: 400 });
  const canonical = provider === 'leetcode' ? `https://leetcode.com/u/${username}/` : provider === 'codechef' ? `https://www.codechef.com/users/${username}` : `https://www.geeksforgeeks.org/user/${username}/`;
  return { provider, username, url: canonical, linkedAt: new Date() };
}

async function importPublicTopics(link, fetcher = fetch) {
  if (link.provider !== 'leetcode') return { ...link, status: 'linked', message: 'Profile link saved. Topic import is not available for this platform yet; your Skiller results guide recommendations.', topicCounts: {} };
  try {
    const response = await fetcher('https://leetcode.com/graphql/', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: 'query SkillerTopicCounts($username: String!) { matchedUser(username: $username) { tagProblemCounts { fundamental { tagSlug problemsSolved } intermediate { tagSlug problemsSolved } advanced { tagSlug problemsSolved } } } }', variables: { username: link.username } }),
    });
    if (!response.ok) throw new Error('The platform did not provide public topic data.');
    const reader = response.body.getReader(); let size = 0; const chunks = [];
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 512000) { await reader.cancel(); throw new Error('Profile response was too large.'); } chunks.push(Buffer.from(value)); }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const tags = body.data?.matchedUser?.tagProblemCounts;
    if (!tags || body.errors?.length) throw new Error('No public topic data was available for that profile.');
    const topicCounts = {};
    for (const group of ['fundamental', 'intermediate', 'advanced']) for (const item of tags[group] || []) {
      const topic = TAGS[item.tagSlug];
      if (topic && Number.isInteger(item.problemsSolved) && item.problemsSolved >= 0) topicCounts[topic] = item.problemsSolved;
    }
    if (!Object.keys(topicCounts).length) throw new Error('No supported topic counts were available.');
    return { ...link, status: 'imported', message: 'Imported public solved counts. These are an initial estimate, not verified mastery or account ownership.', topicCounts, importedAt: new Date() };
  } catch {
    return { ...link, status: 'unavailable', message: 'Public topic import is unavailable. Your link is saved; your Skiller practice results still guide recommendations.', topicCounts: {} };
  }
}

module.exports = { parseProfile, importPublicTopics };
