const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const User = require('../models/User');

const generateUniqueUsername = async (rawName) => {
  let base = (rawName || '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
  if (base.length < 3) {
    base = (base + 'user').slice(0, 20);
  }
  if (base.length < 3) {
    base = 'user';
  }
  base = base.slice(0, 20);

  let username = base;
  let counter = 1;
  while (await User.exists({ username })) {
    const suffix = String(counter);
    const maxBaseLen = 20 - suffix.length;
    username = `${base.slice(0, maxBaseLen)}${suffix}`;
    counter++;
  }
  return username;
};

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || 'google_client_id_placeholder',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'google_client_secret_placeholder',
      callbackURL: `${process.env.SERVER_URL || 'http://localhost:5000'}/api/v1/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ googleId: profile.id });
        if (user) {
          if (!user.authProviders.includes('google')) {
            user.authProviders.push('google');
            await user.save();
          }
          return done(null, user);
        }

        const isVerified =
          profile._json?.email_verified === true ||
          profile._json?.email_verified === 'true' ||
          profile.emails?.[0]?.verified === true;

        if (!isVerified) {
          return done(new Error('email_not_verified'));
        }

        const email = (profile.emails?.[0]?.value || profile._json?.email)?.toLowerCase();
        if (!email) {
          return done(new Error('email_not_verified'));
        }

        user = await User.findOne({ email });
        const avatar = profile.photos?.[0]?.value || '';

        if (user) {
          user.googleId = profile.id;
          if (!user.authProviders.includes('google')) {
            user.authProviders.push('google');
          }
          if (!user.avatar && avatar) {
            user.avatar = avatar;
          }
          await user.save();
          return done(null, user);
        }

        const rawName = profile.displayName || profile.name?.givenName || email.split('@')[0];
        const username = await generateUniqueUsername(rawName);

        user = await User.create({
          username,
          email,
          avatar,
          googleId: profile.id,
          authProviders: ['google'],
        });

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID || 'github_client_id_placeholder',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || 'github_client_secret_placeholder',
      callbackURL: `${process.env.SERVER_URL || 'http://localhost:5000'}/api/v1/auth/github/callback`,
      scope: ['user:email'],
      allRawEmails: true,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ githubId: String(profile.id) });
        if (user) {
          if (!user.authProviders.includes('github')) {
            user.authProviders.push('github');
            await user.save();
          }
          return done(null, user);
        }

        let verifiedEmail = null;
        if (Array.isArray(profile.emails)) {
          const primary = profile.emails.find(
            (e) => e.primary && (e.verified === true || e.verified === 'true')
          );
          if (primary) {
            verifiedEmail = primary.value;
          } else {
            const anyVerified = profile.emails.find(
              (e) => e.verified === true || e.verified === 'true'
            );
            if (anyVerified) verifiedEmail = anyVerified.value;
          }
        }

        if (!verifiedEmail && accessToken) {
          try {
            const emailRes = await fetch('https://api.github.com/user/emails', {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'User-Agent': 'CodingArena',
                Accept: 'application/vnd.github+json',
              },
            });
            if (emailRes.ok) {
              const emailList = await emailRes.json();
              const primary = emailList.find((e) => e.primary && e.verified);
              const any = emailList.find((e) => e.verified);
              verifiedEmail = primary?.email || any?.email || null;
            }
          } catch {}
        }

        if (!verifiedEmail) {
          return done(new Error('email_not_verified'));
        }

        const email = verifiedEmail.toLowerCase();
        user = await User.findOne({ email });
        const avatar = profile.photos?.[0]?.value || profile._json?.avatar_url || '';

        if (user) {
          user.githubId = String(profile.id);
          if (!user.authProviders.includes('github')) {
            user.authProviders.push('github');
          }
          if (!user.avatar && avatar) {
            user.avatar = avatar;
          }
          await user.save();
          return done(null, user);
        }

        const rawName = profile.username || profile.displayName || email.split('@')[0];
        const username = await generateUniqueUsername(rawName);

        user = await User.create({
          username,
          email,
          avatar,
          githubId: String(profile.id),
          authProviders: ['github'],
        });

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

module.exports = passport;
