import PostMortemReport from "./PostMortemReport";

export default function PostMatchResults({ onClose, onContinue, onQueueNext }) {
  return <PostMortemReport onBack={onClose} onQueueNext={onQueueNext || onContinue} />;
}
