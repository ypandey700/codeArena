export default function Brand({ compact = false }) {
  return (
    <span className={`arena-brand${compact ? " arena-brand--compact" : ""}`}>
      <img
        className="arena-brand__mark"
        src="/favicon.svg"
        width="32"
        height="32"
        alt=""
      />
      <span className="arena-brand__name">
        CODE <span className="arena-brand__accent">ARENA</span>
      </span>
    </span>
  );
}
