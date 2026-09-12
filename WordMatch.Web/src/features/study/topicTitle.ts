import { getTopicLabel } from "@/lib/displayLabels";

/**
 * Curriculum headings are derived from the level and topic rather than stored,
 * so there is no separate title to keep in sync with the content.
 */
export function getStudyTopicTitle(topic: { level: string; topic: string }) {
  return `${topic.level} · ${getTopicLabel(topic.topic)}`;
}
