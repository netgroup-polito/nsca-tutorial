import "express-session";
import { NetworkNode } from "./types";

declare module "express-session" {
    interface SessionData {
        labName?: string;
        nodes?: NetworkNode[];
    }
}