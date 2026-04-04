import React from "react";
import SearchFilter, { type SearchItem } from "./SearchFilter";

interface Props {
  items: SearchItem[];
  basePath: string;
}

export default function CandidatesSearch({ items, basePath }: Props) {
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
    <SearchFilter
      placeholder="Search by constituency or candidate name…"
      items={items}
      onSelect={handleSelect}
    />
  );
}
