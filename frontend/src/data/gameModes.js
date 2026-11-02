export const MODE_COLORS = {
  lime: "text-lime-300 bg-lime-300/10 border-lime-300/20",
  orange: "text-orange-300 bg-orange-300/10 border-orange-300/20",
  blue: "text-sky-300 bg-sky-300/10 border-sky-300/20",
  purple: "text-violet-300 bg-violet-300/10 border-violet-300/20",
};

export const GAME_MODES = [
  {
    id: "battle",
    name: "1v1 Battle",
    icon: "swords",
    color: "lime",
    detail:
      "Go head-to-head, solve the same challenge, and talk through every move in live match chat.",
  },
  {
    id: "debug",
    name: "Debug Code ",
    icon: "bug",
    color: "orange",
    detail: "Find the bug, explain the root cause, and ship the fix before your opponent.",
  },
  {
    id: "practice",
    name: "Practice Arena",
    icon: "target",
    color: "blue",
    detail: "Warm up on focused challenges, build a streak, and sharpen the skills you choose.",
  },
  {
    id: "clean",
    name: "Clean Code",
    icon: "brackets",
    color: "purple",
    detail: "Readable, maintainable solutions earn points too. It’s not just about speed.",
  },
  {
    id: "web",
    name: "Web Dev Round",
    icon: "code",
    color: "blue",
    detail: "Put HTML, CSS, JavaScript, and frontend problem-solving to the test.",
  },
  {
    id: "sql",
    name: "MySQL Round",
    icon: "database",
    color: "orange",
    detail: "Take on practical SQL challenges covering joins, filtering, and aggregation.",
  },
  {
    id: "match",
    name: "Skill Matchmaking",
    icon: "trophy",
    color: "lime",
    detail: "Meet a worthy rival at your level, then climb as your skills grow.",
  },
  {
    id: "analysis",
    name: "Battle Analysis",
    icon: "sparkles",
    color: "purple",
    detail: "Review both solutions and spot exactly what you can improve next time.",
  },
];
