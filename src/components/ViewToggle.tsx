import React, { useState } from "react";

export default function ViewToggle() {
  const [active, setActive] = useState<"constituency" | "party">("constituency");

  function handleClick(view: "constituency" | "party") {
    setActive(view);
    const constituencyEl = document.getElementById("view-constituency");
    const partyEl = document.getElementById("view-party");
    if (constituencyEl) constituencyEl.style.display = view === "constituency" ? "" : "none";
    if (partyEl) partyEl.style.display = view === "party" ? "" : "none";
  }

  const base = "px-3.5 py-1.5 font-body text-xs font-medium uppercase tracking-wider transition-colors";
  const activeStyle = "bg-votescot-gold text-votescot-dark font-bold";
  const inactiveStyle = "bg-white text-gray-700 hover:text-gray-900";

  return (
    <div role="group" aria-label="Browse candidates by" className="flex border border-gray-500 rounded-lg overflow-hidden mb-4">
      <button
        type="button"
        aria-pressed={active === "constituency"}
        className={`${base} ${active === "constituency" ? activeStyle : inactiveStyle}`}
        onClick={() => handleClick("constituency")}
      >
        By Constituency
      </button>
      <button
        type="button"
        aria-pressed={active === "party"}
        className={`${base} ${active === "party" ? activeStyle : inactiveStyle}`}
        onClick={() => handleClick("party")}
      >
        By Party
      </button>
    </div>
  );
}
