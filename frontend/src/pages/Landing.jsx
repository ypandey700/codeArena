import { useState } from "react";
import Hero from "../components/Hero";
import GameModes from "../components/GameModes";
import HowItWorks from "../components/HowItWorks";

export default function Landing() {
  const [activeMode, setActiveMode] = useState(0);
  const [battleStarted, setBattleStarted] = useState(false);

  return (
    <>
      <Hero
        battleStarted={battleStarted}
        onToggleBattle={() => setBattleStarted((v) => !v)}
      />
      <GameModes activeMode={activeMode} onSelectMode={setActiveMode} />
      <HowItWorks />
    </>
  );
}
