import { LibraryItemPicker } from "./LibraryItemPicker";

type Props = {
  engagementId: string;
  onAttached: () => void;
};

export function CounselorDocumentLibrary({ engagementId, onAttached }: Props) {
  return <LibraryItemPicker mode="attach" showHeading engagementId={engagementId} onAttached={onAttached} />;
}
