import { useEffect, useMemo, useState } from "react";
import {
  countUnreadCounselorMessagesForStudent,
  initCrmForUser,
  isSignedServiceEnabled,
  resetCrmForUser,
  subscribeCrmStore,
} from "./store";

/** Keeps CRM synced and returns unread counselor message count for a student. */
export function useCrmStudentUnread(userId: string | undefined): number {
  const [tick, setTick] = useState(0);

  useEffect(() => subscribeCrmStore(() => setTick((n) => n + 1)), []);

  useEffect(() => {
    if (!userId || !isSignedServiceEnabled()) return;
    void initCrmForUser(userId, "student");
    // Stop the poll/realtime sync when the user signs out or this unmounts.
    return () => resetCrmForUser();
  }, [userId]);

  return useMemo(
    () => (userId ? countUnreadCounselorMessagesForStudent(userId) : 0),
    [userId, tick],
  );
}
