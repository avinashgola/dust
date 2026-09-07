import { useConversation } from "@app/hooks/conversations/useConversation";
import { useConversations } from "@app/hooks/conversations/useConversations";
import { useCreateConversationWithMessage } from "@app/hooks/useCreateConversationWithMessage";
import { useSendNotification } from "@app/hooks/useNotification";
import type { DustError } from "@app/lib/error";
import type {
  ConversationListItemType,
  ConversationType,
} from "@app/types/assistant/conversation";
import type { RichMention } from "@app/types/assistant/mentions";
import type { ContentFragmentsType } from "@app/types/content_fragment";
import type { Result } from "@app/types/shared/result";
import { Err, Ok } from "@app/types/shared/result";
import type { UserType, WorkspaceType } from "@app/types/user";
import { useCallback, useState } from "react";

const PAST_CONVERSATIONS_LIMIT = 10;

/**
 * Creates and holds the single conversation for the Analytics conversation
 * panel, always mentioning `@analyst` on the first message. Creation is eager
 * on submit with the first message deferred, so `ConversationViewer` mounts
 * right away and renders its own optimistic placeholders (see
 * useCreateConversationWithMessage).
 *
 * Panel conversations are tagged with `analyticsPanel` in their metadata so
 * past ones can be listed and resumed from the panel's empty state, which the
 * conversations list endpoint filters on server-side.
 */
export function useAnalyticsConversation({
  owner,
  user,
  disabled,
}: {
  owner: WorkspaceType;
  user: UserType | null;
  disabled: boolean;
}) {
  const sendNotification = useSendNotification();
  const [conversation, setConversation] = useState<ConversationType | null>(
    null
  );
  const [pickedConversationId, setPickedConversationId] = useState<
    string | null
  >(null);

  // Kept fetch-disabled: only used to prepend the new conversation to the
  // sidebar list cache.
  const { mutateConversations } = useConversations({
    workspaceId: owner.sId,
    options: { disabled: true },
  });

  const {
    conversations: pastConversations,
    mutateConversations: mutatePastConversations,
  } = useConversations({
    workspaceId: owner.sId,
    limit: PAST_CONVERSATIONS_LIMIT,
    filter: "analyticsPanel",
    options: { disabled },
  });

  const {
    conversation: pickedConversation,
    isConversationLoading: isPickedConversationLoading,
  } = useConversation({
    conversationId: pickedConversationId,
    workspaceId: owner.sId,
  });

  const createConversationWithMessage = useCreateConversationWithMessage({
    owner,
    user,
  });

  const createConversation = useCallback(
    async (
      input: string,
      mentions: RichMention[],
      contentFragments: ContentFragmentsType
    ): Promise<Result<undefined, DustError>> => {
      const result = await createConversationWithMessage({
        messageData: {
          input,
          mentions: mentions.map((mention) => ({
            configurationId: mention.id,
          })),
          contentFragments,
          richMentions: mentions,
        },
        metadata: { analyticsPanel: true },
        deferMessage: true,
      });

      if (result.isErr()) {
        sendNotification({
          title: result.error.title,
          description: result.error.message,
          type: "error",
        });
        return new Err({
          code: "internal_error",
          name: result.error.title,
          message: result.error.message,
        });
      }

      setConversation(result.value);
      setPickedConversationId(null);
      const prependCreated = (
        currentData: ConversationListItemType[] | undefined
      ) => [result.value, ...(currentData ?? [])];
      await Promise.all([
        mutateConversations(prependCreated, { revalidate: false }),
        mutatePastConversations(prependCreated, { revalidate: false }),
      ]);

      return new Ok(undefined);
    },
    [
      createConversationWithMessage,
      mutateConversations,
      mutatePastConversations,
      sendNotification,
    ]
  );

  const pickConversation = (conversationId: string) => {
    setConversation(null);
    setPickedConversationId(conversationId);
  };

  const resetConversation = useCallback(() => {
    setConversation(null);
    setPickedConversationId(null);
  }, []);

  return {
    conversation: conversation ?? pickedConversation ?? null,
    // `useConversation` reports loading while its key is null, so the picked id
    // has to gate it. On error it flips back to false and the panel falls back
    // to the picker.
    isConversationLoading:
      pickedConversationId !== null && isPickedConversationLoading,
    pastConversations,
    createConversation,
    pickConversation,
    resetConversation,
  };
}
