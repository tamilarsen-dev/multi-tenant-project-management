"use client";

import { createContext, useContext } from "react";

import { DEFAULT_PREFERENCES, type Preferences } from "@/lib/preferences";

/** The saved preferences, read on the server and handed down (no flash). */
const PreferencesContext = createContext<Preferences>(DEFAULT_PREFERENCES);

export function PreferencesProvider({ value, children }: { value: Preferences; children: React.ReactNode }) {
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): Preferences {
  return useContext(PreferencesContext);
}
