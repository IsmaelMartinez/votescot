import { useState } from "react";

interface Props {
  onToggle: (view: "constituency" | "party") => void;
}

export default function ViewToggle({ onToggle }: Props) {
  const [active, setActive] = useState<"constituency" | "party">("constituency");

  function handleClick(view: "constituency" | "party") {
    setActive(view);
    onToggle(view);
  }

  const base = "px-3.5 py-1.5 font-body text-xs font-medium uppercase tracking-wider transition-colors";
  const activeStyle = "bg-votescot-gold text-gray-900 font-bold";
  const inactiveStyle = "bg-white text-gray-400 hover:text-gray-600";

  return (
    <div className="flex border border-votescot-border rounded-lg overflow-hidden mb-4">
      <button
        type="button"
        className={`${base} ${active === "constituency" ? activeStyle : inactiveStyle}`}
        onClick={() => handleClick("constituency")}
      >
        By Constituency
      </button>
      <button
        type="button"
        className={`${base} ${active === "party" ? activeStyle : inactiveStyle}`}
        onClick={() => handleClick("party")}
      >
        By Party
      </button>
    </div>
  );
}
