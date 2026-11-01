import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigationType, useSearchParams } from "react-router-dom";

export function useListSearchParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigationType = useNavigationType();
  const urlValue = searchParams.get("q") ?? "";
  const [value, setValue] = useState(urlValue);
  const [debouncedValue, setDebouncedValue] = useState(urlValue);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWrittenRef = useRef<string | null>(null);
  const locationKeyRef = useRef(location.key);
  const latestParamsRef = useRef(searchParams);
  latestParamsRef.current = searchParams;

  useEffect(() => {
    if (lastWrittenRef.current === urlValue) {
      lastWrittenRef.current = null;
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    lastWrittenRef.current = null;
    setValue(urlValue);
    setDebouncedValue(urlValue);
  }, [urlValue]);

  useEffect(() => {
    const locationChanged = locationKeyRef.current !== location.key;
    locationKeyRef.current = location.key;
    if (!locationChanged || navigationType !== "POP") return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    lastWrittenRef.current = null;
    setValue(urlValue);
    setDebouncedValue(urlValue);
  }, [location.key, navigationType, urlValue]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const onChange = useCallback((next: string) => {
    setValue(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setDebouncedValue(next);
      const params = new URLSearchParams(latestParamsRef.current);
      if (next.trim()) params.set("q", next);
      else params.delete("q");
      lastWrittenRef.current = next.trim() ? next : "";
      setSearchParams(params);
    }, 150);
  }, [setSearchParams]);

  return { search: value, debouncedSearch: debouncedValue, setSearch: onChange };
}
