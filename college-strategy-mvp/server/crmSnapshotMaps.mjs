/** Shared row → API shape mappers for CRM snapshots (service_role loaders). */

export function mapCounselor(row) {
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    bio: row.bio ?? undefined,
    email: row.email ?? undefined,
    calendlyUrl: row.calendly_url ?? undefined,
    meetingUrl: row.meeting_url ?? undefined,
  };
}

export function mapEngagement(row, counselorIdsByEngagementId) {
  const collaboratorIds = counselorIdsByEngagementId?.get(row.id) ?? [];
  const merged = [row.counselor_id, ...collaboratorIds].filter(Boolean);
  const uniq = [];
  for (const id of merged) if (!uniq.includes(id)) uniq.push(id);
  return {
    id: row.id,
    studentUserId: row.student_user_id,
    studentEmail: row.student_email,
    studentName: row.student_name ?? undefined,
    applicationId: row.application_id,
    applicationTitle: row.application_title,
    counselorId: row.counselor_id,
    counselorIds: uniq.length ? uniq : [row.counselor_id],
    phase: row.phase,
    status: row.status,
    planLabel: row.plan_label ?? undefined,
    needsFollowUp: row.needs_follow_up,
    internalNotes: row.internal_notes,
    nextMeetingLabel: row.next_meeting_label ?? undefined,
    meetingJoinUrl: row.meeting_join_url ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapMessage(row) {
  return {
    id: String(row.id),
    engagementId: String(row.engagement_id),
    authorRole: row.author_role,
    authorLabel: String(row.author_label),
    body: String(row.body),
    channel: row.channel ?? "direct",
    pinned: Boolean(row.pinned),
    createdAt: String(row.created_at),
    readByStudent: Boolean(row.read_by_student),
  };
}

export function mapTask(row) {
  const attachedRaw = row.attached_file_ids;
  const attachedFileIds = Array.isArray(attachedRaw) ? attachedRaw.map((id) => String(id)) : undefined;
  const submittedRaw = row.submitted_file_ids;
  const submittedFileIds = Array.isArray(submittedRaw) ? submittedRaw.map((id) => String(id)) : undefined;
  return {
    id: String(row.id),
    engagementId: String(row.engagement_id),
    title: String(row.title),
    description: row.description ? String(row.description) : undefined,
    dueAt: row.due_at ? String(row.due_at) : undefined,
    status: row.status,
    linkType: row.link_type,
    itemKind: row.item_kind === "resource" ? "resource" : "action",
    attachedFileIds: attachedFileIds?.length ? attachedFileIds : undefined,
    submittedFileIds: submittedFileIds?.length ? submittedFileIds : undefined,
    returnedAt: row.returned_at ? String(row.returned_at) : undefined,
    returnNote: row.return_note ? String(row.return_note) : undefined,
    createdAt: String(row.created_at),
    completedAt: row.completed_at ? String(row.completed_at) : undefined,
  };
}

export function mapDocument(row) {
  return {
    id: String(row.id),
    engagementId: String(row.engagement_id),
    name: String(row.name),
    docType: String(row.doc_type),
    status: row.status,
    dueAt: row.due_at ? String(row.due_at) : undefined,
    note: row.note ? String(row.note) : undefined,
    createdAt: String(row.created_at),
  };
}

export function mapFile(row) {
  return {
    id: String(row.id),
    engagementId: String(row.engagement_id),
    name: String(row.name),
    category: String(row.category),
    note: row.note ? String(row.note) : undefined,
    storagePath: row.storage_path ? String(row.storage_path) : undefined,
    uploadedByRole: row.uploaded_by_role ?? undefined,
    contentType: row.content_type ? String(row.content_type) : undefined,
    sizeBytes: row.size_bytes != null ? Number(row.size_bytes) : undefined,
    uploadedAt: String(row.uploaded_at),
  };
}

export function mapMeetingRecap(row) {
  return {
    id: String(row.id),
    engagementId: String(row.engagement_id),
    title: String(row.title),
    body: String(row.body),
    meetingAt: row.meeting_at ? String(row.meeting_at) : undefined,
    createdAt: String(row.created_at),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

export async function loadCrmSnapshotForEngagementRows(admin, engagementRows) {
  if (!engagementRows.length) {
    return {
      counselors: [],
      engagements: [],
      messages: [],
      tasks: [],
      documents: [],
      files: [],
      meetingRecaps: [],
    };
  }

  const engagementIds = engagementRows.map((e) => e.id);
  const { data: collabs, error: collabErr } = await admin
    .from("engagement_counselors")
    .select("engagement_id, counselor_id, role, active")
    .in("engagement_id", engagementIds)
    .eq("active", true);
  if (collabErr) throw collabErr;

  const counselorIdsByEngagementId = new Map();
  for (const row of collabs ?? []) {
    const list = counselorIdsByEngagementId.get(String(row.engagement_id)) ?? [];
    list.push(String(row.counselor_id));
    counselorIdsByEngagementId.set(String(row.engagement_id), list);
  }

  const allCounselorIds = new Set();
  for (const e of engagementRows) allCounselorIds.add(e.counselor_id);
  for (const ids of counselorIdsByEngagementId.values()) for (const id of ids) allCounselorIds.add(id);
  const counselorIds = [...allCounselorIds].filter(Boolean);

  const [counselorRes, messagesRes, tasksRes, documentsRes, filesRes, recapsRes] = await Promise.all([
    admin.from("counselors").select("id, user_id, name, title, bio, email, calendly_url, meeting_url").in("id", counselorIds),
    admin.from("case_messages").select("*").in("engagement_id", engagementIds),
    admin.from("case_tasks").select("*").in("engagement_id", engagementIds),
    admin.from("case_documents").select("*").in("engagement_id", engagementIds),
    admin.from("case_files").select("*").in("engagement_id", engagementIds),
    admin.from("case_meeting_recaps").select("*").in("engagement_id", engagementIds),
  ]);

  if (counselorRes.error) throw counselorRes.error;
  if (messagesRes.error) throw messagesRes.error;
  if (tasksRes.error) throw tasksRes.error;
  if (documentsRes.error) throw documentsRes.error;
  if (filesRes.error) throw filesRes.error;
  if (recapsRes.error) {
    const msg = (recapsRes.error.message ?? "").toLowerCase();
    if (!msg.includes("case_meeting_recaps") || !msg.includes("does not exist")) {
      throw recapsRes.error;
    }
  }

  const meetingRecaps = recapsRes.error ? [] : (recapsRes.data ?? []).map(mapMeetingRecap);

  return {
    counselors: (counselorRes.data ?? []).map(mapCounselor),
    engagements: engagementRows.map((row) => mapEngagement(row, counselorIdsByEngagementId)),
    messages: (messagesRes.data ?? []).map(mapMessage),
    tasks: (tasksRes.data ?? []).map(mapTask),
    documents: (documentsRes.data ?? []).map(mapDocument),
    files: (filesRes.data ?? []).map(mapFile),
    meetingRecaps,
  };
}
