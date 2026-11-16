import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, CircleAlert, LoaderCircle, RotateCcw, UserRoundSearch } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import ProfileDashboard from "../components/ProfileDashboard";
import ProfileEditor from "../components/ProfileEditor";

export default function Profile() {
  const { username } = useParams();
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [profileUser, setProfileUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileRevision, setProfileRevision] = useState(0);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [recentSubmissions, setRecentSubmissions] = useState([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsError, setSubmissionsError] = useState("");
  const [submissionsRevision, setSubmissionsRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setNotFound(false);
    setProfileError("");
    setProfileUser(null);
    api.get(`/users/${encodeURIComponent(username)}`, { signal: controller.signal }).then((response) => {
      if (!response.data?.data?.user) throw new Error("Profile data is unavailable.");
      if (!controller.signal.aborted) setProfileUser(response.data.data.user);
    }).catch((error) => {
      if (controller.signal.aborted) return;
      if (error.response?.status === 404) setNotFound(true);
      else setProfileError("This player card couldn't load. Please try again.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [username, profileRevision]);

  const isOwnProfile = Boolean(user && profileUser && user.username?.toLowerCase() === profileUser.username?.toLowerCase());
  useEffect(() => {
    setRecentSubmissions([]);
    setSubmissionsError("");
    if (!isOwnProfile) { setSubmissionsLoading(false); return; }
    const controller = new AbortController();
    setSubmissionsLoading(true);
    api.get("/submissions/me", { params: { limit: 5 }, signal: controller.signal }).then((response) => {
      if (!Array.isArray(response.data?.data?.submissions)) throw new Error("Submission data unavailable");
      if (!controller.signal.aborted) setRecentSubmissions(response.data.data.submissions);
    }).catch(() => { if (!controller.signal.aborted) setSubmissionsError("Recent activity is unavailable."); }).finally(() => { if (!controller.signal.aborted) setSubmissionsLoading(false); });
    return () => controller.abort();
  }, [isOwnProfile, profileUser?._id, submissionsRevision]);

  async function handleProfileUpdated(updated) {
    setProfileUser((previous) => ({ ...previous, ...updated }));
    await refreshUser();
    if (updated.username !== username) navigate(`/u/${encodeURIComponent(updated.username)}`, { replace: true });
  }

  if (loading) return <div className="player-profile pp-loading" role="status" aria-label="Loading player profile"><div className="pp-loading__hero" aria-hidden="true"><span /><div /><div /></div><div className="pp-loading__stats" aria-hidden="true">{[0, 1, 2, 3].map((key) => <span key={key} />)}</div><span className="pp-loading__label"><LoaderCircle size={15} className="pp-spin" aria-hidden="true" />Opening the player file…</span></div>;
  if (notFound || profileError || !profileUser) return <div className="pp-route-state"><span className="pp-route-state__icon">{notFound ? <UserRoundSearch size={30} strokeWidth={1.3} aria-hidden="true" /> : <CircleAlert size={30} strokeWidth={1.3} aria-hidden="true" />}</span><p className="pp-eyebrow">{notFound ? "CHALLENGER NOT FOUND" : "A MOMENT BETWEEN MOVES"}</p><h1>{notFound ? <>No player named<br /><em>@{username}.</em></> : "Your player card is taking a moment."}</h1><p>{notFound ? "They may have changed their name, or their story hasn't started here yet." : profileError || "The profile is currently unavailable."}</p>{notFound ? <Link to="/" className="pp-button pp-button--primary">Back to the arena <ArrowRight size={14} aria-hidden="true" /></Link> : <button type="button" className="pp-button pp-button--primary" onClick={() => setProfileRevision((value) => value + 1)}><RotateCcw size={14} aria-hidden="true" />Try again</button>}</div>;

  return <><ProfileDashboard profileUser={profileUser} isOwnProfile={isOwnProfile} recentSubmissions={recentSubmissions} submissionsLoading={submissionsLoading} submissionsError={submissionsError} onRetrySubmissions={() => setSubmissionsRevision((value) => value + 1)} onEdit={() => setIsEditOpen(true)} />{isEditOpen && <ProfileEditor profileUser={profileUser} onClose={() => setIsEditOpen(false)} onUpdated={handleProfileUpdated} />}</>;
}
