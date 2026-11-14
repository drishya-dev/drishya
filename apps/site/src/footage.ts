// SITE-2: builder-reviewed real footage. Capture order and timing stay unchanged.
export type Frame = { img: string; click?: [number, number]; zoom?: [number, number, number, number] };
export const FEATURES: Frame[][] = [
  [
    {
      "img": "explorer",
      "click": [
        0.09931,
        0.33
      ]
    }
  ],
  [
    {
      "img": "history-a"
    },
    {
      "img": "history-b",
      "click": [
        0.62396,
        0.16254
      ]
    }
  ],
  [
    {
      "img": "workspace"
    }
  ],
  [
    {
      "img": "changes-session",
      "click": [
        0.36331,
        0.11111
      ]
    },
    {
      "img": "changes-branch",
      "click": [
        0.41602,
        0.11111
      ]
    },
    {
      "img": "changes-branch-pick",
      "click": [
        0.34801,
        0.16139
      ]
    },
    {
      "img": "changes-branch-picked",
      "click": [
        0.39067,
        0.27694
      ]
    },
    {
      "img": "changes-pr-pick",
      "click": [
        0.46675,
        0.11111
      ]
    },
    {
      "img": "changes-pr",
      "click": [
        0.34097,
        0.23444
      ]
    }
  ],
  [
    {
      "img": "git-graph"
    },
    {
      "img": "git-graph-branch",
      "click": [
        0.14896,
        0.43458
      ]
    }
  ],
  [
    {
      "img": "tool",
      "click": [
        0.90208,
        0.23778
      ]
    },
    {
      "img": "tool-next",
      "click": [
        0.91545,
        0.43111
      ]
    }
  ],
  [
    {
      "img": "prompt",
      "zoom": [
        0.7416666666666667,
        0.6266666666666667,
        0.2538933333333333,
        0.22677083333333337
      ],
      "click": [
        0.98056,
        0.78444
      ]
    }
  ],
  [
    {
      "img": "composer",
      "click": [
        0.5,
        0.95667
      ]
    }
  ]
];
