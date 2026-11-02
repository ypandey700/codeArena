import {
  Brackets,
  Bug,
  Code,
  Database,
  Sparkles,
  Swords,
  Target,
  Trophy,
} from "lucide-react";

const ICONS = {
  swords: Swords,
  bug: Bug,
  target: Target,
  brackets: Brackets,
  code: Code,
  database: Database,
  trophy: Trophy,
  sparkles: Sparkles,
};

export default function ModeIcon({ name, size = 16, className }) {
  const Icon = ICONS[name] ?? Code;
  return <Icon size={size} className={className} />;
}
