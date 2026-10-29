import "../style/resultNotification.css";

type ResultNotificationProps = {
    text: string,
    color?: "red" | "green" | undefined,
}

const colorMapper = {
    red: "var(--btn-red)",
    green: "var(--btn-green)",
}

export default function ResultNotification ({text, color}: ResultNotificationProps) {
    return (
        <div className="notification-div">
            <div className="notification-inside-div" style={{backgroundColor: color ? colorMapper[color] : ""}}>
                <p className="notification-p" style={{color: color ? "var(--btn-text)" : ""}}>{text}</p>
                <div className="time-div"></div>
            </div>
        </div>
    )
}