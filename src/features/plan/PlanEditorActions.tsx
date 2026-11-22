import { ActionIcon } from "../../shared/ActionIcon";
import { Button } from "../../shared/ui/Button";

export function PlanEditorActions({
  saveLabel,
  cancelLabel,
  onCancel,
}: {
  saveLabel: string;
  cancelLabel: string;
  onCancel: () => void;
}) {
  return (
    <div class="plan-editor-actions">
      <Button
        type="submit"
        svgOnly
        appearance="tertiary"
        class="plan-icon-button icon44"
        aria-label={saveLabel}
        title={saveLabel}
      >
        <ActionIcon kind="save" />
      </Button>
      <Button
        type="button"
        svgOnly
        appearance="tertiary"
        class="plan-icon-button icon44"
        aria-label={cancelLabel}
        title={cancelLabel}
        onClick={onCancel}
      >
        <ActionIcon kind="cancel" />
      </Button>
    </div>
  );
}
