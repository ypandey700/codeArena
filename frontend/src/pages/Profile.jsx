import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  Award,
  Calendar,
  Code2,
  GraduationCap,
  Sparkles,
  Swords,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
  X,
  Zap,
} from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

function EditProfileModal({ profileUser, onClose, onUpdated }) {
  const [username, setUsername] = useState(profileUser.username || "");
  const [bio, setBio] = useState(profileUser.bio || "");
  const [college, setCollege] = useState(profileUser.college || "");
  const [avatar, setAvatar] = useState(profileUser.avatar || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 3 || cleanUsername.length > 20) {
      setError("Username must be between 3 and 20 characters");
      return;
    }

    setSaving(true);
    try {
      const res = await api.patch("/users/me", {
        username: cleanUsername,
        bio: bio.trim(),
        college: college.trim(),
        avatar: avatar.trim(),
      });
      const updatedUser = res.data.data.user;
      onUpdated(updatedUser);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#050a09]/85 p-4 backdrop-blur-md"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-dialog-title"
        className="relative my-auto w-full max-w-md rounded-2xl border border-white/10 bg-[#101816] p-6 shadow-[0_24px_100px_rgba(0,0,0,.65)] sm:p-8"
      >
        <button
          type="button"
          aria-label="Close dialog"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-lg p-2 text-slate-400 transition hover:bg-white/5 hover:text-white focus:outline-none focus:ring-1 focus:ring-lime-300"
        >
          <X size={19} />
        </button>

        <div className="mb-6">
          <span className="text-[10px] font-bold uppercase tracking-[.22em] text-lime-300">
            Player Configuration
          </span>
          <h2 id="edit-dialog-title" className="mt-2 text-2xl font-semibold tracking-tight text-white">
            Edit profile
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="text-[11px] font-medium text-orange-300">{error}</div>}

          <label className="block">
            <span className="mb-2 block text-xs font-medium text-slate-300">Username</span>
            <input
              required
              minLength={3}
              maxLength={20}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="w-full rounded-xl border border-white/10 bg-[#0b100f] px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-lime-300/50"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-medium text-slate-300">Avatar URL</span>
            <input
              type="url"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="https://images.unsplash.com/..."
              className="w-full rounded-xl border border-white/10 bg-[#0b100f] px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-lime-300/50"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-medium text-slate-300">College / Organization</span>
            <input
              type="text"
              value={college}
              onChange={(e) => setCollege(e.target.value)}
              placeholder="e.g. Stanford University"
              className="w-full rounded-xl border border-white/10 bg-[#0b100f] px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-lime-300/50"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-medium text-slate-300">Bio</span>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A few words about your coding journey..."
              className="w-full resize-none rounded-xl border border-white/10 bg-[#0b100f] px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-lime-300/50"
            />
          </label>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:bg-white/[.05]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-lime-300 px-5 py-2.5 text-xs font-bold text-[#101512] transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Profile() {
  const { username } = useParams();
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [profileUser, setProfileUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  useEffect(() => {
    let active = true;

    const fetchProfile = async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const res = await api.get(`/users/${username}`);
        if (active) {
          setProfileUser(res.data.data.user);
        }
      } catch (err) {
        if (active) {
          if (err.response?.status === 404) {
            setNotFound(true);
          }
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    if (username) {
      fetchProfile();
    }

    return () => {
      active = false;
    };
  }, [username]);

  const isOwnProfile =
    user && profileUser && user.username?.toLowerCase() === profileUser.username?.toLowerCase();

  const handleProfileUpdated = async (updated) => {
    setProfileUser(updated);
    await refreshUser();
    if (updated.username !== username) {
      navigate(`/u/${updated.username}`, { replace: true });
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/[.08] bg-[#111816]/80 p-6 sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-5">
                <div className="h-20 w-20 animate-pulse rounded-full border-2 border-lime-300/20 bg-white/[.06] sm:h-24 sm:w-24" />
                <div className="space-y-3">
                  <div className="h-6 w-44 animate-pulse rounded bg-white/[.08]" />
                  <div className="h-4 w-32 animate-pulse rounded bg-white/[.04]" />
                  <div className="h-3 w-56 animate-pulse rounded bg-white/[.04]" />
                </div>
              </div>
              <div className="h-20 w-32 animate-pulse rounded-xl bg-white/[.05]" />
            </div>
          </div>
          <div className="h-24 animate-pulse rounded-2xl border border-white/[.08] bg-[#111816]/50" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="h-24 animate-pulse rounded-xl bg-white/[.04]" />
            <div className="h-24 animate-pulse rounded-xl bg-white/[.04]" />
            <div className="h-24 animate-pulse rounded-xl bg-white/[.04]" />
            <div className="h-24 animate-pulse rounded-xl bg-white/[.04]" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !profileUser) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center px-4 py-20">
        <div className="relative w-full max-w-md rounded-2xl border border-white/[.08] bg-[#111816] p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,.65)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-orange-400/20 bg-orange-400/10 text-orange-300">
            <Swords size={26} />
          </div>
          <span className="mt-5 block text-[10px] font-bold uppercase tracking-[.22em] text-orange-300">
            Player Not Found
          </span>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
            No player named{" "}
            <span className="font-mono text-lime-300">@{username}</span>
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            This challenger does not exist in the Code Arena or may have chosen a new callsign.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-lime-300 px-5 py-2.5 text-sm font-bold text-[#101512] transition hover:bg-lime-200"
          >
            Return to arena <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  const xp = profileUser.xp || 0;
  const level = Math.floor(xp / 500) + 1;
  const currentLevelXp = xp % 500;
  const progressPercent = Math.min(100, Math.max(0, (currentLevelXp / 500) * 100));

  const stats = profileUser.stats || {};
  const solved = stats.problemsSolved || 0;
  const submissions = stats.submissions || 0;
  const wins = stats.wins || 0;
  const losses = stats.losses || 0;
  const totalMatches = wins + losses;
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;
  const friendsCount = profileUser.friends ? profileUser.friends.length : 0;

  const memberSince = profileUser.createdAt
    ? new Date(profileUser.createdAt).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : "Unknown";

  const lastSeenDisplay = profileUser.lastSeen
    ? new Date(profileUser.lastSeen).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-6">
        <div
          data-reveal
          data-tilt
          data-cursor="card"
          className="relative overflow-hidden rounded-2xl border border-white/[.12] bg-[#111816]/95 p-6 shadow-[0_28px_90px_rgba(0,0,0,.65)] backdrop-blur-xl sm:p-8"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="relative shrink-0">
                <div className="h-20 w-20 overflow-hidden rounded-full border-2 border-lime-300 p-1 shadow-[0_0_16px_rgba(190,242,100,0.25)] sm:h-24 sm:w-24">
                  {profileUser.avatar ? (
                    <img
                      src={profileUser.avatar}
                      alt={profileUser.username}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center rounded-full bg-lime-300/15 font-mono text-2xl font-bold uppercase text-lime-300 sm:text-3xl">
                      {profileUser.username.charAt(0)}
                    </span>
                  )}
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-[.22em] text-lime-300">
                    Challenger
                  </span>
                  {profileUser.isOnline ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-lime-300/30 bg-lime-300/10 px-2.5 py-0.5 text-[10px] font-semibold text-lime-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-lime-300 shadow-[0_0_8px_#bef264]" />
                      ONLINE
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] text-slate-500">
                      last seen {lastSeenDisplay || "recently"}
                    </span>
                  )}
                </div>

                <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  @{profileUser.username}
                </h1>

                {profileUser.college && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-sky-300">
                    <GraduationCap size={14} />
                    {profileUser.college}
                  </p>
                )}

                {profileUser.bio && (
                  <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-slate-300">
                    {profileUser.bio}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] font-mono text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Calendar size={13} />
                    Member since {memberSince}
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Users size={13} className="text-sky-300" />
                    <span className="text-sky-300">{friendsCount}</span> {friendsCount === 1 ? "friend" : "friends"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/[.07] pt-4 lg:flex-col lg:items-end lg:border-t-0 lg:pt-0">
              <div className="rounded-xl border border-white/[.08] bg-[#0b100f] px-5 py-3 text-center lg:min-w-[130px]">
                <span className="block text-[10px] font-bold uppercase tracking-[.2em] text-slate-500">
                  RATING
                </span>
                <span className="mt-0.5 block font-mono text-3xl font-bold text-lime-300 sm:text-4xl">
                  {profileUser.rating ?? 1200}
                </span>
              </div>

              <div>
                {isOwnProfile ? (
                  <button
                    onClick={() => setIsEditOpen(true)}
                    className="rounded-xl border border-white/20 bg-white/[.03] px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-lime-300/50 hover:bg-lime-300/10 hover:text-lime-300"
                  >
                    Edit profile
                  </button>
                ) : (
                  <button
                    disabled
                    className="flex cursor-not-allowed items-center gap-1.5 rounded-xl border border-white/10 bg-white/[.02] px-4 py-2 text-xs font-semibold text-slate-500"
                  >
                    <UserPlus size={14} /> Add friend <span className="font-mono text-[10px] text-slate-600">(Coming soon)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[.08] bg-[#111816] p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[.22em] text-lime-300">
                Arena Tier
              </span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-xl font-bold text-white">
                  Level{" "}
                  <span className="font-serif italic font-normal text-lime-300">
                    {level}
                  </span>
                </span>
              </div>
            </div>
            <div className="font-mono text-xs text-lime-300">
              {xp} / {level * 500} XP
            </div>
          </div>

          <div className="mt-4 h-2 w-full overflow-hidden rounded-full border border-white/[.06] bg-[#0b100f]">
            <div
              className="h-full rounded-full bg-lime-300 shadow-[0_0_12px_#bef264] transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="mt-2 flex justify-between font-mono text-[10px] text-slate-500">
            <span>{currentLevelXp} XP current tier</span>
            <span>{500 - currentLevelXp} XP to Level {level + 1}</span>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[.22em] text-lime-300">
              Combat Statistics
            </span>
            <span className="rounded-full border border-lime-300/20 bg-lime-300/10 px-2.5 py-0.5 font-mono text-xs text-lime-300">
              Win Rate: {winRate}%
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-white/[.08] bg-[#111816] p-4">
              <span className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">
                SOLVED
              </span>
              <p className="mt-1 font-mono text-2xl font-bold text-lime-300 sm:text-3xl">
                {solved}
              </p>
              <span className="mt-1 block text-[10px] text-slate-500">Problems solved</span>
            </div>

            <div className="rounded-xl border border-white/[.08] bg-[#111816] p-4">
              <span className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">
                SUBMISSIONS
              </span>
              <p className="mt-1 font-mono text-2xl font-bold text-sky-300 sm:text-3xl">
                {submissions}
              </p>
              <span className="mt-1 block text-[10px] text-slate-500">Total evaluations</span>
            </div>

            <div className="rounded-xl border border-white/[.08] bg-[#111816] p-4">
              <span className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">
                WINS
              </span>
              <p className="mt-1 font-mono text-2xl font-bold text-violet-300 sm:text-3xl">
                {wins}
              </p>
              <span className="mt-1 block text-[10px] text-slate-500">Victories</span>
            </div>

            <div className="rounded-xl border border-white/[.08] bg-[#111816] p-4">
              <span className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">
                LOSSES
              </span>
              <p className="mt-1 font-mono text-2xl font-bold text-orange-300 sm:text-3xl">
                {losses}
              </p>
              <span className="mt-1 block text-[10px] text-slate-500">Defeats</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[.08] bg-[#111816] p-5 sm:p-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[.22em] text-lime-300">
              Badges & Honor
            </span>
            <span className="font-mono text-xs text-slate-500">
              {profileUser.badges?.length || 0} unlocked
            </span>
          </div>

          {profileUser.badges && profileUser.badges.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {profileUser.badges.map((badge, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 rounded-full border border-lime-300/30 bg-lime-300/10 px-3 py-1 font-mono text-xs font-medium text-lime-300"
                >
                  <Award size={13} /> {badge}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs italic text-slate-500">
              No badges yet. Win a duel to earn one.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-white/[.08] bg-[#111816] p-5 sm:p-6">
          <span className="text-[10px] font-bold uppercase tracking-[.22em] text-lime-300">
            Battle History
          </span>
          <h3 className="mt-1 text-base font-semibold text-white">Recent activity</h3>

          <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[.08] bg-[#0b100f]/60 px-4 py-10 text-center">
            <Code2 size={24} className="mb-2 text-slate-600" />
            <p className="text-xs text-slate-400">
              No submissions yet. Your first solve shows up here.
            </p>
          </div>
        </div>
      </div>

      {isEditOpen && (
        <EditProfileModal
          profileUser={profileUser}
          onClose={() => setIsEditOpen(false)}
          onUpdated={handleProfileUpdated}
        />
      )}
    </div>
  );
}
