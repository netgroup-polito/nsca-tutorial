import { useDrag } from "react-dnd";
import "../style/networkNode.css";
import type { NodeType, DragItem } from "../types/NodeTypes";

type NetworkNodeProps = {
    name: string,
    type: NodeType,
    icon: string
}

export default function NetworkNode ({
    name,
    type,
    icon
}: NetworkNodeProps) {

    const [{isDragging}, dragRef] = useDrag(() => ({
        type: "Node",
        item: {type, kind: "new"} satisfies DragItem,
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        })
    }));

    return (
            <div ref={(node) => {dragRef(node)}} className="network-nodes">
                <img src={icon} className="network-nodes-img"></img>
                <p className="network-nodes-text">{name}</p>
            </div>
    );
}