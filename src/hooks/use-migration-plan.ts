"use client";

import { useState } from "react";
import type { MigrationPlan } from "@/types/migrations";

type UseMigrationPlanOptions = {
  onReset: () => void;
};

export function useMigrationPlan({ onReset }: UseMigrationPlanOptions) {
  const [migrationPlan, setMigrationPlanRaw] = useState<MigrationPlan | null>(null);
  const [dbTableCount,  setDbTableCount]     = useState<number | null>(null);

  const dbIsEmpty     = dbTableCount !== null && dbTableCount === 0;
  const isNewPlan     = migrationPlan === "new";
  const isVersionPlan = migrationPlan === "version";

  function setMigrationPlan(plan: MigrationPlan) {
    setMigrationPlanRaw(plan);
  }

  function changePlan(plan: MigrationPlan) {
    if (plan === migrationPlan) return;
    setMigrationPlanRaw(plan);
    onReset();
  }

  return {
    migrationPlan,  setMigrationPlan,
    dbTableCount,   setDbTableCount,
    dbIsEmpty, isNewPlan, isVersionPlan,
    changePlan,
  };
}
