"use client";

/**
 * Console diff overlay.
 *
 * Restores the legacy "see the code diff" capability, which lived in a separate
 * modal owned by the shell and could not be opened from inside the Project
 * Intelligence console. The Diff tab in the capability panel calls this.
 *
 * It reuses the shared `Overlay` primitive so focus is trapped, Escape closes
 * the top-most dialog, and focus returns to the trigger.
 */

import * as React from "react";
import { CodeDiffViewer } from "@/components/code-diff-viewer";
import { Overlay } from "@/components/shell/overlay";
import type { MemoryItem } from "@/lib/types";

export function ConsoleDiffOverlay({
  item,
  onClose,
}: {
  item: MemoryItem | null;
  onClose: () => void;
}) {
  if (!item) return null;
  const commit = item.commit_hash;
  return (
    <Overlay
      open
      onClose={onClose}
      label="Commit diff"
      size="xl"
      showClose={false}
    >
      <CodeDiffViewer
        project={item.project}
        commitHash={commit}
        itemId={item.commit_hash ? undefined : item.id}
        isModal
        onClose={onClose}
      />
    </Overlay>
  );
}
