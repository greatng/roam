const modes: Record<string, [string, string]> = {
  walk: ["Walk", "เดิน"],
  car: ["Car", "รถยนต์"],
  taxi: ["Taxi", "แท็กซี่"],
  bus: ["Bus", "รถบัส"],
  train: ["Train", "รถไฟ"],
  boat: ["Boat", "เรือ"],
  flight: ["Flight", "เครื่องบิน"],
  other: ["Other", "อื่น ๆ"],
};

export function transportLabel(value: string, thai: boolean) {
  return modes[value]?.[thai ? 1 : 0] ?? value;
}

export function TransportSelect({
  value,
  thai,
  editor = "plan",
}: {
  value: string;
  thai: boolean;
  editor?: "plan" | "stop";
}) {
  const isStop = editor === "stop";
  return (
    <select name="transport" defaultValue={value}>
      <option value="">
        {thai ? "เลือก (ไม่บังคับ)" : "Choose (optional)"}
      </option>
      {Object.keys(modes)
        .filter((mode) => !isStop || mode !== "flight")
        .map((mode) => (
          <option key={mode} value={mode}>
            {isStop && !thai ? mode : transportLabel(mode, thai)}
          </option>
        ))}
    </select>
  );
}
