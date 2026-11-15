import { useRef } from "preact/hooks";
import { Button } from "../../../shared/ui/Button";

export type ReceiptSourcePickerProps = {
  label: string;
  thai: boolean;
  disabled: boolean;
  onChange: (event: Event) => void;
  beforePick?: () => Promise<unknown>;
};

const hiddenInputStyle = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: "0",
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: "0",
};

export function ReceiptSourcePicker({
  label,
  thai,
  disabled,
  onChange,
  beforePick,
}: ReceiptSourcePickerProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  async function pick(input: HTMLInputElement | null) {
    if (beforePick && (await beforePick()) === false) return;
    input?.click();
  }
  const chooseFile = thai ? "เลือกรูป" : "Choose file";

  return (
    <div class="receipt-source-picker">
      <input
        ref={fileInput}
        aria-label={label}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onChange}
        disabled={disabled}
        tabIndex={-1}
        style={hiddenInputStyle}
      />
      <Button
        type="button"
        size="medium"
        appearance="secondary"
        disabled={disabled}
        onClick={() => void pick(fileInput.current)}
      >
        {chooseFile}
      </Button>
    </div>
  );
}
