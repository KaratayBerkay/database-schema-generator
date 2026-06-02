"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type UseTableSelectorOptions = {
  models: { name: string }[];
};

export function useTableSelector({ models }: UseTableSelectorOptions) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedModelName, setSelectedModelNameRaw] = useState(
    () => searchParams.get("table") ?? "",
  );
  const [tableSearch,         setTableSearch]         = useState("");
  const [isTableSelectorOpen, setIsTableSelectorOpen] = useState(false);

  // Deselect if the model disappears from the list
  useEffect(() => {
    if (selectedModelName && models.length > 0 && !models.some((m) => m.name === selectedModelName)) {
      setSelectedModelNameRaw("");
    }
  }, [models, selectedModelName]);

  // Sync selected model name → URL ?table= param
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (selectedModelName) { params.set("table", selectedModelName); } else { params.delete("table"); }
    if (params.toString() !== searchParams.toString()) router.replace(`?${params.toString()}`, { scroll: false });
  }, [selectedModelName]); // eslint-disable-line react-hooks/exhaustive-deps

  function selectModel(name: string) {
    setSelectedModelNameRaw(name);
    setTableSearch("");
    setIsTableSelectorOpen(false);
  }

  function setSelectedModelName(name: string) {
    setSelectedModelNameRaw(name);
  }

  return {
    selectedModelName, setSelectedModelName,
    tableSearch,        setTableSearch,
    isTableSelectorOpen, setIsTableSelectorOpen,
    selectModel,
  };
}
