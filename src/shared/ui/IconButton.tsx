import type { ComponentChildren } from "preact";
import { Button, type ButtonProps } from "./Button";

type IconButtonProps = Omit<ButtonProps, "svgOnly" | "children"> & {
  "aria-label": string;
  children: ComponentChildren;
};

export function IconButton({ type = "button", ...props }: IconButtonProps) {
  return <Button {...props} type={type} svgOnly />;
}
