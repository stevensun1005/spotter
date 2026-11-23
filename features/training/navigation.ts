"use client";

import { useCallback, useEffect, useState } from "react";
import { workoutAt } from "./route";

const prefix = "/training/";
export function useTrainingNavigation(initialId: string | null = null) {
  const [id, setId] = useState(initialId);
  useEffect(() => {
    const readPath = () => setId(workoutAt(window.location.pathname));
    window.addEventListener("popstate", readPath);
    return () => window.removeEventListener("popstate", readPath);
  }, []);

  const enter = useCallback((workout: string) => {
    if (workoutAt(window.location.pathname) === workout) return;
    window.history.pushState({ spotterWorkout: workout }, "", prefix + workout);
    setId(workout);
  }, []);

  const leave = useCallback(() => {
    const state = window.history.state;
    if (state?.spotterWorkout && state.spotterWorkout === workoutAt(window.location.pathname)) {
      window.history.back();
    } else {
      window.history.replaceState(null, "", "/");
      setId(null);
    }
  }, []);

  return { id, enter, leave };
}
