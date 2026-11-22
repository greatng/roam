import { useState } from "preact/hooks";

const tags = {
  transport: ["Transport", "การเดินทาง"],
  food: ["Food", "อาหาร"],
  shopping: ["Shopping", "ช้อปปิ้ง"],
  sightseeing: ["Sightseeing", "เที่ยวชม"],
  "must-go": ["Must go", "ต้องไป"],
  other: ["Other", "อื่น ๆ"],
} as const;

export type ActivityTag = keyof typeof tags;

export function activityTagLabel(
  tag: ActivityTag | null | undefined,
  thai: boolean,
) {
  return tag ? tags[tag]?.[thai ? 1 : 0] : undefined;
}

export function ActivityTagBadge({
  tag,
  thai,
}: {
  tag?: ActivityTag | null;
  thai: boolean;
}) {
  const label = activityTagLabel(tag, thai);
  return label ? (
    <span class="activity-tag" data-tag={tag}>
      {label}
    </span>
  ) : null;
}

export function ActivityTagField({
  tag,
  thai,
}: {
  tag?: ActivityTag | null;
  thai: boolean;
}) {
  const label = thai ? "ป้ายกำกับกิจกรรม" : "Activity tag";
  const [value, setValue] = useState(tag ?? "");
  return (
    <label>
      {label}
      <select
        name="activityTag"
        aria-label={label}
        value={value}
        onChange={(event) =>
          setValue(event.currentTarget.value as ActivityTag | "")
        }
      >
        <option value="">{thai ? "ไม่ระบุ" : "No tag"}</option>
        {(Object.keys(tags) as ActivityTag[]).map((option) => (
          <option key={option} value={option}>
            {activityTagLabel(option, thai)}
          </option>
        ))}
      </select>
    </label>
  );
}
