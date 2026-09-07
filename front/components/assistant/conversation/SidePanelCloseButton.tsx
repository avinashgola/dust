import { useConversationSidePanelContext } from "@app/components/assistant/conversation/ConversationSidePanelContext";
import { ArrowLeft, Button, XClose } from "@dust-tt/sparkle";

interface SidePanelCloseButtonProps {
  // Defaults to closePanel. A custom handler must end with closePanel(): the icon promises a
  // close or a back navigation, whichever the history dictates.
  onClick?: () => void;
  className?: string;
}

// Closing goes back to the previous panel when there is one, so the icon says which it will do.
export function SidePanelCloseButton({
  onClick,
  className,
}: SidePanelCloseButtonProps) {
  const { canGoBack, closePanel } = useConversationSidePanelContext();
  return (
    <Button
      variant="ghost"
      size="sm"
      icon={canGoBack ? ArrowLeft : XClose}
      tooltip={canGoBack ? "Back" : "Close"}
      onClick={onClick ?? closePanel}
      className={className}
    />
  );
}
