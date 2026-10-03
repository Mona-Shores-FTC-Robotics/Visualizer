{
  "startPoint": {
    "x": 61,
    "y": 132.25,
    "name": "START",
    "headingDeg": 270
  },
  "lines": [
    {
      "id": "to-flower-l-turn-1",
      "color": "#3cc8e4",
      "name": "START to FLOWER_L_TURN",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 47.36,
        "y": 119.29
      },
      "controlPoints": [
        {
          "x": 61,
          "y": 119.29
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.5,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 270
              }
            },
            {
              "startProgress": 0.5,
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
      "id": "to-flower-l-2",
      "color": "#3cc8e4",
      "name": "FLOWER_L_TURN to FLOWER_L",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 47.36,
        "y": 127.59
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
      }
    },
    {
      "id": "to-flower-l-in-3",
      "color": "#3cc8e4",
      "name": "FLOWER_L to FLOWER_L_IN",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 47.36,
        "y": 121.79
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
      }
    },
    {
      "id": "to-mid-4",
      "color": "#3cc8e4",
      "name": "FLOWER_L_IN to MID",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 50,
        "y": 114
      },
      "controlPoints": [],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.2,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 90
              }
            },
            {
              "startProgress": 0.2,
              "endProgress": 0.9,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 90,
                "endDeg": 270
              }
            },
            {
              "startProgress": 0.9,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 270
              }
            }
          ]
        }
      }
    },
    {
      "id": "to-catch-l-5",
      "color": "#3cc8e4",
      "name": "MID to CATCH_L",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 57.5,
        "y": 128
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 270
      }
    },
    {
      "id": "to-back-w-6",
      "color": "#3cc8e4",
      "name": "CATCH_L to BACK_W",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 30,
        "y": 108
      },
      "controlPoints": [
        {
          "x": 57.5,
          "y": 114
        },
        {
          "x": 42,
          "y": 110
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.2,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 270
              }
            },
            {
              "startProgress": 0.2,
              "endProgress": 0.8,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 270,
                "endDeg": 140
              }
            },
            {
              "startProgress": 0.8,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 140
              }
            }
          ]
        }
      }
    },
    {
      "id": "to-wall-flower-turn-7",
      "color": "#3cc8e4",
      "name": "BACK_W to WALL_FLOWER_TURN",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 22.21,
        "y": 47.36
      },
      "controlPoints": [
        {
          "x": 24,
          "y": 90
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.2,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 140
              }
            },
            {
              "startProgress": 0.2,
              "endProgress": 0.7,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 140,
                "endDeg": 180
              }
            },
            {
              "startProgress": 0.7,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 180
              }
            }
          ]
        }
      }
    },
    {
      "id": "to-wall-flower-8",
      "color": "#3cc8e4",
      "name": "WALL_FLOWER_TURN to WALL_FLOWER",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 13.91,
        "y": 47.36
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 180
      }
    },
    {
      "id": "to-back-w-9",
      "color": "#3cc8e4",
      "name": "WALL_FLOWER to BACK_W",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 30,
        "y": 108
      },
      "controlPoints": [
        {
          "x": 24,
          "y": 72
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
                "degrees": 180
              }
            },
            {
              "startProgress": 0.3,
              "endProgress": 0.8,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 180,
                "endDeg": 140
              }
            },
            {
              "startProgress": 0.8,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 140
              }
            }
          ]
        }
      }
    },
    {
      "id": "to-look-l-10",
      "color": "#3cc8e4",
      "name": "BACK_W to LOOK_L",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 44,
        "y": 112
      },
      "controlPoints": [],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0.0,
              "endProgress": 0.5,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 140,
                "endDeg": 330
              }
            },
            {
              "startProgress": 0.5,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 330
              }
            }
          ]
        }
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
      "lineId": "to-flower-l-turn-1"
    },
    {
      "kind": "path",
      "lineId": "to-flower-l-2"
    },
    {
      "kind": "path",
      "lineId": "to-flower-l-in-3"
    },
    {
      "kind": "path",
      "lineId": "to-mid-4"
    },
    {
      "kind": "path",
      "lineId": "to-catch-l-5"
    },
    {
      "kind": "path",
      "lineId": "to-back-w-6"
    },
    {
      "kind": "path",
      "lineId": "to-wall-flower-turn-7"
    },
    {
      "kind": "path",
      "lineId": "to-wall-flower-8"
    },
    {
      "kind": "path",
      "lineId": "to-back-w-9"
    },
    {
      "kind": "path",
      "lineId": "to-look-l-10"
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
    "exportName": "recycle5-left",
    "registry": {
      "actions": [
        "SpinUp",
        "LaunchAll",
        "CollectSeen"
      ],
      "conditions": [
        "LeftCellUp",
        "Empty",
        "IntakeFull",
        "RightCellUp"
      ],
      "typicalS": {
        "SpinUp": 0.1,
        "LaunchAll": 2.0,
        "CollectSeen": 2.0
      },
      "events": []
    },
    "points": {
      "START": [
        61,
        132.25,
        270
      ],
      "FLOWER_L": [
        47.36,
        127.59,
        90
      ],
      "FLOWER_L_IN": [
        47.36,
        121.79,
        90
      ],
      "FLOWER_L_TURN": [
        47.36,
        119.29,
        90
      ],
      "WALL_FLOWER": [
        13.91,
        47.36,
        180
      ],
      "WALL_FLOWER_IN": [
        19.71,
        47.36,
        180
      ],
      "WALL_FLOWER_TURN": [
        22.21,
        47.36,
        180
      ],
      "MID": [
        50,
        114,
        270
      ],
      "CATCH_L": [
        57.5,
        128,
        270
      ],
      "BACK_W": [
        30,
        108,
        140
      ],
      "LOOK_L": [
        44,
        112,
        330
      ]
    },
    "pathEnds": {
      "to-flower-l-turn-1": "FLOWER_L_TURN",
      "to-flower-l-2": "FLOWER_L",
      "to-flower-l-in-3": "FLOWER_L_IN",
      "to-mid-4": "MID",
      "to-catch-l-5": "CATCH_L",
      "to-back-w-6": "BACK_W",
      "to-wall-flower-turn-7": "WALL_FLOWER_TURN",
      "to-wall-flower-8": "WALL_FLOWER",
      "to-back-w-9": "BACK_W",
      "to-look-l-10": "LOOK_L"
    },
    "startAt": "START",
    "cards": [
      {
        "id": "a-1",
        "kind": "action",
        "name": "SpinUp"
      },
      {
        "id": "w-2",
        "kind": "firstOf",
        "label": "TIP 1",
        "rows": [
          {
            "when": [
              "LeftCellUp"
            ],
            "cards": []
          },
          {
            "afterMs": 8000,
            "cards": []
          }
        ]
      },
      {
        "id": "w-3",
        "kind": "firstOf",
        "label": "Fire the preloads",
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
      },
      {
        "id": "p-4",
        "kind": "path",
        "lineId": "to-flower-l-turn-1",
        "park": false
      },
      {
        "id": "p-5",
        "kind": "path",
        "lineId": "to-flower-l-2",
        "park": false
      },
      {
        "id": "w-6",
        "kind": "firstOf",
        "label": "The far FLOWER",
        "rows": [
          {
            "when": [
              "IntakeFull"
            ],
            "cards": []
          },
          {
            "afterMs": 2300,
            "cards": []
          }
        ]
      },
      {
        "id": "p-7",
        "kind": "path",
        "lineId": "to-flower-l-in-3",
        "park": false
      },
      {
        "id": "w-8",
        "kind": "firstOf",
        "label": "Throw the FLOWER back (TIP 2)",
        "rows": [
          {
            "when": [
              "Empty"
            ],
            "cards": []
          },
          {
            "afterMs": 1500,
            "cards": []
          }
        ],
        "alongside": "LaunchAll"
      },
      {
        "id": "p-9",
        "kind": "path",
        "lineId": "to-mid-4",
        "park": false
      },
      {
        "id": "p-10",
        "kind": "path",
        "lineId": "to-catch-l-5",
        "park": false
      },
      {
        "id": "w-11",
        "kind": "firstOf",
        "label": "TIP 2: catch the spill",
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
        "id": "p-12",
        "kind": "path",
        "lineId": "to-back-w-6",
        "park": false
      },
      {
        "id": "w-13",
        "kind": "firstOf",
        "label": "Our CELL up (3)",
        "rows": [
          {
            "when": [
              "LeftCellUp"
            ],
            "cards": []
          },
          {
            "afterMs": 10000,
            "cards": []
          }
        ]
      },
      {
        "id": "w-14",
        "kind": "firstOf",
        "label": "Throw the catch back (3)",
        "rows": [
          {
            "when": [
              "Empty"
            ],
            "cards": []
          },
          {
            "afterMs": 600,
            "cards": []
          }
        ],
        "alongside": "LaunchAll"
      },
      {
        "id": "p-15",
        "kind": "path",
        "lineId": "to-wall-flower-turn-7",
        "park": false
      },
      {
        "id": "p-16",
        "kind": "path",
        "lineId": "to-wall-flower-8",
        "park": false
      },
      {
        "id": "w-17",
        "kind": "firstOf",
        "label": "The wall FLOWER",
        "rows": [
          {
            "when": [
              "IntakeFull"
            ],
            "cards": []
          },
          {
            "afterMs": 1800,
            "cards": []
          }
        ]
      },
      {
        "id": "p-18",
        "kind": "path",
        "lineId": "to-back-w-9",
        "park": false
      },
      {
        "id": "w-19",
        "kind": "firstOf",
        "label": "Throw the wall FLOWER back (TIP 4)",
        "rows": [
          {
            "when": [
              "RightCellUp"
            ],
            "cards": []
          },
          {
            "afterMs": 2500,
            "cards": []
          }
        ],
        "alongside": "LaunchAll"
      },
      {
        "id": "w-23",
        "kind": "firstOf",
        "label": "Tipped? (4)",
        "rows": [
          {
            "when": [
              "RightCellUp"
            ],
            "cards": [],
            "label": "Yes"
          },
          {
            "afterMs": 300,
            "cards": [
              {
                "id": "p-20",
                "kind": "path",
                "lineId": "to-look-l-10",
                "park": false
              },
              {
                "id": "w-21",
                "kind": "firstOf",
                "label": "Collect TIP 2's spill",
                "rows": [
                  {
                    "when": [
                      "IntakeFull"
                    ],
                    "cards": []
                  },
                  {
                    "afterMs": 2500,
                    "cards": []
                  }
                ],
                "alongside": "CollectSeen"
              },
              {
                "id": "w-22",
                "kind": "firstOf",
                "label": "Fire the spill (TIP 4)",
                "rows": [
                  {
                    "when": [
                      "RightCellUp"
                    ],
                    "cards": []
                  },
                  {
                    "afterMs": 2500,
                    "cards": []
                  }
                ],
                "alongside": "LaunchAll"
              }
            ],
            "label": "No: the spill"
          }
        ]
      }
    ]
  },
  "version": "1.5.0"
}