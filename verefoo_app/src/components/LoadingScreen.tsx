import { ClimbingBoxLoader } from "react-spinners";
import "../style/loadingScreen.css";

export default function LoadingScreen () {
    return (
        <div className="loading-screen-div"> 
            <ClimbingBoxLoader color="var(--btn-blue)"/>
        </div>
    )
}