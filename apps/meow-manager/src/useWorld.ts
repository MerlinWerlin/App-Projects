import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import { initialState, restoreState, type State } from "./core/model.ts";

const STORAGE_KEY = "meow-manager.world.v1";
export function useWorld() {
  const [world, setWorld] = useState<State>(() =>
    initialState(getLocales()[0]?.languageCode === "ja" ? "ja" : "en"),
  );
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const queue = useRef(Promise.resolve());
  const current = useRef(world);
  current.current = world;
  async function load() {
    setLoadError(false);
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw !== null) setWorld(restoreState(JSON.parse(raw)));
      setLoaded(true);
    } catch {
      setLoadError(true);
    }
  }
  function persist(state: State) {
    const json = JSON.stringify(state);
    queue.current = queue.current
      .catch(() => {})
      .then(() => AsyncStorage.setItem(STORAGE_KEY, json))
      .then(() => setSaveError(false))
      .catch(() => setSaveError(true));
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (loaded) persist(world);
  }, [world, loaded]);
  return {
    world,
    setWorld,
    loaded,
    loadError,
    saveError,
    load,
    retrySave: () => persist(current.current),
  };
}
