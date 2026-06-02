"use client";

import { useRef, useState } from "react";
import type { Project } from "@/types/projects";

export function useProjectsPageState() {
  const [showForkConfirm,    setShowForkConfirm]    = useState(false);
  const [forkError,          setForkError]          = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteTarget,       setDeleteTarget]       = useState<Project | null>(null);
  const [editingProjectId,   setEditingProjectId]   = useState<string | null>(null);
  const [savingProjectId,    setSavingProjectId]    = useState<string | null>(null);
  const [versionScroll,      setVersionScroll]      = useState({ canScrollDown: false, canScrollUp: false });
  const versionListRef = useRef<HTMLDivElement>(null);

  function openDeleteConfirm(project: Project) {
    setDeleteTarget(project);
    setDeleteConfirmation("");
  }

  function closeDeleteConfirm() {
    setDeleteTarget(null);
    setDeleteConfirmation("");
  }

  return {
    showForkConfirm, setShowForkConfirm,
    forkError, setForkError,
    deleteConfirmation, setDeleteConfirmation,
    deleteTarget, setDeleteTarget,
    editingProjectId, setEditingProjectId,
    savingProjectId, setSavingProjectId,
    versionScroll, setVersionScroll,
    versionListRef,
    openDeleteConfirm, closeDeleteConfirm,
  };
}
