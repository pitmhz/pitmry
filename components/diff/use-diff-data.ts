"use client";

import { useEffect, useMemo, useState } from "react";
import type { DiffData, DiffFile } from "./diff-types";

interface DiffRequest {
  url: string | null;
  data: DiffData | null;
}

function buildDiffUrl(
  project?: string,
  commitHash?: string,
  itemId?: number | string | null
): string | null {
  if (!commitHash && !itemId) return null;
  let url = `/api/memory?action=diff`;
  if (project) url += `&project=${encodeURIComponent(project)}`;
  if (commitHash) url += `&commit=${encodeURIComponent(commitHash)}`;
  if (itemId) url += `&item_id=${encodeURIComponent(itemId)}`;
  return url;
}

export function useDiffData(
  project: string | undefined,
  commitHash: string | undefined,
  itemId: number | string | null | undefined,
  selectedFileIndex: number
) {
  const url = buildDiffUrl(project, commitHash, itemId);
  const [request, setRequest] = useState<DiffRequest>({ url: null, data: null });

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    fetch(url)
      .then((res) => res.json())
      .then((resData: DiffData) => {
        if (!cancelled) setRequest({ url, data: resData });
      })
      .catch((err) => {
        console.error("Failed to load diff:", err);
        if (!cancelled) {
          setRequest({
            url,
            data: { available: false, error: "Failed to connect to backend bridge" },
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  // Loading is derived from whether the settled request matches the current
  // request key, so no setLoading(true) is needed inside the effect body.
  const data = request.url === url ? request.data : null;
  const loading = request.url !== url;

  const files: DiffFile[] = useMemo(() => data?.files || [], [data]);

  const activeFile = files[selectedFileIndex] || files[0];

  const reconstructedCode = useMemo(() => {
    if (!activeFile || activeFile.is_binary || !activeFile.hunks) return "";
    return activeFile.hunks
      .map((h) =>
        h.lines
          .filter((l) => l.type !== "deletion")
          .map((l) => l.content)
          .join("\n")
      )
      .join("\n\n// ...\n\n");
  }, [activeFile]);

  return { data, loading, files, activeFile, reconstructedCode };
}
