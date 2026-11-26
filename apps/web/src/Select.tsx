import {
  Children,
  isValidElement,
  type FocusEventHandler,
  type ReactNode,
} from "react";
import { Select as Primitive } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";

type Option = { value: string; label: ReactNode; disabled?: boolean };

// Keep option declarations beside each form; Base UI owns the popup and keyboard behavior.
export function Select({
  value,
  onValueChange,
  children,
  className = "",
  name,
  required,
  disabled,
  onBlur,
  id,
  "aria-label": ariaLabel,
}: {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  className?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  onBlur?: FocusEventHandler<HTMLButtonElement>;
  id?: string;
  "aria-label"?: string;
}) {
  const items: Option[] = Children.toArray(children).flatMap((child) => {
    if (
      !isValidElement<{
        value: string;
        children: ReactNode;
        disabled?: boolean;
      }>(child)
    )
      return [];
    return [
      {
        value: child.props.value,
        label: child.props.children,
        disabled: child.props.disabled,
      },
    ];
  });
  return (
    <Primitive.Root<string>
      items={items}
      value={value}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next);
      }}
      name={name}
      required={required}
      disabled={disabled}
      id={id}
    >
      <Primitive.Trigger
        className={`select-trigger ${className}`}
        aria-label={ariaLabel}
        onBlur={onBlur}
      >
        <Primitive.Value className="select-value" />
        <Primitive.Icon className="select-icon">
          <ChevronDown size={14} />
        </Primitive.Icon>
      </Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Positioner
          className="select-positioner"
          sideOffset={5}
          alignItemWithTrigger={false}
        >
          <Primitive.Popup className="select-popup">
            <Primitive.List>
              {items.map((item) => (
                <Primitive.Item
                  className="select-item"
                  key={item.value}
                  value={item.value}
                  data-value={item.value}
                  disabled={item.disabled}
                >
                  <Primitive.ItemText>{item.label}</Primitive.ItemText>
                  <Primitive.ItemIndicator className="select-check">
                    <Check size={14} />
                  </Primitive.ItemIndicator>
                </Primitive.Item>
              ))}
            </Primitive.List>
          </Primitive.Popup>
        </Primitive.Positioner>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
