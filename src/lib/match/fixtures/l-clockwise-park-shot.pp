{
  "version": "2.0.0",
  "timestamp": "2026-11-20T18:31:08.154Z",
  "startPoint": {
    "x": 62.3,
    "y": 133.8,
    "locked": false,
    "headingDeg": 270
  },
  "lines": [
    {
      "id": "l-open",
      "color": "#4e79a7",
      "name": "open to LEFT_AUTO_HIVE",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 61.4,
        "y": 120.45
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 270,
        "endDeg": 268.9
      }
    },
    {
      "id": "l-catch-park",
      "color": "#4e79a7",
      "name": "catch park to LEFT_AIMED_PARK",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 13,
        "y": 119
      },
      "controlPoints": [
        {
          "x": 55,
          "y": 119
        },
        {
          "x": 40,
          "y": 119
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.7,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 268.1,
                "endDeg": 345
              }
            },
            {
              "startProgress": 0.7,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 345
              }
            }
          ]
        }
      }
    },
    {
      "id": "link-1",
      "name": "Link (never driven)",
      "color": "#6b7280",
      "kind": "atomic",
      "endPoint": {
        "x": 61.4,
        "y": 120.45
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 268.9
      }
    },
    {
      "id": "l-pickup-garden",
      "color": "#4e79a7",
      "name": "under the HIVE to GARDEN_STAGING",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 11.5,
        "y": 22.1
      },
      "controlPoints": [
        {
          "x": 59.5,
          "y": 101.6
        },
        {
          "x": 67,
          "y": 72
        },
        {
          "x": 63,
          "y": 44
        },
        {
          "x": 60,
          "y": 18
        },
        {
          "x": 30,
          "y": 22
        }
      ],
      "heading": {
        "type": "linear",
        "startDeg": 268.9,
        "endDeg": 270
      }
    },
    {
      "id": "l-pickup-park-garden",
      "color": "#4e79a7",
      "name": "GARDEN park to LEFT_AIMED_PARK",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 13,
        "y": 119
      },
      "controlPoints": [
        {
          "x": 28,
          "y": 30
        },
        {
          "x": 34,
          "y": 60
        },
        {
          "x": 33.5,
          "y": 94
        },
        {
          "x": 33.5,
          "y": 108
        },
        {
          "x": 40,
          "y": 124
        },
        {
          "x": 34,
          "y": 119
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.35,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 270,
                "endDeg": 90
              }
            },
            {
              "startProgress": 0.35,
              "endProgress": 0.7,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 90
              }
            },
            {
              "startProgress": 0.7,
              "endProgress": 0.8,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 90,
                "endDeg": -15
              }
            },
            {
              "startProgress": 0.8,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": -15
              }
            }
          ]
        }
      }
    },
    {
      "id": "link-2",
      "name": "Link (never driven)",
      "color": "#6b7280",
      "kind": "atomic",
      "endPoint": {
        "x": 11.5,
        "y": 22.1
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 270
      }
    },
    {
      "id": "l-to-offset-garden",
      "color": "#4e79a7",
      "name": "GARDEN to RIGHT_AUTO_OFFSET",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 32.1,
        "y": 16.4
      },
      "controlPoints": [
        {
          "x": 22,
          "y": 18
        }
      ],
      "heading": {
        "type": "linear",
        "startDeg": 270,
        "endDeg": 61
      }
    },
    {
      "id": "l-park",
      "color": "#4e79a7",
      "name": "outside lane to LEFT_AIMED_PARK",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 13,
        "y": 119
      },
      "controlPoints": [
        {
          "x": 27,
          "y": 34
        },
        {
          "x": 33.5,
          "y": 66
        },
        {
          "x": 33.5,
          "y": 94
        },
        {
          "x": 33.5,
          "y": 108
        },
        {
          "x": 40,
          "y": 124
        },
        {
          "x": 34,
          "y": 119
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.15,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 61,
                "endDeg": 90
              }
            },
            {
              "startProgress": 0.15,
              "endProgress": 0.7,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 90
              }
            },
            {
              "startProgress": 0.7,
              "endProgress": 0.8,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 90,
                "endDeg": -15
              }
            },
            {
              "startProgress": 0.8,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": -15
              }
            }
          ]
        }
      }
    },
    {
      "id": "link-3",
      "name": "Link (never driven)",
      "color": "#6b7280",
      "kind": "atomic",
      "endPoint": {
        "x": 61.4,
        "y": 120.45
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 268.9
      }
    },
    {
      "id": "l-under-flower",
      "color": "#4e79a7",
      "name": "under the HIVE to LANE_END",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 60.5,
        "y": 34
      },
      "controlPoints": [
        {
          "x": 58.76832619047272,
          "y": 101.56857289931824
        },
        {
          "x": 65.20046354104544,
          "y": 71.90515781237575
        }
      ],
      "heading": {
        "type": "linear",
        "startDeg": 268.9,
        "endDeg": 270
      }
    },
    {
      "id": "l-under-park-flower",
      "color": "#4e79a7",
      "name": "lane's end park to LEFT_AIMED_PARK",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 13,
        "y": 119
      },
      "controlPoints": [
        {
          "x": 38,
          "y": 24
        },
        {
          "x": 22,
          "y": 40
        },
        {
          "x": 35,
          "y": 74
        },
        {
          "x": 33.5,
          "y": 94
        },
        {
          "x": 33.5,
          "y": 108
        },
        {
          "x": 40,
          "y": 124
        },
        {
          "x": 34,
          "y": 119
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.3,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 270,
                "endDeg": 90
              }
            },
            {
              "startProgress": 0.3,
              "endProgress": 0.74,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 90
              }
            },
            {
              "startProgress": 0.74,
              "endProgress": 0.84,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 90,
                "endDeg": -15
              }
            },
            {
              "startProgress": 0.84,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": -15
              }
            }
          ]
        }
      }
    },
    {
      "id": "link-4",
      "name": "Link (never driven)",
      "color": "#6b7280",
      "kind": "atomic",
      "endPoint": {
        "x": 60.5,
        "y": 34
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 270
      }
    },
    {
      "id": "l-pickup-flower",
      "color": "#4e79a7",
      "name": "to WALL_FLOWER_STAGING",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 23.1,
        "y": 47.2
      },
      "controlPoints": [
        {
          "x": 52,
          "y": 38
        },
        {
          "x": 36,
          "y": 38
        },
        {
          "x": 33,
          "y": 47.2
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.5,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 270,
                "endDeg": 180
              }
            },
            {
              "startProgress": 0.5,
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
      "id": "l-pickup-park-flower",
      "color": "#4e79a7",
      "name": "FLOWER park to LEFT_AIMED_PARK",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 13,
        "y": 119
      },
      "controlPoints": [
        {
          "x": 34,
          "y": 50
        },
        {
          "x": 33,
          "y": 72
        },
        {
          "x": 33.5,
          "y": 94
        },
        {
          "x": 33.5,
          "y": 108
        },
        {
          "x": 40,
          "y": 124
        },
        {
          "x": 34,
          "y": 119
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.25,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 180,
                "endDeg": 90
              }
            },
            {
              "startProgress": 0.25,
              "endProgress": 0.7,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 90
              }
            },
            {
              "startProgress": 0.7,
              "endProgress": 0.8,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 90,
                "endDeg": -15
              }
            },
            {
              "startProgress": 0.8,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": -15
              }
            }
          ]
        }
      }
    },
    {
      "id": "link-5",
      "name": "Link (never driven)",
      "color": "#6b7280",
      "kind": "atomic",
      "endPoint": {
        "x": 23.1,
        "y": 47.2
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 180
      }
    },
    {
      "id": "l-to-offset-flower",
      "color": "#4e79a7",
      "name": "FLOWER to RIGHT_AUTO_OFFSET",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 32.1,
        "y": 16.4
      },
      "controlPoints": [
        {
          "x": 28,
          "y": 38
        },
        {
          "x": 30,
          "y": 24
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.25,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 180,
                "endDeg": 270
              }
            },
            {
              "startProgress": 0.25,
              "endProgress": 0.6,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 270
              }
            },
            {
              "startProgress": 0.6,
              "endProgress": 1,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 270,
                "endDeg": 421
              }
            }
          ]
        }
      }
    },
    {
      "id": "link-6",
      "name": "Link (never driven)",
      "color": "#6b7280",
      "kind": "atomic",
      "endPoint": {
        "x": 61.4,
        "y": 120.45
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 268.9
      }
    },
    {
      "id": "l-rescue",
      "color": "#4e79a7",
      "name": "under the HIVE to RIGHT_AUTO_FIX_TIP",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 55.3,
        "y": 25.7
      },
      "controlPoints": [
        {
          "x": 59,
          "y": 101.6
        },
        {
          "x": 65,
          "y": 72
        },
        {
          "x": 58.5,
          "y": 38
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.79,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 270
              }
            },
            {
              "startProgress": 0.79,
              "endProgress": 0.885,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 270,
                "endDeg": 90
              }
            },
            {
              "startProgress": 0.885,
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
      "id": "l-rescue-park",
      "color": "#4e79a7",
      "name": "right catch park to LEFT_AIMED_PARK",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 13,
        "y": 119
      },
      "controlPoints": [
        {
          "x": 38,
          "y": 20
        },
        {
          "x": 22,
          "y": 40
        },
        {
          "x": 35,
          "y": 74
        },
        {
          "x": 33.5,
          "y": 94
        },
        {
          "x": 33.5,
          "y": 108
        },
        {
          "x": 40,
          "y": 124
        },
        {
          "x": 34,
          "y": 119
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.74,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 90
              }
            },
            {
              "startProgress": 0.74,
              "endProgress": 0.84,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 90,
                "endDeg": -15
              }
            },
            {
              "startProgress": 0.84,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": -15
              }
            }
          ]
        }
      }
    }
  ],
  "shapes": [],
  "sequence": [
    {
      "kind": "path",
      "lineId": "l-open"
    },
    {
      "kind": "path",
      "lineId": "l-catch-park"
    },
    {
      "kind": "path",
      "lineId": "link-1"
    },
    {
      "kind": "path",
      "lineId": "l-pickup-garden"
    },
    {
      "kind": "path",
      "lineId": "l-pickup-park-garden"
    },
    {
      "kind": "path",
      "lineId": "link-2"
    },
    {
      "kind": "path",
      "lineId": "l-to-offset-garden"
    },
    {
      "kind": "path",
      "lineId": "l-park"
    },
    {
      "kind": "path",
      "lineId": "link-3"
    },
    {
      "kind": "path",
      "lineId": "l-under-flower"
    },
    {
      "kind": "path",
      "lineId": "l-under-park-flower"
    },
    {
      "kind": "path",
      "lineId": "link-4"
    },
    {
      "kind": "path",
      "lineId": "l-pickup-flower"
    },
    {
      "kind": "path",
      "lineId": "l-pickup-park-flower"
    },
    {
      "kind": "path",
      "lineId": "link-5"
    },
    {
      "kind": "path",
      "lineId": "l-to-offset-flower"
    },
    {
      "kind": "path",
      "lineId": "link-6"
    },
    {
      "kind": "path",
      "lineId": "l-rescue"
    },
    {
      "kind": "path",
      "lineId": "l-rescue-park"
    }
  ],
  "fieldPoints": [],
  "robot": {
    "forwardVelocity": 75,
    "strafeVelocity": 65,
    "aVelocity": 3.141592653589793,
    "kFriction": 0.1,
    "rLength": 15.44,
    "rWidth": 16,
    "rForward": 0,
    "safetyMargin": 1,
    "maxVelocity": 50,
    "maxAcceleration": 50,
    "maxDeceleration": 50,
    "features": [
      {
        "name": "FLOWER poker",
        "length": 1.5,
        "width": 1.5,
        "forward": 8.5,
        "left": 0,
        "collides": true
      }
    ]
  },
  "activePaths": [],
  "auto": {
    "version": 1,
    "drawnFor": "RED",
    "registry": {
      "actions": [
        "LaunchAll",
        "LaunchAllAimed",
        "LaunchOne",
        "SpinUp",
        "PickFlower",
        "GardenGather"
      ],
      "conditions": [
        "Empty",
        "IntakeFull",
        "LeftCellUp",
        "RightCellUp",
        "CellUp",
        "Tip",
        "CameraBlind",
        "Always"
      ],
      "events": [
        "Tip"
      ],
      "typicalS": {
        "LaunchAll": 2.5,
        "LaunchOne": 0.5,
        "SpinUp": 0.1,
        "PickFlower": 4,
        "GardenGather": 3,
        "LaunchAllAimed": 2.5
      }
    },
    "points": {
      "LEFT_START": [
        62.3,
        133.8,
        270
      ],
      "LEFT_AUTO_HIVE": [
        61.4,
        120.45,
        268.9
      ],
      "RIGHT_AUTO_FIX_TIP": [
        55.3,
        25.7,
        90
      ],
      "GARDEN_STAGING": [
        11.5,
        22.1,
        270
      ],
      "WALL_FLOWER_STAGING": [
        23.1,
        47.2,
        180
      ],
      "LANE_END": [
        60.5,
        34,
        270
      ],
      "RIGHT_AUTO_OFFSET": [
        32.1,
        16.4,
        61
      ],
      "LEFT_AIMED_PARK": [
        13,
        119,
        345
      ]
    },
    "pathEnds": {
      "l-open": "LEFT_AUTO_HIVE",
      "l-catch-park": "LEFT_AIMED_PARK",
      "l-to-offset-garden": "RIGHT_AUTO_OFFSET",
      "l-under-flower": "LANE_END",
      "l-pickup-flower": "WALL_FLOWER_STAGING",
      "l-to-offset-flower": "RIGHT_AUTO_OFFSET",
      "l-pickup-garden": "GARDEN_STAGING",
      "l-rescue": "RIGHT_AUTO_FIX_TIP",
      "l-pickup-park-garden": "LEFT_AIMED_PARK",
      "l-park": "LEFT_AIMED_PARK",
      "l-under-park-flower": "LEFT_AIMED_PARK",
      "l-pickup-park-flower": "LEFT_AIMED_PARK",
      "l-rescue-park": "LEFT_AIMED_PARK"
    },
    "cards": [
      {
        "id": "l-spin",
        "kind": "action",
        "name": "SpinUp"
      },
      {
        "id": "l-c-open",
        "kind": "path",
        "lineId": "l-open",
        "park": false
      },
      {
        "id": "l-stop-1",
        "kind": "firstOf",
        "label": "L1 LEFT up by",
        "rows": [
          {
            "when": [
              "LeftCellUp"
            ],
            "cards": [
              {
                "id": "l-launch-left",
                "kind": "action",
                "name": "LaunchAll",
                "timeoutS": 1
              },
              {
                "id": "l-pickup",
                "kind": "firstOf",
                "label": "Pickup: GARDEN or WALL_FLOWER",
                "rows": [
                  {
                    "when": [
                      "Pickup"
                    ],
                    "label": "GARDEN",
                    "cards": [
                      {
                        "id": "l-c-pickup-garden",
                        "kind": "path",
                        "lineId": "l-pickup-garden",
                        "park": false
                      },
                      {
                        "id": "l-grab-garden",
                        "kind": "action",
                        "name": "GardenGather",
                        "timeoutS": 5.5
                      },
                      {
                        "id": "l-c-offset-garden",
                        "kind": "path",
                        "lineId": "l-to-offset-garden",
                        "park": false
                      }
                    ]
                  },
                  {
                    "afterMs": 0,
                    "label": "WALL_FLOWER",
                    "cards": [
                      {
                        "id": "l-c-under-flower",
                        "kind": "path",
                        "lineId": "l-under-flower",
                        "park": false
                      },
                      {
                        "id": "l-hold-flower",
                        "kind": "firstOf",
                        "label": "R has passed the FLOWER: go at 14.0 s",
                        "rows": [
                          {
                            "afterMs": 14000,
                            "matchClock": true,
                            "cards": []
                          }
                        ]
                      },
                      {
                        "id": "l-c-pickup-flower",
                        "kind": "path",
                        "lineId": "l-pickup-flower",
                        "park": false
                      },
                      {
                        "id": "l-grab-flower",
                        "kind": "action",
                        "name": "PickFlower",
                        "timeoutS": 4.5
                      },
                      {
                        "id": "l-c-offset-flower",
                        "kind": "path",
                        "lineId": "l-to-offset-flower",
                        "park": false
                      }
                    ]
                  }
                ],
                "choice": "Pickup"
              },
              {
                "id": "l-stop-2",
                "kind": "firstOf",
                "label": "L2: RIGHT up by 22 s, otherwise park, then fire at LEFT from the park if it is up",
                "rows": [
                  {
                    "when": [
                      "RightCellUp"
                    ],
                    "cards": [
                      {
                        "id": "l-launch-right",
                        "kind": "action",
                        "name": "LaunchAll",
                        "timeoutS": 1
                      },
                      {
                        "id": "l-hold-yes",
                        "kind": "firstOf",
                        "label": "R has left the scoring FLOWER: park at 22.7 s",
                        "rows": [
                          {
                            "afterMs": 22700,
                            "matchClock": true,
                            "cards": []
                          }
                        ]
                      },
                      {
                        "id": "l-c-park",
                        "kind": "path",
                        "lineId": "l-park",
                        "park": true
                      }
                    ]
                  },
                  {
                    "afterMs": 22000,
                    "matchClock": true,
                    "cards": [
                      {
                        "id": "l-hold-no",
                        "kind": "firstOf",
                        "label": "Park for the shot: go at 22.0 s",
                        "rows": [
                          {
                            "afterMs": 22000,
                            "matchClock": true,
                            "cards": []
                          }
                        ]
                      },
                      {
                        "id": "l-c-park-shot",
                        "kind": "path",
                        "lineId": "l-park",
                        "park": true
                      },
                      {
                        "id": "l-park-shot-check",
                        "kind": "firstOf",
                        "label": "LEFT up before 27.5 s, otherwise stay parked",
                        "rows": [
                          {
                            "afterMs": 27500,
                            "matchClock": true,
                            "cards": []
                          },
                          {
                            "when": [
                              "LeftCellUp"
                            ],
                            "cards": [
                              {
                                "id": "l-park-shot",
                                "kind": "action",
                                "name": "LaunchAllAimed",
                                "timeoutS": 4
                              }
                            ]
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          },
          {
            "afterMs": 9500,
            "matchClock": true,
            "adjustable": true,
            "tip": 1,
            "cards": [
              {
                "id": "l-c-rescue",
                "kind": "path",
                "lineId": "l-rescue",
                "park": false
              },
              {
                "id": "l-launch-rescue",
                "kind": "action",
                "name": "LaunchAll",
                "timeoutS": 1
              },
              {
                "id": "l-hold-rescue",
                "kind": "firstOf",
                "label": "R has parked from the left spot: park at 22.5 s",
                "rows": [
                  {
                    "afterMs": 22500,
                    "matchClock": true,
                    "cards": []
                  }
                ]
              },
              {
                "id": "l-c-rescue-park",
                "kind": "path",
                "lineId": "l-rescue-park",
                "park": true
              }
            ]
          }
        ]
      }
    ],
    "startAt": "LEFT_START",
    "linkPaths": [
      "link-1",
      "link-2",
      "link-3",
      "link-4",
      "link-5",
      "link-6"
    ],
    "parkFrom": {
      "l-c-offset-garden": "l-park",
      "l-c-pickup-garden": "l-pickup-park-garden",
      "l-c-under-flower": "l-under-park-flower",
      "l-c-offset-flower": "l-park",
      "l-c-pickup-flower": "l-pickup-park-flower",
      "l-c-open": "l-catch-park"
    },
    "teamSpots": [
      "GARDEN_STAGING",
      "LEFT_AUTO_HIVE",
      "LEFT_START",
      "RIGHT_AUTO_FIX_TIP",
      "RIGHT_AUTO_OFFSET",
      "WALL_FLOWER_STAGING"
    ],
    "exportName": "L-Clockwise"
  }
}