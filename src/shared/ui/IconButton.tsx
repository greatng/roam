import type { ComponentChildren } from "preact";
import { Button, type ButtonProps } from "./Button";

type IconButtonProps = Omit<ButtonProps, "svgOnly" | "children"> & {
  "aria-label": string;
  children: ComponentChildren;
};

export function IconButton({
  type = "button",
  loading,
  children,
  ...props
}: IconButtonProps) {
  return (
    <Button {...props} type={type} loading={loading} svgOnly>
      {!loading && children}
    </Button>
  );
}
