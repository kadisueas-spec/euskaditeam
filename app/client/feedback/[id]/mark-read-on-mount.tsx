"use client";

import { useEffect } from "react";
import { markFeedbackRead } from "../actions";

export function MarkReadOnMount({
  id,
  alreadyRead,
}: {
  id: string;
  alreadyRead: boolean;
}) {
  useEffect(() => {
    if (alreadyRead) return;
    markFeedbackRead(id);
  }, [id, alreadyRead]);

  return null;
}
