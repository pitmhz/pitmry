"use client";

/**
 * Skills catalog state and actions.
 *
 * Owns everything the Skills tab and the two skill dialogs need: the list,
 * the active directory, the search/category filters, the inspect-and-edit
 * buffer, the create form, and the bundled-skill sync. Keeping this in one
 * hook means the catalog tab and the dialogs share a single source of truth
 * without lifting a dozen `useState` calls into the shell.
 */

import React from "react";
import type { SkillItem } from "./types";

export function useSkillsCatalog() {
  // List state
  const [skills, setSkills] = React.useState<SkillItem[]>([]);
  const [activePath, setActivePath] = React.useState("");
  const [scope, setScope] = React.useState("");
  const [skillsLoading, setSkillsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState("All");

  // Inspect & edit state
  const [inspectingSkill, setInspectingSkill] = React.useState<SkillItem | null>(null);
  const [skillContent, setSkillContent] = React.useState("");
  const [editingContent, setEditingContent] = React.useState("");
  const [isEditingSkill, setIsEditingSkill] = React.useState(false);
  const [savingSkill, setSavingSkill] = React.useState(false);
  const [skillSaveSuccess, setSkillSaveSuccess] = React.useState(false);

  // Create state
  const [createModalOpen, setCreateModalOpen] = React.useState(false);
  const [newSkillName, setNewSkillName] = React.useState("");
  const [newSkillTitle, setNewSkillTitle] = React.useState("");
  const [newSkillCategory, setNewSkillCategory] = React.useState("Workflow");
  const [newSkillDesc, setNewSkillDesc] = React.useState("");
  const [newSkillTemplate, setNewSkillTemplate] = React.useState<"blank" | "automation">("blank");
  const [creatingSkill, setCreatingSkill] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);

  // Machine sync state
  const [syncingSkills, setSyncingSkills] = React.useState(false);
  const [syncMessage, setSyncMessage] = React.useState<string | null>(null);

  const fetchSkills = React.useCallback(async () => {
    setSkillsLoading(true);
    try {
      const res = await fetch("/api/skills");
      if (res.ok) {
        const data = await res.json();
        setSkills(data.skills || []);
        setActivePath(data.active_path || "");
        setScope(data.scope || "global");
      }
    } catch (err) {
      console.error("Failed to load skills:", err);
    } finally {
      setSkillsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchSkills();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchSkills]);

  const handleInspectSkill = React.useCallback(async (skill: SkillItem) => {
    setInspectingSkill(skill);
    setIsEditingSkill(false);
    setSkillSaveSuccess(false);
    try {
      const res = await fetch(`/api/skills?name=${encodeURIComponent(skill.name)}`);
      if (res.ok) {
        const data = await res.json();
        setSkillContent(data.content || "");
        setEditingContent(data.content || "");
      }
    } catch (e) {
      console.error("Error inspecting skill:", e);
    }
  }, []);

  const handleSaveSkill = React.useCallback(async () => {
    if (!inspectingSkill) return;
    setSavingSkill(true);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          name: inspectingSkill.name,
          content: editingContent,
        }),
      });
      if (res.ok) {
        setSkillContent(editingContent);
        setIsEditingSkill(false);
        setSkillSaveSuccess(true);
        window.setTimeout(() => setSkillSaveSuccess(false), 3000);
        void fetchSkills();
      }
    } catch (e) {
      console.error("Failed to save skill:", e);
    } finally {
      setSavingSkill(false);
    }
  }, [inspectingSkill, editingContent, fetchSkills]);

  const handleCreateSkill = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newSkillName.trim()) return;
      setCreatingSkill(true);
      setCreateError(null);
      try {
        const res = await fetch("/api/skills", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create",
            name: newSkillName.trim(),
            title: newSkillTitle.trim(),
            category: newSkillCategory,
            description: newSkillDesc.trim(),
            template: newSkillTemplate,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setCreateError(data.error || "Failed to create skill");
        } else {
          setCreateModalOpen(false);
          setNewSkillName("");
          setNewSkillTitle("");
          setNewSkillDesc("");
          await fetchSkills();
        }
      } catch (err) {
        setCreateError(err instanceof Error ? err.message : "Network error");
      } finally {
        setCreatingSkill(false);
      }
    },
    [newSkillName, newSkillTitle, newSkillCategory, newSkillDesc, newSkillTemplate, fetchSkills],
  );

  const handleSyncStarterSkills = React.useCallback(async () => {
    setSyncingSkills(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync_bundled" }),
      });
      const data = await res.json();
      if (res.ok) {
        setSyncMessage(data.message);
        void fetchSkills();
      }
    } catch (e) {
      setSyncMessage(e instanceof Error ? e.message : "Failed to sync skills");
    } finally {
      setSyncingSkills(false);
    }
  }, [fetchSkills]);

  const categories = React.useMemo(
    () => ["All", ...Array.from(new Set(skills.map((s) => s.category)))],
    [skills],
  );

  const filteredSkills = React.useMemo(
    () =>
      skills.filter((s) => {
        if (selectedCategory !== "All" && s.category !== selectedCategory) return false;
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          return (
            s.name.toLowerCase().includes(q) ||
            s.title.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q)
          );
        }
        return true;
      }),
    [skills, selectedCategory, searchQuery],
  );

  const resetFilters = React.useCallback(() => {
    setSearchQuery("");
    setSelectedCategory("All");
  }, []);

  const closeInspector = React.useCallback(() => {
    setInspectingSkill(null);
    setIsEditingSkill(false);
    setSkillSaveSuccess(false);
  }, []);

  const closeCreateDialog = React.useCallback(() => {
    setCreateModalOpen(false);
    setCreateError(null);
  }, []);

  return {
    // list
    skills,
    skillsCount: skills.length,
    activePath,
    scope,
    skillsLoading,
    categories,
    filteredSkills,
    // filters
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    resetFilters,
    // inspect / edit
    inspectingSkill,
    skillContent,
    editingContent,
    setEditingContent,
    isEditingSkill,
    setIsEditingSkill,
    savingSkill,
    skillSaveSuccess,
    handleInspectSkill,
    handleSaveSkill,
    closeInspector,
    // create
    createModalOpen,
    setCreateModalOpen,
    newSkillName,
    setNewSkillName,
    newSkillTitle,
    setNewSkillTitle,
    newSkillCategory,
    setNewSkillCategory,
    newSkillDesc,
    setNewSkillDesc,
    newSkillTemplate,
    setNewSkillTemplate,
    creatingSkill,
    createError,
    handleCreateSkill,
    closeCreateDialog,
    // machine sync
    syncingSkills,
    syncMessage,
    handleSyncStarterSkills,
    // actions
    fetchSkills,
  };
}

export type SkillsCatalog = ReturnType<typeof useSkillsCatalog>;
