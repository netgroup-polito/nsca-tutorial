import { type LucideIcon } from "lucide-react";
import "../style/button.css";
import { useLayoutEffect, useRef, useState } from "react";

type ButtonColor = "green" | "blue" | "red";

type ButtonProps = {
    name: string,
    icon?: LucideIcon,
    color: ButtonColor,
    func?: () => void,
    focused?: boolean,
    disabled?: boolean,
};

const colorMap = {
    green: "var(--btn-green)",
    blue: "var(--btn-blue)",
    red: "var(--btn-red-transparent)",
}

export default function Button({
    name,
    icon: Icon,
    color,
    func,
    focused = false,
    disabled = false,
}: ButtonProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [isFocused, setIsFocused] = useState(false);

    useLayoutEffect(() => {
        if (focused) {
            ref.current?.focus();
            setIsFocused(true);
        }
    }, [focused]);

    return (
        <div 
        ref={ref}
        className={`button-div ${isFocused ? "button-focused" : ""} ${disabled ? "disabled-button": ""}`}
        style={{backgroundColor : disabled ? "var(--disabled-button)" : colorMap[color]}}
        onClick={() => func?.()}
        onBlur={() => setIsFocused(false)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
            if(e.key === "Enter") {
                e.preventDefault();
                func?.();
            }
        }}
        >
            {Icon ? <Icon size={18} color="white" strokeWidth={2}></Icon> : null}
            <p className="button-name">{name}</p>

        </div>
    );
}