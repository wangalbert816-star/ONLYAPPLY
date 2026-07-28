import { useEffect, useMemo, useState } from "react";
import {
  countUnreadCounselorMessagesForStudent,
  initCrmForUser,
  isSignedServiceEnabled,
  stopCrmBackgroundSync,
  subscribeCrmStore,
} from "./store";

/** Keeps CRM synced and returns unread counselor message count for a student. */
export function useCrmStudentUnread(userId: string | undefined): number {
  const [tick, setTick] = useState(0);

  useEffect(() => subscribeCrmStore(() => setTick((n) => n + 1)), []);

  useEffect(() => {
    if (!userId || !isSignedServiceEnabled()) return;
    void initCrmForUser(userId, "student");
    // Stop route-scoped poll/realtime listeners without resetting the CRM
    // backend; signed-service views may still mutate Supabase after chrome
    // unmounts during navigation.
    return () => stopCrmBackgroundSync();
  }, [userId]);

  return useMemo(
    () => (userId ? countUnreadCounselorMessagesForStudent(userId) : 0),
    [userId, tick],
  );
}
