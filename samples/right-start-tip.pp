{
  "startPoint": {
    "x": 59,
    "y": 9.5,
    "name": "RIGHT_START",
    "headingDeg": 90
  },
  "lines": [
    {
      "id": "to-rhe",
      "color": "#3cc8e4",
      "name": "to RIGHT_HIVE_ENTRANCE",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 59,
        "y": 47
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
      }
    },
    {
      "id": "to-lhe",
      "color": "#3cc8e4",
      "name": "to LEFT_HIVE_ENTRANCE",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 59,
        "y": 94.7
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
      }
    },
    {
      "id": "to-lflower",
      "color": "#3cc8e4",
      "name": "to LEFT_FLOWER",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 47.5,
        "y": 129
      },
      "controlPoints": [
        {
          "x": 59,
          "y": 125
        }
      ],
      "heading": {
        "type": "constant",
        "degrees": 90
      }
    },
    {
      "id": "to-lshot",
      "color": "#3cc8e4",
      "name": "to LEFT_SHOT",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 38,
        "y": 112
      },
      "controlPoints": [
        {
          "x": 46,
          "y": 116
        }
      ],
      "heading": {
        "type": "linear",
        "startDeg": 90,
        "endDeg": 308
      }
    },
    {
      "id": "lshot-park",
      "color": "#3cc8e4",
      "name": "LEFT_SHOT to LEFT_LOADING_ZONE",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 16,
        "y": 115.7
      },
      "controlPoints": [
        {
          "x": 26,
          "y": 112
        }
      ],
      "heading": {
        "type": "linear",
        "startDeg": 308,
        "endDeg": 90
      }
    },
    {
      "id": "to-wflower",
      "color": "#3cc8e4",
      "name": "to YOUR_WALL_FLOWER",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 15.2,
        "y": 47.8
      },
      "controlPoints": [
        {
          "x": 30,
          "y": 96
        },
        {
          "x": 26,
          "y": 50
        }
      ],
      "heading": {
        "type": "linear",
        "startDeg": 308,
        "endDeg": 180
      }
    },
    {
      "id": "to-wshot",
      "color": "#3cc8e4",
      "name": "to YOUR_WALL_SHOT",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 30,
        "y": 80
      },
      "controlPoints": [
        {
          "x": 26,
          "y": 60
        }
      ],
      "heading": {
        "type": "linear",
        "startDeg": 180,
        "endDeg": 14
      }
    },
    {
      "id": "wshot-park",
      "color": "#3cc8e4",
      "name": "YOUR_WALL_SHOT to LEFT_LOADING_ZONE",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 16,
        "y": 115.7
      },
      "controlPoints": [
        {
          "x": 22,
          "y": 96
        }
      ],
      "heading": {
        "type": "linear",
        "startDeg": 14,
        "endDeg": 90
      }
    },
    {
      "id": "to-garden",
      "color": "#3cc8e4",
      "name": "to GARDEN",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 10.5,
        "y": 11.8
      },
      "controlPoints": [
        {
          "x": 36,
          "y": 12
        }
      ],
      "heading": {
        "type": "linear",
        "startDeg": 90,
        "endDeg": 180
      }
    },
    {
      "id": "to-rshot",
      "color": "#3cc8e4",
      "name": "to RIGHT_SHOT",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 36,
        "y": 30
      },
      "controlPoints": [
        {
          "x": 24,
          "y": 16
        }
      ],
      "heading": {
        "type": "linear",
        "startDeg": 180,
        "endDeg": 54
      }
    },
    {
      "id": "rshot-lflower",
      "color": "#3cc8e4",
      "name": "RIGHT_SHOT to LEFT_FLOWER",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 47.5,
        "y": 129
      },
      "controlPoints": [
        {
          "x": 30,
          "y": 60
        },
        {
          "x": 30,
          "y": 112
        }
      ],
      "heading": {
        "type": "linear",
        "startDeg": 54,
        "endDeg": 90
      }
    },
    {
      "id": "rshot-park",
      "color": "#3cc8e4",
      "name": "RIGHT_SHOT to RIGHT_LOADING_ZONE",
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 16,
        "y": 96.6
      },
      "controlPoints": [
        {
          "x": 26,
          "y": 60
        }
      ],
      "heading": {
        "type": "linear",
        "startDeg": 54,
        "endDeg": 90
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
      "lineId": "to-rhe"
    },
    {
      "kind": "path",
      "lineId": "to-lhe"
    },
    {
      "kind": "path",
      "lineId": "to-lflower"
    },
    {
      "kind": "path",
      "lineId": "to-lshot"
    },
    {
      "kind": "path",
      "lineId": "lshot-park"
    },
    {
      "kind": "path",
      "lineId": "to-wflower"
    },
    {
      "kind": "path",
      "lineId": "to-wshot"
    },
    {
      "kind": "path",
      "lineId": "wshot-park"
    },
    {
      "kind": "path",
      "lineId": "to-garden"
    },
    {
      "kind": "path",
      "lineId": "to-rshot"
    },
    {
      "kind": "path",
      "lineId": "rshot-lflower"
    },
    {
      "kind": "path",
      "lineId": "rshot-park"
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
    "maxVelocity": 60,
    "maxAcceleration": 55,
    "maxDeceleration": 55,
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
    "exportName": "right-start-tip",
    "registry": {
      "actions": [
        "LaunchAll"
      ],
      "conditions": [
        "Tip",
        "IntakeFull"
      ],
      "typicalS": {
        "LaunchAll": 3.0
      }
    },
    "points": {
      "RIGHT_START": [
        59,
        9.5,
        90
      ],
      "RIGHT_HIVE_ENTRANCE": [
        59,
        47,
        90
      ],
      "LEFT_HIVE_ENTRANCE": [
        59,
        94.7,
        90
      ],
      "LEFT_FLOWER": [
        47.5,
        129,
        90
      ],
      "LEFT_SHOT": [
        38,
        112,
        308
      ],
      "LEFT_LOADING_ZONE": [
        16,
        115.7,
        90
      ],
      "YOUR_WALL_FLOWER": [
        15.2,
        47.8,
        180
      ],
      "YOUR_WALL_SHOT": [
        30,
        80,
        14
      ],
      "GARDEN": [
        10.5,
        11.8,
        180
      ],
      "RIGHT_SHOT": [
        36,
        30,
        54
      ],
      "RIGHT_LOADING_ZONE": [
        16,
        96.6,
        90
      ]
    },
    "pathEnds": {
      "to-rhe": "RIGHT_HIVE_ENTRANCE",
      "to-lhe": "LEFT_HIVE_ENTRANCE",
      "to-lflower": "LEFT_FLOWER",
      "to-lshot": "LEFT_SHOT",
      "lshot-park": "LEFT_LOADING_ZONE",
      "to-wflower": "YOUR_WALL_FLOWER",
      "to-wshot": "YOUR_WALL_SHOT",
      "wshot-park": "LEFT_LOADING_ZONE",
      "to-garden": "GARDEN",
      "to-rshot": "RIGHT_SHOT",
      "rshot-lflower": "LEFT_FLOWER",
      "rshot-park": "RIGHT_LOADING_ZONE"
    },
    "startAt": "RIGHT_START",
    "cards": [
      {
        "id": "first-tip",
        "kind": "firstOf",
        "label": "Did the HIVE tip?",
        "rows": [
          {
            "when": [
              "Tip"
            ],
            "label": "Tipped",
            "cards": [
              {
                "id": "s-rhe",
                "kind": "path",
                "lineId": "to-rhe",
                "park": false,
                "through": true
              },
              {
                "id": "s-lhe",
                "kind": "path",
                "lineId": "to-lhe",
                "park": false,
                "through": true
              },
              {
                "id": "s-lflower",
                "kind": "path",
                "lineId": "to-lflower",
                "park": false
              },
              {
                "id": "full-left",
                "kind": "firstOf",
                "label": "Collect at LEFT_FLOWER",
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
                "id": "s-lshot",
                "kind": "path",
                "lineId": "to-lshot",
                "park": false
              },
              {
                "id": "tip-back",
                "kind": "firstOf",
                "label": "Did it tip back?",
                "rows": [
                  {
                    "when": [
                      "Tip"
                    ],
                    "label": "Tipped back",
                    "cards": [
                      {
                        "id": "s-lpark",
                        "kind": "path",
                        "lineId": "lshot-park",
                        "park": true
                      }
                    ]
                  },
                  {
                    "afterMs": 4000,
                    "label": "No tip back",
                    "cards": [
                      {
                        "id": "s-wflower",
                        "kind": "path",
                        "lineId": "to-wflower",
                        "park": false
                      },
                      {
                        "id": "full-wall",
                        "kind": "firstOf",
                        "label": "Collect at YOUR_WALL_FLOWER",
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
                        "id": "s-wshot",
                        "kind": "path",
                        "lineId": "to-wshot",
                        "park": false
                      },
                      {
                        "id": "launch-wall",
                        "kind": "action",
                        "name": "LaunchAll"
                      },
                      {
                        "id": "s-wpark",
                        "kind": "path",
                        "lineId": "wshot-park",
                        "park": true
                      }
                    ]
                  }
                ],
                "alongside": "LaunchAll"
              }
            ]
          },
          {
            "afterMs": 4000,
            "label": "Not tipped",
            "cards": [
              {
                "id": "s-garden",
                "kind": "path",
                "lineId": "to-garden",
                "park": false
              },
              {
                "id": "full-garden",
                "kind": "firstOf",
                "label": "Collect in the GARDEN",
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
                "id": "s-rshot",
                "kind": "path",
                "lineId": "to-rshot",
                "park": false
              },
              {
                "id": "retry-tip",
                "kind": "firstOf",
                "label": "Did it tip this time?",
                "rows": [
                  {
                    "when": [
                      "Tip"
                    ],
                    "label": "Tipped on the retry",
                    "cards": [
                      {
                        "id": "rejoin-left",
                        "kind": "rejoin",
                        "lineId": "rshot-lflower",
                        "target": "s-lflower"
                      }
                    ]
                  },
                  {
                    "afterMs": 4000,
                    "label": "Retry fails",
                    "cards": [
                      {
                        "id": "s-rpark",
                        "kind": "path",
                        "lineId": "rshot-park",
                        "park": true
                      }
                    ]
                  }
                ],
                "alongside": "LaunchAll"
              }
            ]
          }
        ],
        "alongside": "LaunchAll"
      }
    ]
  },
  "version": "1.5.0"
}