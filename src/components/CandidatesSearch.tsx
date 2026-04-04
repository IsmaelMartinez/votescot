import React from "react";
import SearchFilter, { type SearchItem } from "./SearchFilter";
import PostcodeInput from "./PostcodeInput";

interface Props {
  items: SearchItem[];
  knownConstituencies: string[];
  basePath: string;
}

export default function CandidatesSearch({ items, knownConstituencies, basePath }: Props) {
  const handleSelect = (item: SearchItem) => {
    if (item.id.startsWith("constituency:")) {
      const slug = item.id.replace("constituency:", "");
      window.location.href = `${basePath}candidates/constituency/${slug}`;
    } else {
      const id = item.id.replace("candidate:", "");
      window.location.href = `${basePath}candidates/${id}`;
    }
  };

  return (
    <div>
      <PostcodeInput
        knownConstituencies={knownConstituencies}
        label="Enter your postcode to find your constituency's candidates"
        onResolved={(id) => { window.location.href = `${basePath}candidates/constituency/${id}`; }}
      />
      <p className="font-body text-xs text-gray-500 mb-2">Or search by name:</p>
      <SearchFilter
        placeholder="Search by constituency or candidate name…"
        items={items}
        onSelect={handleSelect}
      />
    </div>
  );
}
