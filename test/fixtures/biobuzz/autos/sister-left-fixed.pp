{
  "startPoint": {
    "x": 59,
    "y": 133.69,
    "name": "START",
    "headingDeg": 270
  },
  "lines": [
    {
      "id": "to-far-flower-turn-1",
      "color": "#3cc8e4",
      "name": "START to FAR_FLOWER_TURN",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 47.36,
        "y": 118.34
      },
      "controlPoints": [
        {
          "x": 59,
          "y": 118.34
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.3,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 270
              }
            },
            {
              "startProgress": 0.3,
              "endProgress": 0.9,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 270,
                "endDeg": 90
              }
            },
            {
              "startProgress": 0.9,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 90
              }
            }
          ]
        }
      }
    },
    {
      "id": "to-far-flower-2",
      "color": "#3cc8e4",
      "name": "FAR_FLOWER_TURN to FAR_FLOWER",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 47.36,
        "y": 126.64
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
      }
    },
    {
      "id": "to-l-n-3",
      "color": "#3cc8e4",
      "name": "FAR_FLOWER to L_N",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 55,
        "y": 123.5
      },
      "controlPoints": [
        {
          "x": 47.36,
          "y": 116.64
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.3,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 90
              }
            },
            {
              "startProgress": 0.3,
              "endProgress": 1.0,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 90,
                "endDeg": 270
              }
            }
          ]
        }
      }
    },
    {
      "id": "to-l-turn-4",
      "color": "#3cc8e4",
      "name": "L_N to L_TURN",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 57,
        "y": 36
      },
      "controlPoints": [
        {
          "x": 57.5,
          "y": 100
        },
        {
          "x": 57.5,
          "y": 50
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.88,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 270
              }
            },
            {
              "startProgress": 0.88,
              "endProgress": 1.0,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 270,
                "endDeg": 90
              }
            }
          ]
        }
      }
    },
    {
      "id": "to-l-s-5",
      "color": "#3cc8e4",
      "name": "L_TURN to L_S",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 59,
        "y": 18
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
      }
    },
    {
      "id": "to-l-c-6",
      "color": "#3cc8e4",
      "name": "L_S to L_C",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 58,
        "y": 40
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
      }
    },
    {
      "id": "to-l-n-7",
      "color": "#3cc8e4",
      "name": "L_C to L_N",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 55,
        "y": 123.5
      },
      "controlPoints": [
        {
          "x": 57.5,
          "y": 50
        },
        {
          "x": 57.5,
          "y": 104
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.85,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 90
              }
            },
            {
              "startProgress": 0.85,
              "endProgress": 1.0,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 90,
                "endDeg": 270
              }
            }
          ]
        }
      }
    },
    {
      "id": "to-park-l-8",
      "color": "#3cc8e4",
      "name": "L_N to PARK_L",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 14,
        "y": 120
      },
      "controlPoints": [
        {
          "x": 44,
          "y": 127
        },
        {
          "x": 24,
          "y": 127
        }
      ],
      "heading": {
        "type": "constant",
        "degrees": 270
      }
    }
  ],
  "shapes": [
    {
      "id": "frame-leg-red",
      "name": "HIVE frame leg (red side)",
      "vertices": [
        {
          "x": 46.6,
          "y": 51.2
        },
        {
          "x": 49.4,
          "y": 51.2
        },
        {
          "x": 49.4,
          "y": 90.3
        },
        {
          "x": 46.6,
          "y": 90.3
        }
      ],
      "color": "#dc2626",
      "fillColor": "#ff6b6b"
    },
    {
      "id": "frame-leg-blue",
      "name": "HIVE frame leg (blue side)",
      "vertices": [
        {
          "x": 92.6,
          "y": 51.2
        },
        {
          "x": 95,
          "y": 51.2
        },
        {
          "x": 95,
          "y": 90.3
        },
        {
          "x": 92.6,
          "y": 90.3
        }
      ],
      "color": "#dc2626",
      "fillColor": "#ff6b6b"
    },
    {
      "id": "blue-half",
      "name": "Blue half: stay out",
      "vertices": [
        {
          "x": 70.8,
          "y": 0
        },
        {
          "x": 141.5,
          "y": 0
        },
        {
          "x": 141.5,
          "y": 141.5
        },
        {
          "x": 70.8,
          "y": 141.5
        }
      ],
      "color": "#2563eb",
      "fillColor": "#60a5fa"
    }
  ],
  "sequence": [
    {
      "kind": "path",
      "lineId": "to-far-flower-turn-1"
    },
    {
      "kind": "path",
      "lineId": "to-far-flower-2"
    },
    {
      "kind": "path",
      "lineId": "to-l-n-3"
    },
    {
      "kind": "path",
      "lineId": "to-l-turn-4"
    },
    {
      "kind": "path",
      "lineId": "to-l-s-5"
    },
    {
      "kind": "path",
      "lineId": "to-l-c-6"
    },
    {
      "kind": "path",
      "lineId": "to-l-n-7"
    },
    {
      "kind": "path",
      "lineId": "to-park-l-8"
    }
  ],
  "settings": {
    "xVelocity": 75,
    "yVelocity": 65,
    "aVelocity": 3.141592653589793,
    "kFriction": 0.1,
    "rWidth": 18,
    "rHeight": 18,
    "safetyMargin": 1,
    "maxVelocity": 50,
    "maxAcceleration": 45.0,
    "maxDeceleration": 45.0,
    "fieldMap": "biobuzz.webp",
    "robotImage": "/robot.png",
    "showGhostPaths": false,
    "showOnionLayers": false,
    "onionLayerSpacing": 3,
    "onionColor": "#dc2626",
    "onionNextPointOnly": false,
    "showHeadingArrow": false,
    "showCurrentTValue": false,
    "leftPanelWidth": 262,
    "rightPanelWidth": 714,
    "headingArrowLength": 50,
    "headingArrowColor": "#ffffff",
    "headingArrowThickness": 2,
    "pathOpacity": 1,
    "leftPanelMinWidth": 0,
    "rightPanelMinWidth": 0,
    "penToolMaxPaths": 8,
    "curveThroughMaxPoints": 4,
    "experimentalFeatures": {
      "optimize": false,
      "curveThrough": false
    }
  },
  "auto": {
    "version": 1,
    "drawnFor": "RED",
    "exportName": "sister-left-fixed",
    "registry": {
      "actions": [
        "SpinUp",
        "LaunchAll",
        "LaunchOne"
      ],
      "conditions": [
        "LeftCellUp",
        "Empty",
        "IntakeFull",
        "Tip",
        "RightCellUp"
      ],
      "typicalS": {
        "SpinUp": 0.1,
        "LaunchAll": 2.0,
        "LaunchOne": 0.5
      },
      "events": [
        "Tip"
      ]
    },
    "points": {
      "START": [
        59,
        133.69,
        270
      ],
      "L_N": [
        55,
        123.5,
        270
      ],
      "L_TURN": [
        57,
        36,
        90
      ],
      "L_S": [
        59,
        18,
        90
      ],
      "PARK_L": [
        14,
        120,
        270
      ],
      "FAR_FLOWER": [
        47.36,
        126.64,
        90
      ],
      "FAR_FLOWER_IN": [
        47.36,
        120.84,
        90
      ],
      "FAR_FLOWER_TURN": [
        47.36,
        118.34,
        90
      ],
      "L_C": [
        58,
        40,
        90
      ]
    },
    "pathEnds": {
      "to-far-flower-turn-1": "FAR_FLOWER_TURN",
      "to-far-flower-2": "FAR_FLOWER",
      "to-l-n-3": "L_N",
      "to-l-turn-4": "L_TURN",
      "to-l-s-5": "L_S",
      "to-l-c-6": "L_C",
      "to-l-n-7": "L_N",
      "to-park-l-8": "PARK_L"
    },
    "startAt": "START",
    "cards": [
      {
        "id": "a-1",
        "kind": "action",
        "name": "SpinUp"
      },
      {
        "id": "p-2",
        "kind": "path",
        "lineId": "to-far-flower-turn-1",
        "park": false
      },
      {
        "id": "w-3",
        "kind": "firstOf",
        "label": "TIP 1 (R): the left CELL up",
        "rows": [
          {
            "when": [
              "LeftCellUp"
            ],
            "cards": []
          },
          {
            "afterMs": 15000,
            "cards": []
          }
        ]
      },
      {
        "id": "w-4",
        "kind": "firstOf",
        "label": "Preloads at the left CELL",
        "rows": [
          {
            "when": [
              "Empty"
            ],
            "cards": []
          },
          {
            "afterMs": 3000,
            "cards": []
          }
        ],
        "alongside": "LaunchAll"
      },
      {
        "id": "p-5",
        "kind": "path",
        "lineId": "to-far-flower-2",
        "park": false
      },
      {
        "id": "w-6",
        "kind": "firstOf",
        "label": "The far FLOWER's 4",
        "rows": [
          {
            "when": [
              "IntakeFull"
            ],
            "cards": []
          },
          {
            "afterMs": 3000,
            "cards": []
          }
        ]
      },
      {
        "id": "p-7",
        "kind": "path",
        "lineId": "to-l-n-3",
        "park": false
      },
      {
        "id": "w-8",
        "kind": "firstOf",
        "label": "The far FLOWER's 4 (TIP 2)",
        "rows": [
          {
            "when": [
              "Tip"
            ],
            "cards": []
          },
          {
            "afterMs": 4000,
            "cards": []
          }
        ],
        "alongside": "LaunchAll"
      },
      {
        "id": "w-21",
        "kind": "firstOf",
        "label": "TIP 2 started",
        "rows": [
          {
            "when": [
              "RightCellUp"
            ],
            "cards": [
              {
                "id": "w-9",
                "kind": "firstOf",
                "label": "TIP 2's spill lands",
                "rows": [
                  {
                    "when": [
                      "IntakeFull"
                    ],
                    "cards": []
                  },
                  {
                    "afterMs": 500,
                    "cards": []
                  }
                ]
              },
              {
                "id": "p-10",
                "kind": "path",
                "lineId": "to-l-turn-4",
                "park": false
              },
              {
                "id": "p-11",
                "kind": "path",
                "lineId": "to-l-s-5",
                "park": false
              },
              {
                "id": "a-12",
                "kind": "action",
                "name": "LaunchOne"
              },
              {
                "id": "a-13",
                "kind": "action",
                "name": "LaunchOne"
              },
              {
                "id": "a-14",
                "kind": "action",
                "name": "LaunchOne"
              },
              {
                "id": "w-15",
                "kind": "firstOf",
                "label": "TIP 3",
                "rows": [
                  {
                    "when": [
                      "LeftCellUp"
                    ],
                    "cards": []
                  },
                  {
                    "afterMs": 6000,
                    "cards": []
                  }
                ]
              },
              {
                "id": "w-16",
                "kind": "firstOf",
                "label": "TIP 3's spill lands",
                "rows": [
                  {
                    "when": [
                      "IntakeFull"
                    ],
                    "cards": []
                  },
                  {
                    "afterMs": 800,
                    "cards": []
                  }
                ]
              },
              {
                "id": "p-17",
                "kind": "path",
                "lineId": "to-l-c-6",
                "park": false
              },
              {
                "id": "w-18",
                "kind": "firstOf",
                "label": "Catch TIP 3's spill",
                "rows": [
                  {
                    "when": [
                      "IntakeFull"
                    ],
                    "cards": []
                  },
                  {
                    "afterMs": 2000,
                    "cards": []
                  }
                ]
              },
              {
                "id": "p-19",
                "kind": "path",
                "lineId": "to-l-n-7",
                "park": false
              },
              {
                "id": "w-20",
                "kind": "firstOf",
                "label": "TIP 3's catch at the left CELL (TIP 4, with R)",
                "rows": [
                  {
                    "when": [
                      "Empty"
                    ],
                    "cards": []
                  },
                  {
                    "afterMs": 2000,
                    "cards": []
                  }
                ],
                "alongside": "LaunchAll"
              }
            ]
          },
          {
            "afterMs": 4500,
            "cards": [],
            "label": "No TIP 2: park"
          }
        ]
      },
      {
        "id": "p-22",
        "kind": "path",
        "lineId": "to-park-l-8",
        "park": true
      }
    ]
  },
  "version": "1.5.0"
}