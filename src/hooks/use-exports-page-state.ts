"use client";

import { useState } from "react";
import type { ExportDialogState } from "@/types/exports";
import type { ExportType } from "@/constants/exports";

export function useExportsPageState() {
  const [exportError,      setExportError]      = useState("");
  const [dialog,           setDialog]           = useState<ExportDialogState | null>(null);
  const [copied,           setCopied]           = useState(false);
  const [activeExportType, setActiveExportType] = useState<ExportType | null>(null);
  const [pendingPickle,    setPendingPickle]    = useState<ExportType | null>(null);
  const [resetConfirm,     setResetConfirm]     = useState(false);

  function closeDialog() {
    setDialog(null);
    setCopied(false);
    setActiveExportType(null);
  }

  return {
    exportError, setExportError,
    dialog, setDialog,
    copied, setCopied,
    activeExportType, setActiveExportType,
    pendingPickle, setPendingPickle,
    resetConfirm, setResetConfirm,
    closeDialog,
  };
}
