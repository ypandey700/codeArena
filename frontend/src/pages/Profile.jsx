import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  Swords,
  X,
} from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import ProfileDashboard from "../components/ProfileDashboard";

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
        className="profile-edit-modal relative my-auto w-full max-w-md rounded-xl border border-white/10 bg-[#101418] p-6 shadow-[0_24px_100px_rgba(0,0,0,.65)] sm:p-8"
      >
        <button
          type="button"
          aria-label="Close dialog"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-lg p-2 text-on-surface-muted transition hover:bg-white/5 hover:text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <X size={19} />
        </button>

        <div className="mb-6">
          <span className="text-[10px] font-bold uppercase tracking-[.22em] text-primary">
            Player Configuration
          </span>
          <h2 id="edit-dialog-title" className="mt-2 text-lg font-semibold tracking-tight text-on-surface">
            Edit profile
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="text-[11px] font-medium text-secondary">{error}</div>}

          <label className="block">
            <span className="mb-2 block text-xs font-medium text-on-surface-muted">Username</span>
            <input
              required
              minLength={3}
              maxLength={20}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="w-full rounded-xl border border-white/10 bg-[#101418] px-3.5 py-2.5 text-sm text-on-surface outline-none placeholder:text-on-surface-subtle focus:border-[#fddf49]/50"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-medium text-on-surface-muted">Avatar URL</span>
            <input
              type="url"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="https://images.unsplash.com/..."
              className="w-full rounded-xl border border-white/10 bg-[#101418] px-3.5 py-2.5 text-sm text-on-surface outline-none placeholder:text-on-surface-subtle focus:border-[#fddf49]/50"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-medium text-on-surface-muted">College / Organization</span>
            <input
              type="text"
              value={college}
              onChange={(e) => setCollege(e.target.value)}
              placeholder="e.g. Stanford University"
              className="w-full rounded-xl border border-white/10 bg-[#101418] px-3.5 py-2.5 text-sm text-on-surface outline-none placeholder:text-on-surface-subtle focus:border-[#fddf49]/50"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-medium text-on-surface-muted">Bio</span>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A few words about your coding journey..."
              className="w-full resize-none rounded-xl border border-white/10 bg-[#101418] px-3.5 py-2.5 text-sm text-on-surface outline-none placeholder:text-on-surface-subtle focus:border-[#fddf49]/50"
            />
          </label>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-on-surface-muted transition hover:bg-white/[.05]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-[#261f18] transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
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
  const [recentSubmissions, setRecentSubmissions] = useState([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;

    const fetchProfile = async () => {
      setLoading(true);
      setNotFound(false);
      setRecentSubmissions([]);
      setSubmissionsLoading(false);
      try {
        const res = await api.get(`/users/${username}`);
        if (active) {
          const nextProfile = res.data.data.user;
          setProfileUser(nextProfile);

          if (user?.username?.toLowerCase() === nextProfile.username?.toLowerCase()) {
            setSubmissionsLoading(true);
            try {
              const submissionRes = await api.get("/submissions/me", { params: { limit: 5 } });
              if (active) setRecentSubmissions(submissionRes.data?.data?.submissions || []);
            } catch {
              if (active) setRecentSubmissions([]);
            } finally {
              if (active) setSubmissionsLoading(false);
            }
          } else {
            setRecentSubmissions([]);
          }
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
  }, [username, user?.username]);

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
          <div className="rounded-2xl border border-white/[.08] bg-[#1b1c1f]/80 p-6 sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-5">
                <div className="h-20 w-20 animate-pulse rounded-full border-2 border-primary/20 bg-white/[.06] sm:h-24 sm:w-24" />
                <div className="space-y-3">
                  <div className="h-6 w-44 animate-pulse rounded bg-white/[.08]" />
                  <div className="h-4 w-32 animate-pulse rounded bg-white/[.04]" />
                  <div className="h-3 w-56 animate-pulse rounded bg-white/[.04]" />
                </div>
              </div>
              <div className="h-20 w-32 animate-pulse rounded-xl bg-white/[.05]" />
            </div>
          </div>
          <div className="h-24 animate-pulse rounded-2xl border border-white/[.08] bg-[#1b1c1f]/50" />
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
      <div className="flex min-h-[65vh] items-center justify-center px-4 py-12">
        <div className="relative w-full max-w-md rounded-2xl border border-white/[.08] bg-[#1b1c1f] p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,.65)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-secondary/20 bg-secondary/10 text-secondary">
            <Swords size={26} />
          </div>
          <span className="mt-5 block text-[10px] font-bold uppercase tracking-[.22em] text-secondary">
            Player Not Found
          </span>
          <h2 className="mt-2 text-lg font-bold tracking-tight text-on-surface">
            No player named{" "}
            <span className="font-mono text-primary">@{username}</span>
          </h2>
          <p className="mt-3 text-sm leading-6 text-on-surface-muted">
            This challenger does not exist in the Code Arena or may have chosen a new callsign.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-[#261f18] transition hover:bg-primary"
          >
            Return to arena <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <ProfileDashboard
        profileUser={profileUser}
        isOwnProfile={Boolean(isOwnProfile)}
        recentSubmissions={recentSubmissions}
        submissionsLoading={submissionsLoading}
        onEdit={() => setIsEditOpen(true)}
      />
      {isEditOpen && (
        <EditProfileModal
          profileUser={profileUser}
          onClose={() => setIsEditOpen(false)}
          onUpdated={handleProfileUpdated}
        />
      )}
    </>
  );
}
