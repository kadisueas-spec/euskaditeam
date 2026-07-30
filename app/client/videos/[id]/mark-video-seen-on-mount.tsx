"use client";

import { useEffect } from "react";
import { markVideoView } from "../actions";

export function MarkVideoSeenOnMount({
  id,
  alreadySeen,
}: {
  id: string;
  alreadySeen: boolean;
}) {
  useEffect(() => {
    if (alreadySeen) return;
    markVideoView(id);
  }, [id, alreadySeen]);

  return null;
}
