import { ActionIcon } from "../../shared/ActionIcon";
import { IconButton } from "../../shared/ui/IconButton";

export function PlanEditorActions({
  saveLabel,
  cancelLabel,
  saving,
  onCancel,
}: {
  saveLabel: string;
  cancelLabel: string;
  saving: boolean;
  onCancel: () => void;
}) {
  return (
    <div class="plan-editor-actions">
      <IconButton
        type="submit"
        loading={saving}
        appearance="tertiary"
        class="plan-icon-button icon44"
        aria-label={saveLabel}
        title={saveLabel}
      >
        <ActionIcon kind="save" />
      </IconButton>
      <IconButton
        appearance="tertiary"
        class="plan-icon-button icon44"
        aria-label={cancelLabel}
        title={cancelLabel}
        onClick={onCancel}
      >
        <ActionIcon kind="cancel" />
      </IconButton>
    </div>
  );
}
