import "../style/confirmationTab.css";
import Button from "./Button";

type ConfirmationTabProps = {
    text: string,
    onConfirm: () => void
    onCancel: () => void
}

export function ConfirmationTab ({text, onConfirm, onCancel}: ConfirmationTabProps) {
    return (
        <div className="confirmation-outer-div">
            <div className="confirmation-inner-div">
                <p>{text}</p>
                <div className="confirmation-buttons-div">
                    <Button name="Confirm" color="green" func={onConfirm} focused={true}/>
                    <Button name="Cancel" color="blue" func={onCancel}/>
                </div>
            </div>
        </div>
    );
}