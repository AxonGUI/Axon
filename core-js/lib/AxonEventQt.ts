export enum Reason {
    Mouse = 0x0,
    Keyboard = 0x1,
    Other = 0x2,
}
export enum KeyboardModifier {
    KeyboardModifierMask = -33554432,
    NoModifier = 0x0,
    ShiftModifier = 0x2000000,
    ControlModifier = 0x4000000,
    AltModifier = 0x8000000,
    MetaModifier = 0x10000000,
    KeypadModifier = 0x20000000,
    GroupSwitchModifier = 0x40000000,
}
export enum MouseButton {
    MouseButtonMask = -1,
    NoButton = 0x0,
    LeftButton = 0x1,
    RightButton = 0x2,
    MiddleButton = 0x4,
    BackButton = 0x8,
    ExtraButton1 = 0x8,
    XButton1 = 0x8,
    ExtraButton2 = 0x10,
    ForwardButton = 0x10,
    XButton2 = 0x10,
    ExtraButton3 = 0x20,
    TaskButton = 0x20,
    ExtraButton4 = 0x40,
    ExtraButton5 = 0x80,
    ExtraButton6 = 0x100,
    ExtraButton7 = 0x200,
    ExtraButton8 = 0x400,
    ExtraButton9 = 0x800,
    ExtraButton10 = 0x1000,
    ExtraButton11 = 0x2000,
    ExtraButton12 = 0x4000,
    ExtraButton13 = 0x8000,
    ExtraButton14 = 0x10000,
    ExtraButton15 = 0x20000,
    ExtraButton16 = 0x40000,
    ExtraButton17 = 0x80000,
    ExtraButton18 = 0x100000,
    ExtraButton19 = 0x200000,
    ExtraButton20 = 0x400000,
    ExtraButton21 = 0x800000,
    ExtraButton22 = 0x1000000,
    ExtraButton23 = 0x2000000,
    ExtraButton24 = 0x4000000,
    MaxMouseButton = 0x4000000,
    AllButtons = 0x7ffffff,
}
export enum DropAction {
    IgnoreAction = 0x0,
    CopyAction = 0x1,
    MoveAction = 0x2,
    LinkAction = 0x4,
    ActionMask = 0xff,
    TargetMoveAction = 0x8002,
}
export type QDropEvent = {
    mimeData: { urls: string[]; text: string; html: string; formats: string[] };
    pos: { x: number; y: number };
    posF: { x: number; y: number };
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
        globalPos: { x: number; y: number };
        pos: { x: number; y: number };
    }) => any;
    dragEnter: (e: QDropEvent) => any;
    dragMoveEvent: (e: QDropEvent) => any;
    drop: (e: QDropEvent) => any;
    dragLeaveEvent: () => any;
    hide: () => any;
    show: () => any;
}
