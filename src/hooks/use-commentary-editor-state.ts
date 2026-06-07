"use client";

import { useEffect, useState } from "react";
import type { PrismaField } from "@/lib/stores/schema-store";

type UseCommentaryEditorStateOptions = {
  fields: PrismaField[];
  fieldsData: unknown; // invalidation key — reset comments when this changes
  selectedModelName: string;
};

export function useCommentaryEditorState({
  fields,
  fieldsData,
  selectedModelName,
}: UseCommentaryEditorStateOptions) {
  const [comments,   setComments]   = useState<Record<string, string>>({});
  const [dirtyKeys,  setDirtyKeys]  = useState<Set<string>>(new Set());
  const [saveError,  setSaveError]  = useState("");
  const [savedKeys,  setSavedKeys]  = useState<Set<string>>(new Set());
  const [fieldSearch, setFieldSearch] = useState("");
  const [fieldPage,   setFieldPage]   = useState(1);

  // Sync comments when fields data changes
  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const f of fields) initial[f.key] = f.comment ?? "";
    setComments(initial);
    setDirtyKeys(new Set());
    setSavedKeys(new Set());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldsData]);

  // Reset field pagination and save error when selected model changes
  useEffect(() => {
    setFieldPage(1);
    setSaveError("");
  }, [selectedModelName]);

  // Reset field pagination on search change
  useEffect(() => { setFieldPage(1); }, [fieldSearch]);

  return {
    comments, setComments,
    dirtyKeys, setDirtyKeys,
    saveError, setSaveError,
    savedKeys, setSavedKeys,
    fieldSearch, setFieldSearch,
    fieldPage, setFieldPage,
  };
}
