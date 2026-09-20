"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type {
  OnboardingState,
  OnboardingTask,
  OnboardingToursState,
} from "@/app/api/onboarding/route";

interface OnboardingContextType {
  state: OnboardingState | null;
  loading: boolean;
  welcomeOpen: boolean;
  setWelcomeOpen: (open: boolean) => void;
  spotlightActive: boolean;
  spotlightStep: number;
  startSpotlight: (step?: number) => void;
  setSpotlightStep: (step: number) => void;
  closeSpotlight: () => void;
  tasks: OnboardingTask[];
  progress: {
    completed_count: number;
    total_count: number;
    percentage: number;
  };
  toggleTask: (taskId: string) => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
  isBeaconSeen: (beaconId: string) => boolean;
  markBeaconSeen: (beaconId: string) => Promise<void>;
  restartOnboarding: () => void;
  resetOnboarding: () => Promise<void>;
  refreshOnboarding: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [spotlightActive, setSpotlightActive] = useState(false);
  const [spotlightStep, setSpotlightStep] = useState(0);

  const fetchOnboardingState = useCallback(async () => {
    try {
      const res = await fetch("/api/onboarding");
      if (res.ok) {
        const data = await res.json();
        setState(data);

        // Auto-show welcome carousel for first-time repo user if not completed or dismissed
        if (
          !data.tours?.welcome_carousel?.completed &&
          !data.tours?.welcome_carousel?.dismissed
        ) {
          // Small grace delay for smoother entrance
          setTimeout(() => setWelcomeOpen(true), 400);
        }
      }
    } catch (e) {
      console.error("Failed to load onboarding state:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOnboardingState();
  }, [fetchOnboardingState]);

  const toggleTask = async (taskId: string) => {
    if (!state) return;
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return;

    const nextDone = !task.done;
    // Optimistic UI update
    setState((prev) => {
      if (!prev) return null;
      const updatedTasks = prev.tasks.map((t) =>
        t.id === taskId ? { ...t, done: nextDone } : t
      );
      return { ...prev, tasks: updatedTasks };
    });

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_task",
          taskId,
          done: nextDone,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) {
          setState((prev) => ({ ...prev, ...data.state }));
        }
      }
    } catch (err) {
      console.error("Failed to toggle task:", err);
    }
  };

  const completeTask = async (taskId: string) => {
    if (!state) return;
    const task = state.tasks.find((t) => t.id === taskId);
    if (task && task.done) return;

    setState((prev) => {
      if (!prev) return null;
      const updatedTasks = prev.tasks.map((t) =>
        t.id === taskId ? { ...t, done: true } : t
      );
      return { ...prev, tasks: updatedTasks };
    });

    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_task",
          taskId,
          done: true,
        }),
      });
    } catch (err) {
      console.error("Failed to mark task complete:", err);
    }
  };

  const startSpotlight = (step = 0) => {
    setWelcomeOpen(false);
    setSpotlightStep(step);
    setSpotlightActive(true);

    // Persist welcome completed
    fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "complete_tour",
        tourId: "welcome_carousel",
      }),
    }).catch(() => {});
  };

  const closeSpotlight = () => {
    setSpotlightActive(false);
    fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "complete_tour",
        tourId: "spotlight_tour",
      }),
    }).catch(() => {});
  };

  const isBeaconSeen = (beaconId: string) => {
    return Boolean(state?.tours?.beacons?.seen_ids?.includes(beaconId));
  };

  const markBeaconSeen = async (beaconId: string) => {
    setState((prev) => {
      if (!prev) return null;
      const seen = prev.tours.beacons.seen_ids;
      if (seen.includes(beaconId)) return prev;
      return {
        ...prev,
        tours: {
          ...prev.tours,
          beacons: {
            ...prev.tours.beacons,
            seen_ids: [...seen, beaconId],
          },
        },
      };
    });

    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark_beacon_seen",
          beaconId,
        }),
      });
    } catch (err) {
      console.error("Failed to mark beacon seen:", err);
    }
  };

  const restartOnboarding = () => {
    setWelcomeOpen(true);
  };

  const resetOnboarding = async () => {
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) {
          setState(data.state);
          setWelcomeOpen(true);
        }
      }
    } catch (e) {
      console.error("Failed to reset onboarding:", e);
    }
  };

  const tasks = state?.tasks || [];
  const completedCount = tasks.filter((t) => t.done).length;
  const totalCount = tasks.length || 1;
  const progress = {
    completed_count: completedCount,
    total_count: totalCount,
    percentage: Math.round((completedCount / totalCount) * 100),
  };

  return (
    <OnboardingContext.Provider
      value={{
        state,
        loading,
        welcomeOpen,
        setWelcomeOpen,
        spotlightActive,
        spotlightStep,
        startSpotlight,
        setSpotlightStep,
        closeSpotlight,
        tasks,
        progress,
        toggleTask,
        completeTask,
        isBeaconSeen,
        markBeaconSeen,
        restartOnboarding,
        resetOnboarding,
        refreshOnboarding: fetchOnboardingState,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return ctx;
}
