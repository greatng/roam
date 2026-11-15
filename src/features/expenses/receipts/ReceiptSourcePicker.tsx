import { useRef } from "preact/hooks";
import { Button } from "../../../shared/ui/Button";

export type ReceiptSourcePickerProps = {
  label: string;
  thai: boolean;
  disabled: boolean;
  onChange: (event: Event) => void;
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
}: ReceiptSourcePickerProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const chooseFile = thai ? "เลือกรูป" : "Choose file";
  const takePhoto = thai ? "ถ่ายรูป" : "Take photo";

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
      <input
        ref={cameraInput}
        aria-label={thai ? "กล้องถ่ายรูปใบเสร็จ" : "Receipt camera"}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
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
        onClick={() => fileInput.current?.click()}
      >
        {chooseFile}
      </Button>
      <Button
        type="button"
        size="medium"
        appearance="secondary"
        disabled={disabled}
        onClick={() => cameraInput.current?.click()}
      >
        {takePhoto}
      </Button>
    </div>
  );
}
