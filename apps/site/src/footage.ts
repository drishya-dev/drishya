// Ordered footage and measured click targets. Change coordinates only after reviewing a new capture.
export type Frame = { img: string; click?: [number, number]; zoom?: [number, number, number, number] };
export const FEATURES: Frame[][] = [
    // Click positions are where the real control was on screen, measured by the footage script.
    [{ img: 'explorer', click: [.155, .472] }],
    [{ img: 'history-a' }, { img: 'history-b', click: [.032, .587] }],
    [{ img: 'workspace' }],
    [{ img: 'changes-session', click: [.419, .111] }, { img: 'changes-branch', click: [.472, .111] }, { img: 'changes-branch-pick', click: [.369, .161] },
     { img: 'changes-branch-picked', click: [.446, .31] }, { img: 'changes-pr-pick', click: [.522, .111] }, { img: 'changes-pr', click: [.397, .201] }],
    [{ img: 'git-graph' }, { img: 'git-graph-branch', click: [.149, .413] }],
    [{ img: 'tool', click: [.869, .754] }, { img: 'tool-next', click: [.882, .471] }],
    [{ img: 'prompt', zoom: [.6, .5, .4, .5], click: [.936, .678] }],
    [{ img: 'composer', click: [.5, .957] }],
  ];
