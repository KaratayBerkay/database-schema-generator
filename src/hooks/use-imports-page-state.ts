"use client";

import { useState } from "react";
import type { ImportMode, ParsedPreview } from "@/types/imports";

export function useImportsPageState() {
  const [mode, setMode] = useState<ImportMode>("version");

  // ── version import form ───────────────────────────────────────────────────
  const [vFile,         setVFile]         = useState<{ name: string; content: string } | null>(null);
  const [vPreview,      setVPreview]      = useState<ParsedPreview | null>(null);
  const [vParseError,   setVParseError]   = useState("");
  const [vProjectName,  setVProjectName]  = useState("");
  const [vVersionName,  setVVersionName]  = useState("");

  // ── project import form ───────────────────────────────────────────────────
  const [pFile,        setPFile]        = useState<{ name: string; content: string } | null>(null);
  const [pPreview,     setPPreview]     = useState<ParsedPreview | null>(null);
  const [pParseError,  setPParseError]  = useState("");
  const [pProjectName, setPProjectName] = useState("");

  // ── result / error ────────────────────────────────────────────────────────
  const [result, setResult] = useState("");
  const [error,  setError]  = useState("");

  function resetVersion() {
    setVFile(null); setVPreview(null); setVParseError(""); setVProjectName(""); setVVersionName("");
  }

  function resetProject() {
    setPFile(null); setPPreview(null); setPParseError(""); setPProjectName("");
  }

  return {
    mode, setMode,
    vFile, setVFile, vPreview, setVPreview, vParseError, setVParseError,
    vProjectName, setVProjectName, vVersionName, setVVersionName,
    pFile, setPFile, pPreview, setPPreview, pParseError, setPParseError,
    pProjectName, setPProjectName,
    result, setResult, error, setError,
    resetVersion, resetProject,
  };
}
