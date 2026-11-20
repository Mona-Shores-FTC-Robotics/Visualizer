{
  "version": "2.0.0",
  "timestamp": "2026-11-20T18:31:07.456Z",
  "startPoint": {
    "x": 55.6,
    "y": 7.7,
    "locked": false,
    "headingDeg": 90
  },
  "lines": [
    {
      "id": "line-r-clockwise-to-right-auto-hive",
      "color": "#76b7b2",
      "name": "to RIGHT_AUTO_HIVE",
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
        "type": "linear",
        "startDeg": 90,
        "endDeg": 96.1
      }
    },
    {
      "id": "r-first-pickup-flower",
      "color": "#e15759",
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
      "controlPoints": [],
      "heading": {
        "type": "linear",
        "startDeg": 96.1,
        "endDeg": 180
      }
    },
    {
      "id": "r-pickup-park-flower",
      "color": "#e15759",
      "name": "FLOWER park to RIGHT_PARK",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 14.5,
        "y": 98.7
      },
      "controlPoints": [
        {
          "x": 26,
          "y": 75
        }
      ],
      "heading": {
        "type": "linear",
        "startDeg": 180,
        "endDeg": 0
      }
    },
    {
      "id": "link-1",
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
        "degrees": 179.99999999999997
      }
    },
    {
      "id": "r-lane-north-flower",
      "color": "#e15759",
      "name": "outside lane BACKWARD from the FLOWER to LEFT_AUTO_HIVE",
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
      "controlPoints": [
        {
          "x": 26,
          "y": 72
        },
        {
          "x": 30,
          "y": 98
        },
        {
          "x": 38,
          "y": 116
        },
        {
          "x": 52,
          "y": 118
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
                "startDeg": 180,
                "endDeg": 270
              }
            },
            {
              "startProgress": 0.15,
              "endProgress": 0.82,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 270
              }
            },
            {
              "startProgress": 0.82,
              "endProgress": 1,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 270,
                "endDeg": 268.9
              }
            }
          ]
        }
      }
    },
    {
      "id": "r-catch-park",
      "color": "#e15759",
      "name": "catch park to RIGHT_PARK",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 14.5,
        "y": 98.7
      },
      "controlPoints": [
        {
          "x": 60,
          "y": 101
        },
        {
          "x": 34,
          "y": 100.6
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
                "startDeg": 268.1,
                "endDeg": 360
              }
            },
            {
              "startProgress": 0.5,
              "endProgress": 1,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 360
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
        "x": 59.2,
        "y": 20.9
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 96.10000000000002
      }
    },
    {
      "id": "r-first-pickup-garden",
      "color": "#e15759",
      "name": "to GARDEN_STAGING",
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
          "x": 46,
          "y": 22
        },
        {
          "x": 30,
          "y": 22.1
        }
      ],
      "heading": {
        "type": "linear",
        "startDeg": 96.1,
        "endDeg": 270
      }
    },
    {
      "id": "r-pickup-park-garden",
      "color": "#e15759",
      "name": "GARDEN park to RIGHT_PARK",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "compound",
      "segments": [
        {
          "id": "r-pickup-park-lane-garden",
          "color": "#76b7b2",
          "name": "",
          "locked": false,
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
              "x": 30,
              "y": 30
            },
            {
              "x": 30,
              "y": 60
            }
          ],
          "heading": {
            "type": "linear",
            "startDeg": 270,
            "endDeg": 90
          }
        },
        {
          "id": "r-pickup-park-turn-garden",
          "color": "#b07aa1",
          "name": "",
          "locked": false,
          "waitBeforeMs": 0,
          "waitAfterMs": 0,
          "waitBeforeName": "",
          "waitAfterName": "",
          "kind": "atomic",
          "endPoint": {
            "x": 14.5,
            "y": 98.7
          },
          "controlPoints": [
            {
              "x": 30,
              "y": 92
            }
          ],
          "heading": {
            "type": "linear",
            "startDeg": 90,
            "endDeg": 0
          }
        }
      ]
    },
    {
      "id": "link-3",
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
      "id": "r-lane-north-garden",
      "color": "#e15759",
      "name": "outside lane BACKWARD from the GARDEN to LEFT_AUTO_HIVE",
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
      "controlPoints": [
        {
          "x": 30,
          "y": 28
        },
        {
          "x": 27,
          "y": 70
        },
        {
          "x": 30,
          "y": 98
        },
        {
          "x": 38,
          "y": 116
        },
        {
          "x": 52,
          "y": 118
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.82,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 270
              }
            },
            {
              "startProgress": 0.82,
              "endProgress": 1,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 270,
                "endDeg": 268.9
              }
            }
          ]
        }
      }
    },
    {
      "id": "r-scoring-flower",
      "color": "#e15759",
      "name": "to SCORING_FLOWER_STAGING",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 47.2,
        "y": 119.3
      },
      "controlPoints": [],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.45,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 268.1
              }
            },
            {
              "startProgress": 0.45,
              "endProgress": 1,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 268.1,
                "endDeg": 90
              }
            }
          ]
        }
      }
    },
    {
      "id": "r-flower-park",
      "color": "#e15759",
      "name": "scoring FLOWER park to RIGHT_PARK",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 14.5,
        "y": 98.7
      },
      "controlPoints": [
        {
          "x": 40,
          "y": 100
        },
        {
          "x": 28,
          "y": 96
        }
      ],
      "heading": {
        "type": "linear",
        "startDeg": 90,
        "endDeg": 0
      }
    },
    {
      "id": "link-4",
      "name": "Link (never driven)",
      "color": "#6b7280",
      "kind": "atomic",
      "endPoint": {
        "x": 47.2,
        "y": 119.3
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
      }
    },
    {
      "id": "r-cross-back",
      "color": "#e15759",
      "name": "BACKWARD under the HIVE from the scoring FLOWER to RIGHT_AUTO_FIX_TIP",
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
          "x": 63,
          "y": 121
        },
        {
          "x": 60,
          "y": 101.6
        },
        {
          "x": 62,
          "y": 72
        },
        {
          "x": 59.5,
          "y": 40
        }
      ],
      "heading": {
        "type": "constant",
        "degrees": 90
      }
    },
    {
      "id": "r-right-park",
      "color": "#e15759",
      "name": "outside lane to RIGHT_PARK",
      "locked": false,
      "waitBeforeMs": 0,
      "waitAfterMs": 0,
      "waitBeforeName": "",
      "waitAfterName": "",
      "kind": "atomic",
      "endPoint": {
        "x": 14.5,
        "y": 98.7
      },
      "controlPoints": [
        {
          "x": 44,
          "y": 30
        },
        {
          "x": 30,
          "y": 36
        },
        {
          "x": 30,
          "y": 80
        }
      ],
      "heading": {
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.7,
              "interpolationType": "constant",
              "parameters": {
                "degrees": 90
              }
            },
            {
              "startProgress": 0.7,
              "endProgress": 1,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 90,
                "endDeg": 0
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
        "x": 47.2,
        "y": 119.3
      },
      "controlPoints": [],
      "heading": {
        "type": "constant",
        "degrees": 90
      }
    },
    {
      "id": "r-to-catch",
      "color": "#e15759",
      "name": "turn to LEFT_AUTO_HIVE",
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
        "type": "piecewise",
        "piecewiseHeading": {
          "segments": [
            {
              "startProgress": 0,
              "endProgress": 0.4,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 450,
                "endDeg": 360
              }
            },
            {
              "startProgress": 0.4,
              "endProgress": 1,
              "interpolationType": "linear",
              "parameters": {
                "startDeg": 360,
                "endDeg": 268.9
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
      "lineId": "line-r-clockwise-to-right-auto-hive"
    },
    {
      "kind": "path",
      "lineId": "r-first-pickup-flower"
    },
    {
      "kind": "path",
      "lineId": "r-pickup-park-flower"
    },
    {
      "kind": "path",
      "lineId": "link-1"
    },
    {
      "kind": "path",
      "lineId": "r-lane-north-flower"
    },
    {
      "kind": "path",
      "lineId": "r-catch-park"
    },
    {
      "kind": "path",
      "lineId": "link-2"
    },
    {
      "kind": "path",
      "lineId": "r-first-pickup-garden"
    },
    {
      "kind": "path",
      "lineId": "r-pickup-park-lane-garden"
    },
    {
      "kind": "path",
      "lineId": "r-pickup-park-turn-garden"
    },
    {
      "kind": "path",
      "lineId": "link-3"
    },
    {
      "kind": "path",
      "lineId": "r-lane-north-garden"
    },
    {
      "kind": "path",
      "lineId": "r-scoring-flower"
    },
    {
      "kind": "path",
      "lineId": "r-flower-park"
    },
    {
      "kind": "path",
      "lineId": "link-4"
    },
    {
      "kind": "path",
      "lineId": "r-cross-back"
    },
    {
      "kind": "path",
      "lineId": "r-right-park"
    },
    {
      "kind": "path",
      "lineId": "link-5"
    },
    {
      "kind": "path",
      "lineId": "r-to-catch"
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
        "LaunchAll": 2.5,
        "LaunchOne": 0.5,
        "SpinUp": 0.1,
        "PickFlower": 4,
        "GardenGather": 3
      }
    },
    "points": {
      "RIGHT_START": [
        55.6,
        7.7,
        90
      ],
      "WALL_FLOWER_STAGING": [
        23.1,
        47.2,
        180
      ],
      "GARDEN_STAGING": [
        11.5,
        22.1,
        270
      ],
      "LEFT_AUTO_HIVE": [
        61.4,
        120.45,
        268.9
      ],
      "SCORING_FLOWER_STAGING": [
        47.2,
        119.3,
        90
      ],
      "RIGHT_AUTO_FIX_TIP": [
        55.3,
        25.7,
        90
      ],
      "RIGHT_PARK": [
        14.5,
        98.7,
        0
      ],
      "RIGHT_AUTO_HIVE": [
        59.2,
        20.9,
        96.1
      ]
    },
    "pathEnds": {
      "r-first-pickup-flower": "WALL_FLOWER_STAGING",
      "r-pickup-park-flower": "RIGHT_PARK",
      "r-first-pickup-garden": "GARDEN_STAGING",
      "r-pickup-park-turn-garden": "RIGHT_PARK",
      "r-scoring-flower": "SCORING_FLOWER_STAGING",
      "r-flower-park": "RIGHT_PARK",
      "r-to-catch": "LEFT_AUTO_HIVE",
      "r-lane-north-flower": "LEFT_AUTO_HIVE",
      "r-lane-north-garden": "LEFT_AUTO_HIVE",
      "r-catch-park": "RIGHT_PARK",
      "r-right-park": "RIGHT_PARK",
      "line-r-clockwise-to-right-auto-hive": "RIGHT_AUTO_HIVE",
      "r-cross-back": "RIGHT_AUTO_FIX_TIP"
    },
    "cards": [
      {
        "id": "r-spin",
        "kind": "action",
        "name": "SpinUp"
      },
      {
        "id": "c-r-clockwise-to-right-auto-hive",
        "kind": "path",
        "lineId": "line-r-clockwise-to-right-auto-hive",
        "park": false
      },
      {
        "id": "r-launch-preloads",
        "kind": "action",
        "name": "LaunchAll"
      },
      {
        "id": "r-pickup",
        "kind": "firstOf",
        "label": "Pickup: WALL_FLOWER or GARDEN",
        "rows": [
          {
            "when": [
              "Pickup"
            ],
            "label": "WALL_FLOWER",
            "cards": [
              {
                "id": "r-c-pickup-flower",
                "kind": "path",
                "lineId": "r-first-pickup-flower",
                "park": false
              },
              {
                "id": "r-grab-1-flower",
                "kind": "action",
                "name": "PickFlower",
                "timeoutS": 4.5
              },
              {
                "id": "r-hold-lane-flower",
                "kind": "firstOf",
                "label": "L clear of LEFT_AUTO_HIVE: go at 9.8 s",
                "rows": [
                  {
                    "afterMs": 9800,
                    "matchClock": true,
                    "cards": []
                  }
                ]
              },
              {
                "id": "r-c-lane-flower",
                "kind": "path",
                "lineId": "r-lane-north-flower",
                "park": false
              }
            ]
          },
          {
            "afterMs": 0,
            "label": "GARDEN",
            "cards": [
              {
                "id": "r-c-pickup-garden",
                "kind": "path",
                "lineId": "r-first-pickup-garden",
                "park": false
              },
              {
                "id": "r-grab-1-garden",
                "kind": "action",
                "name": "GardenGather",
                "timeoutS": 5.5
              },
              {
                "id": "r-hold-lane-garden",
                "kind": "firstOf",
                "label": "L clear of LEFT_AUTO_HIVE: go at 9.9 s",
                "rows": [
                  {
                    "afterMs": 9900,
                    "matchClock": true,
                    "cards": []
                  }
                ]
              },
              {
                "id": "r-c-lane-garden",
                "kind": "path",
                "lineId": "r-lane-north-garden",
                "park": false
              }
            ]
          }
        ],
        "choice": "Pickup"
      },
      {
        "id": "r-stop-2",
        "kind": "firstOf",
        "label": "R2: LEFT up by 15.5 s, otherwise park",
        "rows": [
          {
            "when": [
              "LeftCellUp"
            ],
            "cards": [
              {
                "id": "r-launch-left",
                "kind": "action",
                "name": "LaunchAll",
                "timeoutS": 1
              },
              {
                "id": "r-gate-flower",
                "kind": "firstOf",
                "label": "Time for the scoring FLOWER: before 17.6 s",
                "rows": [
                  {
                    "afterMs": 17600,
                    "matchClock": true,
                    "cards": [
                      {
                        "id": "r-c-left-park-s",
                        "kind": "path",
                        "lineId": "r-catch-park",
                        "park": true
                      }
                    ]
                  },
                  {
                    "when": [
                      "Always"
                    ],
                    "cards": [
                      {
                        "id": "r-c-flower",
                        "kind": "path",
                        "lineId": "r-scoring-flower",
                        "park": false
                      },
                      {
                        "id": "r-grab-2",
                        "kind": "action",
                        "name": "PickFlower",
                        "timeoutS": 4.5
                      },
                      {
                        "id": "r-priority",
                        "kind": "firstOf",
                        "label": "Priority: THREE_TIP or PARK",
                        "rows": [
                          {
                            "when": [
                              "Priority"
                            ],
                            "label": "THREE_TIP",
                            "cards": [
                              {
                                "id": "r-gate-cross",
                                "kind": "firstOf",
                                "label": "Time to cross: before 21.5 s",
                                "rows": [
                                  {
                                    "afterMs": 21500,
                                    "matchClock": true,
                                    "cards": [
                                      {
                                        "id": "r-c-flower-park-t",
                                        "kind": "path",
                                        "lineId": "r-flower-park",
                                        "park": true
                                      }
                                    ]
                                  },
                                  {
                                    "when": [
                                      "Always"
                                    ],
                                    "cards": [
                                      {
                                        "id": "r-c-cross-back",
                                        "kind": "path",
                                        "lineId": "r-cross-back",
                                        "park": false
                                      },
                                      {
                                        "id": "r-stop-3t",
                                        "kind": "firstOf",
                                        "label": "RIGHT up at RIGHT_AUTO_FIX_TIP by 25.5 s, otherwise park",
                                        "rows": [
                                          {
                                            "when": [
                                              "RightCellUp"
                                            ],
                                            "cards": [
                                              {
                                                "id": "r-launch-right",
                                                "kind": "action",
                                                "name": "LaunchAll",
                                                "timeoutS": 1
                                              },
                                              {
                                                "id": "r-c-right-park",
                                                "kind": "path",
                                                "lineId": "r-right-park",
                                                "park": true
                                              }
                                            ]
                                          },
                                          {
                                            "afterMs": 25500,
                                            "matchClock": true,
                                            "cards": [
                                              {
                                                "id": "r-c-right-park-b",
                                                "kind": "path",
                                                "lineId": "r-right-park",
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
                            ]
                          },
                          {
                            "afterMs": 0,
                            "label": "PARK",
                            "cards": [
                              {
                                "id": "r-gate-left-p",
                                "kind": "firstOf",
                                "label": "Time to look at the HIVE from the left: before 22.2 s",
                                "rows": [
                                  {
                                    "afterMs": 22200,
                                    "matchClock": true,
                                    "cards": [
                                      {
                                        "id": "r-c-flower-park-p",
                                        "kind": "path",
                                        "lineId": "r-flower-park",
                                        "park": true
                                      }
                                    ]
                                  },
                                  {
                                    "when": [
                                      "Always"
                                    ],
                                    "cards": [
                                      {
                                        "id": "r-c-catch-p",
                                        "kind": "path",
                                        "lineId": "r-to-catch",
                                        "park": false
                                      },
                                      {
                                        "id": "r-stop-3-p",
                                        "kind": "firstOf",
                                        "label": "R3 RIGHT up by",
                                        "rows": [
                                          {
                                            "when": [
                                              "RightCellUp"
                                            ],
                                            "cards": [
                                              {
                                                "id": "r-hold-c-p",
                                                "kind": "firstOf",
                                                "label": "L has passed: park at 26.8 s",
                                                "rows": [
                                                  {
                                                    "afterMs": 26800,
                                                    "matchClock": true,
                                                    "cards": []
                                                  }
                                                ]
                                              },
                                              {
                                                "id": "r-c-catch-park-c-p",
                                                "kind": "path",
                                                "lineId": "r-catch-park",
                                                "park": true
                                              }
                                            ]
                                          },
                                          {
                                            "afterMs": 23200,
                                            "matchClock": true,
                                            "adjustable": true,
                                            "tip": 2,
                                            "cards": [
                                              {
                                                "id": "r-left-still-up-p",
                                                "kind": "firstOf",
                                                "label": "LEFT CELL still up?",
                                                "rows": [
                                                  {
                                                    "when": [
                                                      "LeftCellUp"
                                                    ],
                                                    "cards": [
                                                      {
                                                        "id": "r-launch-left-again-p",
                                                        "kind": "action",
                                                        "name": "LaunchAll",
                                                        "timeoutS": 1
                                                      },
                                                      {
                                                        "id": "r-hold-a-p",
                                                        "kind": "firstOf",
                                                        "label": "L has passed: park at 26.8 s",
                                                        "rows": [
                                                          {
                                                            "afterMs": 26800,
                                                            "matchClock": true,
                                                            "cards": []
                                                          }
                                                        ]
                                                      },
                                                      {
                                                        "id": "r-c-catch-park-a-p",
                                                        "kind": "path",
                                                        "lineId": "r-catch-park",
                                                        "park": true
                                                      }
                                                    ]
                                                  },
                                                  {
                                                    "afterMs": 750,
                                                    "cards": [
                                                      {
                                                        "id": "r-hold-a-skip-p",
                                                        "kind": "firstOf",
                                                        "label": "L has passed: park at 26.8 s",
                                                        "rows": [
                                                          {
                                                            "afterMs": 26800,
                                                            "matchClock": true,
                                                            "cards": []
                                                          }
                                                        ]
                                                      },
                                                      {
                                                        "id": "r-c-catch-park-a-skip-p",
                                                        "kind": "path",
                                                        "lineId": "r-catch-park",
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
                                    ]
                                  }
                                ]
                              }
                            ]
                          }
                        ],
                        "choice": "Priority"
                      }
                    ]
                  }
                ]
              }
            ]
          },
          {
            "afterMs": 15500,
            "matchClock": true,
            "cards": [
              {
                "id": "r-left-late",
                "kind": "firstOf",
                "label": "LEFT up after L's rescue? Fire at LEFT, else hold",
                "rows": [
                  {
                    "when": [
                      "LeftCellUp"
                    ],
                    "cards": [
                      {
                        "id": "r-launch-left-late",
                        "kind": "action",
                        "name": "LaunchAll",
                        "timeoutS": 1
                      }
                    ]
                  },
                  {
                    "afterMs": 26400,
                    "matchClock": true,
                    "cards": []
                  }
                ]
              },
              {
                "id": "r-hold-late",
                "kind": "firstOf",
                "label": "L has passed: park at 26.8 s",
                "rows": [
                  {
                    "afterMs": 26800,
                    "matchClock": true,
                    "cards": []
                  }
                ]
              },
              {
                "id": "r-c-left-park",
                "kind": "path",
                "lineId": "r-catch-park",
                "park": true
              }
            ]
          }
        ]
      }
    ],
    "startAt": "RIGHT_START",
    "linkPaths": [
      "link-1",
      "link-2",
      "link-3",
      "link-4",
      "link-5"
    ],
    "parkFrom": {
      "r-c-pickup-flower": "r-pickup-park-flower",
      "r-c-lane-flower": "r-catch-park",
      "r-c-pickup-garden": "r-pickup-park-garden",
      "r-c-lane-garden": "r-catch-park",
      "r-c-flower": "r-flower-park",
      "r-c-catch": "r-catch-park",
      "r-c-cross-back": "r-right-park",
      "r-c-catch-p": "r-catch-park"
    },
    "teamSpots": [
      "GARDEN_STAGING",
      "LEFT_AUTO_HIVE",
      "RIGHT_AUTO_FIX_TIP",
      "RIGHT_AUTO_HIVE",
      "RIGHT_PARK",
      "RIGHT_START",
      "SCORING_FLOWER_STAGING",
      "WALL_FLOWER_STAGING"
    ],
    "exportName": "R-Clockwise"
  }
}