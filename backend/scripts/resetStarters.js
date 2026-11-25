const mongoose = require('mongoose');
const Problem = require('../src/models/Problem');
const { problems } = require('../seeds/seedProblems');
const { starterCodeFor } = require('../src/services/starterCode');

async function resetStarters() {
  const confirm = process.argv.includes('--confirm');
  require('dotenv').config({ path: __dirname + '/../.env' });
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/codingarena', { autoIndex: false, autoCreate: false });
  try {
    const documents = await Problem.find({ slug: { $in: problems.map((problem) => problem.slug) } }).select('slug starterCode').lean();
    for (const { _id, slug, starterCode } of documents) {
      const canonical = starterCodeFor(slug);
      const languages = Object.keys(canonical).filter((language) => starterCode?.[language] !== canonical[language]);
      if (!languages.length) continue;
      console.log(`${confirm ? 'Updating' : 'Would update'} ${slug}: ${languages.join(', ')}`);
      if (confirm) {
        const changes = Object.fromEntries(languages.map((language) => [`starterCode.${language}`, canonical[language]]));
        await Problem.updateOne({ _id }, { $set: changes });
      }
    }
    console.log(confirm ? 'Starter reset complete.' : 'Preview complete. Pass --confirm to apply these changes.');
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) resetStarters().catch((err) => {
  console.error('Starter reset failed:', err.message);
  process.exitCode = 1;
});
