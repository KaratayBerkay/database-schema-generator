"use client";

import { useState } from "react";
import type { PrismaModel } from "@/lib/schema-store";
import type { HelpDialog } from "@/types/tables";

export function useTablesPageState() {
  // ── create form ───────────────────────────────────────────────────────────
  const [modelName,    setModelName]    = useState("");
  const [pkName,       setPkName]       = useState("id");
  const [pkType,       setPkType]       = useState("");
  const [createError,  setCreateError]  = useState("");

  // ── edit form ─────────────────────────────────────────────────────────────
  const [selectedModel,  setSelectedModel]  = useState<PrismaModel | null>(null);
  const [editModelName,  setEditModelName]  = useState("");
  const [editPkName,     setEditPkName]     = useState("");
  const [editPkType,     setEditPkType]     = useState("");
  const [isEditing,      setIsEditing]      = useState(false);
  const [updateError,    setUpdateError]    = useState("");

  // ── list UI ───────────────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm,  setSearchTerm]  = useState("");
  const [helpDialog,  setHelpDialog]  = useState<HelpDialog>(null);
  const [diffDetail,  setDiffDetail]  = useState<import("@/lib/version-diff/detect-changes").TableDiff | null>(null);

  function openEdit(model: PrismaModel) {
    setSelectedModel(model);
    setEditModelName(model.name);
    setEditPkName(model.pkName ?? "id");
    setEditPkType(model.pkType ?? "");
    setIsEditing(true);
    setUpdateError("");
  }

  function closeEdit() {
    setIsEditing(false);
    setSelectedModel(null);
    setUpdateError("");
  }

  function resetCreate() {
    setModelName("");
    setCreateError("");
  }

  return {
    modelName, setModelName,
    pkName, setPkName,
    pkType, setPkType,
    createError, setCreateError,
    selectedModel, setSelectedModel,
    editModelName, setEditModelName,
    editPkName, setEditPkName,
    editPkType, setEditPkType,
    isEditing, setIsEditing,
    updateError, setUpdateError,
    currentPage, setCurrentPage,
    searchTerm, setSearchTerm,
    helpDialog, setHelpDialog,
    diffDetail, setDiffDetail,
    openEdit, closeEdit, resetCreate,
  };
}
