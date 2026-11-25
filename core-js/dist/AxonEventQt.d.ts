export declare enum Reason {
    Mouse = 0,
    Keyboard = 1,
    Other = 2
}
export declare enum KeyboardModifier {
    KeyboardModifierMask = -33554432,
    NoModifier = 0,
    ShiftModifier = 33554432,
    ControlModifier = 67108864,
    AltModifier = 134217728,
    MetaModifier = 268435456,
    KeypadModifier = 536870912,
    GroupSwitchModifier = 1073741824
}
export declare enum MouseButton {
    MouseButtonMask = -1,
    NoButton = 0,
    LeftButton = 1,
    RightButton = 2,
    MiddleButton = 4,
    BackButton = 8,
    ExtraButton1 = 8,
    XButton1 = 8,
    ExtraButton2 = 16,
    ForwardButton = 16,
    XButton2 = 16,
    ExtraButton3 = 32,
    TaskButton = 32,
    ExtraButton4 = 64,
    ExtraButton5 = 128,
    ExtraButton6 = 256,
    ExtraButton7 = 512,
    ExtraButton8 = 1024,
    ExtraButton9 = 2048,
    ExtraButton10 = 4096,
    ExtraButton11 = 8192,
    ExtraButton12 = 16384,
    ExtraButton13 = 32768,
    ExtraButton14 = 65536,
    ExtraButton15 = 131072,
    ExtraButton16 = 262144,
    ExtraButton17 = 524288,
    ExtraButton18 = 1048576,
    ExtraButton19 = 2097152,
    ExtraButton20 = 4194304,
    ExtraButton21 = 8388608,
    ExtraButton22 = 16777216,
    ExtraButton23 = 33554432,
    ExtraButton24 = 67108864,
    MaxMouseButton = 67108864,
    AllButtons = 134217727
}
export declare enum DropAction {
    IgnoreAction = 0,
    CopyAction = 1,
    MoveAction = 2,
    LinkAction = 4,
    ActionMask = 255,
    TargetMoveAction = 32770
}
export type QDropEvent = {
    mimeData: {
        urls: string[];
        text: string;
        html: string;
        formats: string[];
    };
    pos: {
        x: number;
        y: number;
    };
    posF: {
        x: number;
        y: number;
    };
    modifiers: KeyboardModifier;
    keyboardModifiers: KeyboardModifier;
    buttons: MouseButton;
    mouseButtons: MouseButton;
    dropAction: DropAction;
    possibleActions: DropAction;
    proposedAction: DropAction;
};
export interface AxonQtEventMap {
    loadFinished: () => any;
    contextMenu: (e: {
        reason: Reason;
        globalPos: {
            x: number;
            y: number;
        };
        pos: {
            x: number;
            y: number;
        };
    }) => any;
    dragEnter: (e: QDropEvent) => any;
    dragMove: (e: QDropEvent) => any;
    drop: (e: QDropEvent) => any;
    dragLeave: () => any;
    hide: () => any;
    show: () => any;
}
