import { useDrag } from "react-dnd";
import "../style/networkNodeCanvas.css";
import type { NodeType, DragItem } from "../types/NodeTypes";
import { useEffect, useRef } from "react";

type NetworkNodeCanvasProps = {
    id: number,
    name: string,
    type: NodeType,
    icon: string,
    x: number,
    y: number,
    width: number,
    height: number,
    selected?: boolean,
    multiSelected?: boolean,
    error: boolean,
    updated: boolean,
    onSizeChange?: (id: number, width: number, height: number) => void,
}

export default function NetworkNodeCanvas ({
    id,
    name, 
    icon: Icon,
    x,
    y,
    width,
    height,
    selected,
    multiSelected,
    error,
    updated,
    onSizeChange
}: NetworkNodeCanvasProps) {

    const [{ isDragging }, dragRef] = useDrag(() => ({
        type: "CanvasNode",
        item: { id, kind: "existing" } satisfies DragItem,
        canDrag: !multiSelected,
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    }));

    const nodeRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = nodeRef.current;
        if (!el || !onSizeChange) return;
        const observer = new ResizeObserver(([entry]) => {
            const box = entry.borderBoxSize?.[0];
            onSizeChange(id, box.inlineSize, box.blockSize);
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, [id, onSizeChange]);

    return (
        <div
            tabIndex={0}
            ref={(node) => { dragRef(node); nodeRef.current = node; }}
            className={`network-node-canvas ${selected ? 'selected' : ''} ${multiSelected ? 'multi-selected' : ''}`}
            style={{
                top: `${y}px`,
                left: `${x}px`,
                opacity: isDragging ? 0.4 : 1,
                width: `${width}px`,
                minWidth: "30px",
                minHeight: "fit-content",
                maxWidth: "150px",
                maxHeight: "150px"

            }}
        >
            {(error || updated )&& <div
                className={`${error && 'error-dot'} ${updated && 'update-dot'}`}
            ></div>}
            <img src={Icon} alt="" style={{ width: "80%", height: "80%", minWidth: "50px", minHeight: "50px",objectFit: "contain" }} />
            <p className="node-name-canvas">{name}</p>
        </div>
    );
}
