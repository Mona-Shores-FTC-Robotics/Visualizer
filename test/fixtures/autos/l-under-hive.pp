{
  "version": "2.0.0",
  "timestamp": "2026-11-16T23:21:41.183Z",
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
        "x": 61.9,
        "y": 120.4
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 270,
        "endDeg": 268.1
      }
    },
    {
      "id": "l-left-abort-park",
      "color": "#4e79a7",
      "name": "left abort park to LEFT_PARK",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 14.5,
        "y": 117.4
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 268.1,
        "endDeg": 360
      }
    },
    {
      "id": "link-1",
      "name": "Link (never driven)",
      "color": "#6b7280",
      "kind": "atomic",
      "endPoint": {
        "x": 61.9,
        "y": 120.4
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 268.1
      }
    },
    {
      "id": "l-early-garden",
      "color": "#4e79a7",
      "name": "early garden to GARDEN_STAGING",
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
        "type": "constant",
        "degrees": 270
      }
    },
    {
      "id": "l-garden-abort-park",
      "color": "#4e79a7",
      "name": "garden abort park to LEFT_PARK",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 14.5,
        "y": 117.4
      },
      "controlPoints": [
        {
          "x": 40,
          "y": 20
        },
        {
          "x": 68,
          "y": 18
        },
        {
          "x": 62,
          "y": 50
        },
        {
          "x": 68,
          "y": 80
        },
        {
          "x": 66,
          "y": 105
        },
        {
          "x": 62,
          "y": 122
        },
        {
          "x": 40,
          "y": 122
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.12,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 270,
                "endDeg": 360
              }
            },
            {
              "startProgress": 0.12,
              "endProgress": 0.26,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 0,
                "endDeg": 90
              }
            },
            {
              "startProgress": 0.26,
              "endProgress": 0.7,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 90
              }
            },
            {
              "startProgress": 0.7,
              "endProgress": 0.9,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 90,
                "endDeg": 0
              }
            },
            {
              "startProgress": 0.9,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 0
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
      "id": "l-garden-exit",
      "color": "#4e79a7",
      "name": "garden exit to RIGHT_AUTO_HIVE",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 59.2,
        "y": 20.9
      },
      "controlPoints": [],
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
                "endDeg": 360
              }
            },
            {
              "startProgress": 0.5,
              "endProgress": 1,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 0,
                "endDeg": 96.1
              }
            }
          ]
        }
      }
    },
    {
      "id": "l-under-hive-park",
      "color": "#4e79a7",
      "name": "under hive park to LEFT_PARK",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 14.5,
        "y": 117.4
      },
      "controlPoints": [
        {
          "x": 60,
          "y": 50
        },
        {
          "x": 66,
          "y": 80
        },
        {
          "x": 65,
          "y": 105
        },
        {
          "x": 62,
          "y": 122
        },
        {
          "x": 40,
          "y": 122
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.1,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 96.1,
                "endDeg": 90
              }
            },
            {
              "startProgress": 0.1,
              "endProgress": 0.62,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 90
              }
            },
            {
              "startProgress": 0.62,
              "endProgress": 0.86,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 90,
                "endDeg": 0
              }
            },
            {
              "startProgress": 0.86,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 0
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
        "x": 61.9,
        "y": 120.4
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 268.1
      }
    },
    {
      "id": "l-to-wall-flower",
      "color": "#4e79a7",
      "name": "under hive to WALL_FLOWER_STAGING",
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
          "x": 60,
          "y": 100
        },
        {
          "x": 70,
          "y": 66
        },
        {
          "x": 66,
          "y": 10
        },
        {
          "x": 38,
          "y": 24
        },
        {
          "x": 34,
          "y": 47.2
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.8,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 270
              }
            },
            {
              "startProgress": 0.8,
              "endProgress": 1,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 270,
                "endDeg": 180
              }
            }
          ]
        }
      }
    },
    {
      "id": "l-flower-abort-park",
      "color": "#4e79a7",
      "name": "wall flower abort park to LEFT_PARK",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 14.5,
        "y": 117.4
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
          "y": 117.4
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
                "endDeg": 0
              }
            },
            {
              "startProgress": 0.8,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 0
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
      "id": "l-flower-exit",
      "color": "#4e79a7",
      "name": "wall flower exit to RIGHT_AUTO_HIVE",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 59.2,
        "y": 20.9
      },
      "controlPoints": [
        {
          "x": 34,
          "y": 40
        },
        {
          "x": 48,
          "y": 27
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.6,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 180,
                "endDeg": 360
              }
            },
            {
              "startProgress": 0.6,
              "endProgress": 1,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 0,
                "endDeg": 96.1
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
        "x": 14.5,
        "y": 117.4
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": -90
      }
    },
    {
      "id": "l-link-left",
      "color": "#4e79a7",
      "name": "Link to LEFT_AUTO_HIVE",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 59.9,
        "y": 116.2
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 0,
        "endDeg": 270
      }
    },
    {
      "id": "link-6",
      "name": "Link (never driven)",
      "color": "#6b7280",
      "kind": "atomic",
      "endPoint": {
        "x": 14.5,
        "y": 117.4
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": -90
      }
    },
    {
      "id": "l-link-garden",
      "color": "#76b7b2",
      "name": "Link to GARDEN_STAGING",
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
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 0,
        "endDeg": 270
      }
    },
    {
      "id": "link-7",
      "name": "Link (never driven)",
      "color": "#6b7280",
      "kind": "atomic",
      "endPoint": {
        "x": 14.5,
        "y": 117.4
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": -90
      }
    },
    {
      "id": "l-link-left-flower",
      "color": "#4e79a7",
      "name": "Link to LEFT_AUTO_HIVE",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 59.9,
        "y": 116.2
      },
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 0,
        "endDeg": 270
      }
    },
    {
      "id": "link-8",
      "name": "Link (never driven)",
      "color": "#6b7280",
      "kind": "atomic",
      "endPoint": {
        "x": 59.2,
        "y": 20.9
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 180
      }
    },
    {
      "id": "l-link-flower",
      "color": "#4e79a7",
      "name": "Link to WALL_FLOWER_STAGING",
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
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 0,
        "endDeg": 180
      }
    }
  ],
  "shapes": [
    {
      "id": "biobuzz-red-hive",
      "name": "Red HIVE",
      "vertices": [
        {
          "x": 46,
          "y": 50
        },
        {
          "x": 48.6,
          "y": 50
        },
        {
          "x": 48.6,
          "y": 91.4
        },
        {
          "x": 46,
          "y": 91.4
        }
      ],
      "color": "#dc2626",
      "fillColor": "#ff6b6b"
    },
    {
      "id": "biobuzz-blue-hive",
      "name": "Blue HIVE",
      "vertices": [
        {
          "x": 96.5,
          "y": 91.4
        },
        {
          "x": 93.9,
          "y": 91.4
        },
        {
          "x": 93.9,
          "y": 50
        },
        {
          "x": 96.5,
          "y": 50
        }
      ],
      "color": "#2563eb",
      "fillColor": "#60a5fa"
    },
    {
      "id": "biobuzz-flower-top",
      "name": "Scoring-Side FLOWER",
      "vertices": [
        {
          "x": 43.4,
          "y": 141.5
        },
        {
          "x": 50.1,
          "y": 141.5
        },
        {
          "x": 50.1,
          "y": 139.4
        },
        {
          "x": 46.75,
          "y": 137.7
        },
        {
          "x": 43.4,
          "y": 139.4
        }
      ],
      "color": "#dc2626",
      "fillColor": "#ff6b6b"
    },
    {
      "id": "biobuzz-flower-right",
      "name": "Blue Alliance FLOWER",
      "vertices": [
        {
          "x": 141.5,
          "y": 98.1
        },
        {
          "x": 139.4,
          "y": 98.1
        },
        {
          "x": 137.7,
          "y": 94.75
        },
        {
          "x": 139.4,
          "y": 91.4
        },
        {
          "x": 141.5,
          "y": 91.4
        }
      ],
      "color": "#2563eb",
      "fillColor": "#60a5fa"
    },
    {
      "id": "biobuzz-flower-bottom",
      "name": "Audience-Side FLOWER",
      "vertices": [
        {
          "x": 91.15,
          "y": 0
        },
        {
          "x": 97.8,
          "y": 0
        },
        {
          "x": 97.8,
          "y": 2.1
        },
        {
          "x": 94.5,
          "y": 3.8
        },
        {
          "x": 91.15,
          "y": 2.1
        }
      ],
      "color": "#2563eb",
      "fillColor": "#60a5fa"
    },
    {
      "id": "biobuzz-flower-left",
      "name": "Red Alliance FLOWER",
      "vertices": [
        {
          "x": 0,
          "y": 50.35
        },
        {
          "x": 2.1,
          "y": 50.35
        },
        {
          "x": 3.8,
          "y": 47
        },
        {
          "x": 2.1,
          "y": 43.65
        },
        {
          "x": 0,
          "y": 43.65
        }
      ],
      "color": "#dc2626",
      "fillColor": "#ff6b6b"
    }
  ],
  "sequence": [
    {
      "kind": "path",
      "lineId": "l-open"
    },
    {
      "kind": "path",
      "lineId": "l-left-abort-park"
    },
    {
      "kind": "path",
      "lineId": "link-1"
    },
    {
      "kind": "path",
      "lineId": "l-early-garden"
    },
    {
      "kind": "path",
      "lineId": "l-garden-abort-park"
    },
    {
      "kind": "path",
      "lineId": "link-2"
    },
    {
      "kind": "path",
      "lineId": "l-garden-exit"
    },
    {
      "kind": "path",
      "lineId": "l-under-hive-park"
    },
    {
      "kind": "path",
      "lineId": "link-3"
    },
    {
      "kind": "path",
      "lineId": "l-to-wall-flower"
    },
    {
      "kind": "path",
      "lineId": "l-flower-abort-park"
    },
    {
      "kind": "path",
      "lineId": "link-4"
    },
    {
      "kind": "path",
      "lineId": "l-flower-exit"
    },
    {
      "kind": "path",
      "lineId": "link-5"
    },
    {
      "kind": "path",
      "lineId": "l-link-left"
    },
    {
      "kind": "path",
      "lineId": "link-6"
    },
    {
      "kind": "path",
      "lineId": "l-link-garden"
    },
    {
      "kind": "path",
      "lineId": "link-7"
    },
    {
      "kind": "path",
      "lineId": "l-link-left-flower"
    },
    {
      "kind": "path",
      "lineId": "link-8"
    },
    {
      "kind": "path",
      "lineId": "l-link-flower"
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
        "LaunchAll": 4.5,
        "LaunchOne": 0.5,
        "SpinUp": 0.1,
        "PickFlower": 4,
        "GardenGather": 5
      }
    },
    "points": {
      "LEFT_START": [
        62.3,
        133.8,
        270
      ],
      "LEFT_AUTO_HIVE": [
        61.9,
        120.4,
        268.1
      ],
      "GARDEN_STAGING": [
        11.5,
        22.1,
        270
      ],
      "RIGHT_AUTO_HIVE": [
        59.2,
        20.9,
        96.1
      ],
      "LEFT_PARK": [
        14.5,
        117.4,
        0
      ],
      "WALL_FLOWER_STAGING": [
        23.1,
        47.2,
        180
      ]
    },
    "pathEnds": {
      "l-open": "LEFT_AUTO_HIVE",
      "l-early-garden": "GARDEN_STAGING",
      "l-garden-exit": "RIGHT_AUTO_HIVE",
      "l-under-hive-park": "LEFT_PARK",
      "l-left-abort-park": "LEFT_PARK",
      "l-garden-abort-park": "LEFT_PARK",
      "l-to-wall-flower": "WALL_FLOWER_STAGING",
      "l-flower-exit": "RIGHT_AUTO_HIVE",
      "l-flower-abort-park": "LEFT_PARK"
    },
    "cards": [
      {
        "id": "L-spin",
        "kind": "action",
        "name": "SpinUp"
      },
      {
        "id": "card-l-open",
        "kind": "path",
        "lineId": "l-open",
        "park": false
      },
      {
        "id": "L-wait-left",
        "kind": "firstOf",
        "label": "LEFT up before 9 s, otherwise park",
        "rows": [
          {
            "afterMs": 9000,
            "matchClock": true,
            "cards": [
              {
                "id": "card-l-left-abort-park",
                "kind": "path",
                "lineId": "l-left-abort-park",
                "park": true
              }
            ]
          },
          {
            "when": [
              "LeftCellUp"
            ],
            "cards": [
              {
                "id": "L-launch-preloads",
                "kind": "action",
                "name": "LaunchAll",
                "timeoutS": 1
              },
              {
                "id": "L-pickup",
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
                        "id": "card-l-early-garden",
                        "kind": "path",
                        "lineId": "l-early-garden",
                        "park": false
                      },
                      {
                        "id": "L-garden",
                        "kind": "action",
                        "name": "GardenGather",
                        "timeoutS": 5.5
                      },
                      {
                        "id": "card-l-garden-exit",
                        "kind": "path",
                        "lineId": "l-garden-exit",
                        "park": false
                      }
                    ]
                  },
                  {
                    "afterMs": 0,
                    "label": "WALL_FLOWER",
                    "cards": [
                      {
                        "id": "card-l-to-wall-flower",
                        "kind": "path",
                        "lineId": "l-to-wall-flower",
                        "park": false
                      },
                      {
                        "id": "L-pick-wall",
                        "kind": "action",
                        "name": "PickFlower",
                        "timeoutS": 4.5
                      },
                      {
                        "id": "card-l-flower-exit",
                        "kind": "path",
                        "lineId": "l-flower-exit",
                        "park": false
                      }
                    ]
                  }
                ],
                "choice": "Pickup"
              },
              {
                "id": "L-wait-right",
                "kind": "firstOf",
                "label": "RIGHT up before 22 s, otherwise park",
                "rows": [
                  {
                    "afterMs": 22000,
                    "matchClock": true,
                    "cards": [
                      {
                        "id": "card-l-under-hive-park-timeout",
                        "kind": "path",
                        "lineId": "l-under-hive-park",
                        "park": true
                      }
                    ]
                  },
                  {
                    "when": [
                      "RightCellUp"
                    ],
                    "cards": [
                      {
                        "id": "L-launch-right",
                        "kind": "action",
                        "name": "LaunchAll",
                        "timeoutS": 1
                      },
                      {
                        "id": "card-l-under-hive-park",
                        "kind": "path",
                        "lineId": "l-under-hive-park",
                        "park": true
                      }
                    ]
                  }
                ]
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
      "link-6",
      "link-7",
      "link-8"
    ],
    "parkFrom": {
      "card-l-open": "l-left-abort-park",
      "card-l-early-garden": "l-garden-abort-park",
      "card-l-garden-exit": "l-under-hive-park",
      "card-l-to-wall-flower": "l-flower-abort-park",
      "card-l-flower-exit": "l-under-hive-park"
    },
    "teamSpots": [
      "GARDEN_STAGING",
      "LEFT_AUTO_HIVE",
      "LEFT_PARK",
      "LEFT_START",
      "RIGHT_AUTO_HIVE",
      "WALL_FLOWER_STAGING"
    ],
    "exportName": "L-UnderHive"
  }
}