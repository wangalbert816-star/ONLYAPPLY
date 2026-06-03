import { useEffect, useMemo, useRef } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { localizeCrmText } from "../../lib/crm/localizeCrmContent";
import type { CrmMessage, CrmMessageChannel } from "../../lib/crm/types";
import "./MessagesChatPanel.css";

type Props = {
  messages: CrmMessage[];
  pinnedMessages: CrmMessage[];
  channel: CrmMessageChannel;
  onChannelChange: (channel: CrmMessageChannel) => void;
  messageDraft: string;
  onMessageDraftChange: (value: string) => void;
  onSend: () => void;
  studentDisplayName?: string;
};

type TimelineItem =
  | { kind: "date"; key: string; label: string }
  | { kind: "system"; key: string; message: CrmMessage }
  | { kind: "group"; key: string; role: CrmMessage["authorRole"]; authorLabel: string; messages: CrmMessage[] };

function formatMessageTime(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString(locale === "en" ? "en-US" : "zh-CN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateSeparator(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale === "en" ? "en-US" : "zh-CN", {
    month: "short",
    day: "numeric",
  });
}

function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function stripPinnedPrefix(body: string): string {
  return body.replace(/^【置顶】\s*/u, "").replace(/^\[Pinned\]\s*/i, "").trim();
}

function buildTimeline(messages: CrmMessage[], locale: string): TimelineItem[] {
  const sorted = [...messages]
    .filter((message) => !message.pinned)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const items: TimelineItem[] = [];
  let lastDate = "";
  let currentGroup: Extract<TimelineItem, { kind: "group" }> | null = null;

  const flushGroup = () => {
    if (currentGroup) {
      items.push(currentGroup);
      currentGroup = null;
    }
  };

  for (const message of sorted) {
    const day = dateKey(message.createdAt);
    if (day !== lastDate) {
      flushGroup();
      lastDate = day;
      items.push({
        kind: "date",
        key: `date-${day}`,
        label: formatDateSeparator(message.createdAt, locale),
      });
    }

    if (message.authorRole === "system") {
      flushGroup();
      items.push({ kind: "system", key: message.id, message });
      continue;
    }

    if (
      currentGroup &&
      currentGroup.role === message.authorRole &&
      currentGroup.authorLabel === message.authorLabel
    ) {
      currentGroup.messages.push(message);
      continue;
    }

    flushGroup();
    currentGroup = {
      kind: "group",
      key: `group-${message.id}`,
      role: message.authorRole,
      authorLabel: message.authorLabel,
      messages: [message],
    };
  }

  flushGroup();
  return items;
}

export function MessagesChatPanel({
  messages,
  pinnedMessages,
  channel,
  onChannelChange,
  messageDraft,
  onMessageDraftChange,
  onSend,
  studentDisplayName,
}: Props) {
  const { t, locale } = useLanguage();
  const feedRef = useRef<HTMLDivElement>(null);

  const channelPinned = useMemo(
    () => pinnedMessages.find((message) => message.channel === channel) ?? null,
    [pinnedMessages, channel],
  );

  const timeline = useMemo(() => buildTimeline(messages, locale), [messages, locale]);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    feed.scrollTop = feed.scrollHeight;
  }, [channel, timeline]);

  const studentName = studentDisplayName || t("crm.signedService.you");
  const studentInitials = initials(studentName);

  const displayAuthor = (message: CrmMessage) => {
    if (message.authorRole === "student") {
      return `${studentName} (${t("crm.signedService.you")})`;
    }
    if (message.authorRole === "system") return t("crm.signedService.chatPanel.system");
    return localizeCrmText(message.authorLabel, locale, t);
  };

  return (
    <section className="msg-panel" aria-label={t("crm.signedService.tabs.chat")}>
      <div className="msg-panel__scroll-shell">
        <div className="msg-panel__tabs" role="tablist" aria-label={t("crm.signedService.chatPanel.tabsAria")}>
          <button
            type="button"
            role="tab"
            aria-selected={channel === "direct"}
            className={channel === "direct" ? "is-active" : undefined}
            onClick={() => onChannelChange("direct")}
          >
            {t("crm.signedService.directChat")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={channel === "group"}
            className={channel === "group" ? "is-active" : undefined}
            onClick={() => onChannelChange("group")}
          >
            {t("crm.signedService.groupChat")}
          </button>
        </div>

        {channelPinned ? (
          <div className="msg-panel__pinned">
            <span className="msg-panel__pinned-icon" aria-hidden />
            <div className="msg-panel__pinned-copy">
              <p className="msg-panel__pinned-label">{t("crm.signedService.chatPanel.pinnedLabel")}</p>
              <p className="msg-panel__pinned-body">
                {localizeCrmText(stripPinnedPrefix(channelPinned.body), locale, t)}
              </p>
            </div>
          </div>
        ) : null}

        <div ref={feedRef} className="msg-panel__feed">
        {timeline.length === 0 ? (
          <p className="msg-panel__empty">{t("crm.signedService.chatPanel.empty")}</p>
        ) : (
          timeline.map((item) => {
            if (item.kind === "date") {
              return (
                <div key={item.key} className="msg-panel__date">
                  <span>{item.label}</span>
                </div>
              );
            }

            if (item.kind === "system") {
              const time = formatMessageTime(item.message.createdAt, locale);
              return (
                <div key={item.key} className="msg-panel__system">
                  <span className="msg-panel__system-icon" aria-hidden />
                  <div className="msg-panel__system-copy">
                    <p className="msg-panel__system-head">
                      {t("crm.signedService.chatPanel.system")} {time}
                    </p>
                    <p className="msg-panel__system-body">
                      {localizeCrmText(item.message.body, locale, t)}
                    </p>
                  </div>
                </div>
              );
            }

            const isOutgoing = item.role === "student";
            const headName = displayAuthor(item.messages[0]!);
            const headTime = formatMessageTime(item.messages[0]!.createdAt, locale);
            const incomingInitials = initials(headName);

            return (
              <article
                key={item.key}
                className={`msg-panel__thread${isOutgoing ? " msg-panel__thread--outgoing" : " msg-panel__thread--incoming"}`}
              >
                {!isOutgoing ? (
                  <span className="msg-panel__avatar msg-panel__avatar--counselor">{incomingInitials}</span>
                ) : null}
                <div className="msg-panel__thread-body">
                  <p className="msg-panel__thread-head">
                    {isOutgoing ? (
                      <>
                        <span>{headTime}</span>
                        <span>{headName}</span>
                      </>
                    ) : (
                      <>
                        <span>{headName}</span>
                        <span>{headTime}</span>
                      </>
                    )}
                  </p>
                  <div className="msg-panel__bubbles">
                    {item.messages.map((message) => (
                      <div key={message.id} className="msg-panel__bubble">
                        {localizeCrmText(message.body, locale, t)}
                      </div>
                    ))}
                  </div>
                </div>
                {isOutgoing ? (
                  <span className="msg-panel__avatar msg-panel__avatar--student">{studentInitials}</span>
                ) : null}
              </article>
            );
          })
        )}
      </div>
      </div>

      <div className="msg-panel__compose">
        <textarea
          value={messageDraft}
          onChange={(e) => onMessageDraftChange(e.target.value)}
          placeholder={t("crm.messagePlaceholder")}
          rows={1}
        />
        <button type="button" className="btn btn-primary" onClick={onSend} disabled={!messageDraft.trim()}>
          {t("crm.send")}
        </button>
      </div>
    </section>
  );
}
